// Hosted free-trial recognition for Page2Task.
//
// The extension's default "free trial" AI source calls this endpoint instead of
// carrying an API key: the OpenAI key lives only in the OPENAI_API_KEY env var
// on Vercel. Requests must carry the user's Google access token; we verify it
// belongs to THIS app (aud check) so only real Page2Task users can spend the
// budget. Nothing is logged or stored: the page text or screenshot goes to
// OpenAI for one completion and the result goes straight back.
//
// The prompt below is lifted verbatim from lib/ai.js — keep them in sync.

const CLIENT_ID = '741089829068-6eramf0ghkuvbvofb3smoaeolplcc0cb.apps.googleusercontent.com';

const MODE_HINTS = {
  todo:
    'The user asked for TO-DOS: concrete actions to complete (readings and assignments to ' +
    'finish, forms or applications to submit, registrations, replies, payments, things to ' +
    'prepare), each with its deadline. When the input pairs dates with deliverables - a ' +
    'syllabus listing readings per session, a schedule with homework per week - extract each ' +
    'deliverable as its own to-do due by that session\'s date (like "Read Lewis et al. (RAG)"), ' +
    'NOT attendance of the session itself. List the sessions themselves only when the input ' +
    'offers no such deliverables. ',
  calendar:
    'The user asked for CALENDAR EVENTS: sessions that happen at a time (classes, meetings, ' +
    'appointments, event sessions), not chores or homework. ',
  both:
    'The user asked for both to-dos and calendar events: extract the actionable to-dos with ' +
    'their deadlines AND the scheduled sessions. ',
};

const systemPrompt = (refDateISO, listNames, mode) =>
    'Extract the actionable to-dos, deadlines, and scheduled events (meetings, appointments, ' +
    'calls) from the user\'s input as a list of items, most important first, at most 10 ' +
    '(when there are more, keep the most important ones). ' +
    (MODE_HINTS[mode] || '') +
    'For meetings/appointments use the agreed date and time. The input may be an email thread ' +
    'with several messages, the visible text of a web page (an event page, a form, a syllabus), ' +
    'or a SCREENSHOT (chat conversation, email, poster, form) — read the ' +
    'text in the image carefully, including any visible message timestamps. Today is ' + refDateISO +
    '; resolve relative dates (like "next Friday") against it. ' +
    'When a date has no year, infer it: use a year stated nearby (like a "Autumn Quarter 2026" heading), else the next occurrence on or after today. A weekday printed next to the date (like "Friday, September 4") must agree with the year you pick. Never invent a year in the past. ' +
    'When a time range is given (like "5:30 PM-8:00 PM"), set dueTime to the start time and endTime to the end time. ' +
    'Titles, in the SAME language as the input text, max 60 characters: for a to-do, a short imperative naming the SPECIFIC action ' +
    '(like "Submit health insurance waiver", never just the email subject); for an event, the event\'s own name exactly as ' +
    'the page gives it (like "Claude Code Workshop"), with no verb in front: never "Attend", "Go to", "Join", "参加". ' +
    'Set location to the place name when one is mentioned. ' +
    (listNames && listNames.length
      ? 'The user\'s task lists are: ' + listNames.join(' | ') +
        '. For each item set "list" to the single best-fitting list name copied EXACTLY from that set, or null if none clearly fits. '
      : 'Always set "list" to null. ') +
    'Skip dates that are already in the past. Use null for any field without reliable information. ' +
    'Output JSON only.';

const COMPAT_JSON_HINT =
    ' Respond with a single JSON object of the shape {"items": [{"title": string or null, ' +
    '"dueDate": "YYYY-MM-DD" or null, "dueTime": "HH:MM" or null, "endTime": "HH:MM" or null, ' +
    '"location": string or null, "list": string or null}]} and nothing else.';

// Soft per-user rate limit within one warm instance: the real spend backstop is
// the monthly budget cap on the OpenAI account.
const RATE = new Map();
function allow(sub) {
  const now = Date.now();
  const e = RATE.get(sub) || { count: 0, ts: now };
  if (now - e.ts > 60000) { e.count = 0; e.ts = now; }
  e.count += 1;
  RATE.set(sub, e);
  return e.count <= 10;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'chrome-extension://ceidkihpjbnbekklighmhcpabpbcjlff');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, rev: 'r3-yearfix' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });

  let sub;
  try {
    const info = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token));
    if (!info.ok) return res.status(401).json({ error: 'invalid token' });
    const data = await info.json();
    if (data.aud !== CLIENT_ID) return res.status(401).json({ error: 'wrong app' });
    if (!data.sub) return res.status(401).json({ error: 'no subject' });
    sub = data.sub;
  } catch (e) {
    return res.status(502).json({ error: 'token check unavailable' });
  }
  if (!allow(sub)) return res.status(429).json({ error: 'rate limit' });

  const body = req.body || {};
  const text = body.text ? String(body.text).slice(0, 6000) : null;
  const rawImage = body.image;
  const image =
    rawImage &&
    typeof rawImage.dataBase64 === 'string' &&
    /^[A-Za-z0-9+/=]+$/.test(rawImage.dataBase64.slice(0, 100)) &&
    typeof rawImage.mimeType === 'string' &&
    /^image\/(png|jpe?g|webp|gif)$/.test(rawImage.mimeType)
      ? { mimeType: rawImage.mimeType, dataBase64: rawImage.dataBase64 }
      : null;
  const refDateISO = /^\d{4}-\d{2}-\d{2}$/.test(body.refDateISO || '') ? body.refDateISO : null;
  const mode = ['todo', 'calendar', 'both'].includes(body.mode) ? body.mode : null;
  // List names reach the system prompt, so they are clamped hard: an
  // authenticated caller must not get to write paragraphs of system-role text
  const listNames = Array.isArray(body.listNames)
    ? body.listNames.slice(0, 30).map((n) => String(n).replace(/\s+/g, ' ').slice(0, 60))
    : null;
  if (!text && !image) return res.status(400).json({ error: 'nothing to read' });
  if (!refDateISO) return res.status(400).json({ error: 'refDateISO required' });
  if (image && image.dataBase64.length > 4000000) return res.status(400).json({ error: 'image too large' });

  const content = [];
  if (image) {
    content.push({ type: 'image_url', image_url: { url: 'data:' + image.mimeType + ';base64,' + image.dataBase64 } });
  }
  content.push({ type: 'text', text: text || 'Extract from this screenshot.' });

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(refDateISO, listNames, mode) + COMPAT_JSON_HINT },
          { role: 'user', content },
        ],
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'AI service unreachable' });
  }
  if (upstream.status === 429) return res.status(429).json({ error: 'rate limit' });
  if (!upstream.ok) return res.status(502).json({ error: 'AI service error ' + upstream.status });
  try {
    const data = await upstream.json();
    const msg = ((data.choices || [])[0] || {}).message || {};
    return res.status(200).json({ content: msg.content || '', remaining: null });
  } catch (e) {
    return res.status(502).json({ error: 'AI service returned an unreadable reply' });
  }
};
