const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, {
      filename: file,
      timeout: 5000
    });
  }
  vm.runInContext(`init(); ${source}
    QUnit.test('subsequent test', function(assert) { assert.ok(true); });
    QUnit.start();`, context, { filename: 'suite.gs', timeout: 5000 });
  const resultsString = context.getResultsFromServer();
  const results = JSON.parse(resultsString);
  const summaries = results.filter(item => item.type === 'TESTS_RESULTS_ALL');
  assert.equal(summaries.length, 1, 'suite completes with exactly one summary');
  const tests = results.filter(item => item.type === 'TESTS_RESULTS_ONE').map(item => item.value);
  assert.equal(tests.at(-1).results.name, 'subsequent test');
  assert.equal(tests.at(-1).results.failed, 0);
  assert.equal(new Set(tests.map(item => item.id)).size, tests.length, 'each test has its own result');
  for (const test of tests) {
    assert.equal(test.results.total, test.assertions.length, 'all assertions are recorded');
    assert.equal(test.results.failed, test.assertions.filter(item => !item.result).length);
    assert.equal(test.results.passed, test.assertions.filter(item => item.result).length);
  }
  const summary = summaries[0].value;
  for (const key of ['total', 'passed', 'failed']) {
    assert.equal(summary[key], tests.reduce((sum, test) => sum + test.results[key], 0));
  }
  return { tests, summary, resultsString };
}

module.exports = { runSuite };
