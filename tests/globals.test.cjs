const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

function results(library) {
  const records = JSON.parse(library.getResultsFromServer());
  const summary = records.find(record => record.type === 'TESTS_RESULTS_ALL').value;
  const tests = records.filter(record => record.type === 'TESTS_RESULTS_ONE')
    .map(record => record.value);
  assert.equal(summary.total, tests.reduce((total, test) => total + test.assertions.length, 0));
  return { tests, summary };
}

test('clean tests and HTML generation do not introduce wrapper globals', () => {
  const library = createLibrary();
  vm.runInContext(`
    init(); QUnit.config.noglobals = true;
    QUnit.test('clean', function(assert) { assert.ok(true); });
    QUnit.test('HTML', function(assert) { assert.ok(getHtml().getContent()); });
    QUnit.start();
  `, library, { timeout: 5000 });
  assert.equal(results(library).summary.failed, 0);
  assert.equal(Object.hasOwn(library, 'cache'), false);
  assert.equal(Object.hasOwn(library, 'testHtml'), false);
});

test('bundled engine reports added and deleted globals and continues accurately', () => {
  const library = createLibrary();
  vm.runInContext(`
    existingGlobal = true;
    init(); QUnit.config.noglobals = true;
    QUnit.test('addition', function(assert) { leakedGlobal = 1; assert.ok(true); });
    QUnit.test('deletion', function(assert) { delete existingGlobal; assert.ok(true); });
    QUnit.test('next clean', function(assert) { assert.ok(true); });
    QUnit.start();
  `, library, { timeout: 5000 });
  const { tests, summary } = results(library);
  assert.equal(summary.failed, 2);
  assert.equal(summary.passed, 3);
  assert.match(tests[0].assertions[1].message, /Introduced global variable\(s\): leakedGlobal/);
  assert.match(tests[1].assertions[1].message, /Deleted global variable\(s\): existingGlobal/);
  assert.equal(tests[2].results.failed, 0);
});

function consumer(source) {
  const library = createLibrary();
  const context = vm.createContext({ QUnitGS2: {
    QUnit: library.QUnit, init: library.init, getHtml: library.getHtml
  } });
  vm.runInContext(source, context, { filename: 'consumer.gs', timeout: 5000 });
  vm.runInContext('', library, { timeout: 5000 });
  return { library, context, ...results(library) };
}

test('checks the consumer scope instead of the library scope when explicitly supplied', () => {
  const { summary, tests } = consumer(`
    var QUnit = QUnitGS2.QUnit;
    globalThis.existingGlobal = true;
    QUnitGS2.init({ globalObject: globalThis });
    QUnit.config.noglobals = true;
    QUnit.test('clean consumer', function(assert) { assert.ok(true); });
    QUnit.test('consumer leak', function(assert) { consumerLeak = true; assert.ok(true); });
    QUnit.test('consumer deletion', function(assert) { delete globalThis.existingGlobal; assert.ok(true); });
    QUnit.test('continued', function(assert) { assert.ok(true); });
    QUnit.start();
  `);
  assert.equal(summary.failed, 2);
  assert.equal(tests[0].results.failed, 0);
  assert.match(tests[1].assertions[1].message, /consumerLeak/);
  assert.match(tests[2].assertions[1].message, /existingGlobal/);
  assert.equal(tests[3].results.failed, 0);
});

test('checks remain off by default even with a caller scope', () => {
  const { summary } = consumer(`
    var QUnit = QUnitGS2.QUnit;
    QUnitGS2.init({ globalObject: globalThis });
    QUnit.test('unchecked', function(assert) { uncheckedGlobal = true; assert.ok(true); });
    QUnit.start();
  `);
  assert.equal(summary.failed, 0);
});

test('retains property-name checking semantics for existing values and lexical bindings', () => {
  const { summary } = consumer(`
    var QUnit = QUnitGS2.QUnit;
    globalThis.intentional = 1;
    QUnitGS2.init({ globalObject: globalThis });
    QUnit.config.noglobals = true;
    QUnit.test('not property additions', function(assert) {
      globalThis.intentional = 2;
      Object.defineProperty(globalThis, 'hidden', { value: 1, enumerable: false });
      let local = 1;
      assert.strictEqual(local, 1);
    });
    QUnit.start();
  `);
  assert.equal(summary.failed, 0);
});

test('caller-scope checks work with console-only output', () => {
  const library = createLibrary();
  const lines = [];
  library.console = { log: line => lines.push(line) };
  const context = vm.createContext({ QUnitGS2: {
    QUnit: library.QUnit, init: library.init
  } });
  vm.runInContext(`
    var QUnit = QUnitGS2.QUnit;
    QUnitGS2.init({ globalObject: globalThis, logToConsole: true, cacheResults: false });
    QUnit.config.noglobals = true;
    QUnit.test('leaking', function(assert) { leakedInConsole = true; assert.ok(true); });
    QUnit.start();
  `, context, { timeout: 5000 });
  vm.runInContext('', library, { timeout: 5000 });
  assert.match(lines.join('\n'), /Introduced global variable\(s\): leakedInConsole/);
  const summaryLine = lines.find(line => line.startsWith('[QUnitGS2] Suite complete: '));
  assert.equal(JSON.parse(summaryLine.split('Suite complete: ')[1]).failed, 1);
  assert.equal(library.getResultsFromServer(), null);
});

test('rejects invalid global scopes without clearing previous results', () => {
  for (const globalObject of [null, undefined, false, [], 'global', 1]) {
    const cache = new Map([['qunit_test_results', 'previous report']]);
    const library = createLibrary(cache);
    assert.throws(() => library.init({ globalObject }), /globalObject must be an object/);
    assert.equal(cache.get('qunit_test_results'), 'previous report');
  }
});

test('initialization resets the globals baseline and an earlier caller scope', () => {
  const library = createLibrary();
  library.init({ globalObject: {} });
  library.QUnit.config.pollution = ['stale'];
  library.init();
  assert.equal(library.QUnit.config.gsGlobalObject, undefined);
  assert.equal(library.QUnit.config.pollution, undefined);
});

test('README globals example runs in a separate consumer scope', () => {
  const markdown = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const section = markdown.split('### Check for accidental globals')[1].split('## Deploy')[0];
  const source = section.match(/```javascript\r?\n([\s\S]*?)```/)[1];
  assert.equal(consumer(source + '\ndoGet();').summary.failed, 0);
});
