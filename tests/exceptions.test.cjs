const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function runSuite(source) {
  const cache = new Map();
  const context = vm.createContext({
    HtmlService: {},
    CacheService: {
      getUserCache: () => ({
        get: key => cache.get(key) ?? null,
        put: (key, value) => cache.set(key, value),
        remove: key => cache.delete(key)
      })
    }
  }, { microtaskMode: 'afterEvaluate' });
  for (const file of ['QUnitGS2.gs', 'qunitjs.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  vm.runInContext(`init(); ${source}
    QUnit.test('subsequent test', function(assert) { assert.ok(true); });
    QUnit.start();`, context);
  const results = JSON.parse(context.getResultsFromServer());
  const summary = results.find(item => item.type === 'TESTS_RESULTS_ALL');
  assert.ok(summary, 'suite completes with totals');
  const tests = results.filter(item => item.type === 'TESTS_RESULTS_ONE').map(item => item.value);
  assert.equal(tests.at(-1).results.name, 'subsequent test');
  assert.equal(tests.at(-1).results.failed, 0);
  return { tests, summary: summary.value };
}

for (const thrown of ["'uh oh'", "new Error('uh oh')"]) {
  test(`records thrown ${thrown} and continues`, () => {
    const { tests, summary } = runSuite(`
      QUnit.test('exception', function() { throw ${thrown}; });
    `);
    assert.equal(tests[0].results.failed, 1);
    assert.match(tests[0].assertions[0].message, /uh oh/);
    assert.equal(tests[0].assertions[0].diff, '');
    assert.equal(Object.hasOwn(tests[0].assertions[0], 'expected'), false);
    assert.equal(summary.failed, 1);
    assert.equal(summary.passed, 1);
  });
}

for (const hook of ['before', 'beforeEach', 'afterEach', 'after']) {
  test(`records a failing ${hook} hook`, () => {
    const { tests, summary } = runSuite(`
      QUnit.module('hooks', function(hooks) {
        hooks.${hook}(function() { throw new Error('hook failure'); });
        QUnit.test('hook test', function(assert) { assert.ok(true); });
      });
    `);
    assert.equal(summary.failed, 1);
    assert.ok(tests[0].assertions.some(item => !item.result && /hook failure/.test(item.message)));
  });
}

test('preserves ordinary assertions and explicit undefined comparisons', () => {
  const { tests, summary } = runSuite(`
    QUnit.test('comparisons', function(assert) {
      assert.equal(2, 2);
      assert.equal(3, 2);
      assert.strictEqual(undefined, undefined);
      assert.strictEqual('text', undefined);
      assert.deepEqual({ value: 1 }, { value: 1 });
      assert.throws(function() { throw new Error('expected'); }, /expected/);
    });
  `);
  assert.equal(tests[0].assertions.length, 6);
  assert.equal(tests[0].assertions[1].diff, '+1');
  assert.equal(summary.failed, 2);
  assert.equal(summary.passed, 5);
});
