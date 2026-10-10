const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary, runSuite } = require('./runner.cjs');

for (const expression of ["new Error('debug error')", "'debug string'", 'null', '0']) {
  test(`notrycatch propagates the original thrown ${expression} directly from start`, () => {
    const library = createLibrary();
    vm.runInContext(`
      init(); QUnit.config.notrycatch = true;
      var thrownValue = ${expression};
      var laterRan = false;
      QUnit.test('before', function(assert) { assert.ok(true); });
      QUnit.test('throwing', function(assert) {
        assert.ok(true, 'before throw');
        throw thrownValue;
      });
      QUnit.test('later', function(assert) { laterRan = true; assert.ok(true); });
    `, library);
    let caught = false;
    try {
      vm.runInContext('QUnit.start();', library, { timeout: 5000 });
    } catch (error) {
      caught = true;
      assert.equal(error, library.thrownValue);
    }
    assert.equal(caught, true);
    assert.equal(library.laterRan, false);
    const records = JSON.parse(library.getResultsFromServer());
    assert.equal(records.some(record => record.type === 'TESTS_RESULTS_ALL'), false);
    assert.equal(records[0].value.results.name, 'before');
    assert.equal(records[1].value.assertions[0].message, 'before throw');
    assert.deepEqual(Object.keys(records[1].value.results), []);
  });
}

for (const hook of ['before', 'beforeEach', 'afterEach', 'after']) {
  test(`notrycatch propagates ${hook} exceptions without converting them to assertions`, () => {
    const library = createLibrary();
    vm.runInContext(`
      init(); QUnit.config.notrycatch = true;
      var failure = new Error('${hook} debug failure');
      var laterRan = false;
      QUnit.module('hooks', function(hooks) {
        hooks.${hook}(function() { throw failure; });
        QUnit.test('hooked', function(assert) { assert.ok(true); });
      });
      QUnit.module('subsequent');
      QUnit.test('later', function(assert) { laterRan = true; assert.ok(true); });
    `, library);
    assert.throws(() => vm.runInContext('QUnit.start();', library), error => error === library.failure);
    assert.equal(library.laterRan, false);
    const records = JSON.parse(library.getResultsFromServer()) || [];
    assert.equal(records.some(record => record.type === 'TESTS_RESULTS_ALL'), false);
    assert.ok(records.every(record => record.value.assertions.every(item => item.result)));
  });
}

test('synchronous debug suites complete with ordinary failures and assert.throws semantics', () => {
  const { summary, tests } = runSuite(`
    QUnit.config.notrycatch = true;
    QUnit.module('debug', function(hooks) {
      hooks.beforeEach(function(assert) { assert.ok(true, 'setup'); });
      QUnit.test('intentional failure', function(assert) { assert.strictEqual(1, 2); });
      QUnit.test('expected exception', function(assert) {
        assert.throws(function() { throw new Error('expected'); }, /expected/);
      });
    });
  `);
  assert.equal(summary.failed, 1);
  assert.equal(tests.length, 3);
});

test('debug task queue drains iteratively without per-test recursion', () => {
  const library = createLibrary();
  vm.runInContext(`
    init({ logToConsole: true, cacheResults: false });
    QUnit.config.notrycatch = true;
    for (var i = 0; i < 2000; i++) {
      QUnit.test('test ' + i, function(assert) { assert.ok(true); });
    }
  `, library);
  let summary;
  library.console = { log: line => {
    if (line.startsWith('[QUnitGS2] Suite complete: ')) {
      summary = JSON.parse(line.split('Suite complete: ')[1]);
    }
  } };
  vm.runInContext('QUnit.start();', library, { timeout: 10000 });
  assert.equal(summary.total, 2000);
  assert.equal(summary.failed, 0);
});

for (const source of [
  "QUnit.test('async', function(assert) { assert.async(); });",
  "QUnit.test('thenable', function() { return { then: function() {} }; });",
  "QUnit.module('async hook', function(hooks) { hooks.before(function() { return { then: function() {} }; }); QUnit.test('test', a => a.ok(true)); });",
  "QUnit.begin(function() { return { then: function() {} }; }); QUnit.test('test', a => a.ok(true));"
]) {
  test(`unsupported async debug work fails explicitly: ${source.slice(0, 30)}`, () => {
    const library = createLibrary();
    vm.runInContext(`init(); QUnit.config.notrycatch = true; ${source}`, library);
    assert.throws(() => vm.runInContext('QUnit.start();', library),
      /synchronous runs require synchronous/);
    const records = JSON.parse(library.getResultsFromServer()) || [];
    assert.equal(records.some(record => record.type === 'TESTS_RESULTS_ALL'), false);
  });
}

test('default mode still reports exceptions and continues subsequent tests', () => {
  assert.equal(runSuite("QUnit.test('throw', function() { throw new Error('ordinary'); });")
    .summary.failed, 1);
});

test('debug logging callback exceptions propagate rather than rejecting a queue promise', () => {
  const library = createLibrary();
  vm.runInContext(`
    init(); QUnit.config.notrycatch = true;
    var callbackError = new Error('debug logging failure');
    QUnit.testStart(function() { throw callbackError; });
    QUnit.test('never starts', function(assert) { assert.ok(true); });
  `, library);
  assert.throws(() => vm.runInContext('QUnit.start();', library),
    error => error === library.callbackError);
  assert.equal(library.getResultsFromServer(), null);
});

test('consumer doGet receives the original debug exception synchronously', () => {
  const library = createLibrary();
  const consumer = vm.createContext({ QUnitGS2: {
    QUnit: library.QUnit, init: library.init, getHtml: library.getHtml
  } });
  vm.runInContext(`
    var QUnit = QUnitGS2.QUnit;
    var failure = new Error('consumer debug failure');
    function doGet() {
      QUnitGS2.init();
      QUnit.config.notrycatch = true;
      QUnit.test('debug', function() { throw failure; });
      QUnit.start();
      return QUnitGS2.getHtml();
    }
  `, consumer);
  assert.throws(() => consumer.doGet(), error => error === consumer.failure);
  assert.equal(library.getResultsFromServer(), null);
});

test('README debug runner raises its documented error from the consumer call', () => {
  const library = createLibrary();
  const lines = [];
  library.console = { log: line => lines.push(line) };
  const consumer = vm.createContext({ QUnitGS2: {
    QUnit: library.QUnit, init: library.init
  } });
  const markdown = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const section = markdown.split('### Debug without catching exceptions')[1]
    .split('### Check for accidental globals')[0];
  const source = section.match(/```javascript\r?\n([\s\S]*?)```/)[1];
  vm.runInContext(source, consumer);
  assert.throws(() => consumer.debugTests(), /Inspect this original error in the execution log/);
  assert.equal(lines.some(line => line.includes('Suite complete')), false);
  assert.equal(library.getResultsFromServer(), null);
});
