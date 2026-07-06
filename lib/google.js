// Google Tasks / Google Calendar API wrapper
(function (root) {
  function getToken(interactive) {
    return new Promise((resolve, reject) => {
      const manifest = chrome.runtime.getManifest();
      const clientId = (manifest.oauth2 && manifest.oauth2.client_id) || '';
      if (clientId.includes('PASTE')) {
        reject(Object.assign(new Error('Google authorization setup required'), { code: 'SETUP_NEEDED' }));
        return;
      }
      chrome.identity.getAuthToken({ interactive: !!interactive }, (token) => {
        if (chrome.runtime.lastError || !token) {
          const detail = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'no token granted';
          reject(new Error('Google authorization failed: ' + detail));
        } else {
          resolve(token);
        }
      });
    });
  }

  async function request(method, url, body, interactive = true) {
    let token = await getToken(interactive);
    const doFetch = (tk) =>
      fetch(url, {
        method,
        headers: {
          Authorization: 'Bearer ' + tk,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

    let res = await doFetch(token);
    if (res.status === 401 || res.status === 403) {
      // Expired token (401) or missing scope (403, e.g. a permission was left
      // unchecked during consent): drop the cached token and retry exactly once.
      await new Promise((r) => chrome.identity.removeCachedAuthToken({ token }, r));
      token = await getToken(interactive);
      res = await doFetch(token);
    }
    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        if (j.error && j.error.message) detail = ': ' + j.error.message;
      } catch (e) { /* ignore parse failure */ }
      throw new Error('Save failed (error ' + res.status + detail + '), please try again');
    }
    return res.json();
  }

  const post = (url, body) => request('POST', url, body);

  // All of the user's task lists (e.g. Family / School work). Non-interactive:
  // called on popup open, must never trigger a surprise auth prompt.
  function listTaskLists() {
    return request('GET', 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=50', null, false);
  }

  function createTask({ title, notes, dueDate, listId }) {
    const body = { title, notes };
    if (dueDate) body.due = dueDate + 'T00:00:00.000Z';
    const list = encodeURIComponent(listId || '@default');
    return post('https://tasks.googleapis.com/tasks/v1/lists/' + list + '/tasks', body);
  }

  // Calendar all-day events use an EXCLUSIVE end date, so add one day
  function nextDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const nd = new Date(y, m - 1, d + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return nd.getFullYear() + '-' + pad(nd.getMonth() + 1) + '-' + pad(nd.getDate());
  }

  function createEvent({ title, description, allDay, dateStr, startISO, endISO, location }) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const body = { summary: title, description };
    if (location) body.location = location;
    if (allDay) {
      body.start = { date: dateStr };
      body.end = { date: nextDay(dateStr) };
    } else {
      body.start = { dateTime: startISO, timeZone: tz };
      body.end = { dateTime: endISO, timeZone: tz };
    }
    return post('https://www.googleapis.com/calendar/v3/calendars/primary/events', body);
  }

  root.GoogleApi = { getToken, createTask, createEvent, listTaskLists };
})(typeof globalThis !== 'undefined' ? globalThis : this);
