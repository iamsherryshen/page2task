// Guards the filter that fits a long PDF's text layer into one model call.
//
// Unlike the other tests here, this one reads the functions straight out of
// popup.js instead of keeping a hand-copied twin: a stale copy once kept this
// suite green while it tested code that no longer shipped.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../popup.js', import.meta.url), 'utf8');
const grab = (re, what) => {
  const m = src.match(re);
  assert.ok(m, `could not find ${what} in popup.js`);
  return m[0];
};
const condenseDated = new Function(
  grab(/const DATE_SHAPES = \[[\s\S]*?\];/, 'DATE_SHAPES') +
  grab(/const DEADLINE_WORDS = .*?;/, 'DEADLINE_WORDS') +
  grab(/const CALENDAR_DATE = \[[\s\S]*?\];/, 'CALENDAR_DATE') +
  grab(/function condenseDated\(text, cap\) \{[\s\S]*?\n\}/, 'condenseDated') +
  '; return condenseDated;'
)();

const CLOUD = 23800;
const LOCAL = 5800;
const repeat = (n, line) => Array.from({ length: n }, () => line).join('\n');

// Shaped like the syllabus that exposed the original bug: the course name at
// the top, a heading five lines above its due dates, the deadlines well past
// any head truncation, and loose "date-like" noise ("Giving 2.0", "start
// today") in about the amount a real syllabus carries, which must not crowd
// the heading out. The bulk is undated prose.
const NOISE = 'Readings come from Giving 2.0 and we need to start today.';
const PROSE = 'Office hours are held in the building next door.';
const SYLLABUS = [
  'Stanford University Graduate School of Business',
  'GSBGID 513',
  'Philanthropy: Strategy, Impact and Leadership',
  'Course Syllabus',
  repeat(20, NOISE),
  repeat(150, PROSE),
  'Final Project: Local Nonprofit Assessment',
  '30% of your total grade',
  'Objective: select a local nonprofit and assess it',
  'and recommend it for funding',
  'Due Dates:',
  'Nonprofit Signup: October 1, 2026, by 11:59 pm',
  'Final Submission: October 15, 2026, by 11:59 pm',
  repeat(150, PROSE),
  repeat(20, NOISE),
  'Weekly slides: submit by Monday at 5 pm PT',
  repeat(300, PROSE),
].join('\n');

test('short text is passed through untouched', () => {
  const short = 'Final Submission: October 15, 2026';
  assert.equal(condenseDated(short, LOCAL), short);
});

for (const [name, cap] of [['cloud', CLOUD], ['local', LOCAL]]) {
  test(`${name}: output stays under the cap`, () => {
    assert.ok(SYLLABUS.length > cap, 'fixture must exceed the cap to be meaningful');
    assert.ok(condenseDated(SYLLABUS, cap).length <= cap);
  });

  test(`${name}: every deadline survives, deep in the document`, () => {
    const out = condenseDated(SYLLABUS, cap);
    for (const d of ['October 1, 2026', 'October 15, 2026']) assert.ok(out.includes(d), `lost ${d}`);
  });

  test(`${name}: a deadline with no calendar date is still kept`, () => {
    assert.ok(condenseDated(SYLLABUS, cap).includes('submit by Monday at 5 pm'));
  });

  test(`${name}: the course name at the top is always kept`, () => {
    const out = condenseDated(SYLLABUS, cap);
    assert.ok(out.includes('GSBGID 513'));
    assert.ok(out.includes('Philanthropy: Strategy, Impact and Leadership'));
  });
}

test('a head truncation would have lost the deadlines, which is why this filter exists', () => {
  assert.ok(!SYLLABUS.slice(0, LOCAL).includes('October 15, 2026'));
});

test('cloud: the heading five lines above the dates survives the noise', () => {
  // The regression this exists for: with every loose match given the same
  // context, the noise used up the budget and this heading was cut, leaving
  // "Final Submission" with nothing to say which assignment it belongs to.
  const out = condenseDated(SYLLABUS, CLOUD);
  assert.ok(out.includes('Final Project: Local Nonprofit Assessment'));
});

test('undated prose is mostly dropped', () => {
  const out = condenseDated(SYLLABUS, CLOUD);
  const kept = out.split('\n').filter((l) => l === PROSE).length;
  const total = SYLLABUS.split('\n').filter((l) => l === PROSE).length;
  assert.ok(kept <= 40, `kept ${kept} of ${total} lines of undated prose`);
});

for (const [name, cap] of [['cloud', CLOUD], ['local', LOCAL]]) {
  test(`${name}: when loose matches alone overflow, the calendar dates still survive`, () => {
    // A long reading list where every line has a page range ("pp. 13-43")
    // or a decimal: the loose matches by themselves exceed the budget.
    const doc = [
      'GSBGID 513',
      repeat(800, NOISE),
      'Final Project: Local Nonprofit Assessment',
      'Final Submission: October 15, 2026, by 11:59 pm',
      repeat(800, NOISE),
    ].join('\n');
    const out = condenseDated(doc, cap);
    assert.ok(out.length <= cap);
    assert.ok(out.includes('October 15, 2026'), 'a calendar date was cut for noise');
    assert.ok(out.includes('Final Project: Local Nonprofit Assessment'), 'its heading was cut for noise');
  });
}

test('URLs are stripped, so a date in a link path is not mistaken for a deadline', () => {
  const doc = [
    'GSBGEN 591',
    repeat(400, 'Reading: https://www.forbes.com/sites/someone/2022/02/03/an-article-title'),
    'Final pitch: June 4, 2025',
  ].join('\n');
  const out = condenseDated(doc, LOCAL);
  assert.ok(!out.includes('forbes.com'));
  assert.ok(out.includes('June 4, 2025'));
});

test('a dateless document falls back to its opening rather than going empty', () => {
  const doc = repeat(900, 'This document contains no dates at all.');
  const out = condenseDated(doc, LOCAL);
  assert.ok(out.length > 0 && out.length <= LOCAL);
  assert.ok(doc.startsWith(out.slice(0, 40)));
});

test('Chinese dates are recognised as calendar dates', () => {
  const doc = [repeat(900, '课程说明与评分方式。'), '第一次作业提交：2026 年 10 月 5 日', repeat(900, '阅读材料每周发布。')].join('\n');
  const out = condenseDated(doc, LOCAL);
  assert.ok(out.includes('2026 年 10 月 5 日'));
  assert.ok(out.length <= LOCAL);
});
