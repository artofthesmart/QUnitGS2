---
title: 'QUnitGS2 Test Suite'
media_order: QUnitGS2_test_suite_screenshot.png
allowCSS: default
allowJS: default
subtitle: 'A bigger example where we test QUnitGS2 itself.'
show_header_image: false
show_clickthrough: false
---

Take a look at the [consolidated live test source](https://github.com/artofthesmart/QUnitGS2/tree/master/tests/live)
or the [Apps Script test project](https://script.google.com/d/1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M/edit)
for more examples. It uses a more complicated setup to manage many tests. A
[historical live results deployment](https://script.google.com/macros/s/AKfycbxGNuNyR-pec75X_whqf56rkoi8-8ne5aeK8bdctR-uyq5Wjwht/exec)
is also available, but its source and library versions may differ from the
current repository. It is not proof that the latest changes have been deployed.
**Tests can take a long time to complete**, so be patient.

It should look like the image below.

![Example of QUnitGS2 test suite results.](QUnitGS2_test_suite_screenshot.png)

These are actually the tests from the [original QUnit library](https://github.com/qunitjs/qunit/tree/master/test/main), intended to help test this implementation to make sure the results match.

## One-command live testing

The test sources now live alongside the library in `tests/live`. After the
[one-time clasp and web-app setup](https://github.com/artofthesmart/QUnitGS2/blob/master/tests/live/README.md),
run `npm run test:live` to build the current sources, push only to the test
project, redeploy, and retrieve correlated JSON results with wget.
The automated suite excludes intentional failures and unsupported asynchronous
suites. On an updated deployment, `?demo=failures` enables the failure examples.
The published library deployment is not changed.

## Exception reporting regressions

The pending companion [artofthesmart/QUnitGS2-Test#4](https://github.com/artofthesmart/QUnitGS2-Test/pull/4)
adds an opt-in `?suite=exceptions` route. It has not been imported into this
repository's live runner; the instructions below apply only to that companion
change, not the consolidated default suite.
Use a test project containing that suite and a QUnitGS2 library version with
the exception-reporting fixes. The default suite is unchanged.

The regression suite intentionally throws strings and `Error` objects before
and after assertions and in all four setup/teardown hooks. It also tests
`assert.throws`, comparison values, and recovery after each throwing case.
Expected results are **29 test rows and 45 assertions: 28 passed, 17 failed**.
Of the test rows, **14 pass and 15 fail**. These failures are intentional: the
regression is successful when every expected failure and subsequent recovery
test is visible and the totals match, not when the page is all green.

Check that exception messages appear as text, source details appear when
available, and the final passing test is present. A blank page, missing totals,
or missing failure rows does not count as success. See the companion
[test instructions on the integration branch](https://github.com/artofthesmart/QUnitGS2-Test/blob/artofthesmart-exception-integration-regressions/test/README.md)
for the exact cases, and the
[integration PR](https://github.com/artofthesmart/QUnitGS2-Test/pull/4).

### Testing an unpublished library change

Use a disposable test project. For a published library, select a version that
contains the fix. To test saved but unpublished library source, editors of that
library can use its development mode with an existing version selected. The
consumer web app's `/dev` URL uses saved consumer code; it does not automatically
enable development mode for an imported library.

Merging a GitHub PR does not publish a new Apps Script library version or update
an existing consumer's binding.

## Local checks when live testing is difficult

In the QUnitGS2 library checkout, Node.js 22 or later can run the collection
tests without installing packages:

```sh
node --test tests/*.test.cjs
```

For the complete local collection and Chromium browser checks:

```sh
npm ci
npx playwright install chromium
npm run test:all
```

The tests use the bundled QUnit engine and the library's actual result
collection and rendering code. Browser checks verify messages, source details,
totals, subsequent tests, and collapse/filter controls. The pending companion change
also includes a local verifier that calls its real consumer entry points
against a local library checkout.

These checks substitute Apps Script services and do not validate Google's
deployment, authorization, cache quotas, or runtime scheduling. They provide
offline regression coverage, not a guarantee that a particular deployed
project is correctly configured.