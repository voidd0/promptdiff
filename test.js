const {
  diff, charDiff, lineDiff, stats,
  wordFrequencyDelta, tokenImpact,
  formatInline, formatMarkdown, tokenize,
} = require('./src/differ');
const { resolveModel, approxTokens, costForTokens, MODELS } = require('./src/pricing');

console.log('running tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// tokenize tests
test('tokenize: splits on whitespace', () => {
  const result = tokenize('hello world');
  assert(result.length === 3); // hello, ' ', world
  assert(result[0] === 'hello');
  assert(result[2] === 'world');
});

test('tokenize: preserves whitespace', () => {
  const result = tokenize('a  b');
  assert(result.some(t => t === '  '));
});

// diff tests
test('diff: identical texts have no changes', () => {
  const result = diff('hello world', 'hello world');
  const changes = result.filter(r => r.type !== 'same');
  assert(changes.length === 0);
});

test('diff: detects added words', () => {
  const result = diff('hello', 'hello world');
  const added = result.filter(r => r.type === 'added');
  assert(added.length > 0);
  assert(added.some(a => a.value === 'world'));
});

test('diff: detects removed words', () => {
  const result = diff('hello world', 'hello');
  const removed = result.filter(r => r.type === 'removed');
  assert(removed.length > 0);
  assert(removed.some(r => r.value === 'world'));
});

test('diff: detects changed words', () => {
  const result = diff('hello world', 'hello universe');
  const added = result.filter(r => r.type === 'added');
  const removed = result.filter(r => r.type === 'removed');
  assert(added.some(a => a.value === 'universe'));
  assert(removed.some(r => r.value === 'world'));
});

// lineDiff tests
test('lineDiff: detects added lines', () => {
  const result = lineDiff('line1', 'line1\nline2');
  const added = result.filter(r => r.type === 'added');
  assert(added.length === 1);
  assert(added[0].value === 'line2');
});

test('lineDiff: detects removed lines', () => {
  const result = lineDiff('line1\nline2', 'line1');
  const removed = result.filter(r => r.type === 'removed');
  assert(removed.length === 1);
  assert(removed[0].value === 'line2');
});

// stats tests
test('stats: calculates word counts', () => {
  const wordDiff = diff('one two', 'one two three');
  const result = stats('one two', 'one two three', wordDiff);
  assert(result.before.words === 2);
  assert(result.after.words === 3);
});

test('stats: calculates char counts', () => {
  const wordDiff = diff('abc', 'abcdef');
  const result = stats('abc', 'abcdef', wordDiff);
  assert(result.before.chars === 3);
  assert(result.after.chars === 6);
});

test('stats: calculates similarity', () => {
  const wordDiff = diff('hello world', 'hello world');
  const result = stats('hello world', 'hello world', wordDiff);
  assert(result.similarity === 100);
});

test('stats: similarity is 0 for completely different', () => {
  const wordDiff = diff('aaa', 'bbb');
  const result = stats('aaa', 'bbb', wordDiff);
  assert(result.similarity === 0);
});

// formatInline tests
test('formatInline: marks added words', () => {
  const diffResult = [{ type: 'added', value: 'test' }];
  const result = formatInline(diffResult, false);
  assert(result.includes('[+test]'));
});

test('formatInline: marks removed words', () => {
  const diffResult = [{ type: 'removed', value: 'test' }];
  const result = formatInline(diffResult, false);
  assert(result.includes('[-test]'));
});

test('formatInline: keeps same words unchanged', () => {
  const diffResult = [{ type: 'same', value: 'test' }];
  const result = formatInline(diffResult, false);
  assert(result === 'test');
});

// charDiff tests
test('charDiff: detects single-character change', () => {
  const result = charDiff('cat', 'bat');
  const added = result.filter(r => r.type === 'added').map(r => r.value);
  const removed = result.filter(r => r.type === 'removed').map(r => r.value);
  assert(added.includes('b'));
  assert(removed.includes('c'));
});

// wordFrequencyDelta tests
test('wordFrequencyDelta: returns added words', () => {
  const rows = wordFrequencyDelta('foo bar', 'foo bar baz baz baz', { minLen: 3 });
  const baz = rows.find(r => r.word === 'baz');
  assert(baz, 'baz should be reported');
  assert(baz.delta === 3);
});

test('wordFrequencyDelta: returns removed words', () => {
  const rows = wordFrequencyDelta('help help help done', 'done', { minLen: 3 });
  const help = rows.find(r => r.word === 'help');
  assert(help);
  assert(help.delta === -3);
});

test('wordFrequencyDelta: respects minLen', () => {
  const rows = wordFrequencyDelta('ab', 'ab cd', { minLen: 3 });
  assert(rows.length === 0, 'both words < 3 chars');
});

// Pricing + tokenImpact tests
test('pricing: resolveModel handles aliases', () => {
  assert(resolveModel('claude') === 'claude-sonnet-4-6');
  assert(resolveModel('opus') === 'claude-opus-4-7');
  assert(resolveModel('reasoning') === 'o3');
});

test('pricing: approxTokens returns positive', () => {
  assert(approxTokens('hello world this is a test') > 0);
  assert(approxTokens('') === 0);
});

test('pricing: costForTokens math', () => {
  // 1M input tokens on claude-sonnet-4-6 @ $3/MTok → $3.00
  const c = costForTokens(1_000_000, 0, 'claude-sonnet-4-6');
  assert(Math.abs(c.total - 3.00) < 0.0001, `expected $3 got ${c.total}`);
});

test('pricing: MODELS table has 2026-04 flagship', () => {
  assert(MODELS['gpt-5.4']);
  assert(MODELS['claude-opus-4-7']);
  assert(MODELS['gemini-3.1-pro']);
  assert(MODELS['llama-4-scout']);
});

test('tokenImpact: reports delta across versions', () => {
  const a = 'short prompt';
  const b = 'much longer prompt with many additional words here and there you see';
  const imp = tokenImpact(a, b, 'claude-sonnet-4-6', 100);
  assert(imp.tokens.delta > 0, 'tokens should grow');
  assert(imp.costPerCall.delta > 0, 'cost should grow');
  assert(imp.monthly.calls === 100);
});

// formatMarkdown tests
test('formatMarkdown: emits fenced diff block', () => {
  const lines = lineDiff('a\nb', 'a\nc');
  const out = formatMarkdown(lines, { file1: 'v1', file2: 'v2' });
  assert(out.startsWith('```diff'));
  assert(out.endsWith('```'));
  assert(out.includes('--- v1'));
  assert(out.includes('+++ v2'));
  assert(out.includes('- b'));
  assert(out.includes('+ c'));
});

// Real world prompt diff test
test('diff: handles real prompt change', () => {
  const old = 'You are a helpful assistant. Be concise.';
  const new_ = 'You are a coding expert. Be concise and precise.';
  const result = diff(old, new_);
  
  const added = result.filter(r => r.type === 'added').map(r => r.value);
  const removed = result.filter(r => r.type === 'removed').map(r => r.value);
  
  assert(added.includes('coding'));
  assert(added.includes('expert.'));
  assert(removed.includes('helpful'));
  assert(removed.includes('assistant.'));
});

console.log(`\n${passed}/${passed + failed} tests passed`);
process.exit(failed > 0 ? 1 : 0);
