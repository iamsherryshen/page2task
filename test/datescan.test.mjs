// Guards the local pre-check that decides whether a page is worth a model call.
// Copied from popup.js: keep the two in sync when the patterns change.
import { test } from 'node:test';
import assert from 'node:assert';

// Purely local, never leaves the machine: does this page even look like it has
// a date? If not, calling a model would spend a read to learn nothing.
const DATE_SHAPES = [
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i,
  /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i,
  /\b\d{1,2}[/.\-]\d{1,2}([/.\-]\d{2,4})?\b/,
  /\d{4}\s*年\s*\d{1,2}\s*月/,
  /\d{1,2}\s*月\s*\d{1,2}\s*日/,
  /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*day\b/i,
  /(周|星期)[一二三四五六日天]/,
  /\b(today|tomorrow|tonight)\b/i,
  /(今天|明天|后天|今晚)/,
];
const DEADLINE_WORDS = /(deadline|due|rsvp|register|closes?|截止|报名|开始|提交|面试|考试)/i;
function localDateScan(text) {
  const t = String(text || '').slice(0, 20000);
  if (DATE_SHAPES.some((re) => re.test(t))) return true;
  // a keyword with a number close by also counts as date shaped
  const m = DEADLINE_WORDS.exec(t);
  return !!(m && /\d/.test(t.slice(Math.max(0, m.index - 60), m.index + 60)));
}

const YES = [
  ['English month', 'Deadline: September 4 at 5pm'],
  ['Chinese month and day', '截止日期：9月4日'],
  ['Chinese year and month', '2026年9月4日 提交'],
  ['numeric date', 'Due 12/25/2026'],
  ['weekday', 'See you Friday'],
  ['Chinese weekday', '周五之前交'],
  ['keyword near a number', '报名将于第 3 天关闭'],
  ['relative day', 'The workshop is tomorrow'],
];
const NO = [
  ['marketing homepage', 'Welcome to our homepage. We build software for teams.'],
  ['source code', 'function foo() { return bar; }'],
  ['navigation', '关于我们　联系我们　加入我们'],
  ['empty', ''],
];

for (const [name, text] of YES) {
  test('reads a page with ' + name, () => assert.equal(localDateScan(text), true));
}
for (const [name, text] of NO) {
  test('skips ' + name, () => assert.equal(localDateScan(text), false));
}
