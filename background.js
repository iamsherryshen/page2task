// Background service worker: performs the Google API writes so they survive
// the popup being closed (e.g. when the first-time OAuth consent window opens).
//
// Each job is persisted to chrome.storage.session before it starts, so a write
// interrupted by service-worker termination (Chrome kills a SW whose request
// takes >5 minutes — e.g. the user leaves the first-run consent window open)
// is replayed on the next SW startup instead of being silently lost. By then
// the OAuth grant is cached, so the replay completes without another prompt.
importScripts('lib/google.js');

const JOB_PREFIX = 'job:';
const MAX_ATTEMPTS = 3;
const inFlight = new Set(); // jobs this SW instance is already running — the flush must skip them

function execute(action, args) {
  if (action === 'createTask') return GoogleApi.createTask(args);
  if (action === 'createEvent') return GoogleApi.createEvent(args);
  return Promise.reject(new Error('Unknown action: ' + action));
}

// Task lists for the popup's list selector — read-only, never queued as a job
function handleListTaskLists(sendResponse) {
  GoogleApi.listTaskLists().then(
    (data) => sendResponse({
      ok: true,
      data: { lists: (data.items || []).map((l) => ({ id: l.id, title: l.title })) },
    }),
    () => sendResponse({ ok: true, data: { lists: [] } }) // not authorized yet — fine
  );
}

// Replay jobs left over from a terminated SW. Deletes a job only after its
// write succeeds (so an interrupted replay is retried), but gives up after
// MAX_ATTEMPTS so a persistently failing job is not replayed forever.
let flushing = null;
function flushPendingJobs() {
  if (!flushing) {
    flushing = doFlush().finally(() => { flushing = null; });
  }
  return flushing;
}

async function doFlush() {
  const all = await chrome.storage.session.get(null);
  for (const key of Object.keys(all)) {
    if (!key.startsWith(JOB_PREFIX) || inFlight.has(key)) continue;
    const job = all[key];
    const attempts = (job.attempts || 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      await chrome.storage.session.remove(key);
      continue;
    }
    await chrome.storage.session.set({ [key]: { ...job, attempts } });
    try {
      await execute(job.action, job.args);
      await chrome.storage.session.remove(key);
    } catch (e) {
      // left in storage — retried on the next flush, dropped after MAX_ATTEMPTS
    }
  }
}

// First install only: open Settings, where the onboarding wizard runs until
// setup is completed or explicitly skipped. (Not on update or Chrome restart.)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  // Sent by the popup on open: opening the popup starts the SW, which is the
  // natural moment to replay anything a previous SW left unfinished.
  if (msg.action === 'flush') {
    flushPendingJobs().finally(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'listTaskLists') {
    handleListTaskLists(sendResponse);
    return true;
  }

  // Which Google account is the extension writing to? (null when not yet authorized)
  if (msg.action === 'whoami') {
    (async () => {
      try {
        const token = await GoogleApi.getToken(false);
        const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('userinfo ' + res.status);
        const j = await res.json();
        sendResponse({ ok: true, data: { email: j.email || null } });
      } catch (e) {
        sendResponse({ ok: true, data: { email: null } });
      }
    })();
    return true;
  }

  // Interactive authorization from the Settings page: opens Google's account
  // picker/consent window, then reports which account is now connected.
  // The hosted free-trial endpoint authenticates with the user's own token
  if (msg.action === 'getToken') {
    GoogleApi.getToken(false)
      .then((token) => sendResponse({ ok: true, data: { token } }))
      .catch((e) => sendResponse({ ok: false, error: (e && e.message) || 'no token' }));
    return true;
  }

  if (msg.action === 'connect') {
    (async () => {
      try {
        const token = await GoogleApi.getToken(true);
        const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const j = res.ok ? await res.json() : {};
        sendResponse({ ok: true, data: { email: j.email || null } });
      } catch (e) {
        sendResponse({ ok: false, error: { message: (e && e.message) || 'Authorization failed' } });
      }
    })();
    return true;
  }

  // Drop the cached Google authorization so the next save shows the account
  // picker again — lets the user switch to a different Google account.
  if (msg.action === 'disconnect') {
    (async () => {
      try {
        const token = await GoogleApi.getToken(false);
        try { await fetch('https://accounts.google.com/o/oauth2/revoke?token=' + encodeURIComponent(token)); } catch (e) { /* best-effort */ }
        await new Promise((r) => chrome.identity.removeCachedAuthToken({ token }, r));
      } catch (e) { /* no cached token — still clear everything below */ }
      if (chrome.identity.clearAllCachedAuthTokens) {
        await new Promise((r) => chrome.identity.clearAllCachedAuthTokens(r));
      }
      sendResponse({ ok: true, data: { done: true } });
    })();
    return true;
  }

  const key = JOB_PREFIX + Date.now() + ':' + Math.random().toString(36).slice(2);
  inFlight.add(key);

  const run = async () => {
    await chrome.storage.session.set({ [key]: { action: msg.action, args: msg.args } });
    return execute(msg.action, msg.args);
  };

  run()
    .then(
      (data) => sendResponse({ ok: true, data }),
      (e) => sendResponse({ ok: false, error: { message: (e && e.message) || 'Unknown error', code: e && e.code } })
    )
    .finally(() => {
      // The popup got a definitive answer (or the error was final) — no replay.
      inFlight.delete(key);
      return chrome.storage.session.remove(key);
    });
  return true; // keep the message channel open for the async response
});

flushPendingJobs();
