// Popup main logic
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const dateStrOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => dateStrOf(new Date());

let pageInfo = null;
let candidates = []; // unified: { title|null, dueDate|null, dueTime|null, matchedText|null, location|null }
let selectedLocation = null; // location of the currently applied candidate (goes into the calendar event)
let imageMode = false; // true when the current candidates came from a pasted/dropped screenshot
let taskLists = []; // the user's Google Tasks lists, e.g. [{id, title: 'School work'}]

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Opening the popup starts the background service worker, which replays any
  // Google API write a previously terminated worker left unfinished.
  chrome.runtime.sendMessage({ action: 'flush' }, () => void chrome.runtime.lastError);

  $('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('todoBtn').addEventListener('click', onSetTodo);
  $('calBtn').addEventListener('click', onSetCalendar);
  $('timeInput').addEventListener('input', updateTimeHint);
  $('clearTime').addEventListener('click', () => {
    $('timeInput').value = '';
    updateTimeHint();
  });
  loadAccount();
  const listsPromise = loadTaskLists();

  // Screenshot input: paste (⌘V) or drag-and-drop an image anywhere in the popup
  document.addEventListener('paste', (e) => {
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find(
      (i) => i.type && i.type.startsWith('image/')
    );
    if (item) {
      e.preventDefault();
      handleImage(item.getAsFile());
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
    const cfg = await chrome.storage.sync.get({ aiProvider: 'gemini', geminiApiKey: '', anthropicApiKey: '' });
    let provider = cfg.aiProvider === 'claude' ? 'claude' : 'gemini';
    let apiKey = provider === 'gemini' ? cfg.geminiApiKey : cfg.anthropicApiKey;
    if (!apiKey) {
      // fall back to whichever provider actually has a key configured
      if (cfg.geminiApiKey) { provider = 'gemini'; apiKey = cfg.geminiApiKey; }
      else if (cfg.anthropicApiKey) { provider = 'claude'; apiKey = cfg.anthropicApiKey; }
    }
    if (apiKey) {
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
        $('aiWarn').textContent = '⚠️ AI unavailable (' + aiError + ') — using local rules';
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

// Screenshot flow: read the image, send it to the AI, reuse the normal candidate UI
function handleImage(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataBase64 = String(reader.result).split(',')[1];
    if (dataBase64) extractFromImage({ mimeType: file.type, dataBase64 });
  };
  reader.readAsDataURL(file);
}

async function extractFromImage(image) {
  const cfg = await chrome.storage.sync.get({ aiProvider: 'gemini', geminiApiKey: '', anthropicApiKey: '' });
  let provider = cfg.aiProvider === 'claude' ? 'claude' : 'gemini';
  let apiKey = provider === 'gemini' ? cfg.geminiApiKey : cfg.anthropicApiKey;
  if (!apiKey) {
    if (cfg.geminiApiKey) { provider = 'gemini'; apiKey = cfg.geminiApiKey; }
    else if (cfg.anthropicApiKey) { provider = 'claude'; apiKey = cfg.anthropicApiKey; }
  }
  if (!apiKey) {
    flashError('Screenshot recognition needs an AI key — add one in Settings (⚙️)');
    return;
  }

  imageMode = true;
  $('chip').textContent = '🖼 Screenshot';
  $('chip').classList.remove('hidden');
  $('notice').classList.add('hidden');
  $('aiWarn').classList.add('hidden');
  $('banner').className = 'banner hidden';
  $('candBox').classList.add('hidden');
  $('aiStatus').classList.remove('hidden');

  try {
    const r = await AiExtract.extract({
      image,
      refDateISO: todayStr(),
      apiKey,
      provider,
      listNames: taskLists.length > 1 ? taskLists.map((l) => l.title) : null,
    });
    candidates = (r.items || []).map((it) => ({ ...it, matchedText: null }));
    if (!candidates.length) {
      flashError('No to-do found in this screenshot');
      return;
    }
    if (candidates.length > 1) renderCandidateChooser();
    applyCandidate(0);
  } catch (e) {
    flashError((e && e.message) || 'Screenshot recognition failed');
  } finally {
    $('aiStatus').classList.add('hidden');
  }
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
  $('timeInput').value = c.dueTime || '';
  selectedLocation = c.location || null;
  if (c.list && taskLists.length > 1) {
    const hit = taskLists.find((l) => l.title.toLowerCase() === String(c.list).toLowerCase());
    if (hit) $('listSelect').value = hit.id; // AI's suggestion — user can still change it
  }
  const url = imageMode ? 'From a screenshot' : (pageInfo && pageInfo.url) || '';
  let notes = url;
  if (c.matchedText) notes += '\n' + c.matchedText;
  if (c.location) notes += '\nLocation: ' + c.location;
  $('notesInput').value = notes;
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
    info.kind === 'email' ? '📧 Email'
    : info.kind === 'video' ? '📺 Video · ~' + info.videoMinutes + ' min long'
    : info.kind === 'article' ? '📖 Article · ~' + info.readingMinutes + ' min read'
    : info.kind === 'pdf' ? '📄 PDF'
    : '🔗 Page';
  chip.textContent = label;
  chip.classList.remove('hidden');
}

// When no deadline was detected: default the date to today, leave the time
// empty (no assumptions — an empty time means an undated todo / all-day event)
function applyDefaults() {
  $('dateInput').value = todayStr();
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
    $('listField').classList.remove('hidden');
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

function updateTimeHint() {
  const show = pageInfo && pageInfo.kind === 'email' && !!$('timeInput').value;
  $('timeHint').classList.toggle('hidden', !show);
}

function showNotice(msg) {
  const n = $('notice');
  n.textContent = msg;
  n.classList.remove('hidden');
}

function showSuccess(text, href, linkText) {
  const b = $('banner');
  b.className = 'banner success';
  b.textContent = text + ' ';
  const a = document.createElement('a');
  a.href = withAccount(href);
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = linkText;
  b.appendChild(a);
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
  const todoBtn = $('todoBtn');
  const calBtn = $('calBtn');
  const mainSpan = btn.querySelector('.btn-main');
  const orig = mainSpan.textContent;
  todoBtn.disabled = calBtn.disabled = true;
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
    todoBtn.disabled = calBtn.disabled = false;
  }
}

async function onSetTodo() {
  const title = $('titleInput').value.trim();
  if (!title) { flashError('Please enter a title'); return; }

  let notes = $('notesInput').value;
  const time = $('timeInput').value;
  if (time) notes = notes + '\nDue time ' + time; // Google Tasks only stores the date

  const listId = taskLists.length > 1 ? $('listSelect').value : null;

  await withPending($('todoBtn'), async () => {
    await callBackground('createTask', { title, notes, dueDate: $('dateInput').value || null, listId });
    if (listId) chrome.storage.sync.set({ lastListId: listId });
    const listName = listId && (taskLists.find((l) => l.id === listId) || {}).title;
    showSuccess('Added to Google Tasks' + (listName ? ' (' + listName + ')' : '') + ' ✓', 'https://tasks.google.com', 'Open Google Tasks');
  });
}

async function onSetCalendar() {
  const title = $('titleInput').value.trim();
  if (!title) { flashError('Please enter a title'); return; }

  const dateStr = $('dateInput').value;
  if (!dateStr) {
    $('dateInput').classList.add('error');
    flashError('Please pick a date first');
    return;
  }
  $('dateInput').classList.remove('error');

  const time = $('timeInput').value;
  const description = $('notesInput').value;

  await withPending($('calBtn'), async () => {
    let ev;
    if (time) {
      const { defaultEventMinutes } = await chrome.storage.sync.get({ defaultEventMinutes: 30 });
      const duration = Math.max(
        15,
        (pageInfo && (pageInfo.videoMinutes || pageInfo.readingMinutes)) || defaultEventMinutes
      );
      const [y, mo, d] = dateStr.split('-').map(Number);
      const [h, mi] = time.split(':').map(Number);
      const start = new Date(y, mo - 1, d, h, mi);
      const end = new Date(start.getTime() + duration * 60000);
      const toLocalISO = (dt) =>
        dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
        'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':00';
      ev = await callBackground('createEvent', {
        title, description, allDay: false,
        startISO: toLocalISO(start), endISO: toLocalISO(end),
        location: selectedLocation,
      });
    } else {
      ev = await callBackground('createEvent', { title, description, allDay: true, dateStr, location: selectedLocation });
    }
    showSuccess('Added to Google Calendar ✓', (ev && ev.htmlLink) || 'https://calendar.google.com', 'View in Calendar');
  });
}
