const { test, expect } = require('@playwright/test');
const { collectSuite, openResults } = require('./browser.cjs');

const passing = collectSuite(`
  QUnit.test('ordinary pass', function(assert) { assert.ok(true, 'recorded assertion'); });
`);

function modifiedResults(change) {
  const records = JSON.parse(passing.resultsString);
  change(records);
  return { ...passing, resultsString: JSON.stringify(records) };
}

async function expectUnverified(page, state) {
  await expect(page.locator('#qunit-banner')).not.toHaveClass(/qunit-pass/);
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', state);
  await expect(page.locator('#qunit-title-cross')).toBeEmpty();
  await expect(page.locator('#qunit-testresult-display')).toBeHidden();
  for (const field of ['total', 'passed', 'failed', 'runtime']) {
    await expect(page.locator(`#qunit-${field}`)).toBeEmpty();
  }
}

test('starts in a neutral loading state before the bridge resolves', async ({ page }) => {
  const errors = await openResults(page, passing, { delivery: 'manual' });
  await expectUnverified(page, 'loading');
  await expect(page.locator('#qunit-result-status')).toHaveText('Loading test results...');
  await page.evaluate(results => google.script.run.success(results), passing.resultsString);
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', 'passed');
  await expect(page.locator('#qunit-banner')).toHaveClass('qunit-pass');
  await expect(page.locator('#qunit-result-status')).toHaveText('Tests completed: all assertions passed.');
  await expect(page.locator('#qunit-total')).toHaveText('2');
  expect(errors).toEqual([]);
});

test('marks a real throwing suite as completed and failed', async ({ page }) => {
  const suite = collectSuite(`QUnit.test('exception', function() { throw new Error('visible failure'); });`);
  const errors = await openResults(page, suite);
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', 'failed');
  await expect(page.locator('#qunit-banner')).toHaveClass('qunit-fail');
  await expect(page.locator('#qunit-result-status')).toHaveText('Tests completed: failures reported.');
  await expect(page.locator('#qunit-total')).toHaveText('2');
  await expect(page.locator('#qunit-failed')).toHaveText('1');
  await expect(page.locator('#qunit-passed')).toHaveText('1');
  expect(errors).toEqual([]);
});

for (const [name, payload, state] of [
  ['null payload', null, 'unavailable'],
  ['undefined payload', undefined, 'unavailable'],
  ['empty payload', '', 'unavailable'],
  ['blank payload', ' \n ', 'unavailable'],
  ['malformed JSON', '{broken', 'error'],
  ['non-string payload', {}, 'error'],
  ['JSON null', 'null', 'error'],
  ['non-array JSON', '{}', 'error'],
  ['empty record array', '[]', 'incomplete'],
  ['malformed record', '[null]', 'incomplete']
]) {
  test(`makes ${name} explicit`, async ({ page }) => {
    const errors = await openResults(page, { ...passing, resultsString: payload });
    await expectUnverified(page, state);
    await expect(page.locator('#qunit-result-status')).toContainText(
      state === 'unavailable' ? 'Results unavailable' :
        state === 'incomplete' ? 'Incomplete results' : 'Unable to display test results'
    );
    expect(errors).toEqual([]);
  });
}

for (const [name, change] of [
  ['missing summary', records => records.pop()],
  ['partial test', records => { records[0].value.results = {}; }],
  ['inconsistent summary', records => { records[2].value.total = 3; }],
  ['missing assertion', records => { records[0].value.assertions = []; }],
  ['malformed assertion', records => { records[0].value.assertions = [null]; }],
  ['duplicate summary', records => { records.push(records[2]); }],
  ['duplicate test', records => { records.push(records[0]); }],
  ['summary preceding an invalid record', records => { records.unshift(records.pop()); records.push(null); }],
  ['unknown record', records => { records.unshift({ type: 'unknown', value: {} }); }]
]) {
  test(`keeps usable rows but does not report success with ${name}`, async ({ page }) => {
    const errors = await openResults(page, modifiedResults(change));
    await expectUnverified(page, 'incomplete');
    await expect(page.locator('#qunit-tests .test-name')).toHaveText(['ordinary pass', 'subsequent test']);
    if (name === 'partial test' || name === 'missing assertion') {
      await expect(page.locator('#qunit-test-output1')).toHaveClass('incomplete');
      await expect(page.locator('#qunit-test-output1')).toContainText('Incomplete');
      if (name === 'partial test') {
        await expect(page.locator('#qunit-test-block1 .test-message')).toHaveText('recorded assertion');
        await expect(page.locator('#qunit-test-total1')).toHaveText('1');
      } else {
        await expect(page.locator('#qunit-test-total1')).toHaveText('0');
      }
      await page.locator('#qunit-filter-pass').check();
      await expect(page.locator('#qunit-test-output1')).not.toHaveClass(/pass/);
    }
    expect(errors).toEqual([]);
  });
}

test('shows an explicit zero-assertion completion neutrally', async ({ page }) => {
  const errors = await openResults(page, {
    ...passing,
    resultsString: JSON.stringify([{ type: 'TESTS_RESULTS_ALL', value: {
      passed: 0, failed: 0, total: 0, runtime: 0
    } }])
  });
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', 'empty');
  await expect(page.locator('#qunit-banner')).not.toHaveClass(/qunit-pass/);
  await expect(page.locator('#qunit-title-cross')).toBeEmpty();
  await expect(page.locator('#qunit-result-status')).toHaveText('Tests completed: no assertions were reported.');
  await expect(page.locator('#qunit-total')).toHaveText('0');
  await expect(page.locator('#qunit-testresult-display')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const delivery of ['error', 'throw']) {
  test(`displays ${delivery} bridge failures as literal text`, async ({ page }) => {
    const error = '<b data-regression="error">bridge failure</b> & details';
    const errors = await openResults(page, passing, { delivery, error });
    await expectUnverified(page, 'error');
    await expect(page.locator('#qunit-result-status')).toContainText(error);
    await expect(page.locator('[data-regression="error"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('clears old success indicators if a later callback fails', async ({ page }) => {
  const errors = await openResults(page, passing);
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', 'passed');
  await page.evaluate(() => google.script.run.failure(new Error('late failure')));
  await expectUnverified(page, 'error');
  await expect(page.locator('#qunit-tests .test-name')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('replaces rows and clears stale totals on another incomplete response', async ({ page }) => {
  const errors = await openResults(page, passing);
  await expect(page.locator('#qunit-total')).toHaveText('2');
  const partial = modifiedResults(records => { records.pop(); });
  await page.evaluate(results => google.script.run.success(results), partial.resultsString);
  await expectUnverified(page, 'incomplete');
  await expect(page.locator('#qunit-tests .test-name')).toHaveText(['ordinary pass', 'subsequent test']);
  await page.evaluate(results => google.script.run.success(results), passing.resultsString);
  await expect(page.locator('#qunit-total')).toHaveText('2');
  await expect(page.locator('#qunit-tests .test-name')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('renders real skipped, todo, zero-assertion and undefined-value tests without rejecting completion', async ({ page }) => {
  const suite = collectSuite(`
    QUnit.skip('skip', function() {});
    QUnit.todo('expected todo failure', function(assert) { assert.ok(false); });
    QUnit.todo('unexpected todo pass', function(assert) { assert.ok(true); });
    QUnit.test('zero', function(assert) { assert.expect(0); });
    QUnit.test('undefined', function(assert) { assert.strictEqual('defined', undefined); });
  `);
  const errors = await openResults(page, suite);
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', 'failed');
  await expect(page.locator('#qunit-total')).toHaveText(String(suite.summary.total));
  await expect(page.locator('#qunit-failed')).toHaveText(String(suite.summary.failed));
  await expect(page.locator('#qunit-passed')).toHaveText(String(suite.summary.passed));
  await expect(page.locator('#qunit-tests .test-name')).toHaveText(suite.tests.map(test => test.results.name));
  await expect(page.locator('#qunit-test-total1')).toHaveText('0');
  await expect(page.locator('#qunit-test-total4')).toHaveText('0');
  await expect(page.locator('#qunit-test-block5 .test-expected pre')).toBeEmpty();
  await expect(page.locator('#qunit-test-block5 .test-message')).toHaveText('failed');
  expect(errors).toEqual([]);
});

test('honors the initially checked filter without hiding unfinished tests', async ({ page }) => {
  const suite = modifiedResults(records => { records[0].value.results = {}; });
  suite.html = suite.html.replace('type="checkbox"', 'type="checkbox" checked');
  const errors = await openResults(page, suite);
  await expectUnverified(page, 'incomplete');
  await expect(page.locator('#qunit-tests')).toHaveClass(/hidepass/);
  await expect(page.locator('#qunit-test-output1')).toHaveClass('incomplete');
  await expect(page.locator('#qunit-test-block1')).not.toHaveClass(/qunit-collapsed/);
  await page.locator('#qunit-test-banner1').click();
  await expect(page.locator('#qunit-test-block1')).toHaveClass(/qunit-collapsed/);
  await page.locator('#qunit-filter-pass').uncheck();
  await expect(page.locator('#qunit-tests')).not.toHaveClass(/hidepass/);
  expect(errors).toEqual([]);
});

test('retains earlier rows and reports a rendering exception instead of success', async ({ page }) => {
  const errors = await openResults(page, passing, { delivery: 'manual' });
  await page.evaluate(results => {
    const list = document.getElementById('qunit-tests');
    const append = list.appendChild.bind(list);
    list.appendChild = node => {
      if (list.children.length === 1) throw new Error('<b>render failed</b>');
      return append(node);
    };
    google.script.run.success(results);
  }, passing.resultsString);
  await expectUnverified(page, 'error');
  await expect(page.locator('#qunit-result-status')).toContainText('<b>render failed</b>');
  await expect(page.locator('#qunit-result-status b')).toHaveCount(0);
  await expect(page.locator('#qunit-tests .test-name')).toHaveText(['ordinary pass']);
  expect(errors).toEqual([]);
});

test('renders values, sources and passing messages literally, preserving generated diffs', async ({ page }) => {
  const actual = '<b data-regression="value">actual</b> & text';
  const expected = '<b data-regression="value">expected</b> & text';
  const message = '<b data-regression="message">passing message</b>';
  const suite = collectSuite(`
    QUnit.test('values', function(assert) {
      assert.strictEqual(${JSON.stringify(actual)}, ${JSON.stringify(expected)});
      throw new Error(${JSON.stringify(actual)});
    });
    QUnit.test('passing message', function(assert) { assert.ok(true, ${JSON.stringify(message)}); });
  `);
  const records = JSON.parse(suite.resultsString);
  records[0].value.assertions[0].source = '<b data-regression="source">source</b>';
  suite.resultsString = JSON.stringify(records);
  const errors = await openResults(page, suite);
  await expect(page.locator('#qunit-test-block1 .test-actual pre').first()).toHaveText(actual);
  await expect(page.locator('#qunit-test-block1 .test-expected pre').first()).toHaveText(expected);
  await expect(page.locator('#qunit-test-block1 .test-source pre').first()).toHaveText('<b data-regression="source">source</b>');
  await expect(page.locator('#qunit-test-block2 .test-message')).toHaveText(message);
  await expect(page.locator('[data-regression]')).toHaveCount(0);
  await expect(page.locator('#qunit-test-block1 .test-diff ins').first()).toBeAttached();
  await expect(page.locator('#qunit-test-block1 .test-diff del').first()).toBeAttached();
  await expect(page.locator('#qunit')).toHaveAttribute('data-result-state', 'failed');
  expect(errors).toEqual([]);
});
