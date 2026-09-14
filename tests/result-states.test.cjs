const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary, runSuite } = require('./runner.cjs');

const renderer = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'qunit.js.html'), 'utf8')
  .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''), renderer);

function analyze(records) {
  return renderer.analyzeResults(records);
}

const passing = JSON.parse(runSuite(`
  QUnit.test('ordinary', function(assert) { assert.ok(true, 'recorded assertion'); });
`).resultsString);

for (const [name, source] of [
  ['ordinary pass', "QUnit.test('pass', a => a.ok(true));"],
  ['throwing test', "QUnit.test('throw', () => { throw new Error('failure'); });"],
  ['skipped test', "QUnit.skip('skip', () => {});"],
  ['expected todo failure', "QUnit.todo('todo', a => a.ok(false));"],
  ['unexpected todo pass', "QUnit.todo('todo', a => a.ok(true));"],
  ['explicit zero-assertion test', "QUnit.test('zero', a => a.expect(0));"],
  ['omitted serialized fields', "QUnit.test('undefined', a => a.strictEqual('defined', undefined));"]
]) {
  test(`accepts real engine records for ${name}`, () => {
    const { resultsString, summary } = runSuite(source);
    const result = analyze(JSON.parse(resultsString));
    assert.equal(result.problems.length, 0);
    assert.ok(result.tests.every(test => test.complete));
    assert.deepEqual(result.summary, summary);
  });
}

test('does not turn a cache miss into a completed empty suite', () => {
  const library = createLibrary();
  library.init();
  assert.equal(library.getResultsFromServer(), null);
  assert.equal(analyze([]).summary, null);
  assert.match(analyze([]).problems.join(' '), /No suite completion summary/);
});

test('accepts an explicit zero-assertion completion record without inventing one', () => {
  const result = analyze([{ type: 'TESTS_RESULTS_ALL', value: {
    passed: 0, failed: 0, total: 0, runtime: 0
  } }]);
  assert.equal(result.problems.length, 0);
  assert.equal(result.tests.length, 0);
  assert.equal(result.summary.total, 0);
});

for (const value of [null, {}, 1, 'results']) {
  test(`rejects a non-array result root: ${JSON.stringify(value)}`, () => {
    assert.throws(() => analyze(value), /Expected an array/);
  });
}

for (const [name, change] of [
  ['missing summary', records => records.pop()],
  ['missing test row', records => records.shift()],
  ['null record', records => records.unshift(null)],
  ['unknown record', records => records.push({ type: 'UNKNOWN', value: {} })],
  ['missing record value', records => { delete records[0].value; }],
  ['missing record id', records => { delete records[0].value.id; }],
  ['duplicate test id', records => records.push(records[0])],
  ['duplicate summary', records => records.push(records[2])],
  ['null summary', records => { records[2].value = null; }],
  ['non-numeric counts', records => { records[2].value.total = '2'; }],
  ['negative counts', records => { records[2].value.failed = -1; }],
  ['fractional counts', records => { records[2].value.total = 2.5; }],
  ['non-finite runtime', records => { records[2].value.runtime = Infinity; }],
  ['incorrect summary totals', records => { records[2].value.total++; }],
  ['self-consistent but mismatched summary', records => {
    records[2].value.total++;
    records[2].value.passed++;
  }],
  ['partial test', records => { records[0].value.results = {}; }],
  ['missing test results', records => { delete records[0].value.results; }],
  ['mismatched test id', records => { records[0].value.results.testId = 'other'; }],
  ['missing test name', records => { delete records[0].value.results.name; }],
  ['missing test runtime', records => { delete records[0].value.results.runtime; }],
  ['missing assertion array', records => { records[0].value.assertions = null; }],
  ['missing assertions', records => { records[0].value.assertions = []; }],
  ['malformed assertion', records => { records[0].value.assertions[0] = null; }],
  ['non-boolean outcome', records => { records[0].value.assertions[0].result = 'false'; }],
  ['mismatched assertion id', records => { records[0].value.assertions[0].testId = 'other'; }],
  ['malformed diff', records => { records[0].value.assertions[0].diff = {}; }],
  ['inconsistent assertion outcomes', records => { records[0].value.results.assertions[0].result = false; }],
  ['missing compact assertions', records => { delete records[0].value.results.assertions; }]
]) {
  test(`does not trust completion with ${name}`, () => {
    const records = structuredClone(passing);
    change(records);
    const result = analyze(records);
    assert.ok(result.problems.length > 0, name);
    assert.ok(result.tests.some(test => test.details.name === 'subsequent test'));
  });
}

test('recovers named partial assertion records without claiming a completed test', () => {
  const records = structuredClone(passing);
  records[0].value.results = {};
  records.pop();
  const result = analyze(records);
  const partial = result.tests[0];
  assert.equal(partial.complete, false);
  assert.equal(partial.details.name, 'ordinary');
  assert.equal(partial.details.total, 1);
  assert.equal(partial.details.passed, 1);
  assert.equal(partial.details.failed, 0);
  assert.equal(partial.details.runtime, '');
  assert.equal(partial.assertions[0].message, 'recorded assertion');
  assert.equal(result.summary, null);
});

test('keeps only usable assertions and counts those actually recovered', () => {
  const records = structuredClone(passing);
  records[0].value.assertions.push(null);
  const result = analyze(records);
  assert.equal(result.tests[0].complete, false);
  assert.equal(result.tests[0].details.total, 1);
  assert.equal(result.tests[0].assertions.length, 1);
  assert.equal(result.tests[1].complete, true);
});

test('keeps an assertion with a malformed optional diff but marks the test incomplete', () => {
  const records = structuredClone(passing);
  records[0].value.assertions[0].diff = {};
  const result = analyze(records);
  assert.equal(result.tests[0].complete, false);
  assert.equal(result.tests[0].assertions.length, 1);
  assert.equal(result.tests[0].assertions[0].message, 'recorded assertion');
  assert.ok(result.problems.length > 0);
});

test('does not mutate the cached records or depend on summary order', () => {
  const records = structuredClone(passing);
  records.unshift(records.pop());
  const before = structuredClone(records);
  assert.equal(analyze(records).problems.length, 0);
  assert.deepEqual(records, before);
});
