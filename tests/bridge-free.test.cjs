const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

function embedded(output) {
  const match = output.getContent().match(
    /<script type="application\/json" id="qunit-embedded-results">([\s\S]*?)<\/script>/);
  assert.ok(match, 'completed report is embedded');
  return JSON.parse(match[1]);
}

test('bridge-free consumer returns complete HTML with ordinary errors and no result RPC or cache writes', () => {
  const cache = new Map([['qunit_test_results', 'previous legacy report']]);
  cache.set = () => assert.fail('bridge-free run must not write user cache');
  const library = createLibrary(cache);
  const originalCache = library.CACHE_;
  const consumer = vm.createContext({ QUnitGS2: {
    QUnit: library.QUnit, run: library.run
  } });
  vm.runInContext(`
    var QUnit = QUnitGS2.QUnit;
    function registerTests() {
      QUnit.module('bridge-free');
      QUnit.test('pass', a => a.ok(true));
      QUnit.test('exception', function() { throw new Error('helper failed'); });
      QUnit.test('subsequent', a => a.ok(true));
    }
    function doGet() { return QUnitGS2.run(registerTests); }
  `, consumer);
  const output = consumer.doGet();
  assert.equal(consumer.getResultsFromServer, undefined);
  const records = embedded(output);
  assert.equal(records.at(-1).value.total, 3);
  assert.equal(records.at(-1).value.failed, 1);
  assert.match(records[1].value.assertions[0].message, /helper failed/);
  assert.equal(records[2].value.results.failed, 0);
  assert.equal(library.CACHE_, originalCache);
  assert.equal(cache.get('qunit_test_results'), 'previous legacy report');
  assert.equal(library.QUnit.config.gsSynchronousRun, false);
});

test('embedded results cannot close the JSON script element or inject HTML', () => {
  const library = createLibrary();
  const message = '</script><script>window.injected=true</script>&\u2028\u2029';
  library.message = message;
  const output = vm.runInContext(`run(function() {
    QUnit.test('literal data', function(assert) {
      assert.strictEqual(message, 'different', message);
    });
  })`, library);
  assert.equal(embedded(output)[0].value.assertions[0].message, message);
  assert.equal(output.getContent().includes('<script>window.injected'), false);
});

test('bridge-free reports do not inherit single-entry cache limits', () => {
  const library = createLibrary();
  library.largeValue = randomBytes(120000).toString('base64');
  const output = vm.runInContext(`run(function() {
    QUnit.test('large report', function(assert) {
      assert.strictEqual(largeValue, largeValue);
    });
  })`, library, { timeout: 5000 });
  assert.ok(Buffer.byteLength(output.getContent()) > 100000);
  assert.equal(embedded(output).at(-1).value.failed, 0);
});

for (const source of [
  "QUnit.test('async', function(assert) { assert.async(); });",
  "QUnit.test('thenable', function() { return { then: function() {} }; });",
  "QUnit.module('hook', { before: function() { return { then: function() {} }; } }); QUnit.test('test', a => a.ok(true));",
  "QUnit.testStart(function() { return { then: function() {} }; }); QUnit.test('test', a => a.ok(true));",
  "QUnit.log(function() { return { then: function() {} }; }); QUnit.test('test', a => a.ok(true));"
]) {
  test(`unsupported bridge-free async work fails rather than returning success: ${source.slice(0, 25)}`, () => {
    const library = createLibrary();
    const originalCache = library.CACHE_;
    assert.throws(() => vm.runInContext(`run(function() { ${source} })`, library),
      /synchronous/);
    assert.equal(library.CACHE_, originalCache);
    assert.equal(library.QUnit.config.gsSynchronousRun, false);
  });
}

test('registration failures and invalid runners restore the cache handle', () => {
  const library = createLibrary();
  const originalCache = library.CACHE_;
  assert.throws(() => library.run(null), /registration function/);
  assert.throws(() => vm.runInContext("run(function() { throw new Error('registration failed'); })", library),
    /registration failed/);
  assert.equal(library.CACHE_, originalCache);
  assert.equal(library.QUnit.config.gsSynchronousRun, false);
  const next = createLibrary();
  assert.throws(() => vm.runInContext('run(function() { return { then: function() {} }; })', next),
    /synchronous test registration/);
});

test('legacy getHtml does not embed results and retains the bridge path', () => {
  const library = createLibrary();
  library.init();
  assert.doesNotMatch(library.getHtml().getContent(), /id="qunit-embedded-results"/);
  assert.match(library.getHtml().getContent(), /\.getResultsFromServer\(\)/);
});

test('bridge-free debug errors propagate and do not return an incomplete page', () => {
  const library = createLibrary();
  assert.throws(() => vm.runInContext(`run(function() {
    QUnit.config.notrycatch = true;
    QUnit.test('debug', function() { throw new Error('uncaught debug'); });
  })`, library), /uncaught debug/);
});

test('README bridge-free runner works in a consumer without bridge globals', () => {
  const library = createLibrary();
  const context = vm.createContext({ QUnitGS2: { QUnit: library.QUnit, run: library.run } });
  const markdown = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const section = markdown.split('### HTML results without a browser bridge')[1]
    .split('### Run tests from the editor')[0];
  vm.runInContext(section.match(/```javascript\r?\n([\s\S]*?)```/)[1], context);
  assert.equal(embedded(context.doGet()).at(-1).value.passed, 1);
  assert.equal(context.getResultsFromServer, undefined);
});
