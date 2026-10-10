const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

for (const [file, entry, total, testCount] of [
  ['tests/live/test/main/modules.gs', 'modules', 70, 33],
  ['tests/live/test/main/assert/step.gs', 'step', 39, 10]
]) {
  test(`imported ${entry} suite completes with accurate assertion and banner totals`, () => {
    const store = new Map();
    const library = createLibrary(store);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), library);
    vm.runInContext(`init(); ${entry}(); QUnit.start();`, library, { timeout: 5000 });
    const json = library.getResultsFromServer();
    assert.equal(createLibrary(store).getResultsFromServer(), json);
    const records = JSON.parse(json);
    const summaries = records.filter(record => record.type === 'TESTS_RESULTS_ALL');
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].value.total, total);
    assert.equal(summaries[0].value.failed, 0);
    const tests = records.filter(record => record.type === 'TESTS_RESULTS_ONE');
    assert.equal(tests.length, testCount);
    assert.equal(tests.reduce((count, record) => count + record.value.assertions.length, 0), total);
    const renderer = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'qunit.js.html'), 'utf8')
      .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''), renderer);
    const result = renderer.analyzeResults(records);
    assert.equal(result.problems.length, 0);
    assert.equal(result.summary.total, total);
  });
}

test('collector leaves raw assertion types and references intact for later QUnit callbacks', () => {
  const library = createLibrary();
  vm.runInContext(`
    init();
    var objectActual = { value: 1 };
    var objectExpected = { value: 1 };
    var logged = [];
    QUnit.log(function(details) { logged.push(details); });
    QUnit.test('raw objects', function(assert) {
      assert.deepEqual(objectActual, objectExpected, 'objects');
      assert.strictEqual(undefined, undefined, 'undefined');
      assert.step('first');
      assert.verifySteps(['first'], 'steps');
    });
    QUnit.start();
  `, library, { timeout: 5000 });
  const object = library.logged.find(details => details.message === 'objects');
  assert.equal(object.actual, library.objectActual);
  assert.equal(object.expected, library.objectExpected);
  assert.equal(Object.hasOwn(object, 'diff'), false);
  const steps = library.logged.find(details => details.message === 'steps');
  assert.ok(Array.isArray(steps.actual));
  assert.deepEqual(Array.from(steps.actual), ['first']);
  assert.equal(library.logged.find(details => details.message === 'undefined').actual, undefined);
  const cached = JSON.parse(library.getResultsFromServer());
  assert.equal(typeof cached[0].value.assertions[0].actual, 'string');
  assert.equal(cached.at(-1).value.failed, 0);
});
