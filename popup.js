// Popup main logic
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const dateStrOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => dateStrOf(new Date());

let pageInfo = null;
let candidates = []; // unified: { title|null, dueDate|null, dueTime|null, endTime|null, matchedText|null, location|null, checked, notes }
let activeIndex = 0; // which candidate the form is currently editing
let pastedInput = false; // true when candidates came from a pasted screenshot or pasted text (not the page)
let taskLists = []; // the user's Google Tasks lists, e.g. [{id, title: 'School work'}]
let defaultEventMinutes = 30; // fallback calendar-event length; loaded from settings
let mode = 'todo'; // 'todo' | 'calendar' | 'both' — picked at the top, remembered across uses
// The last successful AI read: its source and the tab it was interpreted for.
// Switching tabs re-runs it, because To-do vs Calendar ask different questions
// of the same page (readings to finish vs sessions to attend).
let lastAiRead = null;
let modeReadyPromise = null;
let lastAnalyzedText = null; // stops the typing debounce from re-reading what a paste already read
let aiReadSeq = 0; // stamps every AI read; a read that is no longer the newest must not touch the UI
let aiReadAbort = null; // controller of the in-flight read; a newer read cancels it
// Start a new AI read: bump the sequence and cancel whatever was still running,
// so a paste right after opening the popup does not queue behind the page read
function beginAiRead() {
  if (aiReadAbort) aiReadAbort.abort();
  aiReadAbort = new AbortController();
  return { seq: ++aiReadSeq, signal: aiReadAbort.signal };
}

// ── Hosted free trial: 30 reads on our key, counted here, then the panel ──
const HOSTED_TRIAL_LIMIT = 30;
let trialPanelShown = false;
async function hostedTrialUsed() {
  const { hostedUsed } = await chrome.storage.sync.get({ hostedUsed: 0 });
  return hostedUsed;
}
function showTrialPanel() {
  trialPanelShown = true;
  $('trialPanel').classList.remove('hidden');
}
async function noteHostedSuccess() {
  const used = (await hostedTrialUsed()) + 1;
  await chrome.storage.sync.set({ hostedUsed: used });
  const left = HOSTED_TRIAL_LIMIT - used;
  if (left >= 0 && left <= 5) {
    setRelang('trialHint', () => {
      $('trialHint').textContent = I18n.t('Free trial: {n} reads left', { n: left });
    });
    $('trialHint').classList.remove('hidden');
  }
}

// Offline fallback for user-initiated reads once no AI is available
function applyLocalRules(sourceText) {
  candidates = DateParse.extractAll(sourceText, new Date(), 5).map((c) => ({
    title: titleFromSentence(c.matchedText),
    dueDate: c.dueDate,
    dueTime: c.dueTime,
    matchedText: c.matchedText,
  }));
  if (candidates.length > 1) renderCandidateChooser();
  else if (candidates.length) applyCandidate(0);
}

// Re-render closures for text set imperatively (not via data-i18n), so the
// language toggle can refresh it. setRelang registers and runs immediately.
const relangs = {};
const setRelang = (id, fn) => { relangs[id] = fn; fn(); };

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await I18n.init(); // translate the static markup before anything renders
  // Opening the popup starts the background service worker, which replays any
  // Google API write a previously terminated worker left unfinished.
  chrome.runtime.sendMessage({ action: 'flush' }, () => void chrome.runtime.lastError);

  $('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('langToggle').addEventListener('click', async () => {
    await I18n.toggle();
    Object.values(relangs).forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    setMode(mode, false); // refreshes the submit button, labels, and item cards
    if (!$('candBox').classList.contains('hidden')) renderCandidateChooser();
    loadAccount(); // re-renders the account line in the new language
  });
  $('submitBtn').addEventListener('click', onSubmit);
  document.querySelectorAll('#modeSeg .seg').forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.mode))
  );
  modeReadyPromise = chrome.storage.sync.get({ lastMode: 'todo' }).then((c) => setMode(c.lastMode, false));
  $('timeInput').addEventListener('input', updateTimeHint);
  // When the user commits a start time and there's no end yet, propose an end
  // (start + default length) so a calendar event is a period they can adjust.
  $('timeInput').addEventListener('change', () => {
    const t = $('timeInput').value;
    if (t && !$('endTimeInput').value) $('endTimeInput').value = addMinutesToTimeStr(t, preferredDurationMin());
    syncActiveCandidate();
    updateTimeHint();
  });
  $('clearTime').addEventListener('click', () => {
    $('timeInput').value = '';
    $('endTimeInput').value = '';
    syncActiveCandidate();
    updateTimeHint();
  });

  // Form edits flow back into the candidate being edited, so with several
  // checkboxes ticked every deadline keeps its own (possibly edited) values
  ['titleInput', 'dateInput', 'timeInput', 'endTimeInput', 'locationInput', 'notesInput'].forEach((id) =>
    $(id).addEventListener('input', syncActiveCandidate)
  );
  $('listSelect').addEventListener('change', () => {
    const c = candidates[activeIndex];
    if (c) c.listId = $('listSelect').value;
  });

  // Textareas grow with their content (up to a cap) so long pasted text or
  // notes can be read without scrolling inside a tiny box
  $('pasteText').addEventListener('input', () => autoGrow($('pasteText'), 180));
  $('notesInput').addEventListener('input', () => autoGrow($('notesInput'), 220));
  chrome.storage.sync.get({ defaultEventMinutes: 30 }).then((c) => {
    defaultEventMinutes = c.defaultEventMinutes || 30;
  });
  loadAccount();
  const listsPromise = loadTaskLists();

  // Screenshot or PDF input, three ways: click the drop zone (file picker),
  // paste (⌘V), or drop a file anywhere in the popup.
  $('screenshotBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
    e.target.value = ''; // allow re-picking the same file
  });
  const dz = $('importZone');
  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('dragover')));
  dz.addEventListener('click', (e) => { if (e.target === dz) $('pasteText').focus(); });

  // No "read" button: typed text analyzes itself once the user pauses (~600ms);
  // pasting analyzes immediately (images are caught by the document-level handler)
  let typeTimer = null;
  $('pasteText').addEventListener('input', () => {
    updateImportPlaceholder();
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      const v = $('pasteText').value.trim();
      if (v.length >= 8 && v !== lastAnalyzedText) extractFromText(v);
    }, 600);
  });
  $('pasteText').addEventListener('paste', (e) => {
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
    if (items.some((i) => i.type && i.type.startsWith('image/'))) return;
    setTimeout(() => {
      const v = $('pasteText').value.trim();
      if (v && v !== lastAnalyzedText) extractFromText(v);
    }, 0);
  });
  // Free-trial panel actions: the key path goes to Settings with the guide
  // open; the local path switches and reruns this read in one click.
  $('tpKey').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#get-key') });
  });
  $('tpLocal').addEventListener('click', async () => {
    await chrome.storage.sync.set({ aiProvider: 'builtin' });
    const avail = await AiExtract.builtinAvailability();
    if (avail === 'available') location.reload();
    // The model needs a download (or this Chrome cannot run it): Settings
    // shows the on-device tile with its status and the download offer
    else chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  });

  // Focus the box on open so ⌘V lands in the obvious place
  $('pasteText').focus();

  document.addEventListener('paste', (e) => {
    const img = Array.from((e.clipboardData && e.clipboardData.items) || []).find(
      (i) => i.type && (i.type.startsWith('image/') || i.type === 'application/pdf')
    );
    if (img) {
      e.preventDefault();
      handleFile(img.getAsFile());
      return;
    }
    // Plain text pasted while NOT editing a field → read it straight away.
    // (Pasting into the title/notes/text boxes keeps normal behavior.)
    const ae = document.activeElement;
    const editing = ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName);
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (!editing && text && text.trim()) {
      e.preventDefault();
      $('pasteText').value = text.trim();
      updateImportPlaceholder();
      autoGrow($('pasteText'), 180);
      extractFromText(text.trim());
    }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  // The automatic page read claims its sequence number BEFORE the first await,
  // so anything the user pastes or drops while it runs supersedes it.
  const { seq: initSeq, signal: initSignal } = beginAiRead();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (initSeq !== aiReadSeq) return; // the user already started a read — it owns the UI
  const url = (tab && tab.url) || '';
  const restricted =
    !url ||
    ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'https://chrome.google.com/webstore'].some(
      (p) => url.startsWith(p)
    );

  if (restricted) {
    showNotice("This page can't be read automatically. Fill in the fields manually.");
    applyDefaults();
    getAiConfig(); // the page is unreadable, but the free-AI setup offer must still show
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: analyzePage });
    pageInfo = (results && results[0] && results[0].result) || null;
  } catch (e) {
    pageInfo = null;
  }
  if (initSeq !== aiReadSeq) return; // superseded by a user paste/drop

  if (!pageInfo) {
    showNotice("This page can't be read automatically. Fill in the fields manually.");
    applyDefaults();
    getAiConfig(); // the page is unreadable, but the free-AI setup offer must still show
    return;
  }

  renderChip(pageInfo);
  $('titleInput').value = pageInfo.emailSubject || pageInfo.title || '';
  $('notesInput').value = pageInfo.url || '';
  if (pageInfo.kind === 'pdf') {
    showNotice("Chrome's PDF viewer doesn't let extensions read the text. Title taken from the file name.");
  }

  const sourceText = pageInfo.selectionText || pageInfo.bodyText;
  let aiRan = false;

  if (sourceText) {
    const { provider, apiKey } = await getAiConfig();
    if (initSeq !== aiReadSeq) return; // superseded by a user paste/drop
    if (provider) {
      $('aiStatusText').textContent = I18n.t('AI is reading this page…');
      $('aiStatus').classList.remove('hidden');
      document.body.classList.add('reading'); // the form appears once, with the final result
      let aiError = null;
      try {
        await listsPromise; // list names feed the AI's list suggestion
        if (modeReadyPromise) await modeReadyPromise; // the remembered tab is the intent
        const modeAtCall = mode;
        const r = await AiExtract.extract({
          text: sourceText,
          refDateISO: todayStr(),
          apiKey,
          provider,
          listNames: taskLists.length > 1 ? taskLists.map((l) => l.title) : null,
          mode: modeAtCall,
          signal: initSignal,
        });
        if (initSeq !== aiReadSeq) return; // superseded mid-read — discard this result
        candidates = (r.items || []).map((it) => ({ ...it, matchedText: null }));
        aiRan = true; // an empty answer from the AI is an answer, not a failure
        lastAiRead = {
          mode: modeAtCall,
          opts: {
            text: sourceText,
            keepSource: true,
            progress: 'AI is reading this page…',
            emptyMsg: 'Nothing to add was found on this page',
            failMsg: "Couldn't read this page",
          },
        };
        if (provider === 'hosted') noteHostedSuccess();
        if (mode !== modeAtCall) { runAi(lastAiRead.opts); return; } // tab changed mid-read
      } catch (e) {
        if (initSeq !== aiReadSeq) return;
        candidates = []; // fall back to local rules, but say so
        aiError = (e && e.message) || 'unknown error';
      }
      $('aiStatus').classList.add('hidden');
      document.body.classList.remove('reading');
      if (aiError) {
        setRelang('aiWarn', () => {
          $('aiWarn').textContent = I18n.t('AI unavailable ({err}). Using local rules.', { err: I18n.t(aiError) });
        });
        $('aiWarn').classList.remove('hidden');
      }
    }
    // Local rules only stand in when no AI answered; overriding an AI that found
    // nothing would put dates on a page that has none
    if (!candidates.length && !aiRan) {
      candidates = DateParse.extractAll(sourceText, new Date(), 5).map((c) => ({
        title: titleFromSentence(c.matchedText),
        dueDate: c.dueDate,
        dueTime: c.dueTime,
        matchedText: c.matchedText,
      }));
    }
  } else {
    getAiConfig(); // no readable text on this page — still surface the free-AI setup offer
  }

  if (candidates.length) {
    if (candidates.length > 1) renderCandidateChooser(); // checked ones become editable cards
    else applyCandidate(0);
  } else {
    if (pageInfo.kind === 'email' && sourceText) {
      showNotice('No upcoming deadline found. The dates in this email may have already passed.');
    }
    applyDefaults();
  }
  updateTimeHint();
}

// What the user is creating. Everything mode-specific hangs off this:
// which fields are visible and what the one submit button says/does.
const MODE_LABELS = {
  todo: { main: 'Add to-do', multi: 'Add {n} to-dos', sub: 'Google Tasks' },
  calendar: { main: 'Add event', multi: 'Add {n} events', sub: 'Google Calendar' },
  both: { main: 'Add both', multi: 'Add {n} to both', sub: 'Google Tasks + Calendar' },
};

function setMode(m, save = true) {
  if (!MODE_LABELS[m]) m = 'todo';
  mode = m;
  document.querySelectorAll('#modeSeg .seg').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $('timeRow').classList.toggle('hidden', m === 'todo'); // Google Tasks only stores a date anyway
  $('locationField').classList.toggle('hidden', m === 'todo'); // Tasks has no location field either
  $('listField').classList.toggle('hidden', m === 'calendar' || taskLists.length <= 1);
  $('dateLabel').textContent = I18n.t(m === 'todo' ? 'Date (optional)' : 'Date');
  renderItemCards(); // per-item cards show mode-specific fields, so rebuild them
  updateSubmitLabel();
  updateTimeHint();
  if (save) {
    chrome.storage.sync.set({ lastMode: m });
    if (lastAiRead && lastAiRead.mode !== m) runAi(lastAiRead.opts);
  }
}

// The button says how many will be created: "Add 3 events" when 3 are checked
function updateSubmitLabel() {
  const multi = !$('candBox').classList.contains('hidden');
  const n = multi ? candidates.filter((c) => c.checked).length : 1;
  const L = MODE_LABELS[mode];
  $('submitBtn').querySelector('.btn-main').textContent =
    n > 1 ? I18n.t(L.multi, { n }) : I18n.t(L.main);
  $('submitBtn').querySelector('.btn-sub').textContent = I18n.t(L.sub);
}

// Resolve how to run AI, in order of preference:
// 1. an API key the user configured (their explicit choice)
// 2. Chrome's built-in on-device AI — free, keyless, nothing leaves the device
// 3. none — callers fall back to the local date-parsing rules
async function getAiConfig() {
  const cfg = await chrome.storage.sync.get({ aiProvider: 'hosted' });
  const keys = await AiExtract.loadKeys(); // keys are local-only; loadKeys migrates old synced ones
  const keyFor = {
    gemini: keys.geminiApiKey,
    claude: keys.anthropicApiKey,
    openai: keys.openaiApiKey,
    kimi: keys.kimiApiKey,
  };
  // New installs default to the hosted free trial. Once its 30 reads are spent
  // a saved key continues silently (same quality); with nothing else set up the
  // trial panel explains the two paths instead of quietly degrading.
  let trialSpent = false;
  if (cfg.aiProvider === 'hosted') {
    if ((await hostedTrialUsed()) < HOSTED_TRIAL_LIMIT) {
      const token = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getToken' }, (resp) => {
          void chrome.runtime.lastError;
          resolve((resp && resp.ok && resp.data && resp.data.token) || null);
        });
      });
      if (token) return { provider: 'hosted', apiKey: token };
      // no Google session — fall through to whatever else is configured
    } else {
      trialSpent = true;
    }
  }
  if (cfg.aiProvider === 'builtin') {
    const avail = await AiExtract.builtinAvailability();
    if (avail === 'available') {
      if (!Object.values(keyFor).some(Boolean)) showBuiltinHintOnce(); // keyless user: one-time tip
      return { provider: 'builtin', apiKey: null };
    }
    offerBuiltinSetup(avail);
  }
  let provider = Object.prototype.hasOwnProperty.call(keyFor, cfg.aiProvider) ? cfg.aiProvider : 'gemini';
  let apiKey = keyFor[provider];
  if (!apiKey) {
    // The chosen provider has no key — fall back to any provider that does.
    const withKey = Object.keys(keyFor).find((p) => keyFor[p]);
    if (withKey) { provider = withKey; apiKey = keyFor[withKey]; }
  }
  if (apiKey) return { provider, apiKey };

  if (trialSpent) {
    // Do not silently drop to the weaker on-device model: the panel says what
    // happened and offers both paths, one click each.
    showTrialPanel();
    return { provider: null, apiKey: null };
  }

  const avail = await AiExtract.builtinAvailability();
  if (avail === 'available') {
    showBuiltinHintOnce(); // reaching here means no key is saved anywhere
    return { provider: 'builtin', apiKey: null };
  }
  offerBuiltinSetup(avail);
  showAiOffHint();
  return { provider: null, apiKey: null };
}

// One-time tip for keyless users running on the on-device model: better
// recognition is one Settings visit away. Shown once ever, click opens Settings.
let builtinHintChecked = false;
async function showBuiltinHintOnce() {
  if (builtinHintChecked) return;
  builtinHintChecked = true;
  const { builtinHintShown } = await chrome.storage.local.get({ builtinHintShown: false });
  if (builtinHintShown) return;
  await chrome.storage.local.set({ builtinHintShown: true });
  const el = $('builtinHint');
  setRelang('builtinHint', () => {
    el.textContent = I18n.t('Using the on-device AI model. For better recognition, add your own API key in Settings. Keys stay only on this computer, never visible to the developer or anyone else.');
  });
  el.classList.remove('hidden');
  el.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

// When no AI tier is active, say so instead of degrading silently — with a
// tooltip that answers the natural worries (whose key, stored where, who sees it)
let aiHintShown = false;
function showAiOffHint() {
  if (aiHintShown || builtinOfferShown) return; // the download button already offers a setup path
  aiHintShown = true;
  const el = $('aiHint');
  setRelang('aiHint', () => {
    el.textContent = I18n.t('AI is off (using basic date rules). Click to set up free AI.');
    el.title = I18n.t('Add your own AI key in Settings. Google Gemini has a free tier (no credit card needed). Your key is stored only on this computer, sent only to the AI provider, and never visible to the developer.');
  });
  el.classList.remove('hidden');
  el.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

// The on-device model needs a one-time download, and Chrome only starts it on a
// user gesture — so show a line the user can click, then reload with AI ready.
let builtinOfferShown = false;
function offerBuiltinSetup(state) {
  if (builtinOfferShown || (state !== 'downloadable' && state !== 'downloading')) return;
  builtinOfferShown = true;
  const btn = $('builtinOffer');
  let offerState = 'offer'; // 'offer' | 'downloading' | 'failed'
  setRelang('builtinOffer', () => {
    if (offerState === 'offer') {
      btn.textContent = I18n.t('Enable free AI (one-time ~2 GB download, runs on your computer)');
      btn.title = I18n.t("Chrome's built-in AI model. It runs entirely on your computer: no account, no API key, and nothing you analyze leaves your device. The model is shared by all of Chrome's AI features, so it only ever downloads once.");
    } else if (offerState === 'failed') {
      btn.textContent = I18n.t('Download failed. Click to retry.');
    } // downloading: the progress callback keeps the label fresh
  });
  btn.classList.remove('hidden');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    offerState = 'downloading';
    btn.textContent = I18n.t('Downloading on-device AI…');
    try {
      await AiExtract.ensureBuiltinReady((p) => {
        btn.textContent = I18n.t('Downloading on-device AI…') + ' ' + Math.round(p * 100) + '%';
      });
      location.reload(); // re-runs the page analysis, this time with AI
    } catch (e) {
      btn.disabled = false;
      offerState = 'failed';
      btn.textContent = I18n.t('Download failed. Click to retry.');
    }
  });
}

// Read a dropped/pasted image file, then hand it to the AI
function handleFile(file) {
  if (!file || !file.type) return;
  if (file.type === 'application/pdf') handlePdf(file);
  else handleImage(file);
}

function handleImage(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  // Retina screenshots easily exceed provider payload limits; anything wide
  // gets redrawn to a bounded JPEG first (the models don't need more pixels)
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const MAX_W = 1600;
    if (img.naturalWidth > MAX_W || file.size > 2500000) {
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dataBase64 = c.toDataURL('image/jpeg', 0.88).split(',')[1];
      extractFromImage({ mimeType: 'image/jpeg', dataBase64 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataBase64 = String(reader.result).split(',')[1];
      if (dataBase64) extractFromImage({ mimeType: file.type, dataBase64 });
    };
    reader.readAsDataURL(file);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    flashError(I18n.t('Screenshot recognition failed'));
  };
  img.src = url;
}

// PDFs go through the same vision path as screenshots: pdf.js (bundled, runs
// entirely on this machine) draws the first pages onto one tall canvas.
const MAX_PDF_PAGES = 3;

async function pdfToImage(file) {
  const pdfjs = await import(chrome.runtime.getURL('lib/vendor/pdfjs/pdf.min.mjs'));
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/vendor/pdfjs/pdf.worker.min.mjs');
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  const canvases = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const scale = 1100 / page.getViewport({ scale: 1 }).width;
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    canvases.push(c);
  }
  const gap = 16;
  const out = document.createElement('canvas');
  out.width = Math.max(...canvases.map((c) => c.width));
  out.height = canvases.reduce((h, c) => h + c.height, 0) + gap * (canvases.length - 1);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const c of canvases) { ctx.drawImage(c, 0, y); y += c.height + gap; }
  return {
    mimeType: 'image/jpeg',
    dataBase64: out.toDataURL('image/jpeg', 0.88).split(',')[1],
    truncated: doc.numPages > pages,
  };
}

async function handlePdf(file) {
  $('aiStatusText').textContent = I18n.t('Reading the PDF…');
  $('aiStatus').classList.remove('hidden');
  let image;
  try {
    image = await pdfToImage(file);
  } catch (e) {
    $('aiStatus').classList.add('hidden');
    flashError(I18n.t('Could not read this PDF. Try a screenshot of it instead.'));
    return;
  }
  await extractFromImage(image, {
    chip: 'PDF',
    progress: 'AI is reading the PDF…',
    emptyMsg: 'Nothing to add was found in this PDF',
    failMsg: 'PDF recognition failed',
  });
  if (image.truncated) showNotice('Long PDF: only the first 3 pages were read.');
}

// Shared AI flow for pasted screenshots and pasted text — reuses the candidate UI
async function runAi(opts) {
  // This user-initiated read supersedes the automatic page read and any older
  // in-flight read; stale reads see the bumped sequence and stand down.
  const { seq, signal } = beginAiRead();
  const { provider, apiKey } = await getAiConfig();
  if (seq !== aiReadSeq) return; // an even newer read started meanwhile
  if (!provider) {
    $('aiStatus').classList.add('hidden'); // a PDF read may have shown it already
    document.body.classList.remove('reading');
    if (trialPanelShown) {
      if (opts.text) {
        pastedInput = true; // notes must not borrow the current page's URL
        lastAnalyzedText = opts.text;
        $('candBox').classList.add('hidden');
        $('banner').className = 'banner hidden';
        applyLocalRules(opts.text);
      } else {
        flashError(I18n.t('Screenshots need AI. Add a key in Settings or switch to the on-device model.'));
      }
      return;
    }
    flashError(I18n.t(
      builtinOfferShown
        ? 'AI is one click away. Use the "Enable free AI" line above.'
        : 'AI recognition needs a newer Chrome (built-in AI) or an API key in Settings (the gear icon)'
    ));
    return;
  }

  if (!opts.keepSource) {
    pastedInput = true;
    setRelang('chip', () => { $('chip').textContent = I18n.t(opts.chip); });
    $('chip').classList.remove('hidden');
  }
  $('notice').classList.add('hidden');
  $('aiWarn').classList.add('hidden');
  $('banner').className = 'banner hidden';
  $('candBox').classList.add('hidden');
  updateSubmitLabel();
  renderItemCards(); // back to the single form while a new read is in flight
  $('aiStatusText').textContent = I18n.t(opts.progress || 'AI is reading…');
  $('aiStatus').classList.remove('hidden');
  document.body.classList.add('reading');

  const modeAtCall = mode;
  try {
    const r = await AiExtract.extract({
      text: opts.text,
      image: opts.image,
      refDateISO: todayStr(),
      apiKey,
      provider,
      listNames: taskLists.length > 1 ? taskLists.map((l) => l.title) : null,
      mode: modeAtCall,
      signal,
    });
    if (seq !== aiReadSeq) return; // superseded — the newer read owns the UI now
    if (provider === 'hosted') noteHostedSuccess();
    lastAiRead = { mode: modeAtCall, opts };
    if (mode !== modeAtCall) { runAi(opts); return; } // tab changed mid-read
    candidates = (r.items || []).map((it) => ({ ...it, matchedText: null }));
    if (!candidates.length) {
      flashError(I18n.t(opts.emptyMsg));
      return;
    }
    if (candidates.length > 1) renderCandidateChooser(); // checked ones become editable cards
    else applyCandidate(0);
  } catch (e) {
    if (seq !== aiReadSeq) return; // a stale error must not cover the newer result
    flashError(e && e.message ? I18n.t(e.message) : I18n.t(opts.failMsg));
  } finally {
    if (seq === aiReadSeq) {
      $('aiStatus').classList.add('hidden');
      document.body.classList.remove('reading');
    }
  }
}

// opts carry raw string keys; runAi translates them at render time so a
// language toggle mid-flow re-renders correctly
const extractFromImage = (image, over) =>
  runAi({
    image,
    chip: 'Screenshot',
    progress: 'AI is reading the screenshot…',
    emptyMsg: 'Nothing to add was found in this screenshot',
    failMsg: 'Screenshot recognition failed',
    ...(over || {}),
  });

const extractFromText = (text) => {
  lastAnalyzedText = text;
  return runAi({
    text,
    chip: 'Pasted text',
    progress: 'AI is reading the text…',
    emptyMsg: 'Nothing to add was found in this text',
    failMsg: "Couldn't read this text",
  });
};

// Preferred calendar-event length: a video's own length, else the setting
function preferredDurationMin() {
  return Math.max(15, (pageInfo && pageInfo.videoMinutes) || defaultEventMinutes);
}

// "14:30" + 90 → "16:00"; wraps within a 24h clock (calendar handles the day rollover)
function addMinutesToTimeStr(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
}

// Set the start time and the end time: the real one when it was detected,
// else a proposed one (start + preferred length); clears both when no start
function setStartTime(hhmm, end) {
  $('timeInput').value = hhmm || '';
  $('endTimeInput').value = hhmm ? (end || addMinutesToTimeStr(hhmm, preferredDurationMin())) : '';
  updateTimeHint();
}

// Turn the sentence containing a deadline into a usable task title
function titleFromSentence(s) {
  if (!s) return null;
  let t = s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,,;;。.::\-–—\s]+/, '')
    .replace(/[,,;;。.!!??\s]+$/, '');
  if (t.length > 80) t = t.slice(0, 77) + '…';
  return t || null;
}

// Let a textarea grow to fit its content, up to maxPx (then it scrolls)
function autoGrow(el, maxPx) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight + 2, maxPx) + 'px';
}

// Copy the form's current values into the candidate being edited
function syncActiveCandidate() {
  const c = candidates[activeIndex];
  if (!c) return;
  c.title = $('titleInput').value;
  c.dueDate = $('dateInput').value || null;
  c.dueTime = $('timeInput').value || null;
  c.endTime = $('endTimeInput').value || null;
  c.location = $('locationInput').value || null;
  c.notes = $('notesInput').value;
}

// The default notes for a candidate: the source URL plus the sentence it came from
function defaultNotesFor(c) {
  const lines = [];
  if (!pastedInput && pageInfo && pageInfo.url) lines.push(pageInfo.url);
  if (c.matchedText) lines.push(c.matchedText);
  return lines.join('\n');
}

function applyCandidate(i) {
  const c = candidates[i];
  if (!c) return;
  activeIndex = i;
  $('titleInput').value = c.title || (pageInfo && (pageInfo.emailSubject || pageInfo.title)) || '';
  $('dateInput').value = c.dueDate || '';
  setStartTime(c.dueTime || '', c.endTime || '');
  $('locationInput').value = c.location || ''; // real Location field — editable, sent to Calendar as such
  if (taskLists.length > 1) {
    if (!c.listId) c.listId = resolveListId(c); // AI's suggestion, else the remembered list
    if (c.listId) $('listSelect').value = c.listId;
  }
  if (c.notes === undefined) c.notes = defaultNotesFor(c);
  $('notesInput').value = c.notes;
  autoGrow($('notesInput'), 220);
  if (c.matchedText) {
    setRelang('matchedLine', () => {
      $('matchedLine').textContent = I18n.t('Detected from: “{s}”', { s: c.matchedText });
    });
    $('matchedLine').classList.remove('hidden');
  } else {
    $('matchedLine').classList.add('hidden');
  }
  updateSubmitLabel();
  updateTimeHint();
}

// The AI suggests a list NAME per candidate; resolve it to a real list id,
// else fall back to the remembered/global selection
function resolveListId(c) {
  if (taskLists.length < 2) return null;
  if (c.list) {
    const hit = taskLists.find((l) => l.title.toLowerCase() === String(c.list).toLowerCase());
    if (hit) return hit.id;
  }
  return $('listSelect').value || null;
}

function renderCandidateChooser() {
  const list = $('candList');
  list.textContent = '';
  candidates.forEach((c, i) => {
    if (typeof c.checked !== 'boolean') c.checked = i === 0; // first one preselected
    const row = document.createElement('div');
    row.className = 'cand-item';
    const main = document.createElement('div');
    main.className = 'cand-main';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'cand-check';
    cb.checked = c.checked;
    cb.title = I18n.t('Include this one when adding');
    cb.addEventListener('click', (e) => e.stopPropagation()); // avoid double-toggling via the row handler
    cb.addEventListener('change', () => {
      c.checked = cb.checked;
      updateSubmitLabel();
      renderItemCards();
    });
    main.append(cb);
    if (c.dueDate) { // undated items show just the title, no "No date" label
      const due = new Date(c.dueDate + 'T00:00:00');
      const opts = { month: 'short', day: 'numeric' };
      if (due.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'; // "Jun 1" alone would hide next-year dates
      const d = document.createElement('span');
      d.className = 'cand-date';
      d.textContent = due.toLocaleDateString(I18n.lang === 'zh' ? 'zh-CN' : 'en-US', opts) + (c.dueTime ? ' ' + c.dueTime : '');
      main.append(d);
    }
    const s = document.createElement('span');
    s.className = 'cand-snip';
    s.textContent = c.title || c.matchedText || (pageInfo && (pageInfo.emailSubject || pageInfo.title)) || '';
    main.append(s);
    row.append(main);
    // Clicking anywhere on the row toggles inclusion, same as the checkbox
    row.addEventListener('click', () => {
      cb.checked = !cb.checked;
      c.checked = cb.checked;
      updateSubmitLabel();
      renderItemCards();
    });
    list.appendChild(row);
  });
  $('candBox').classList.remove('hidden');
  updateSubmitLabel();
  renderItemCards();
}

// When deadlines are checked above, the single form is replaced by one
// editable card per checked item: every dimension is adjustable per item
function renderItemCards() {
  const wrap = $('itemCards');
  const chooserVisible = !$('candBox').classList.contains('hidden');
  const checkedList = chooserVisible ? candidates.filter((c) => c.checked) : [];
  wrap.textContent = '';
  if (!checkedList.length) {
    wrap.classList.add('hidden');
    $('formCard').classList.remove('hidden');
    return;
  }
  $('formCard').classList.add('hidden');
  checkedList.forEach((c, idx) => wrap.appendChild(buildItemCard(c, idx + 1)));
  wrap.classList.remove('hidden');
}

function cardField(labelText, inputEl) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(span, inputEl);
  return label;
}

function buildItemCard(c, n) {
  const card = document.createElement('div');
  card.className = 'item-card';

  const head = document.createElement('div');
  head.className = 'item-card-head';
  head.textContent = I18n.t('Item {n}', { n });
  card.appendChild(head);

  const title = document.createElement('input');
  title.type = 'text';
  title.value = c.title || (pageInfo && (pageInfo.emailSubject || pageInfo.title)) || '';
  title.addEventListener('input', () => { c.title = title.value; });
  card.appendChild(cardField(I18n.t('Title'), title));

  const date = document.createElement('input');
  date.type = 'date';
  date.value = c.dueDate || '';
  date.addEventListener('input', () => { c.dueDate = date.value || null; });
  card.appendChild(cardField(I18n.t(mode === 'todo' ? 'Date (optional)' : 'Date'), date));

  if (mode !== 'todo') {
    const row = document.createElement('div');
    row.className = 'row time-row';
    const start = document.createElement('input');
    start.type = 'time';
    start.value = c.dueTime || '';
    const end = document.createElement('input');
    end.type = 'time';
    end.value = c.endTime || '';
    start.addEventListener('input', () => { c.dueTime = start.value || null; });
    start.addEventListener('change', () => {
      if (start.value && !end.value) {
        end.value = addMinutesToTimeStr(start.value, preferredDurationMin());
        c.endTime = end.value;
      }
    });
    end.addEventListener('input', () => { c.endTime = end.value || null; });
    row.append(cardField(I18n.t('Start time'), start), cardField(I18n.t('End time'), end));
    card.appendChild(row);

    const loc = document.createElement('input');
    loc.type = 'text';
    loc.value = c.location || '';
    loc.addEventListener('input', () => { c.location = loc.value; });
    card.appendChild(cardField(I18n.t('Location (optional)'), loc));
  }

  if (c.notes === undefined) c.notes = defaultNotesFor(c);
  const notes = document.createElement('textarea');
  notes.rows = 2;
  notes.value = c.notes;
  notes.addEventListener('input', () => {
    c.notes = notes.value;
    autoGrow(notes, 180);
  });
  card.appendChild(cardField(I18n.t('Notes'), notes));

  if (mode !== 'calendar' && taskLists.length > 1) {
    if (!c.listId) c.listId = resolveListId(c);
    const sel = document.createElement('select');
    for (const l of taskLists) {
      const o = document.createElement('option');
      o.value = l.id;
      o.textContent = l.title;
      sel.appendChild(o);
    }
    if (c.listId) sel.value = c.listId;
    sel.addEventListener('change', () => { c.listId = sel.value; });
    card.appendChild(cardField(I18n.t('Task list'), sel));
  }
  return card;
}

function renderChip(info) {
  setRelang('chip', () => {
    $('chip').textContent =
      info.kind === 'email' ? I18n.t('Email')
      : info.kind === 'video' ? I18n.t('Video · ~{n} min long', { n: info.videoMinutes })
      : info.kind === 'pdf' ? 'PDF'
      : I18n.t('Page');
  });
  $('chip').classList.remove('hidden');
}

// When nothing was detected, make no assumptions: leave the date and time blank.
// (A blank date = an undated to-do; the user picks a date only if they want one.)
function applyDefaults() {
  /* intentionally empty — no default date or time */
}

// One quick shake of the date field: the user pressed Add on a calendar event
// without a date, and the field itself asks for one instead of a red banner.
function nudgeDate() {
  const el = $('dateInput');
  el.classList.remove('nudge');
  void el.offsetWidth; // restart the animation if it is already running
  el.classList.add('nudge');
  el.addEventListener('animationend', () => el.classList.remove('nudge'), { once: true });
  el.addEventListener('input', () => el.classList.remove('nudge'), { once: true });
}

// The user's task lists → the "Task list" selector (shown only when there are several).
// Preselects the list used last time; the AI's suggestion may override per candidate.
async function loadTaskLists() {
  try {
    const r = await callBackground('listTaskLists', {});
    taskLists = (r && r.lists) || [];
  } catch (e) {
    taskLists = [];
  }
  if (taskLists.length > 1) {
    const { lastListId } = await chrome.storage.sync.get({ lastListId: '' });
    const sel = $('listSelect');
    sel.textContent = '';
    for (const l of taskLists) {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.title;
      sel.appendChild(opt);
    }
    if (lastListId && taskLists.some((l) => l.id === lastListId)) sel.value = lastListId;
    if (mode !== 'calendar') $('listField').classList.remove('hidden');
    // Lists can arrive after the cards were drawn (e.g. pasted text was read
    // first). Redraw so every card gets its Task list selector.
    if (candidates.length > 1 && !$('candBox').classList.contains('hidden')) {
      renderCandidateChooser();
    }
  }
  return taskLists;
}

// Show which Google account the extension writes to (needs one prior authorization)
let connectedEmail = null;
function loadAccount() {
  callBackground('whoami', {}).then((r) => {
    if (r && r.email) {
      connectedEmail = r.email;
      $('accountLine').textContent = I18n.t('Saving to Google account: {email}', { email: r.email });
      $('accountLine').classList.remove('hidden');
    }
  }).catch(() => { /* not authorized yet — leave hidden */ });
}

// Open Google links in the SAME account the extension writes to,
// not whatever account the browser happens to default to
function withAccount(href) {
  if (!connectedEmail) return href;
  try {
    const u = new URL(href);
    u.searchParams.set('authuser', connectedEmail);
    return u.toString();
  } catch (e) {
    return href;
  }
}

// The placeholder is an overlay (so "upload a file" can be a real link) —
// hide it as soon as the box has content, like a native placeholder
function updateImportPlaceholder() {
  $('importPlaceholder').classList.toggle('hidden', !!$('pasteText').value);
}

function updateTimeHint() {
  // The "Tasks keeps only the date" caveat matters only when both get created
  $('timeHint').classList.toggle('hidden', mode !== 'both' || !$('timeInput').value);
}

function showNotice(key) {
  setRelang('notice', () => { $('notice').textContent = I18n.t(key); });
  $('notice').classList.remove('hidden');
}

function showSuccess(text, links) {
  const b = $('banner');
  b.className = 'banner success';
  b.textContent = text + ' ';
  links.forEach((l, i) => {
    if (i) b.appendChild(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = withAccount(l.href);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = l.text;
    b.appendChild(a);
  });
  loadAccount(); // token is fresh after a successful save — show/refresh the account line
}

function flashError(msg) {
  const b = $('banner');
  b.className = 'banner error';
  b.textContent = msg;
}

// The actual Google API write happens in the background service worker, so it
// completes even if this popup gets closed (e.g. by the first-run OAuth window).
function callBackground(action, args) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, args }, (resp) => {
      const le = chrome.runtime.lastError;
      if (le && /Receiving end does not exist/i.test(le.message || '')) {
        // The service worker never started — nothing is in flight, retrying is safe
        reject(new Error(I18n.t('Something went wrong, please try again')));
        return;
      }
      if (le || !resp) {
        reject(new Error(I18n.t('The request is still finishing in the background. Check Google Tasks/Calendar before retrying.')));
        return;
      }
      if (resp.ok) {
        resolve(resp.data);
      } else {
        reject(Object.assign(new Error(resp.error.message), { code: resp.error.code }));
      }
    });
  });
}

async function withPending(btn, fn) {
  const mainSpan = btn.querySelector('.btn-main');
  const orig = mainSpan.textContent;
  btn.disabled = true;
  mainSpan.textContent = I18n.t('Adding…');
  try {
    await fn();
  } catch (e) {
    if (e && e.code === 'SETUP_NEEDED') {
      $('actions').classList.add('hidden');
      $('setupPanel').classList.remove('hidden');
    } else {
      flashError((e && e.message) || I18n.t('Something went wrong, please try again'));
    }
  } finally {
    mainSpan.textContent = orig;
    btn.disabled = false;
  }
}

// What gets submitted when there is no candidate chooser: the form as-is
function itemFromForm() {
  return {
    title: $('titleInput').value.trim(),
    dueDate: $('dateInput').value || null,
    dueTime: $('timeInput').value || null,
    endTime: $('endTimeInput').value || null,
    location: ($('locationInput').value || '').trim() || null,
    notes: $('notesInput').value,
    listId: (taskLists.length > 1 && $('listSelect').value) || null,
  };
}

// A checked candidate, with the same fallbacks the form applies when showing one
function resolveItem(c) {
  return {
    title: (c.title || (pageInfo && (pageInfo.emailSubject || pageInfo.title)) || '').trim(),
    dueDate: c.dueDate || null,
    dueTime: c.dueTime || null,
    endTime: c.endTime || null,
    location: (c.location || '').trim() || null,
    notes: c.notes !== undefined ? c.notes : defaultNotesFor(c),
    listId: c.listId || null, // each item keeps its own task list
  };
}

// One submit button; the mode decides what gets created. With the checkbox
// list showing, every checked deadline is created, each with its own values.
async function onSubmit() {
  const multi = !$('candBox').classList.contains('hidden') && candidates.length > 1;
  const checked = multi ? candidates.filter((c) => c.checked) : [];
  const items = checked.length ? checked.map(resolveItem) : [itemFromForm()];

  for (let i = 0; i < items.length; i++) {
    if (!items[i].title) { flashError(I18n.t('Please enter a title')); return; }
    if (mode !== 'todo' && !items[i].dueDate) {
      if (items.length > 1) {
        flashError(I18n.t('Item {i} has no date. Calendar events need one.', { i: i + 1 }));
      } else {
        // A calendar event needs a date: the field itself asks for it
        $('banner').className = 'banner hidden';
        nudgeDate();
        $('dateInput').focus();
      }
      return;
    }
  }

  await withPending($('submitBtn'), async () => {
    let added = 0;
    let lastEvent = null;
    try {
      for (const it of items) {
        lastEvent = await submitItem(it);
        added++;
      }
    } catch (e) {
      const prefix = items.length > 1 ? I18n.t('Item {i} of {total}: ', { i: added + 1, total: items.length }) : '';
      const suffix = added > 0 ? I18n.t(' ({n} already added)', { n: added }) : '';
      throw Object.assign(
        new Error(prefix + ((e && e.message) || 'Something went wrong') + suffix),
        { code: e && e.code }
      );
    }
    if (mode !== 'calendar' && items[0].listId) chrome.storage.sync.set({ lastListId: items[0].listId });

    const links = [];
    if (mode !== 'calendar') {
      const listName =
        items.length === 1 && items[0].listId && (taskLists.find((l) => l.id === items[0].listId) || {}).title;
      links.push({ text: I18n.t('Open Google Tasks') + (listName ? ' (' + listName + ')' : ''), href: 'https://tasks.google.com' });
    }
    if (mode !== 'todo') {
      links.push({ text: I18n.t('View in Calendar'), href: (items.length === 1 && lastEvent && lastEvent.htmlLink) || 'https://calendar.google.com' });
    }
    const n = items.length;
    const doneMsg =
      mode === 'todo' ? (n > 1 ? I18n.t('Added {n} to-dos to Google Tasks ✓', { n }) : I18n.t('Added to Google Tasks ✓'))
      : mode === 'calendar' ? (n > 1 ? I18n.t('Added {n} events to Google Calendar ✓', { n }) : I18n.t('Added to Google Calendar ✓'))
      : (n > 1 ? I18n.t('Added {n} items to Tasks & Calendar ✓', { n }) : I18n.t('Added to Google Tasks & Calendar ✓'));
    showSuccess(doneMsg, links);
  });
}

// Creates the task and/or event for one item, per the current mode
async function submitItem(it) {
  let taskDone = false;
  if (mode !== 'calendar') {
    await createTaskItem(it);
    taskDone = true;
  }
  if (mode !== 'todo') {
    try {
      return await createEventItem(it);
    } catch (e) {
      if (!taskDone) throw e;
      // Don't hide a half-success: the task exists even though the event failed
      throw new Error(I18n.t('The to-do was saved, but the calendar event failed: {err}', {
        err: (e && e.message) || I18n.t('Something went wrong, please try again'),
      }));
    }
  }
  return null;
}

function createTaskItem(it) {
  let notes = it.notes || '';
  if (it.dueTime) notes = notes + '\nTime ' + it.dueTime + (it.endTime ? '-' + it.endTime : ''); // Google Tasks only stores the date
  if (it.location) notes = notes + '\nLocation: ' + it.location; // Tasks has no location field — keep it in the notes
  return callBackground('createTask', { title: it.title, notes, dueDate: it.dueDate, listId: it.listId });
}

function createEventItem(it) {
  if (it.dueTime) {
    const [y, mo, d] = it.dueDate.split('-').map(Number);
    const [h, mi] = it.dueTime.split(':').map(Number);
    const start = new Date(y, mo - 1, d, h, mi);
    let end;
    if (it.endTime) {
      const [eh, em] = it.endTime.split(':').map(Number);
      end = new Date(y, mo - 1, d, eh, em);
      if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // end past midnight
    } else {
      end = new Date(start.getTime() + preferredDurationMin() * 60000);
    }
    const toLocalISO = (dt) =>
      dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':00';
    return callBackground('createEvent', {
      title: it.title, description: it.notes, allDay: false,
      startISO: toLocalISO(start), endISO: toLocalISO(end),
      location: it.location,
    });
  }
  return callBackground('createEvent', {
    title: it.title, description: it.notes, allDay: true, dateStr: it.dueDate, location: it.location,
  });
}
