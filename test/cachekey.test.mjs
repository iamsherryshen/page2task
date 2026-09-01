// The cache key must separate two different emails that share a URL, which is
// how Gmail works. Copied from popup.js: keep the two in sync.
import { test } from 'node:test';
import assert from 'node:assert';

// Keyed by the text itself, not the URL. Gmail and other apps put the thing
// you are looking at in the URL hash, so any URL-shaped key served one email's
// dates for every email after it. The text is what the model reads, so the
// text is what decides whether we have already read this.
function textKey(text) {
  const t = String(text || '').slice(0, 6000); // the same slice the model gets
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)) + ':' + t.length;
}

test('same text gives the same key', () => {
  const t = 'Complete health requirements by August 15';
  assert.equal(textKey(t), textKey(t));
});

test('two emails at the same URL get different keys', () => {
  const a = 'Complete health requirements in Vaden Patient Portal by August 15';
  const b = 'Submit Cardinal Care waiver request via AHP portal by September 15';
  assert.notEqual(textKey(a), textKey(b));
});

test('a one character change changes the key', () => {
  assert.notEqual(textKey('due August 15'), textKey('due August 16'));
});

test('same length, different content, still differs', () => {
  assert.notEqual(textKey('aaaa bbbb cccc'), textKey('cccc bbbb aaaa'));
});

test('empty text is stable and does not throw', () => {
  assert.equal(textKey(''), textKey(null));
});

test('text past the model cutoff does not blow up', () => {
  const long = 'x'.repeat(50000);
  assert.equal(typeof textKey(long), 'string');
});
