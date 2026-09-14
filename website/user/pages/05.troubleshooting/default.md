---
title: Troubleshooting
allowCSS: default
allowJS: default
subtitle: 'Find the next useful check when setup, deployment, or a test run goes wrong.'
show_header_image: false
show_clickthrough: true
---

Start with the symptom below. If you are unsure whether the problem is setup or
your tests, run the complete [quick-start example](/quick-start-guide) in a
separate practice project. Its two passing assertions give you a known baseline.

## Find your symptom

| What you see | What to check first |
| --- | --- |
| `QUnitGS2 is not defined` | Add the library and set its identifier to exactly `QUnitGS2`. |
| `QUnit is not defined` or `Qunit is not defined` | Add `var QUnit = QUnitGS2.QUnit;` and use `QUnit` consistently. |
| `Script function not found: doGet` | Add one top-level `doGet()` in the project whose web app URL you opened. |
| Editor execution finishes, but no results page opens | Open the web app URL; the editor's Run button does not display returned HTML. |
| Blank page, missing totals, or unavailable results | Check the [runner and result bridge](#missing-results). |
| A new or failing test is missing | Check registration, filters, and [exception reporting](#missing-or-throwing-tests). |
| Results do not reflect saved changes | Check [runner and library versions](#old-results). |
| An access or authorization error | Check the account, execution identity, and [deployment settings](#authorization-and-access). |
| A run is slow or never finishes | Check [runtime limitations](#runtime-limitations). |

## Missing results

A blank page, green styling by itself, or an empty list is **not proof that tests
passed**. Look for a completed summary and the test rows you expected.
Unavailable, incomplete, or error results need investigation before you trust
the run.

1. In the Apps Script editor, open **Executions** and inspect the relevant
   `doGet` or `getResultsFromServer` execution for errors.
2. Confirm that `doGet()` calls `QUnitGS2.init()`, registers at least one test,
   calls `QUnit.start()`, and returns `QUnitGS2.getHtml()`, in that order.
3. Keep this exact bridge in the project serving the web app, not only in an
   imported application library:

```javascript
function getResultsFromServer() {
  return QUnitGS2.getResultsFromServer();
}
```

The bridge must be top-level and must not end in `_`, which would hide it from
`google.script.run`. Do not replace the library's result string with your own
object or call `init()` in this bridge: that would erase the results before
the page reads them.

If the server executions finish successfully, inspect the browser's developer
console for client-side errors. Remove credentials, file contents, and private
identifiers before sharing error details.

QUnitGS2 uses a user cache entry to pass results from the server to the page.
Cache entries are temporary, and a run clears the previous result. Avoid
overlapping runs using the same cache scope, such as multiple tabs under the
same execution identity. Close duplicate tabs and rerun one small suite.
The cache is not durable storage or a run-isolation mechanism.

## Missing or throwing tests

Defining `registerOrderTests()` does not call it. Add the call between `init()`
and `start()` in the runner. Keep test registration inside functions rather
than at script file load time, and check that each test has assertions.

Remove `QUnit.config.filter` while debugging, and turn off **Hide passed tests**
to see all rows. The checkbox only changes visibility; a configured filter
changes which tests run.

With default QUnit exception handling and a library version containing the
exception-reporting fix, an unexpected exception in a test or a setup/teardown
hook is a failed assertion. Its message should be visible, and subsequent tests
continue. Use `assert.throws` when throwing is the intended behavior; do not
catch unexpected errors merely to hide them.

An exception in top-level code or in a registration function outside a test
callback can stop `doGet()` before the results page is returned. Inspect
**Executions** rather than assuming every script error becomes a QUnit row.

Older library versions could lose failures while generating an assertion diff.
Select a published version containing the fix or use updated source.
The [test suite guide](/examples/qunitgs2-test-suite#exception-reporting-regressions)
documents the intentional failure cases and their expected totals.

## Old results

| You opened... | Code it uses | How to see changes |
| --- | --- | --- |
| A runner URL ending in `/dev` | Most recently saved runner code | Save and reload. You must have editor access. |
| A runner URL ending in `/exec` | The version selected for that deployment | Use Deploy > Manage deployments > Edit, select New version, and deploy. |
| Either URL with a numbered imported library | That selected library version | Change the version in the runner's Libraries list; update the runner deployment too if using `/exec`. |

The `/dev` URL updates the runner, not its pinned dependencies. Even an updated
QUnitGS2 repository does not change an already selected Apps Script library
version. For unpublished library code, see
[testing the right version](/how-to-guides/testing-existing-projects#make-sure-you-are-testing-the-right-version).

## Authorization and access

The development URL is for project editors. If it fails to open, confirm that
you are signed in with an account that can edit that script. For non-editors,
use a versioned deployment restricted to your intended testers.

Check both **Execute as** and **Who has access** in the web app deployment.
Running as the deployer uses the deployer's permissions; running as the
accessing user requires that user's authorization and access to the test data.
Organization policies can further restrict available deployment options.

If a service call fails, check that the executing identity can access the
disposable spreadsheet or file and has granted the required scopes. Do not
make a test runner public or broaden data access just to get past an error.
See [Google's web app permissions guide](https://developers.google.com/apps-script/guides/web#permissions).

## Runtime limitations

QUnitGS2 adapts QUnit to synchronous, server-side Apps Script. It is not the
same environment as browser QUnit:

| Limitation | Practical approach |
| --- | --- |
| No browser `window`, DOM, or user interface | Test server-side functions here; test HTML and client JavaScript separately. |
| No normal browser timer scheduling | Keep tests synchronous. The library's `setTimeout` shim invokes the callback immediately; it does not wait. |
| Promises, `assert.async()`, and triggers are not a normal asynchronous test runner | Test the synchronous work separately. Do not wait for a time-based trigger to complete a web request. |
| Apps Script execution limits and service quotas still apply | Split large suites, minimize real service calls, and use small fixtures. |
| Results are cached, not streamed or permanently stored | Avoid overlapping runs and keep suites small enough for the cache. |
| A web app has no active spreadsheet UI | Open test files by explicit ID instead of relying on active selection. |

`Utilities.sleep()` blocks execution and consumes runtime; it does not turn a
trigger or promise into supported asynchronous testing. Large results can also
hit [CacheService limits](https://developers.google.com/apps-script/reference/cache/cache)
even when individual tests are fast.

The bundled QUnit engine is 2.10.1. Consult `QUnit.version` for the version you
are actually running before using APIs from the current upstream documentation.
For platform limits, consult
[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).

## Report a reproducible problem

If a small example still fails, [open an issue](https://github.com/artofthesmart/QUnitGS2/issues)
with the selected QUnitGS2 library version, `QUnit.version`, `/dev` or `/exec`
(not a private deployment URL), the smallest test that reproduces it, expected
and actual results, and relevant error text from **Executions** or the browser.
Use invented data and omit secrets and identifying details.
