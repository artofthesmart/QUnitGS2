---
title: 'Step-by-step tutorial'
media_order: 'add-new-apps-script-file.png,add-the-library-code.png,add-web-app-details.png,menu-bar-deploy-as-web-app.png,add-production-code.png,copy-paste-test-code.png,qunit-in-apps-script-tests-passing.png,production-code-fix-to-pass-tests.png,broken-qunit-tests-page.png,add-qunit-tests-to-apps-script-file.png,empty-qunit-tests-page.png,deployed-web-app-urls.png,name-the-new-script-file.png,add-qunit-library.png,name-the-apps-script-project.png,new-apps-script-project.png,Screenshots.psd'
allowCSS: default
allowJS: default
subtitle: 'Write a test, watch it catch a bug, and fix the code with confidence.'
show_header_image: false
show_clickthrough: true
---

In this tutorial, you will test a function that divides two numbers and rounds
the result. We will deliberately leave out the rounding, let a test catch the
mistake, and then fix it. You only need a Google account with access to Apps
Script and a browser.

===

## 1. Create a practice project

Open the [Apps Script home page](https://script.google.com/home), click
**New project**, and name it `QUnitGS2 practice`. A new standalone project keeps
this exercise separate from your real files and data.

## 2. Add QUnitGS2

Next to **Libraries** in the editor sidebar, click **+**. Paste this ID into
**Script ID**, then click **Look up**:

```text
1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG
```

Select the latest numbered version available. Set the identifier to `QUnitGS2`
and click **Add**. The identifier is the name your code will use to call the
library; `QUnitGS2` and `QunitGS2` are not interchangeable.

These steps use the current Apps Script editor. Older instructions mentioning
**Resources > Libraries** or **Publish > Deploy as web app** refer to the legacy
editor; use the sidebar and **Deploy** menu instead.

## 3. Write the function we want to test

Replace the starter code in `Code.gs` with this deliberately incomplete function:

```javascript
function divideThenRound(numerator, denominator) {
  return numerator / denominator;
}
```

Its name promises rounding, but its implementation only divides. Rather than
checking the answer by hand each time, let's capture that promise in a test.

## 4. Add the runner and a test

Next to **Files**, click **+ > Script** and name the file `Tests` (the editor adds
`.gs`). Paste this entire block into `Tests.gs`:

```javascript
var QUnit = QUnitGS2.QUnit;

function doGet() {
  QUnitGS2.init();
  registerMathTests();
  QUnit.start();
  return QUnitGS2.getHtml();
}

function getResultsFromServer() {
  return QUnitGS2.getResultsFromServer();
}

function registerMathTests() {
  QUnit.module("Math");

  QUnit.test("divides and rounds", function(assert) {
    assert.strictEqual(divideThenRound(10, 2), 5, "whole numbers");
    assert.strictEqual(divideThenRound(10, 4), 3, "fractional results round up");
  });
}
```

Read `assert.strictEqual(actual, expected, message)` from left to right:
call your function, say what it should return, then describe the behavior.
`strictEqual` checks both the value and its type, so the number `3` is different
from the string `"3"`.

`registerMathTests()` defines the tests; `QUnit.start()` runs them. Keep test
registration inside functions called by `doGet()`, after `QUnitGS2.init()`, rather
than running tests at file load time. This avoids relying on script file order.

## 5. Run it and read the failure

Save both files. Choose **Deploy > Test deployments**, select **Web app**, copy
the URL ending in `/dev`, and open it in your browser. Use an account with editor
access to the project. Review any authorization request before granting access.

**Expected result: one test with 2 assertions, 1 passed and 1 failed.** A test
fails if any assertion in it fails. Expand the test row if needed and look for
the failing assertion:

| Field | Value | Meaning |
| --- | --- | --- |
| Expected | `3` | The rounded answer promised by the test |
| Actual | `2.5` | What the function returned |
| Message | `fractional results round up` | The behavior that needs fixing |

The screenshot below illustrates a failure in an older version of the runner.
Its labels may differ from this example.

![A failed rounding assertion shows the expected and actual values.](broken-qunit-tests-page.png)

If no results appear, use [troubleshooting](/troubleshooting). The editor's
**Run** button does not display the results page; open the web app URL instead.

## 6. Fix the code, not the expectation

Replace `divideThenRound()` in `Code.gs` with:

```javascript
function divideThenRound(numerator, denominator) {
  return Math.round(numerator / denominator);
}
```

Save and reload the same `/dev` URL. **Both assertions should now pass, with
0 failed.** You do not need to create another deployment for each edit.

![The results page after fixing the rounding function.](qunit-in-apps-script-tests-passing.png)

If the result still shows `2.5`, check that you saved the file and opened `/dev`.
An `/exec` URL keeps running its selected version until you
[update the deployment](/quick-start-guide#share-a-versioned-test-runner).

## 7. Add a regression test

Inside `registerMathTests()`, after the existing `QUnit.test()` call, add:

```javascript
QUnit.test("rounds down below the halfway point", function(assert) {
  assert.strictEqual(divideThenRound(9, 4), 2, "2.25 rounds to 2");
});
```

Save and reload. You should now have **2 tests, 3 assertions passed, and 0 failed**.
These tests will catch a future change that accidentally removes rounding.

The example leaves division by zero unspecified. Before testing that case in
your own application, decide whether your function should throw an error or
return a particular value. Tests are most useful when they describe a deliberate
contract.

## When a test throws an exception

With QUnit's default exception handling, unexpected exceptions in tests and
setup/teardown hooks appear as failed assertions with their messages. Subsequent
tests continue. Use `assert.throws` to test a function that is supposed to throw;
do not wrap an unexpected exception in a catch block just to keep the test
results visible.

Older QUnitGS2 library versions could lose tests that threw exceptions. To get
the fix, select a published library version containing it or use the updated
source. The consumer web app's latest-code URL does not override its selected
library version. See the [test suite guide](/examples/qunitgs2-test-suite) for
the exception regression suite and expected results.

Continue with [writing and organizing tests](/how-to-guides/writing-tests), or
apply the same approach to [spreadsheet data](/how-to-guides/testing-spreadsheet-code).
