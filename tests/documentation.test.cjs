const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

function readDocument(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function javascriptBlocks(file) {
  const markdown = readDocument(file);
  return [...markdown.matchAll(/```javascript\r?\n([\s\S]*?)```/g)].map(match => match[1]);
}

function createConsumer(source, globals = {}) {
  const library = createLibrary();
  const context = vm.createContext({
    ...globals,
    HtmlService: library.HtmlService,
    QUnitGS2: {
      QUnit: library.QUnit,
      init: library.init,
      getHtml: library.getHtml,
      getResultsFromServer: library.getResultsFromServer
    }
  });
  vm.runInContext(source, context, {
    filename: 'documentation.gs', timeout: 5000
  });
  assert.equal(library.getResultsFromServer(), null, 'loading files must not run tests');
  return { library, context };
}

function runExample(source, { testCount, total, failed = 0, globals = {}, entry = 'doGet()' }) {
  const { library, context } = createConsumer(source, globals);
  vm.runInContext(`var output = ${entry};`, context, {
    filename: 'documentation.gs', timeout: 5000
  });
  vm.runInContext('', library, { timeout: 5000 });
  assert.match(context.output.getContent(), /id="qunit-tests"/);
  assert.doesNotMatch(context.output.getContent(), /<\?/);
  const results = JSON.parse(context.getResultsFromServer());
  const tests = results.filter(item => item.type === 'TESTS_RESULTS_ONE').map(item => item.value);
  const summaries = results.filter(item => item.type === 'TESTS_RESULTS_ALL');
  assert.equal(tests.length, testCount, 'documented number of test rows');
  assert.equal(summaries.length, 1);
  const summary = summaries[0].value;
  assert.equal(summary.total, total, 'documented number of assertions');
  assert.equal(summary.passed, total - failed, 'documented passing assertions');
  assert.equal(summary.failed, failed, 'documented failing assertions');
  for (const key of ['total', 'passed', 'failed']) {
    assert.equal(summary[key], tests.reduce((sum, test) => sum + test.results[key], 0));
  }
  for (const test of tests) {
    assert.equal(test.results.total, test.assertions.length, 'each assertion reaches the page');
  }
  return { results, tests, summary, context };
}

const assertion = "QUnit.test('documented example', function(assert) { assert.equal(1 + 1, 2); });";
const pagesRoot = 'website/user/pages';
const quickStartFile = `${pagesRoot}/03.quick-start-guide/default.md`;
const tutorialFile = `${pagesRoot}/02.examples/03.step-by-step-tutorial/default.md`;
const writingFile = `${pagesRoot}/04.how-to-guides/01.writing-tests/default.md`;
const spreadsheetFile = `${pagesRoot}/04.how-to-guides/02.testing-spreadsheet-code/default.md`;
const existingProjectFile = `${pagesRoot}/04.how-to-guides/03.testing-existing-projects/default.md`;
const quickStart = javascriptBlocks(quickStartFile)[0];
const mathFunctions = quickStart.match(/function divideThenRound[\s\S]+/)[0];

test('README connecting code runs with a user-defined test function', () => {
  const blocks = javascriptBlocks('README.md');
  runExample(`${blocks[0]}\n${blocks[1]}
    function userDefinedtestFunctions() { ${assertion} }`, { testCount: 1, total: 1 });
});

test('documentation harness does not leak the library QUnit global into the consumer', () => {
  const blocks = javascriptBlocks('README.md');
  const source = `${blocks[0]}\n${blocks[1]}
    function userDefinedtestFunctions() { ${assertion} }`;
  assert.throws(() => runExample(source.replace(
    'var QUnit = QUnitGS2.QUnit;', 'var Qunit = QUnitGS2.QUnit;'
  ), { testCount: 1, total: 1 }), /QUnit is not defined/);
});

test('homepage leads to a complete quick start that runs without inserting tests', () => {
  assert.match(readDocument(`${pagesRoot}/01.home/default.md`), /\]\(\/quick-start-guide\)/);
  const { tests } = runExample(quickStart, { testCount: 2, total: 2 });
  assert.deepEqual(tests.map(test => test.results.name), [
    'divides whole numbers', 'rounds a fractional result'
  ]);
});

for (const [stage, implementation, failed] of [['before', 0, 1], ['after', 2, 0]]) {
  test(`website tutorial reports expected counts ${stage} the rounding fix`, () => {
    const blocks = javascriptBlocks(tutorialFile);
    assert.equal(blocks.length, 4);
    const { tests } = runExample(`${blocks[1]}\n${blocks[implementation]}`, {
      testCount: 1, total: 2, failed
    });
    if (failed) {
      const failure = tests[0].assertions.find(assertion => !assertion.result);
      assert.equal(failure.actual, 2.5);
      assert.equal(failure.expected, 3);
      assert.equal(failure.message, 'fractional results round up');
    }
  });
}

test('tutorial added regression test passes alongside the original assertions', () => {
  const [broken, runner, fixed, regression] = javascriptBlocks(tutorialFile);
  const expanded = runner.replace('QUnit.module("Math");', `QUnit.module("Math");\n${regression}`);
  runExample(`${expanded}\n${fixed}`, { testCount: 2, total: 3 });
  runExample(`${expanded}\n${broken}`, { testCount: 2, total: 3, failed: 2 });
});

test('multi-file guide registers both modules with fresh fixtures', () => {
  const [runner, arrays] = javascriptBlocks(writingFile);
  const { tests } = runExample(`${mathFunctions}\n${runner}\n${arrays}`, {
    testCount: 4, total: 5
  });
  assert.deepEqual(tests.map(test => test.results.module), ['Math', 'Math', 'Arrays', 'Arrays']);
});

test('validation guide records expected exceptions as passing assertions', () => {
  const [runner, arrays, validation] = javascriptBlocks(writingFile);
  const expanded = runner.replace('QUnit.start();', 'registerValidationTests();\nQUnit.start();');
  runExample(`${mathFunctions}\n${expanded}\n${arrays}\n${validation}`, {
    testCount: 6, total: 7
  });
});

test('filter configuration runs only the documented group and sets the title', () => {
  const [runner, arrays, , config] = javascriptBlocks(writingFile);
  const filtered = runner.replace('QUnitGS2.init();', `QUnitGS2.init();\n${config}`);
  const { tests, context } = runExample(`${mathFunctions}\n${filtered}\n${arrays}`, {
    testCount: 2, total: 3
  });
  assert.ok(tests.every(test => test.results.module === 'Arrays'));
  assert.match(context.output.getContent(), /Array helper tests/);
});

test('spreadsheet logic guide runs without Google service globals', () => {
  const [calculation, orders] = javascriptBlocks(spreadsheetFile);
  const runner = quickStart.replace('registerMathTests();', 'registerOrderTests();');
  runExample(`${runner}\n${calculation}\n${orders}`, { testCount: 5, total: 5 });
});

test('spreadsheet adapter guide verifies range coordinates and values', () => {
  const [calculation, orders, adapter, adapterTest] = javascriptBlocks(spreadsheetFile);
  const runner = quickStart.replace('registerMathTests();', 'registerOrderTests();');
  const expanded = orders.replace('QUnit.module("Orders");', `QUnit.module("Orders");\n${adapterTest}`);
  runExample(`${runner}\n${calculation}\n${adapter}\n${expanded}`, { testCount: 6, total: 8 });
});

test('spreadsheet adapter handles empty and header-only sheets without reading an invalid range', () => {
  const [calculation, , adapter] = javascriptBlocks(spreadsheetFile);
  const context = vm.createContext({});
  vm.runInContext(`${calculation}\n${adapter}`, context);
  for (const lastRow of [0, 1]) {
    assert.equal(context.totalFromSheet({
      getLastRow: () => lastRow,
      getRange: () => assert.fail('an empty sheet must not request a data range')
    }), 0);
  }
});

test('separate-project guide calls the real example through a library namespace', () => {
  const [application, runner] = javascriptBlocks(existingProjectFile);
  const app = vm.createContext({});
  vm.runInContext(application, app);
  runExample(runner, {
    testCount: 1, total: 1, globals: { AppUnderTest: app }
  });
});

test('private router serves the application without running tests', () => {
  const router = javascriptBlocks(existingProjectFile)[2];
  const { context, library } = createConsumer(`${mathFunctions}\n${router}`);
  for (const event of [undefined, {}, { parameter: {} }, { parameter: { page: 'home' } }]) {
    assert.match(context.doGet(event).getContent(), /<h1>My application<\/h1>/);
    assert.equal(library.getResultsFromServer(), null);
  }
});

test('private router runs tests only on the documented test route', () => {
  const router = javascriptBlocks(existingProjectFile)[2];
  runExample(`${mathFunctions}\n${router}`, {
    testCount: 2, total: 2, entry: 'doGet({ parameter: { page: "tests" } })'
  });
});

test('troubleshooting result bridge retrieves the completed quick-start results', () => {
  const bridge = javascriptBlocks(`${pagesRoot}/05.troubleshooting/default.md`)[0];
  const source = quickStart.replace(/function getResultsFromServer\(\) \{[\s\S]*?\n\}/, bridge);
  runExample(source, { testCount: 2, total: 2 });
});

function pageFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? pageFiles(file) : file.endsWith('.md') ? [file] : [];
  });
}

test('Grav page links, anchors, media, and collection metadata stay connected', () => {
  const root = path.join(__dirname, '..', pagesRoot);
  const pages = pageFiles(root).map(file => {
    const markdown = fs.readFileSync(file, 'utf8');
    const frontMatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    assert.ok(frontMatter, `${file}: YAML front matter`);
    assert.match(frontMatter[1], /^title: .+/m, `${file}: page title`);
    assert.equal((markdown.match(/^```/gm) || []).length % 2, 0, `${file}: closed code fences`);
    assert.doesNotMatch(markdown, /^(?:<<<<<<<|=======|>>>>>>>) /m, `${file}: no merge markers`);
    const body = markdown.slice(frontMatter[0].length).replace(/```[\s\S]*?```/g, '');
    const route = '/' + path.relative(root, path.dirname(file)).split(path.sep)
      .map(folder => folder.replace(/^\d+\./, '')).join('/');
    const anchors = [...body.matchAll(/^#{1,6} (.+)$/gm)].map(match =>
      match[1].toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-'));
    if (path.basename(file) === 'collection.md') {
      assert.match(frontMatter[1], /'@self.children'/, `${file}: lists child pages`);
    }
    const mediaOrder = frontMatter[1].match(/^media_order: ['"]?([^'"\r\n]+)/m);
    for (const media of mediaOrder ? mediaOrder[1].split(',') : []) {
      assert.ok(fs.existsSync(path.join(path.dirname(file), media)), `${file}: missing ${media}`);
    }
    return { file, body, route, anchors };
  });
  const routes = new Map(pages.map(page => [page.route, page]));
  routes.set('/', routes.get('/home'));
  for (const page of pages) {
    for (const match of page.body.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^https?:\/\//.test(target)) continue;
      const [pathname, fragment] = target.split('#');
      if (pathname.startsWith('/') || !pathname) {
        const destination = pathname ? routes.get(pathname) : page;
        assert.ok(destination, `${page.file}: missing route ${target}`);
        if (fragment) {
          assert.ok(destination.anchors.includes(fragment), `${page.file}: missing anchor ${target}`);
        }
      } else {
        assert.ok(fs.existsSync(path.resolve(path.dirname(page.file), pathname)),
          `${page.file}: missing media ${target}`);
      }
    }
  }
});
