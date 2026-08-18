// Rule-based deadline detection: chrono library (EN + ZH) plus a custom Chinese regex layer.
// Pure logic: exposed as global DateParse in the browser, require()-able in Node for tests.
(function (root) {
  const ZH_KW = ['截止', '之前', '提交', '交', '前'];

  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const toTimeStr = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());

  // Keyword score: the closer a deadline keyword is, the higher (0–10), window ±40 chars
  function keywordScore(text, index, length) {
    const WIN = 40;
    const start = Math.max(0, index - WIN);
    const ctx = text.slice(start, index + length + WIN);
    const spanStart = index - start;
    const spanEnd = spanStart + length;
    let best = Infinity;
    const consider = (i, l) => {
      const d = i + l <= spanStart ? spanStart - (i + l) : i >= spanEnd ? i - spanEnd : 0;
      if (d < best) best = d;
    };
    const enRe = /\b(due|by|before|deadline|submit|no later than|eod|end of day)\b/gi;
    let m;
    while ((m = enRe.exec(ctx))) consider(m.index, m[0].length);
    for (const k of ZH_KW) {
      let i = -1;
      while ((i = ctx.indexOf(k, i + 1)) !== -1) consider(i, k.length);
    }
    if (best === Infinity) return 0;
    return 10 - Math.min(9, best / 4);
  }

  // Sentence containing the match — used for the "Detected from" line and title suggestions.
  // A '.' only ends a sentence when followed by whitespace + capital/digit (so "11:59 p.m." survives).
  const HARD_BOUNDS = new Set(['。', '!', '?', '!', '?', ';', ';']);
  function isBoundary(text, i) {
    const ch = text[i];
    if (HARD_BOUNDS.has(ch)) return true;
    if (ch === '.') return /^\s+[A-Z0-9]/.test(text.slice(i + 1, i + 4));
    if (ch === '\n' || ch === '\r') {
      // A lone newline in hard-wrapped plain text is soft; only break at a
      // finished sentence, a blank line (paragraph), or before a list item.
      if (/[.!?。!?;;::]\s*$/.test(text.slice(Math.max(0, i - 2), i))) return true;
      const j = ch === '\r' && text[i + 1] === '\n' ? i + 1 : i; // CRLF pair: look past the '\n'
      const after = text.slice(j + 1, j + 8);
      return /^[ \t]*([\n\r]|$)/.test(after) || /^[ \t]*(?:[-*•·▪‣]|\d+[.、)])/.test(after);
    }
    return false;
  }
  function sentenceAround(text, index, length) {
    let s = index;
    let e = index + Math.max(1, length) - 1; // start at the last matched char so a trailing '.' counts
    while (s > 0 && !isBoundary(text, s - 1)) s--;
    while (e < text.length && !isBoundary(text, e)) e++;
    return text.slice(s, Math.min(e + 1, text.length)).replace(/\s+/g, ' ').trim().slice(0, 140);
  }

  // —— chrono layer (English + chrono's own Chinese) ——
  function chronoCandidates(text, ref) {
    const out = [];
    const c = typeof chrono !== 'undefined' ? chrono : root.chrono;
    if (!c) return out;
    const runs = [];
    try { runs.push(c.parse(text, ref, { forwardDate: true })); } catch (e) { /* ignore */ }
    try { if (c.zh) runs.push(c.zh.parse(text, ref, { forwardDate: true })); } catch (e) { /* ignore */ }
    for (const results of runs) {
      for (const r of results) {
        const d = r.start.date();
        if (!(d instanceof Date) || isNaN(d.getTime())) continue;
        const txt = (r.text || '').trim();
        // Noise guard: "now" (e.g. in "Service Now") parses as the current moment
        if (/^(right\s+)?now$/i.test(txt)) continue;
        // Durations and frequencies ("48 hours", "a day", "in two weeks") are not dates:
        // chrono anchors them to the moment of reading, which is meaningless
        if (/^(?:in|within|under|over|about|for|the next|next)?\s*(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?)$/i.test(txt)) continue;
        // A bare "today" or "tomorrow" in prose ("Today, it's our fastest-growing team")
        // is only a deadline when a deadline word or a clock time sits next to it
        if (/^(?:today|tonight|tomorrow|this (?:morning|afternoon|evening|week|weekend))$/i.test(txt) &&
            !r.start.isCertain('hour') && keywordScore(text, r.index, r.text.length) === 0) continue;
        // Require a real date anchor: bare times like "11:59 p.m." have neither
        if (!(r.start.isCertain('day') || r.start.isCertain('weekday'))) continue;
        // An implied-year date 9+ months out is almost always a past mention
        // rolled forward by forwardDate (explicit years like "June 1, 2027" survive)
        if (!r.start.isCertain('year') && d - ref > 270 * 86400000) continue;
        out.push({ index: r.index, length: r.text.length, date: d, hasTime: r.start.isCertain('hour') });
      }
    }
    return out;
  }

  // —— custom Simplified-Chinese layer (covers gaps in chrono's zh support) ——
  const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

  // Look for a time expression in the 20 chars after a date match (e.g. 「7月10日下午3点」)
  function parseTimeAfter(text, from) {
    const seg = text.slice(from, from + 20);
    let m = /^[^,。;,\n]{0,4}?(上午|早上|下午|晚上|中午|凌晨)?\s*(\d{1,2})\s*[点时](?:(半)|(\d{1,2})\s*分?)?/.exec(seg);
    if (m) {
      let h = parseInt(m[2], 10);
      const period = m[1] || '';
      if ((period === '下午' || period === '晚上') && h < 12) h += 12;
      if (period === '中午' && h < 11) h += 12; // 中午1点 → 13:00, 中午12点 stays 12
      const min = m[3] ? 30 : m[4] ? parseInt(m[4], 10) : 0;
      if (h > 23 || min > 59) return null;
      return { h, min, len: m[0].length };
    }
    m = /^[^,。;,\n]{0,4}?(\d{1,2}):(\d{2})/.exec(seg);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      if (h > 23 || min > 59) return null;
      return { h, min, len: m[0].length };
    }
    return null;
  }

  function chineseCandidates(text, ref) {
    const out = [];
    const dayAt = (offsetDays) => new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + offsetDays);
    const push = (index, len, baseDate, time) => {
      const d = new Date(baseDate);
      let hasTime = false;
      if (time) { d.setHours(time.h, time.min, 0, 0); hasTime = true; }
      out.push({ index, length: len, date: d, hasTime });
    };

    // Relative days: 今天/今晚/明天/明晚/后天/大后天
    const relRe = /(大后天|后天|明天|明晚|今晚|今天)/g;
    let m;
    while ((m = relRe.exec(text))) {
      const w = m[1];
      const off = w === '大后天' ? 3 : w === '后天' ? 2 : w === '明天' || w === '明晚' ? 1 : 0;
      const t = parseTimeAfter(text, m.index + m[0].length);
      push(m.index, m[0].length + (t ? t.len : 0), dayAt(off), t);
    }

    // Weekdays: 本周五 / 下周三 / 下下周三 / 星期天 / 礼拜六
    const wkRe = /(下下|下|本|这)?(?:周|星期|礼拜)([一二三四五六日天])/g;
    while ((m = wkRe.exec(text))) {
      const iso = (n) => (n === 0 ? 7 : n);
      const targetIso = iso(CN_NUM[m[2]]);
      const curIso = iso(ref.getDay());
      let offset = targetIso - curIso; // that weekday within the current Mon-Sun week
      const prefix = m[1] || '';
      if (prefix === '下') offset += 7;
      else if (prefix === '下下') offset += 14;
      else if (offset < 0) offset += 7; // bare 周X / 本周X already past → next occurrence
      const t = parseTimeAfter(text, m.index + m[0].length);
      push(m.index, m[0].length + (t ? t.len : 0), dayAt(offset), t);
    }

    // Explicit dates: 7月10日 / 7月20号
    const mdRe = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g;
    while ((m = mdRe.exec(text))) {
      const mo = parseInt(m[1], 10);
      const da = parseInt(m[2], 10);
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        const today0 = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
        let d = new Date(ref.getFullYear(), mo - 1, da);
        if (d < today0) d = new Date(ref.getFullYear() + 1, mo - 1, da);
        // The year here is always implied — a date 9+ months out is almost
        // always a past mention rolled forward, not a real deadline
        if (d - ref > 270 * 86400000) continue;
        const t = parseTimeAfter(text, m.index + m[0].length);
        push(m.index, m[0].length + (t ? t.len : 0), d, t);
      }
    }

    return out;
  }

  // Gather, filter to the future, score, sort best-first
  function gather(text, ref) {
    const t = text.slice(0, 8000);
    const candidates = [...chronoCandidates(t, ref), ...chineseCandidates(t, ref)];
    const today0 = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const horizon = new Date(ref.getFullYear() + 2, 0, 1);
    const valid = candidates.filter((c) => c.date >= today0 && c.date < horizon);
    for (const c of valid) {
      c.score = keywordScore(t, c.index, c.length) + (c.hasTime ? 1 : 0) - c.index / 100000;
    }
    valid.sort((a, b) => b.score - a.score);
    return { t, valid };
  }

  // All distinct deadline candidates, best-first (used by the popup's "pick a deadline" list)
  function extractAll(text, refDate, maxN = 5) {
    if (!text || typeof text !== 'string') return [];
    const ref = refDate instanceof Date && !isNaN(refDate.getTime()) ? refDate : new Date();
    const { t, valid } = gather(text, ref);
    const seen = new Set();
    const out = [];
    for (const c of valid) {
      const dueDate = toDateStr(c.date);
      const dueTime = c.hasTime ? toTimeStr(c.date) : null;
      const matchedText = sentenceAround(t, c.index, c.length);
      // Include the sentence so two distinct tasks due at the same moment both
      // surface, while en/zh double-parses of the SAME sentence still dedupe
      const key = dueDate + '|' + (dueTime || '') + '|' + matchedText;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ dueDate, dueTime, matchedText });
      if (out.length >= maxN) break;
    }
    return out;
  }

  function extract(text, refDate) {
    const all = extractAll(text, refDate, 1);
    return all[0] || { dueDate: null, dueTime: null, matchedText: null };
  }

  const DateParse = { extract, extractAll };
  if (typeof module !== 'undefined' && module.exports) module.exports = DateParse;
  root.DateParse = DateParse;
})(typeof globalThis !== 'undefined' ? globalThis : this);
