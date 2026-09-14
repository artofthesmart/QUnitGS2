const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');

async function renderSuite(page, source) {
  // Keep Playwright's stack formatter out of QUnit's stack-source detection.
  const { tests, summary, resultsString } = JSON.parse(execFileSync(process.execPath, [
    '-e',
    `const { runSuite } = require(process.argv[1]);
     process.stdout.write(JSON.stringify(runSuite(require('node:fs').readFileSync(0, 'utf8'))));`,
    path.join(__dirname, 'runner.cjs')
  ], { input: source, encoding: 'utf8', timeout: 10000 }));
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const toolbar = read('qunit-toolbar.html')
    .replace('<?= testUrl ?>', '/')
    .replace('<?!= checked ?>', '')
    .replace('<?!= urlConfigs ?>', '');
  const html = read('index.html')
    .replace('<?!= styles ?>', '')
    .replace('<?= testUrl ?>', '/')
    .replace('<?= title ?>', 'QUnitGS2 regression tests')
    .replace('<?!= toolbar ?>', toolbar)
    .replace("<?!= _include('qunit.js') ?>", () => read('qunit.js.html'));
  expect(html).not.toContain('<?');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(results => {
    const bridge = {
      withSuccessHandler(callback) { this.success = callback; return this; },
      withFailureHandler(callback) { this.failure = callback; return this; },
      getResultsFromServer() {
        window.setTimeout(() => this.success(results), 0);
      }
    };
    window.google = { script: { run: bridge } };
  }, resultsString);
  await page.route('https://qunitgs2.test/', route => route.fulfill({
    contentType: 'text/html',
    body: html
  }));
  await page.goto('https://qunitgs2.test/');
  await expect(page.locator('#qunit-total')).toHaveText(String(summary.total));
  await expect(page.locator('#qunit-passed')).toHaveText(String(summary.passed));
  await expect(page.locator('#qunit-failed')).toHaveText(String(summary.failed));
  await expect(page.locator('#qunit-tests .test-name')).toHaveText(
    tests.map(item => item.results.name)
  );
  await expect(page.locator('#qunit-tests .test-name').last()).toHaveText('subsequent test');
  expect(errors).toEqual([]);
  return { tests, summary };
}

test('renders an exception, its stack, and subsequent results', async ({ page }) => {
  const { tests } = await renderSuite(page, `
    QUnit.test('exception', function() { throw new Error('visible exception'); });
  `);
  expect(tests[0].assertions[0].source).toContain('suite.gs');
  await expect(page.locator('#qunit-test-output1')).toHaveClass('fail');
  await expect(page.locator('#qunit-test-block1 .test-message')).toContainText('visible exception');
  await expect(page.locator('#qunit-test-block1 .test-source')).toContainText('suite.gs');
  await expect(page.locator('#qunit-test-output2')).toHaveClass('pass');
  await expect(page.locator('#qunit-title-cross')).toHaveText(String.fromCodePoint(0x2716));
  await page.locator('#qunit-test-banner1').click();
  await expect(page.locator('#qunit-test-block1')).toHaveClass(/qunit-collapsed/);
  await page.locator('#qunit-test-banner1').click();
  await expect(page.locator('#qunit-test-block1')).not.toHaveClass(/qunit-collapsed/);
});

test('renders thrown strings literally, including HTML-like message text', async ({ page }) => {
  const message = '<b data-regression="message">literal failure</b> & details';
  await renderSuite(page, `
    QUnit.test('string exception', function() { throw ${JSON.stringify(message)}; });
  `);
  await expect(page.locator('#qunit-test-block1 .test-message')).toContainText(message);
  await expect(page.locator('#qunit-test-block1 .test-message b')).toHaveCount(0);
});

test('renders each hook failure and the following test', async ({ page }) => {
  await renderSuite(page, `
    QUnit.module('hooks', function(hooks) {
      hooks.before(function() { throw new Error('before failure'); });
      hooks.beforeEach(function() { throw new Error('beforeEach failure'); });
      hooks.afterEach(function() { throw new Error('afterEach failure'); });
      hooks.after(function() { throw new Error('after failure'); });
      QUnit.test('hook test', function(assert) { assert.ok(true); });
    });
  `);
  await expect(page.locator('#qunit-test-block1 .test-message')).toHaveCount(4);
  for (const hook of ['before', 'beforeEach', 'afterEach', 'after']) {
    await expect(page.locator('#qunit-test-block1')).toContainText(`${hook} failure`);
  }
  await expect(page.locator('#qunit-test-failed1')).toHaveText('4');
});

test('preserves numeric comparisons and failed throws assertion messages', async ({ page }) => {
  await renderSuite(page, `
    QUnit.test('failed assertions', function(assert) {
      assert.equal(3, 2, 'numeric failure');
      assert.throws(function() {}, /expected/, 'missing exception');
      assert.throws(function() { throw new Error('wrong'); }, /expected/, 'wrong exception');
    });
  `);
  await expect(page.locator('#qunit-test-block1 .test-message')).toHaveText([
    'numeric failure', 'missing exception', 'wrong exception'
  ]);
  await expect(page.locator('#qunit-test-block1 .test-diff').first()).toContainText('+1');
});

test('preserves all-passing results and the passed-test filter', async ({ page }) => {
  await renderSuite(page, `
    QUnit.test('expected exception', function(assert) {
      assert.throws(function() { throw new Error('expected'); }, /expected/, 'caught as expected');
    });
  `);
  await expect(page.locator('#qunit-test-block1 .test-message')).toHaveText('caught as expected');
  await expect(page.locator('#qunit-tests .test-name')).toHaveCount(2);
  await expect(page.locator('#qunit-title-cross')).toHaveText(String.fromCodePoint(0x2714));
  await page.locator('#qunit-filter-pass').check();
  await expect(page.locator('#qunit-tests')).toHaveClass(/hidepass/);
  await page.locator('#qunit-filter-pass').uncheck();
  await expect(page.locator('#qunit-tests')).not.toHaveClass(/hidepass/);
});
