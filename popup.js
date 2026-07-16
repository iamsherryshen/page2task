// Popup main logic
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const dateStrOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => dateStrOf(new Date());

let pageInfo = null;
let candidates = []; // unified: { title|null, dueDate|null, dueTime|null, matchedText|null, location|null }
let pastedInput = false; // true when candidates came from a pasted screenshot or pasted text (not the page)
let taskLists = []; // the user's Google Tasks lists, e.g. [{id, title: 'School work'}]
let defaultEventMinutes = 30; // fallback calendar-event length; loaded from settings
let mode = 'todo'; // 'todo' | 'calendar' | 'both' — picked at the top, remembered across uses
let lastAnalyzedText = null; // stops the typing debounce from re-reading what a paste already read

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Opening the popup starts the background service worker, which replays any
  // Google API write a previously terminated worker left unfinished.
  chrome.runtime.sendMessage({ action: 'flush' }, () => void chrome.runtime.lastError);

  $('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('submitBtn').addEventListener('click', onSubmit);
  document.querySelectorAll('#modeSeg .seg').forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.mode))
  );
  chrome.storage.sync.get({ lastMode: 'todo' }).then((c) => setMode(c.lastMode, false));
  $('timeInput').addEventListener('input', updateTimeHint);
  // When the user commits a start time and there's no end yet, propose an end
  // (start + default length) so a calendar event is a period they can adjust.
  $('timeInput').addEventListener('change', () => {
    const t = $('timeInput').value;
    if (t && !$('endTimeInput').value) $('endTimeInput').value = addMinutesToTimeStr(t, preferredDurationMin());
    updateTimeHint();
  });
  $('clearTime').addEventListener('click', () => {
    $('timeInput').value = '';
    $('endTimeInput').value = '';
    updateTimeHint();
  });
  chrome.storage.sync.get({ defaultEventMinutes: 30 }).then((c) => {
    defaultEventMinutes = c.defaultEventMinutes || 30;
  });
  loadAccount();
  const listsPromise = loadTaskLists();

  // Screenshot input, three ways: click the drop zone (file picker), paste (⌘V),
  // or drop an image anywhere in the popup.
  $('screenshotBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleImage(f);
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
  // Focus the box on open so ⌘V lands in the obvious place
  $('pasteText').focus();

  document.addEventListener('paste', (e) => {
    const img = Array.from((e.clipboardData && e.clipboardData.items) || []).find(
      (i) => i.type && i.type.startsWith('image/')
    );
    if (img) {
      e.preventDefault();
      handleImage(img.getAsFile());
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
      extractFromText(text.trim());
    }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleImage(f);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (tab && tab.url) || '';
  const restricted =
    !url ||
    ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'https://chrome.google.com/webstore'].some(
      (p) => url.startsWith(p)
    );

  if (restricted) {
    showNotice("This page can't be read automatically — fill in the fields manually");
    applyDefaults();
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: analyzePage });
    pageInfo = (results && results[0] && results[0].result) || null;
  } catch (e) {
    pageInfo = null;
  }

  if (!pageInfo) {
    showNotice("This page can't be read automatically — fill in the fields manually");
    applyDefaults();
    return;
  }

  renderChip(pageInfo);
  $('titleInput').value = pageInfo.emailSubject || pageInfo.title || '';
  $('notesInput').value = pageInfo.url || '';
  if (pageInfo.kind === 'pdf') {
    showNotice("Chrome's PDF viewer doesn't let extensions read the text — title taken from the file name");
  }

  const sourceText = pageInfo.selectionText || pageInfo.bodyText;

  if (sourceText) {
    const { provider, apiKey } = await getAiConfig();
    if (provider) {
      $('aiStatus').classList.remove('hidden');
      let aiError = null;
      try {
        await listsPromise; // list names feed the AI's list suggestion
        const r = await AiExtract.extract({
          text: sourceText,
          refDateISO: todayStr(),
          apiKey,
          provider,
          listNames: taskLists.length > 1 ? taskLists.map((l) => l.title) : null,
        });
        candidates = (r.items || []).map((it) => ({ ...it, matchedText: null }));
      } catch (e) {
        candidates = []; // fall back to local rules, but say so
        aiError = (e && e.message) || 'unknown error';
      }
      $('aiStatus').classList.add('hidden');
      if (aiError) {
        $('aiWarn').textContent = 'AI unavailable (' + aiError + ') — using local rules';
        $('aiWarn').classList.remove('hidden');
      }
    }
    if (!candidates.length) {
      candidates = DateParse.extractAll(sourceText, new Date(), 5).map((c) => ({
        title: titleFromSentence(c.matchedText),
        dueDate: c.dueDate,
        dueTime: c.dueTime,
        matchedText: c.matchedText,
      }));
    }
  }

  if (candidates.length) {
    if (candidates.length > 1) renderCandidateChooser();
    applyCandidate(0);
  } else {
    if (pageInfo.kind === 'email' && sourceText) {
      showNotice('No upcoming deadline found — the dates in this email may have already passed');
    }
    applyDefaults();
  }
  updateTimeHint();
}

// What the user is creating. Everything mode-specific hangs off this:
// which fields are visible and what the one submit button says/does.
const MODE_LABELS = {
  todo: { main: 'Add to-do', sub: 'Google Tasks' },
  calendar: { main: 'Add event', sub: 'Google Calendar' },
  both: { main: 'Add both', sub: 'Google Tasks + Calendar' },
};

function setMode(m, save = true) {
  if (!MODE_LABELS[m]) m = 'todo';
  mode = m;
  document.querySelectorAll('#modeSeg .seg').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $('timeRow').classList.toggle('hidden', m === 'todo'); // Google Tasks only stores a date anyway
  $('locationField').classList.toggle('hidden', m === 'todo'); // Tasks has no location field either
  $('listField').classList.toggle('hidden', m === 'calendar' || taskLists.length <= 1);
  $('dateLabel').textContent = m === 'todo' ? 'Date (optional)' : 'Date';
  $('submitBtn').querySelector('.btn-main').textContent = MODE_LABELS[m].main;
  $('submitBtn').querySelector('.btn-sub').textContent = MODE_LABELS[m].sub;
  updateTimeHint();
  if (save) chrome.storage.sync.set({ lastMode: m });
}

// Resolve how to run AI, in order of preference:
// 1. an API key the user configured (their explicit choice)
// 2. Chrome's built-in on-device AI — free, keyless, nothing leaves the device
// 3. none — callers fall back to the local date-parsing rules
async function getAiConfig() {
  const cfg = await chrome.storage.sync.get({ aiProvider: 'gemini' });
  const keys = await AiExtract.loadKeys(); // keys are local-only; loadKeys migrates old synced ones
  let provider = cfg.aiProvider === 'claude' ? 'claude' : 'gemini';
  let apiKey = provider === 'gemini' ? keys.geminiApiKey : keys.anthropicApiKey;
  if (!apiKey) {
    if (keys.geminiApiKey) { provider = 'gemini'; apiKey = keys.geminiApiKey; }
    else if (keys.anthropicApiKey) { provider = 'claude'; apiKey = keys.anthropicApiKey; }
  }
  if (apiKey) return { provider, apiKey };

  const avail = await AiExtract.builtinAvailability();
  if (avail === 'available') return { provider: 'builtin', apiKey: null };
  offerBuiltinSetup(avail);
  return { provider: null, apiKey: null };
}

// The on-device model needs a one-time download, and Chrome only starts it on a
// user gesture — so show a line the user can click, then reload with AI ready.
let builtinOfferShown = false;
function offerBuiltinSetup(state) {
  if (builtinOfferShown || (state !== 'downloadable' && state !== 'downloading')) return;
  builtinOfferShown = true;
  const btn = $('builtinOffer');
  btn.textContent = 'Enable free AI — one-time ~2 GB download, runs on your computer';
  btn.classList.remove('hidden');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Downloading on-device AI…';
    try {
      await AiExtract.ensureBuiltinReady((p) => {
        btn.textContent = 'Downloading on-device AI… ' + Math.round(p * 100) + '%';
      });
      location.reload(); // re-runs the page analysis, this time with AI
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Download failed — click to retry';
    }
  });
}

// Read a dropped/pasted image file, then hand it to the AI
function handleImage(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataBase64 = String(reader.result).split(',')[1];
    if (dataBase64) extractFromImage({ mimeType: file.type, dataBase64 });
  };
  reader.readAsDataURL(file);
}

// Shared AI flow for pasted screenshots and pasted text — reuses the candidate UI
async function runAi(opts) {
  const { provider, apiKey } = await getAiConfig();
  if (!provider) {
    flashError(
      builtinOfferShown
        ? 'AI is one click away — use the "Enable free AI" line above'
        : 'AI recognition needs a newer Chrome (built-in AI) or an API key in Settings (the gear icon)'
    );
    return;
  }

  pastedInput = true;
  $('chip').textContent = opts.chip;
  $('chip').classList.remove('hidden');
  $('notice').classList.add('hidden');
  $('aiWarn').classList.add('hidden');
  $('banner').className = 'banner hidden';
  $('candBox').classList.add('hidden');
  $('aiStatus').classList.remove('hidden');

  try {
    const r = await AiExtract.extract({
      text: opts.text,
      image: opts.image,
      refDateISO: todayStr(),
      apiKey,
      provider,
      listNames: taskLists.length > 1 ? taskLists.map((l) => l.title) : null,
    });
    candidates = (r.items || []).map((it) => ({ ...it, matchedText: null }));
    if (!candidates.length) {
      flashError(opts.emptyMsg);
      return;
    }
    if (candidates.length > 1) renderCandidateChooser();
    applyCandidate(0);
  } catch (e) {
    flashError((e && e.message) || opts.failMsg);
  } finally {
    $('aiStatus').classList.add('hidden');
  }
}

const extractFromImage = (image) =>
  runAi({ image, chip: 'Screenshot', emptyMsg: 'Nothing to add was found in this screenshot', failMsg: 'Screenshot recognition failed' });

const extractFromText = (text) => {
  lastAnalyzedText = text;
  return runAi({ text, chip: 'Pasted text', emptyMsg: 'Nothing to add was found in this text', failMsg: "Couldn't read this text" });
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

// Set the start time and propose a matching end time (or clear both)
function setStartTime(hhmm) {
  $('timeInput').value = hhmm || '';
  $('endTimeInput').value = hhmm ? addMinutesToTimeStr(hhmm, preferredDurationMin()) : '';
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

function applyCandidate(i) {
  const c = candidates[i];
  if (!c) return;
  $('titleInput').value = c.title || (pageInfo && (pageInfo.emailSubject || pageInfo.title)) || '';
  $('dateInput').value = c.dueDate || '';
  setStartTime(c.dueTime || '');
  $('locationInput').value = c.location || ''; // real Location field — editable, sent to Calendar as such
  if (c.list && taskLists.length > 1) {
    const hit = taskLists.find((l) => l.title.toLowerCase() === String(c.list).toLowerCase());
    if (hit) $('listSelect').value = hit.id; // AI's suggestion — user can still change it
  }
  const lines = [];
  if (!pastedInput && pageInfo && pageInfo.url) lines.push(pageInfo.url);
  if (c.matchedText) lines.push(c.matchedText);
  $('notesInput').value = lines.join('\n');
  if (c.matchedText) {
    $('matchedLine').textContent = 'Detected from: “' + c.matchedText + '”';
    $('matchedLine').classList.remove('hidden');
  } else {
    $('matchedLine').classList.add('hidden');
  }
  document.querySelectorAll('.cand-item').forEach((el, idx) => el.classList.toggle('selected', idx === i));
  updateTimeHint();
}

function renderCandidateChooser() {
  const list = $('candList');
  list.textContent = '';
  candidates.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cand-item';
    const due = new Date(c.dueDate + 'T00:00:00');
    const opts = { month: 'short', day: 'numeric' };
    if (due.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'; // "Jun 1" alone would hide next-year dates
    const dateLabel = c.dueDate
      ? due.toLocaleDateString('en-US', opts) + (c.dueTime ? ' ' + c.dueTime : '')
      : 'No date';
    const d = document.createElement('span');
    d.className = 'cand-date';
    d.textContent = dateLabel;
    const s = document.createElement('span');
    s.className = 'cand-snip';
    s.textContent = c.title || c.matchedText || (pageInfo && (pageInfo.emailSubject || pageInfo.title)) || '';
    btn.append(d, s);
    btn.addEventListener('click', () => applyCandidate(i));
    list.appendChild(btn);
  });
  $('candBox').classList.remove('hidden');
}

function renderChip(info) {
  const chip = $('chip');
  const label =
    info.kind === 'email' ? 'Email'
    : info.kind === 'video' ? 'Video · ~' + info.videoMinutes + ' min long'
    : info.kind === 'article' ? 'Article'
    : info.kind === 'pdf' ? 'PDF'
    : 'Page';
  chip.textContent = label;
  chip.classList.remove('hidden');
}

// When nothing was detected, make no assumptions: leave the date and time blank.
// (A blank date = an undated to-do; the user picks a date only if they want one.)
function applyDefaults() {
  /* intentionally empty — no default date or time */
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
  }
  return taskLists;
}

// Show which Google account the extension writes to (needs one prior authorization)
let connectedEmail = null;
function loadAccount() {
  callBackground('whoami', {}).then((r) => {
    if (r && r.email) {
      connectedEmail = r.email;
      $('accountLine').textContent = 'Saving to Google account: ' + r.email;
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

function showNotice(msg) {
  const n = $('notice');
  n.textContent = msg;
  n.classList.remove('hidden');
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
        reject(new Error('Something went wrong, please try again'));
        return;
      }
      if (le || !resp) {
        reject(new Error('The request is still finishing in the background — check Google Tasks/Calendar before retrying'));
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
  mainSpan.textContent = 'Adding…';
  try {
    await fn();
  } catch (e) {
    if (e && e.code === 'SETUP_NEEDED') {
      $('actions').classList.add('hidden');
      $('setupPanel').classList.remove('hidden');
    } else {
      flashError((e && e.message) || 'Something went wrong, please try again');
    }
  } finally {
    mainSpan.textContent = orig;
    btn.disabled = false;
  }
}

// One submit button; the mode decides what gets created
async function onSubmit() {
  const title = $('titleInput').value.trim();
  if (!title) { flashError('Please enter a title'); return; }

  if (mode !== 'todo' && !$('dateInput').value) {
    $('dateInput').classList.add('error');
    flashError('Please pick a date first — a calendar event needs one');
    return;
  }
  $('dateInput').classList.remove('error');

  await withPending($('submitBtn'), async () => {
    const links = [];
    let taskDone = false;
    if (mode !== 'calendar') {
      const listName = await createTaskFromForm(title);
      taskDone = true;
      links.push({ text: 'Open Google Tasks' + (listName ? ' (' + listName + ')' : ''), href: 'https://tasks.google.com' });
    }
    if (mode !== 'todo') {
      let ev;
      try {
        ev = await createEventFromForm(title);
      } catch (e) {
        if (!taskDone) throw e;
        // Don't hide a half-success: the task exists even though the event failed
        throw new Error('The to-do was saved, but the calendar event failed: ' + ((e && e.message) || 'please try again'));
      }
      links.push({ text: 'View in Calendar', href: (ev && ev.htmlLink) || 'https://calendar.google.com' });
    }
    const doneMsg =
      mode === 'todo' ? 'Added to Google Tasks ✓'
      : mode === 'calendar' ? 'Added to Google Calendar ✓'
      : 'Added to Google Tasks & Calendar ✓';
    showSuccess(doneMsg, links);
  });
}

// Returns the list name the task went into (null for the default list)
async function createTaskFromForm(title) {
  let notes = $('notesInput').value;
  const start = $('timeInput').value;
  const end = $('endTimeInput').value;
  if (start) notes = notes + '\nTime ' + start + (end ? '–' + end : ''); // Google Tasks only stores the date
  const loc = $('locationInput').value.trim();
  if (loc) notes = notes + '\nLocation: ' + loc; // Tasks has no location field — keep it in the notes

  const listId = taskLists.length > 1 ? $('listSelect').value : null;
  await callBackground('createTask', { title, notes, dueDate: $('dateInput').value || null, listId });
  if (listId) chrome.storage.sync.set({ lastListId: listId });
  return (listId && (taskLists.find((l) => l.id === listId) || {}).title) || null;
}

async function createEventFromForm(title) {
  const dateStr = $('dateInput').value;
  const startTime = $('timeInput').value;
  const endTime = $('endTimeInput').value;
  const description = $('notesInput').value;
  const location = $('locationInput').value.trim() || null;

  if (startTime) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = startTime.split(':').map(Number);
    const start = new Date(y, mo - 1, d, h, mi);
    let end;
    if (endTime) {
      const [eh, em] = endTime.split(':').map(Number);
      end = new Date(y, mo - 1, d, eh, em);
      if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // end past midnight
    } else {
      end = new Date(start.getTime() + preferredDurationMin() * 60000);
    }
    const toLocalISO = (dt) =>
      dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':00';
    return callBackground('createEvent', {
      title, description, allDay: false,
      startISO: toLocalISO(start), endISO: toLocalISO(end),
      location,
    });
  }
  return callBackground('createEvent', { title, description, allDay: true, dateStr, location });
}
