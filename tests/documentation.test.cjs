const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

function javascriptBlocks(file) {
  const markdown = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  return [...markdown.matchAll(/```javascript\r?\n([\s\S]*?)```/g)].map(match => match[1]);
}

function runExample(source) {
  const library = createLibrary();
  const context = vm.createContext({
    QUnitGS2: {
      QUnit: library.QUnit,
      init: library.init,
      getHtml: library.getHtml,
      getResultsFromServer: library.getResultsFromServer
    }
  });
  vm.runInContext(`${source}\nvar output = doGet();`, context, {
    filename: 'documentation.gs', timeout: 5000
  });
  vm.runInContext('', library, { timeout: 5000 });
  assert.match(context.output.getContent(), /id="qunit-tests"/);
  assert.doesNotMatch(context.output.getContent(), /<\?/);
  const results = JSON.parse(context.getResultsFromServer());
  const tests = results.filter(item => item.type === 'TESTS_RESULTS_ONE');
  const summaries = results.filter(item => item.type === 'TESTS_RESULTS_ALL');
  assert.equal(tests.length, 1);
  assert.equal(summaries.length, 1);
  return { results, summary: summaries[0].value };
}

const assertion = "QUnit.test('documented example', function(assert) { assert.equal(1 + 1, 2); });";

test('README connecting code runs with a user-defined test function', () => {
  const blocks = javascriptBlocks('README.md');
  const { summary } = runExample(`${blocks[0]}\n${blocks[1]}
    function userDefinedtestFunctions() { ${assertion} }`);
  assert.equal(summary.total, 1);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 0);
});

test('documentation harness does not leak the library QUnit global into the consumer', () => {
  const blocks = javascriptBlocks('README.md');
  const source = `${blocks[0]}\n${blocks[1]}
    function userDefinedtestFunctions() { ${assertion} }`;
  assert.throws(() => runExample(source.replace(
    'var QUnit = QUnitGS2.QUnit;', 'var Qunit = QUnitGS2.QUnit;'
  )), /QUnit is not defined/);
});

for (const [name, file] of [
  ['home', 'website/user/pages/01.home/default.md'],
  ['quick start', 'website/user/pages/03.quick-start-guide/default.md']
]) {
  test(`website ${name} connecting code runs after inserting a test`, () => {
    const source = javascriptBlocks(file).join('\n');
    assert.ok(source.includes('QUnit.start();'));
    const { summary } = runExample(source.replace('QUnit.start();', `${assertion}\nQUnit.start();`));
    assert.equal(summary.total, 1);
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 0);
  });
}

for (const [stage, implementation, failed] of [['before', 1, 1], ['after', 3, 0]]) {
  test(`website tutorial reports expected counts ${stage} the rounding fix`, () => {
    const blocks = javascriptBlocks('website/user/pages/02.examples/03.step-by-step-tutorial/default.md');
    assert.equal(blocks.length, 4);
    const source = blocks[0].replace('QUnit.start();', `${blocks[2]}\nQUnit.start();`);
    const { summary } = runExample(`${source}\n${blocks[implementation]}`);
    assert.equal(summary.total, 2);
    assert.equal(summary.failed, failed);
    assert.equal(summary.passed, 2 - failed);
  });
}
