---
title: 'Quick Start Guide'
allowCSS: default
allowJS: default
subtitle: 'Copy a complete example, open the test runner, and see your first passing tests.'
show_header_image: false
show_clickthrough: true
---

Start in a new Apps Script project, or one that does not already have a `doGet()`
function. If your project serves an existing web app, use the
[existing-project guide](/how-to-guides/testing-existing-projects) instead of
replacing its entry point.

## 1. Add the library

Open your project in the [Apps Script editor](https://script.google.com/home).
Next to **Libraries**, click **+**. Paste this into **Script ID**, then click
**Look up**:

```text
1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG
```

Choose the latest numbered **Version** available, set the **Identifier** to
`QUnitGS2`, and click **Add**. These examples use that exact capitalization.

## 2. Paste this complete example

In a new project, replace the contents of `Code.gs` with the following code.
In an existing project, add it in a new script file without replacing your
application code. Keep only one `doGet()` and one `getResultsFromServer()`.

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

function divideThenRound(numerator, denominator) {
  return Math.round(numerator / denominator);
}

function registerMathTests() {
  QUnit.module("Math");

  QUnit.test("divides whole numbers", function(assert) {
    assert.strictEqual(divideThenRound(10, 2), 5, "10 / 2 is 5");
  });

  QUnit.test("rounds a fractional result", function(assert) {
    assert.strictEqual(divideThenRound(10, 4), 3, "2.5 rounds to 3");
  });
}
```

Save the project. You do not need to create an HTML file; the library provides
the results page.

## 3. Open the test runner

1. Click **Deploy > Test deployments**.
2. Select the **Web app** deployment type.
3. Copy the web app URL and open it in a browser while signed in with an account
   that can edit the project.

This development URL ends in `/dev` and runs your most recently saved code.
If Google requests authorization, review the requested permissions and authorize
only a project you trust. Organization policies can restrict web app access;
see [deployment troubleshooting](/troubleshooting#authorization-and-access).

**You should see two tests, with 2 assertions passed and 0 failed.** Click a test
name to expand its assertions. If the page is blank or shows an error, start with
[troubleshooting](/troubleshooting).

Use the web app URL, not the editor's **Run** button, to view results. Running
`doGet()` in the editor does not open its returned HTML.

## 4. Make it yours

Add your own `QUnit.test()` calls inside `registerMathTests()`, or add another
registration function and call it between `QUnitGS2.init()` and `QUnit.start()`.
Save, then reload the `/dev` page after each change.

The two objects have different jobs:

| Code | Purpose |
| --- | --- |
| `QUnitGS2.init()` | Clears previous cached results and prepares the Apps Script wrapper. Call it before registering tests. |
| `QUnit.test()` and `QUnit.module()` | Define tests and organize them into named groups. |
| `QUnit.start()` | Runs the registered tests. `QUnit` is the alias for `QUnitGS2.QUnit`. |
| `QUnitGS2.getHtml()` | Returns the results page from `doGet()`. |
| `getResultsFromServer()` | Lets the page retrieve results from the library. Keep this top-level function with this exact name. |

Want to watch a test catch a bug? Follow the
[step-by-step tutorial](/examples/step-by-step-tutorial). Ready for real project
code? Use the [how-to guides](/how-to-guides).

## Share a versioned test runner

For trusted testers who are not project editors, use
**Deploy > New deployment > Web app**. Choose who the app executes as and the narrowest available
**Who has access** setting that covers your testers, then deploy and share the
`/exec` URL. Available choices depend on your account and organization.

**Execute as me** runs tests with the deployer's permissions, even when someone
else opens the URL. Do not expose a runner that can change your data to the public.
See [Google's web app permissions guide](https://developers.google.com/apps-script/guides/web#permissions).

Unlike `/dev`, `/exec` uses a saved version. To publish changes at the same URL,
use **Deploy > Manage deployments**, select the deployment, click **Edit**,
choose **New version**, then click **Deploy**.

## Exceptions and library versions

Uncaught test and setup/teardown hook exceptions are reported as failed
assertions, with their messages, under QUnit's default exception handling.
Subsequent tests continue. For expected exceptions, use `assert.throws`.

If failed tests disappear on an older library version, select a published
version containing the exception-reporting fix or use the updated source.
Redeploying the consumer web app does not by itself change its library version.
The [test suite guide](/examples/qunitgs2-test-suite) explains how to verify
reporting without relying on a blank results page.
