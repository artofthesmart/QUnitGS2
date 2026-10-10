const { test, expect } = require('@playwright/test');
const { collectBridgeFree, openResults } = require('./browser.cjs');

test('renders a completed report without google.script.run or any result bridge', async ({ page }) => {
  const suite = collectBridgeFree(`
    QUnit.config.title = 'Standalone report';
    QUnit.test('passing', a => a.ok(true));
    QUnit.test('helper error', function() { throw new Error('standalone failure'); });
    QUnit.test('subsequent', a => a.ok(true));
  `);
  const errors = await openResults(page, suite, { delivery: 'absent' });
  await expect(page.locator('#qunit-total')).toHaveText('3');
  await expect(page.locator('#qunit-failed')).toHaveText('1');
  await expect(page.locator('#qunit-header')).toContainText('Standalone report');
  await expect(page.locator('#qunit-test-block2 .test-message')).toContainText('standalone failure');
  await expect(page.locator('#qunit-test-output3')).toHaveClass('pass');
  expect(await page.evaluate(() => typeof window.google)).toBe('undefined');
  await page.locator('#qunit-filter-pass').check();
  await expect(page.locator('#qunit-tests')).toHaveClass(/hidepass/);
  expect(errors).toEqual([]);
});

test('embedded test data stays literal even with script-closing text', async ({ page }) => {
  const message = '</script><script>window.injected=true</script><b>literal</b>&';
  const suite = collectBridgeFree(`
    QUnit.test('malicious-looking data', function(assert) {
      assert.strictEqual('actual', 'expected', ${JSON.stringify(message)});
    });
  `);
  const errors = await openResults(page, suite, { delivery: 'absent' });
  await expect(page.locator('#qunit-failed')).toHaveText('1');
  await expect(page.locator('#qunit-test-block1 .test-message')).toHaveText(message);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('#qunit-test-block1 .test-message b')).toHaveCount(0);
  expect(errors).toEqual([]);
});
