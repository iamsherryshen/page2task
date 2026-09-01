// Optional AI extraction module. Supports five providers:
//   - 'builtin': Chrome's on-device Gemini Nano (Prompt API, Chrome 138+) — free, no key
//   - 'gemini': Google Gemini cloud API (generativelanguage.googleapis.com) — has a free tier
//   - 'claude': Anthropic Claude (api.anthropic.com)
//   - 'openai': OpenAI (api.openai.com)
//   - 'kimi': Kimi / Moonshot (api.moonshot.cn or api.moonshot.ai, whichever the key belongs to)
//   - 'hosted': Page2Task's free-trial proxy (page2task.sherryshen.world; the key stays server-side)
// Returns { items: [{ title, dueDate, dueTime }] } — up to 10 candidates, most important first.
(function (root) {
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

  const systemPrompt = (refDateISO, listNames, mode, userEmail) =>
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
    (userEmail
      ? 'The user reading this input is signed in as "' + userEmail + '". In a conversation, ' +
        'the participant whose name matches that account is the user themself: title meetings ' +
        'and events with the OTHER person\'s name, never the user\'s own. '
      : '') +
    'When the email matches no participant, tell the user\'s side from interface cues instead: ' +
    'chat apps mark your own messages (aligned to one side, a different color, read receipts) - ' +
    'the meeting is with the other side. ' +
    'In chat screenshots, day dividers naming only a weekday (like SATURDAY) mean the most ' +
    'recent such day at or before the newest message, which is normally close to today; ' +
    'resolve words like "tomorrow" against the day of the message that says them. ' +
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

  // A much shorter brief for the small on-device model. The full brief above
  // overwhelms it: it splits one plan into several items, mixes up names, and
  // picks declined times. Small models need few rules and one worked example.
  const builtinSystemPrompt = (refDateISO) => {
    const d = new Date(refDateISO + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const p2 = (n) => String(n).padStart(2, '0');
    const tomorrowISO = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    return 'You turn text or a screenshot into to-do items. Today is ' + refDateISO + '. Rules: ' +
      '1. Output the plan the people FINALLY agreed on. When a time is changed several times, use the LAST one. A declined option is ignored. ' +
      '2. If the plan was cancelled and nothing new was agreed, output {"items":[]} with no items at all. ' +
      '3. One item per distinct task. A conversation about one plan is ONE item; a LIST of separate things (such as one per line) is one item per line. ' +
      '4. title: in the same language as the input. For a plan or event, the name of the thing itself, like "Lunch with Jennie at Madera" or "Claude Code Workshop", never starting with "Attend" or "参加". For a task, a short action like "Submit the report". ' +
      '5. dueDate: YYYY-MM-DD, resolving words like "tomorrow" against today. If a clock time is agreed but no date is said, use today. If there is no date and no time, dueDate must be null. Never invent a date. ' +
      '6. dueTime and endTime: 24-hour HH:MM, or null. location: the place name, or null. list: always null. ' +
      'Example 1. Chat: "Coffee tomorrow 3pm?" then "Can we do 4pm instead?" then "4pm works, at Blue Bottle!" gives ' +
      '{"items":[{"title":"Coffee at Blue Bottle","dueDate":"' + tomorrowISO + '","dueTime":"16:00","endTime":null,"location":"Blue Bottle","list":null}]} ' +
      'Example 2. A reading list "OpenAI: A practical guide to building agents" and "Anthropic: Building effective agents" gives ' +
      '{"items":[{"title":"Read OpenAI: A practical guide to building agents","dueDate":null,"dueTime":null,"endTime":null,"location":null,"list":null},' +
      '{"title":"Read Anthropic: Building effective agents","dueDate":null,"dueTime":null,"endTime":null,"location":null,"list":null}]} ' +
      'Example 3. Chat: "Dinner Friday 7:30pm at Madera!" then "So sorry, I have to cancel, I am flying out, another time!" gives ' +
      '{"items":[]} because the plan was cancelled. ' +
      'Output JSON only.';
  };

  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
  });

  // A 429 right after another request usually means the previous one is still
  // holding a concurrency slot (low tiers allow a single request), so wait a
  // moment and try again. A quota/balance 429 will not clear by waiting.
  async function doFetch(url, init) {
    const waits = [2000, 4000];
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetch(url, init);
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        throw new Error('Network error: could not reach the AI service');
      }
      if (res.status !== 429 || attempt >= waits.length) return res;
      let body = '';
      try { body = await res.clone().text(); } catch (e) { /* ignore */ }
      if (/quota|balance/i.test(body)) return res;
      await sleep(waits[attempt], init && init.signal);
    }
  }

  // API keys live in chrome.storage.LOCAL only, so a key never leaves the
  // computer it was typed on (storage.sync would copy it to every browser
  // signed into the same Google account — e.g. a shared or lab computer).
  // Keys that older versions stored in sync are migrated here and wiped from
  // sync; the wipe propagates, deleting them from Google's sync servers too.
  async function loadKeys() {
    const local = await chrome.storage.local.get({
      geminiApiKey: '', anthropicApiKey: '', openaiApiKey: '', kimiApiKey: '',
    });
    // Only Gemini/Anthropic keys ever lived in sync (older versions)
    const synced = await chrome.storage.sync.get({ geminiApiKey: '', anthropicApiKey: '' });
    if (!synced.geminiApiKey && !synced.anthropicApiKey) return local;
    const merged = {
      geminiApiKey: local.geminiApiKey || synced.geminiApiKey,
      anthropicApiKey: local.anthropicApiKey || synced.anthropicApiKey,
      openaiApiKey: local.openaiApiKey,
      kimiApiKey: local.kimiApiKey,
    };
    await chrome.storage.local.set(merged);
    await chrome.storage.sync.remove(['geminiApiKey', 'anthropicApiKey']);
    return merged;
  }

  // —— Anthropic Claude ——
  async function callClaude({ text, image, refDateISO, apiKey, listNames, mode, userEmail, signal }) {
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
        max_tokens: 1600,
        system: systemPrompt(refDateISO, listNames, mode, userEmail),
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
                      dueTime: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'start time HH:MM (24-hour) or null' },
                      endTime: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'end time HH:MM (24-hour) if a range is given, else null' },
                      location: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'place name if mentioned, else null' },
                      list: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'best-fitting task list name from the provided set, else null' },
                    },
                    required: ['title', 'dueDate', 'dueTime', 'endTime', 'location', 'list'],
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
    if (res.status === 401) throw new Error('Invalid API key. Please check it in Settings.');
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
            dueTime: { type: 'STRING', nullable: true, description: 'start time HH:MM 24-hour, or null' },
            endTime: { type: 'STRING', nullable: true, description: 'end time HH:MM 24-hour if a range is given, or null' },
            location: { type: 'STRING', nullable: true, description: 'place name if mentioned, or null' },
            list: { type: 'STRING', nullable: true, description: 'best-fitting task list name from the provided set, or null' },
          },
          required: ['title', 'dueDate', 'dueTime', 'endTime', 'location', 'list'],
        },
      },
    },
    required: ['items'],
  };

  async function callGemini({ text, image, refDateISO, apiKey, listNames, mode, userEmail, signal }) {
    const parts = [];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.dataBase64 } });
    parts.push({ text: text ? String(text).slice(0, 6000) : 'Extract from this screenshot.' });
    const body = (thinkingConfig) => JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(refDateISO, listNames, mode, userEmail) }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA,
        thinkingConfig,
      },
    });
    const call = (model, thinkingConfig) =>
      doFetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST',
        signal,
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body: body(thinkingConfig),
      });
    // Flash-Lite is the current low-latency tier, built for document parsing
    // and data extraction; its default config is the fast path, so no thinking
    // override. The chain behind it exists because Google retires models on
    // its own schedule (2.5-flash died early for NEW projects while the docs
    // still listed it): 2.5-flash takes thinkingBudget, Gemini 3+ takes
    // thinkingLevel ('low' is its floor), and the two reject each other.
    let res = await call('gemini-3.5-flash-lite');
    if (res.status === 404) res = await call('gemini-2.5-flash', { thinkingBudget: 0 });
    if (res.status === 404) res = await call('gemini-flash-latest', { thinkingLevel: 'low' });
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
    if (res.status === 429) throw new Error('Gemini rate limit reached. Wait a minute and try again.');
    if (res.status === 401 || res.status === 403 || /api key/i.test(detail)) {
      throw new Error('Invalid API key. Please check it in Settings.');
    }
    throw new Error('AI service unavailable (error ' + res.status + (detail ? ': ' + detail.slice(0, 120) : '') + ')');
  }

  // —— OpenAI-compatible chat APIs (OpenAI, Kimi/Moonshot) ——
  // Kimi keys come from two separate platforms (platform.moonshot.cn vs
  // platform.moonshot.ai) and only work against their own endpoint, so try
  // both — a wrong-region key answers 401 and we move on to the other.
  const COMPAT_PROVIDERS = {
    openai: {
      label: 'OpenAI',
      urls: ['https://api.openai.com/v1/chat/completions'],
      model: 'gpt-4o-mini',
    },
    kimi: {
      label: 'Kimi',
      urls: [
        'https://api.moonshot.cn/v1/chat/completions',
        'https://api.moonshot.ai/v1/chat/completions',
      ],
      // Every provider runs its fast tier here (Flash / Haiku / 4o-mini): pulling a
      // date out of an email is not a reasoning task. kimi-k3 always reasons at
      // max effort and blew the 25s budget; k2.6 reads images and can skip thinking.
      model: 'kimi-k2.6',
      extraBody: { thinking: { type: 'disabled' } },
    },
  };

  // These APIs get JSON mode + the shape spelled out in the prompt (their strict
  // schema support differs per model); normalize() below validates every field.
  const COMPAT_JSON_HINT =
    ' Respond with a single JSON object of the shape {"items": [{"title": string or null, ' +
    '"dueDate": "YYYY-MM-DD" or null, "dueTime": "HH:MM" or null, "endTime": "HH:MM" or null, ' +
    '"location": string or null, "list": string or null}]} and nothing else.';

  async function callCompat(provider, { text, image, refDateISO, apiKey, listNames, mode, userEmail, signal }) {
    const p = COMPAT_PROVIDERS[provider];
    const content = [];
    if (image) {
      content.push({
        type: 'image_url',
        image_url: { url: 'data:' + image.mimeType + ';base64,' + image.dataBase64 },
      });
    }
    content.push({ type: 'text', text: text ? String(text).slice(0, 6000) : 'Extract from this screenshot.' });
    const body = JSON.stringify({
      model: p.model,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(refDateISO, listNames, mode, userEmail) + COMPAT_JSON_HINT },
        { role: 'user', content },
      ],
      ...(p.extraBody || {}),
    });
    let res = null;
    let netErr = null;
    for (const url of p.urls) {
      try {
        res = await doFetch(url, {
          method: 'POST',
          signal,
          headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
          body,
        });
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        netErr = e;
        res = null;
        continue; // endpoint unreachable — try the other region
      }
      if (res.status !== 401 && res.status !== 403) break; // key may belong to the other region
    }
    if (!res) throw netErr || new Error('Network error: could not reach the AI service');
    if (res.status === 401 || res.status === 403) throw new Error('Invalid API key. Please check it in Settings.');
    if (!res.ok) {
      let detail = '', type = '';
      try {
        const j = await res.json();
        detail = (j.error && j.error.message) || '';
        type = (j.error && (j.error.type || j.error.code)) || '';
      } catch (e) { /* ignore */ }
      // Kimi answers an empty balance with 429 too (type exceeded_current_quota_error),
      // and OpenAI with insufficient_quota; "wait a minute" would be the wrong advice.
      if (/quota|balance/i.test(type + ' ' + detail)) {
        throw new Error(p.label + ' account has no balance. Top up on the provider site and try again.');
      }
      if (res.status === 429) throw new Error(p.label + ' rate limit reached. Wait a minute and try again.');
      throw new Error('AI service unavailable (error ' + res.status + (detail ? ': ' + detail.slice(0, 120) : '') + ')');
    }
    const data = await res.json();
    const msg = ((data.choices || [])[0] || {}).message || {};
    return msg.content || '';
  }

  // —— Page2Task hosted free trial ——
  // The default for new installs: the same model family as "your own key", but
  // the key lives on our server. Auth is the user's own Google token, so only
  // real users of this app can spend the shared budget.
  const HOSTED_URL = 'https://page2task.sherryshen.world/api/extract';

  async function callHosted({ text, image, refDateISO, apiKey, listNames, mode, userEmail, signal }) {
    const res = await doFetch(HOSTED_URL, {
      method: 'POST',
      signal,
      headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: text ? String(text).slice(0, 6000) : null,
        image: image || null,
        refDateISO,
        listNames,
        mode: mode || null,
        userEmail: userEmail || null,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      // Drop the cached token so the next read fetches a fresh one, the same
      // recovery lib/google.js performs for the Tasks and Calendar calls
      try {
        if (chrome.identity) chrome.identity.removeCachedAuthToken({ token: apiKey }, () => {});
      } catch (e) { /* ignore */ }
      throw new Error('Google sign-in expired. Reconnect in Settings.');
    }
    if (res.status === 429) throw new Error('The free service is busy. Wait a minute and try again.');
    if (!res.ok) {
      console.debug('hosted extract failed with status', res.status);
      throw new Error('The free service had a problem. Try again in a moment.');
    }
    const data = await res.json();
    return data.content || '';
  }

  // —— Chrome built-in AI (Gemini Nano via the Prompt API) ——
  // Free and keyless: the model runs on the user's own computer, no data leaves
  // the device. Needs Chrome 138+ on capable desktop hardware.
  const BUILTIN_SCHEMA = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            dueDate: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'YYYY-MM-DD or null' },
            dueTime: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'start time HH:MM (24-hour) or null' },
            endTime: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'end time HH:MM (24-hour) if a range is given, else null' },
            location: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'place name if mentioned, else null' },
            list: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'best-fitting task list name from the provided set, else null' },
          },
          required: ['title', 'dueDate', 'dueTime', 'endTime', 'location', 'list'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  };

  function builtinApi() {
    return typeof LanguageModel !== 'undefined' ? LanguageModel : null;
  }

  // Chrome's Prompt API asks for an attested output language (else it logs a
  // warning on every request). Its supported list is [de,en,es,fr,ja]; zh is
  // not attestable yet, so we declare 'en'. The extraction brief still asks
  // for same-language titles, which cloud providers honor fully.
  const BUILTIN_OUTPUT = [{ type: 'text', languages: ['en'] }];

  // 'available' | 'downloadable' | 'downloading' | 'unavailable'
  async function builtinAvailability() {
    const LM = builtinApi();
    if (!LM || !LM.availability) return 'unavailable';
    try { return await LM.availability({ expectedOutputs: BUILTIN_OUTPUT }); } catch (e) { return 'unavailable'; }
  }

  // Whether the on-device model can also take IMAGES — older Prompt API builds
  // are text-only, and the UI must not promise screenshot reading on those
  async function builtinImageAvailability() {
    const LM = builtinApi();
    if (!LM || !LM.availability) return false;
    try {
      return (await LM.availability({ expectedInputs: [{ type: 'image' }], expectedOutputs: BUILTIN_OUTPUT })) === 'available';
    } catch (e) {
      return false;
    }
  }

  // Triggers/continues the one-time on-device model download. onProgress: 0..1.
  // Must be called from a user gesture (Chrome requires one to start the download).
  async function ensureBuiltinReady(onProgress) {
    const LM = builtinApi();
    if (!LM) throw new Error('This Chrome version has no built-in AI');
    const session = await LM.create({
      expectedOutputs: BUILTIN_OUTPUT,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onProgress && onProgress(e.loaded));
      },
    });
    if (session && session.destroy) session.destroy();
  }

  async function callBuiltin({ text, image, refDateISO, signal }) {
    const LM = builtinApi();
    if (!LM) throw new Error('This Chrome version has no built-in AI');
    const opts = {
      // The simplified on-device brief; task-list matching is deliberately
      // dropped here (the small model gets it wrong more often than right)
      initialPrompts: [{ role: 'system', content: builtinSystemPrompt(refDateISO) }],
      expectedOutputs: BUILTIN_OUTPUT,
      signal,
    };
    if (image) opts.expectedInputs = [{ type: 'image' }];
    let session;
    try {
      session = await LM.create(opts);
    } catch (e) {
      if (image) {
        throw new Error("This Chrome version can't read screenshots on-device yet. Pasted text still works, or add an API key in Settings.");
      }
      throw new Error('On-device AI could not start (' + ((e && e.message) || 'unknown error') + ')');
    }
    try {
      const promptOpts = { responseConstraint: BUILTIN_SCHEMA, signal };
      if (!image) return await session.prompt(String(text || '').slice(0, 6000), promptOpts);
      const bin = atob(image.dataBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const bitmap = await createImageBitmap(new Blob([bytes], { type: image.mimeType }));
      // Two steps for screenshots: the small model reads far more reliably when
      // it first transcribes the image and then reasons over its own transcript.
      // One-shot OCR+reasoning is exactly where it dropped final-agreement
      // details (e.g. picking a superseded time it read seconds earlier).
      const transcript = await session.prompt(
        [{
          role: 'user',
          content: [
            { type: 'image', value: bitmap },
            { type: 'text', value: 'Transcribe every message in this image exactly, in reading order, keeping timestamps. Output only the transcript.' },
          ],
        }],
        { signal }
      );
      console.log('[Page2Task] on-device screenshot transcript:', transcript);
      // Reason in a FRESH text-only session: with the image still in context the
      // model re-reads the picture and repeats its one-shot mistakes instead of
      // working from the clean transcript.
      if (session.destroy) session.destroy();
      session = await LM.create({
        initialPrompts: [{ role: 'system', content: builtinSystemPrompt(refDateISO) }],
        expectedOutputs: BUILTIN_OUTPUT,
        signal,
      });
      return await session.prompt(
        String(transcript || '').slice(0, 6000) +
          (text ? '\nAdditional context: ' + String(text).slice(0, 2000) : ''),
        promptOpts
      );
    } finally {
      if (session && session.destroy) session.destroy();
    }
  }

  async function extract({ text, image, refDateISO, apiKey, provider, listNames, mode, userEmail, signal }) {
    const controller = new AbortController();
    // The caller cancels a read that a newer one has superseded; drop the
    // connection so the provider frees its concurrency slot for the new read
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    // On-device inference can be slow (the model loads from disk on first use);
    // screenshots take the two-step transcribe-then-extract path, so give them more
    const timer = setTimeout(
      () => controller.abort(),
      provider === 'builtin' ? (image ? 150000 : 90000) : image ? 45000 : 25000
    );
    let raw;
    try {
      const args = { text, image, refDateISO, apiKey, listNames, mode, userEmail, signal: controller.signal };
      raw =
        provider === 'builtin' ? await callBuiltin(args)
        : provider === 'gemini' ? await callGemini(args)
        : provider === 'hosted' ? await callHosted(args)
        : provider === 'openai' || provider === 'kimi' ? await callCompat(provider, args)
        : await callClaude(args);
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new Error(signal && signal.aborted ? 'AI request cancelled' : 'AI request timed out');
      }
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
      .map((it) => ({ ...it, dueDate: fixPastYear(it.dueDate, refDateISO) }))
      .filter((it) => it.title || it.dueDate)
      .slice(0, 10); // safety valve, not a target: prompts no longer advertise a count
    return { items };
  }

  // Models default yearless dates to their training era: a syllabus headed
  // "Autumn Quarter 2026" came back dated 2024 even when the prompt forbade
  // it. A due date far in the past is that failure, not information — roll
  // it forward to the same month/day's next occurrence. Dates in the recent
  // past stay as stated: those are usually real (last week's deadline).
  function fixPastYear(dateStr, refDateISO) {
    if (!validDate(dateStr) || !validDate(refDateISO)) return dateStr;
    const ref = new Date(refDateISO + 'T00:00:00');
    const d = new Date(dateStr + 'T00:00:00');
    if (ref - d <= 183 * 86400000) return dateStr;
    const md = dateStr.slice(4); // '-MM-DD'
    for (let y = ref.getFullYear(); y <= ref.getFullYear() + 1; y++) {
      const cand = y + md;
      if (validDate(cand) && new Date(cand + 'T00:00:00') >= ref) return cand;
    }
    return dateStr; // e.g. a past Feb 29 with no valid future twin
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

  // "Attend X" says nothing that "X" does not; models still add it now and then
  const cleanTitle = (t) => t.replace(/^(?:attend(?: the| a| an)?\s+|参加|出席)/i, '').trim() || t;

  function normalize(o) {
    return {
      title: typeof o.title === 'string' && o.title.trim() ? cleanTitle(o.title.trim()).slice(0, 60) : null,
      dueDate: validDate(o.dueDate) ? o.dueDate : null,
      dueTime: validTime(o.dueTime),
      endTime: validTime(o.endTime),
      location: typeof o.location === 'string' && o.location.trim() ? o.location.trim().slice(0, 80) : null,
      list: typeof o.list === 'string' && o.list.trim() ? o.list.trim().slice(0, 80) : null,
    };
  }

  root.AiExtract = { extract, builtinAvailability, builtinImageAvailability, ensureBuiltinReady, loadKeys };
})(typeof globalThis !== 'undefined' ? globalThis : this);
