const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

function run(options) {
  const cache = new Map();
  const library = createLibrary(cache);
  const lines = [];
  library.console = { log: line => lines.push(line) };
  vm.runInContext(`
    init(${JSON.stringify(options)});
    QUnit.module('console examples');
    QUnit.test('pass', function(assert) { assert.strictEqual(1, 1, 'same value'); });
    QUnit.test('failure', function(assert) { assert.strictEqual(undefined, 2, 'missing value'); });
    QUnit.test('exception', function() { throw new Error('procedure failed'); });
    QUnit.skip('skipped', function() {});
    QUnit.todo('todo', function(assert) { assert.ok(false, 'not implemented'); });
    QUnit.test('objects', function(assert) {
      var circular = {}; circular.self = circular;
      assert.strictEqual(circular, circular, 'circular value');
    });
    QUnit.start();
  `, library, { filename: 'console-suite.gs', timeout: 5000 });
  return { library, cache, lines };
}

function records(lines, label) {
  const prefix = `[QUnitGS2] ${label}: `;
  return lines.filter(line => line.startsWith(prefix))
    .map(line => JSON.parse(line.slice(prefix.length)));
}

test('console reporting is silent by default and preserves cached results', () => {
  const { library, lines } = run(undefined);
  assert.deepEqual(lines, []);
  assert.ok(JSON.parse(library.getResultsFromServer()).some(
    record => record.type === 'TESTS_RESULTS_ALL'));
});

test('opt-in logs contain assertions, failures, test identities and accurate completion counts', () => {
  const { library, lines } = run({ logToConsole: true });
  const assertions = records(lines, 'Assertion');
  const tests = records(lines, 'Test');
  const summaries = records(lines, 'Suite complete');
  assert.equal(assertions.length, 5);
  assert.equal(tests.length, 6);
  assert.equal(summaries.length, 1);
  assert.ok(tests.every(test => test.module === 'console examples'));
  assert.equal(tests.find(test => test.name === 'skipped').skipped, true);
  assert.equal(tests.find(test => test.name === 'todo').todo, true);
  const failure = assertions.find(assertion => assertion.name === 'failure');
  assert.equal(failure.result, false);
  assert.equal(failure.actual, 'undefined');
  assert.equal(failure.expected, '2');
  assert.equal(failure.message, 'missing value');
  const exception = assertions.find(assertion => assertion.name === 'exception');
  assert.match(exception.message, /procedure failed/);
  assert.match(exception.source, /console-suite\.gs/);
  assert.equal(Object.hasOwn(exception, 'expected'), false);
  assert.match(assertions.find(assertion => assertion.name === 'objects').actual, /recursion/);
  const cached = JSON.parse(library.getResultsFromServer());
  assert.deepEqual(summaries[0], cached.find(record => record.type === 'TESTS_RESULTS_ALL').value);
  const quiet = JSON.parse(run(undefined).library.getResultsFromServer());
  assert.deepEqual(cached.map(record => record.value.results?.assertions.map(item => item.result)),
    quiet.map(record => record.value.results?.assertions.map(item => item.result)));
  const cachedObject = cached.find(record => record.value.results?.name === 'objects');
  const quietObject = quiet.find(record => record.value.results?.name === 'objects');
  assert.equal(cachedObject.value.assertions[0].actual, quietObject.value.assertions[0].actual);
});

test('console-only mode needs no HTML, leaves no stale cache and performs no result writes', () => {
  const cache = new Map([['qunit_test_results', 'old report']]);
  cache.set = () => assert.fail('console-only runs must not write result cache');
  const library = createLibrary(cache);
  const lines = [];
  library.console = { log: line => lines.push(line) };
  library.HtmlService = undefined;
  library.ScriptApp = undefined;
  vm.runInContext(`
    init({ logToConsole: true, cacheResults: false });
    QUnit.test('large result', function(assert) {
      assert.strictEqual('x'.repeat(110000), 'x'.repeat(110000));
    });
    QUnit.start();
  `, library, { timeout: 5000 });
  assert.equal(library.getResultsFromServer(), null);
  assert.equal(records(lines, 'Suite complete')[0].passed, 1);
});

test('invalid or unavailable outputs fail before initialization clears prior results', () => {
  for (const options of [null, [], 'console', { logToConsole: 'true' },
    { cacheResults: 0 }, { unknown: true }, { cacheResults: false }]) {
    const cache = new Map([['qunit_test_results', 'old report']]);
    const library = createLibrary(cache);
    assert.throws(() => library.init(options), /QUnitGS2/);
    assert.equal(cache.get('qunit_test_results'), 'old report');
    assert.equal(library.QUnit.config.callbacks.done.length, 0);
  }
  for (const console of [undefined, null, {}, { log: 'not a function' }]) {
    const library = createLibrary();
    library.console = console;
    assert.throws(() => library.init({ logToConsole: true }), /requires console\.log/);
  }
});

test('logging failures are surfaced instead of silently dropping reports', () => {
  const library = createLibrary();
  library.console = { log: () => { throw new Error('logging unavailable'); } };
  library.init({ logToConsole: true, cacheResults: false });
  const onAssertion = library.QUnit.config.callbacks.log[0];
  assert.throws(() => onAssertion({
    testId: 'logging-failure', result: true, actual: 1, expected: 1
  }), /logging unavailable/);
  assert.equal(library.getResultsFromServer(), null);
});

test('README console-only example runs as a consumer without a web-app deployment', () => {
  const library = createLibrary();
  const lines = [];
  library.console = { log: line => lines.push(line) };
  const context = vm.createContext({ QUnitGS2: {
    QUnit: library.QUnit, init: library.init
  } });
  const markdown = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const section = markdown.split('### Run tests from the editor')[1].split('## Deploy')[0];
  const source = section.match(/```javascript\r?\n([\s\S]*?)```/)[1];
  vm.runInContext(source + '\nrunTests();', context, { timeout: 5000 });
  vm.runInContext('', library, { timeout: 5000 });
  assert.equal(records(lines, 'Suite complete').length, 1);
  assert.equal(records(lines, 'Suite complete')[0].passed, 1);
  assert.equal(library.getResultsFromServer(), null);
});
