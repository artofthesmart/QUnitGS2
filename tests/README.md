# Regression tests

Run `node --test tests/*.test.cjs` with Node.js 22 or later. No packages are required.

The collection tests load the bundled QUnit engine and Apps Script wrapper in an
isolated VM with an in-memory CacheService substitute. Every suite must finish,
record each assertion, retain a subsequent passing test, and produce totals
matching the individual test records. Cases cover test/hook exceptions,
assert.throws, QUnit-generated failures, and the comparison value types affected
by diff normalization.

## Browser integration tests

Install the development-only browser test dependency and Chromium:

```sh
npm ci
npx playwright install chromium
npm run test:all
```

`npm run test:browser` runs just the browser tests. These use the actual HTML
templates and browser script, with local substitutions for Apps Script template
values. A stub of `google.script.run` asynchronously delivers results collected
by the real bundled engine and wrapper. No Google project or network service is
used, and the external QUnit stylesheet is omitted.

Collection runs in a separate Node process so Playwright's stack formatter does
not interfere with the bundled QUnit engine's stack-source detection.

The browser checks cover visible exception messages, literal message text,
stack traces, hook failures, subsequent tests, totals, and existing collapse and
filter class toggles. They do not validate the external stylesheet's appearance.

Neither suite simulates Google's deployment, library binding, cache quotas, or
runtime scheduling. Deployed Apps Script smoke tests in
[QUnitGS2-Test](https://github.com/artofthesmart/QUnitGS2-Test) are still needed
for those boundaries.
