// Optional AI extraction module. Never called unless an API key is configured.
// Supports two providers:
//   - Google Gemini (generativelanguage.googleapis.com) — has a free tier
//   - Anthropic Claude (api.anthropic.com)
// Returns { items: [{ title, dueDate, dueTime }] } — up to 5 candidates, most important first.
(function (root) {
  const systemPrompt = (refDateISO, listNames) =>
    'Extract the actionable to-dos, deadlines, and scheduled events (meetings, appointments, ' +
    'calls) from the user\'s input as a list of items, most important first, at most 5. ' +
    'For meetings/appointments use the agreed date and time. The input may be an email thread ' +
    'with several messages, or a SCREENSHOT (chat conversation, email, poster, form) — read the ' +
    'text in the image carefully, including any visible message timestamps. Today is ' + refDateISO +
    '; resolve relative dates (like "next Friday") against it. ' +
    'Each title must be a short imperative describing the SPECIFIC action or event ' +
    '(never just the email subject), written in the SAME language as the input text, max 60 characters. ' +
    'Set location when a place is mentioned (e.g. "@GSB Coupa" → "GSB Coupa"). ' +
    (listNames && listNames.length
      ? 'The user\'s task lists are: ' + listNames.join(' | ') +
        '. For each item set "list" to the single best-fitting list name copied EXACTLY from that set, or null if none clearly fits. '
      : 'Always set "list" to null. ') +
    'Skip dates that are already in the past. Use null for any field without reliable information. ' +
    'Output JSON only.';

  async function doFetch(url, init) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('Network error — could not reach the AI service');
    }
  }

  // —— Anthropic Claude ——
  async function callClaude({ text, image, refDateISO, apiKey, listNames, signal }) {
    const content = [];
    if (image) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: image.dataBase64 },
      });
    }
    content.push({ type: 'text', text: text ? String(text).slice(0, 6000) : 'Extract from this screenshot.' });
    const res = await doFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: systemPrompt(refDateISO, listNames),
        messages: [{ role: 'user', content }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      dueDate: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'YYYY-MM-DD or null' },
                      dueTime: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'HH:MM (24-hour) or null' },
                      location: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'place name if mentioned, else null' },
                      list: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'best-fitting task list name from the provided set, else null' },
                    },
                    required: ['title', 'dueDate', 'dueTime', 'location', 'list'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (res.status === 401) throw new Error('Invalid API key — please check it in Settings');
    if (!res.ok) throw new Error('AI service unavailable (error ' + res.status + ')');
    const data = await res.json();
    const block = (data.content || []).find((b) => b.type === 'text');
    return (block && block.text) || '';
  }

  // —— Google Gemini ——
  const GEMINI_SCHEMA = {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', nullable: true },
            dueDate: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD, or null' },
            dueTime: { type: 'STRING', nullable: true, description: 'HH:MM 24-hour, or null' },
            location: { type: 'STRING', nullable: true, description: 'place name if mentioned, or null' },
            list: { type: 'STRING', nullable: true, description: 'best-fitting task list name from the provided set, or null' },
          },
          required: ['title', 'dueDate', 'dueTime', 'location', 'list'],
        },
      },
    },
    required: ['items'],
  };

  async function callGemini({ text, image, refDateISO, apiKey, listNames, signal }) {
    const parts = [];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.dataBase64 } });
    parts.push({ text: text ? String(text).slice(0, 6000) : 'Extract from this screenshot.' });
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(refDateISO, listNames) }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA,
      },
    });
    const call = (model) =>
      doFetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST',
        signal,
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body,
      });
    let res = await call('gemini-flash-latest');
    if (res.status === 404) res = await call('gemini-2.5-flash'); // alias unavailable → stable fallback
    if (res.ok) {
      const data = await res.json();
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      return parts.map((p) => p.text || '').join('');
    }
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.error && j.error.message) || '';
    } catch (e) { /* ignore */ }
    if (res.status === 429) throw new Error('Gemini rate limit reached — wait a minute and try again');
    if (res.status === 401 || res.status === 403 || /api key/i.test(detail)) {
      throw new Error('Invalid API key — please check it in Settings');
    }
    throw new Error('AI service unavailable (error ' + res.status + (detail ? ': ' + detail.slice(0, 120) : '') + ')');
  }

  async function extract({ text, image, refDateISO, apiKey, provider, listNames }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let raw;
    try {
      const args = { text, image, refDateISO, apiKey, listNames, signal: controller.signal };
      raw = provider === 'gemini' ? await callGemini(args) : await callClaude(args);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('AI request timed out');
      throw e;
    } finally {
      clearTimeout(timer);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const m = (raw || '').match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (e2) { /* fall through */ }
      }
    }
    if (!parsed || !Array.isArray(parsed.items)) throw new Error('Could not parse the AI response');

    const items = parsed.items
      .map(normalize)
      .filter((it) => it.title || it.dueDate)
      .slice(0, 5);
    return { items };
  }

  // Real calendar date only: rejects garbage like 2026-13-45 (Invalid Date)
  // and rollovers like 2026-02-30 (which JS would silently parse as Mar 2)
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s + 'T00:00:00');
    return !isNaN(d.getTime()) && d.getDate() === parseInt(s.slice(8), 10);
  }

  // Accepts "9:30", "14:30" and "14:30:00" (some models append seconds) → "HH:MM"
  function validTime(s) {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(s || '').trim());
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return String(h).padStart(2, '0') + ':' + m[2];
  }

  function normalize(o) {
    return {
      title: typeof o.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 60) : null,
      dueDate: validDate(o.dueDate) ? o.dueDate : null,
      dueTime: validTime(o.dueTime),
      location: typeof o.location === 'string' && o.location.trim() ? o.location.trim().slice(0, 80) : null,
      list: typeof o.list === 'string' && o.list.trim() ? o.list.trim().slice(0, 80) : null,
    };
  }

  root.AiExtract = { extract };
})(typeof globalThis !== 'undefined' ? globalThis : this);
