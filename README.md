# QUnitGS2

QUnitGS2 is a Google Apps Script Library that allows Apps Script projects to be
tested using the QUnit JavaScript testing framework -
[qunitjs.com](http://qunitjs.com). Just add this library to your project and
start writing tests in just a few minutes.

See [CHANGELOG.md](CHANGELOG.md) for notable changes.

Read more detailed usage instructions and see examples at
[QUnitGS2.com](https://qunitgs2.com).

## Developing and testing

**Start with local tests.** Use Node.js 22 or newer and run these commands from
the repository root (the directory containing `package.json`):

```sh
npm ci
npm test
```

These checks need no Google account and do not deploy anything. For the complete
local suite, including browser checks:

```sh
npx playwright install chromium
npm run test:all
```

**To test on Google's servers**, first follow the
[live-test setup guide](tests/live/README.md#one-time-setup). It covers installing
wget, signing into clasp, choosing a test project, and creating
`.live-test.json` in this checkout's repository root. Then run:

```sh
npm run test:live
```

The live command builds, pushes, redeploys, and fetches test results. It changes
the configured test project, **not the published library**.

**A clone or merge does not supply `.live-test.json`.** It is intentionally
ignored by Git and must be created in each checkout or worktree; clasp login is
separate. The guide includes the exact copy command, an example with the shared
test project's IDs, and troubleshooting for a missing configuration file.

See the [testing guide](tests/README.md) for command choices and coverage,
[`tests/live`](tests/live) for live cases, and [`scripts`](scripts) for tooling.

## Website

The authored Grav website pages are maintained in
[`website/user/pages`](website/user/pages). Installed themes, plugins,
configuration, runtime data, and administrator credentials remain outside this
repository.

Start with the [complete quick start](https://qunitgs2.com/quick-start-guide),
then use the [how-to guides](https://qunitgs2.com/how-to-guides) for organizing
tests, testing spreadsheet code, and integrating with existing applications.
See [troubleshooting](https://qunitgs2.com/troubleshooting) when a run does not
behave as expected. Website authoring notes are in
[`website/README.md`](website/README.md).

## Usage

**Summary:**
1. Add the testing library to your project.
2. Add the connecting code to your project code.
3. Deploy as a web app to see test results.
4. Write tests & enjoy.

### Add the testing library

You can either add this library to your project directly by copy-pasting code
from the latest version here on Github, or you can add the library directly to
your project
([tutorial](https://developers.google.com/apps-script/guides/libraries#using_a_library)).
Here's the library ID for you to copy/paste if you add it directly:
`1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG`

### Add the connecting code

1. Add a `doGet()` function that draws the test results when you request it as a
   webpage:
```javascript
var QUnit = QUnitGS2.QUnit;

function doGet() {
   QUnitGS2.init();
   userDefinedtestFunctions();
   QUnit.start();
   return QUnitGS2.getHtml();
}
```

2. Add a `getResultsFromServer()` function that passes results from QUnit to the
   webpage:
```javascript
function getResultsFromServer() {
   return QUnitGS2.getResultsFromServer();
}
```

> Further examples can be seen on the [QUnitGS2 website](https://qunitgs2.com/examples),
> in the [live test sources](tests/live), and in the
> [Apps Script test project](https://script.google.com/d/1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M/edit).

### HTML results without a browser bridge

For synchronous tests, use `QUnitGS2.run(registerTests)` to return a complete
HTML report from `doGet()`:

```javascript
var QUnit = QUnitGS2.QUnit;

function doGet() {
   return QUnitGS2.run(registerTests);
}

function registerTests() {
   QUnit.module("Math");
   QUnit.test("addition", function(assert) {
      assert.strictEqual(1 + 1, 2, "adds two numbers");
   });
}
```

No `getResultsFromServer()` bridge is needed. `run()` initializes the wrapper,
calls your registration function, starts QUnit synchronously, and embeds the
completed JSON in the returned HTML. Do not call `init()`, `QUnit.start()`, or
`getHtml()` yourself inside the registration function. Configuration such as
`QUnit.config.title` can be set there before registering tests.

Results stay in memory and are not written to the shared user cache. The page
renders its embedded results without a `google.script.run` call, so a later
cache eviction or overlapping run cannot replace that page's results.
Normal exceptions still become failing assertions and subsequent tests run.

This mode supports synchronous registration, tests, hooks, and logging callbacks
only. `assert.async()` and returned promises/thenables fail explicitly instead
of returning a misleading completed page. Do not schedule timer callbacks or
external asynchronous work. Apps Script execution and HTML response limits still
apply. Use a fresh execution for each run.

The older `init()`/`start()`/`getHtml()` runner remains supported and still needs
its result bridge. This new API requires a published library version containing
it or the updated source.

### Run tests from the editor

To see results without deploying a web app, add this function and run `runTests`
from the Apps Script editor:

```javascript
var QUnit = QUnitGS2.QUnit;

function runTests() {
   QUnitGS2.init({ logToConsole: true, cacheResults: false });
   QUnit.test("addition", function(assert) {
      assert.strictEqual(1 + 1, 2, "adds two numbers");
   });
   QUnit.start();
}
```

Each assertion and test is logged with its name and outcome, followed by a
`Suite complete` record with assertion totals. Failures include comparison
values and available stack traces; skipped and todo tests are marked explicitly.
Only a completion record confirms that the suite finished.

| `init` option | Default | Behavior |
|---|---|---|
| `logToConsole` | `false` | Write result records to `console.log`. |
| `cacheResults` | `true` | Store results for the HTML page. |

Use `QUnitGS2.init({ logToConsole: true })` to keep both console and HTML output.
Console-only runs clear old results but do not write the results cache, so they
do not encounter its per-value size limit. They need neither `getHtml()` nor a
`getResultsFromServer()` bridge. At least one output must remain enabled.

Logs are available in the Apps Script execution log and, with the appropriate
Google Cloud project setup, Cloud Logging. Assertion values and stack traces may
contain application data: enable logging only where that data is safe to record.
This requires a published library version containing the feature or the updated
source; it does not remove Apps Script's asynchronous testing limitations.

### Debug without catching exceptions

For synchronous test debugging, set `QUnit.config.notrycatch = true` after
initialization and before registering tests:

```javascript
var QUnit = QUnitGS2.QUnit;

function debugTests() {
   QUnitGS2.init({ logToConsole: true, cacheResults: false });
   QUnit.config.notrycatch = true;
   QUnit.test("debug a helper", function() {
      throw new Error("Inspect this original error in the execution log");
   });
   QUnit.start();
}
```

Run `debugTests` from the Apps Script editor. In versions containing this fix,
the task queue runs synchronously in this mode: the original thrown value
escapes `QUnit.start()` and stops the run rather than becoming an assertion or
a deferred Promise rejection. Test and hook exceptions both propagate.
Ordinary failed assertions still produce results, and `assert.throws` still
catches the exceptions it is explicitly testing.

This debug mode supports only synchronous tests, hooks, and logging callbacks.
`assert.async()` and returned promises/thenables fail explicitly. Do not schedule
timer callbacks or external asynchronous work in a debug run. A halted run may
retain earlier assertions or completed tests but has no suite completion summary;
it is not a passing run. Start a fresh execution after fixing the error.

For normal testing, omit the setting or set `QUnit.config.notrycatch = false`
before starting. Normal mode reports unexpected exceptions as failures and
continues subsequent tests. Enable the option in code, not with a URL query
parameter: the Apps Script wrapper does not translate browser query parameters
into QUnit configuration.

### Check for accidental globals

Enable `QUnit.config.noglobals` before registering tests. When importing QUnitGS2
as a library, also pass the test project's global object so checks inspect the
caller rather than only the library:

```javascript
var QUnit = QUnitGS2.QUnit;

function doGet() {
   QUnitGS2.init({ globalObject: globalThis });
   QUnit.config.noglobals = true;
   QUnit.test("keeps temporary variables local", function(assert) {
      var temporary = 1;
      assert.strictEqual(temporary, 1);
   });
   QUnit.start();
   return QUnitGS2.getHtml();
}
```

`globalObject` is optional; without it, checks inspect the library's own global
object. It can also be combined with the console options. Global checking
remains off by default. Checks report newly introduced or deleted own enumerable
properties as assertion failures and continue to subsequent tests. The library's
collector and HTML generation no longer create accidental globals themselves.

Declare intentional globals before starting the suite. This detects property
additions/deletions, not changes to existing values, non-enumerable properties,
or top-level `let`/`const` bindings. It checks only the supplied scope, not globals
inside other imported libraries. The behavior follows the bundled QUnit engine,
including its baseline reset after a caught test exception; use strict mode too
to catch undeclared assignments that throw before the pollution check.

Use `globalThis` in the Apps Script V8 runtime. This requires a library version
containing this fix or the updated source; selecting an older published version
will not pick it up automatically.

## Deploy as a web app.

To use the HTML results page, you must either
- deploy a web app of your script so it can render the HTML results of your
  tests, or
- write your code so that a different project can be a web app and test your
  code.

[You can learn more about Web Apps
here](https://developers.google.com/apps-script/guides/web), but basically it
means allowing your script project to respond to web browser requests with a
website, data, or (in this situation) test results.

These are explained below.

### Option 1: Deploy your code as a web app for testing purposes.

The first and easiest option is to import the library and deploy your script as
as Web App. If your script isn't currently deployed as a web app (and you don't
expect it to be), this should be your go-to choice.

> Note that you can [set permissions on who can load the web
> app](https://developers.google.com/apps-script/guides/web#permissions) for
> security.

![Use the library by making your script a
webapp.](images/single_import_test_only.png)

### Option 2: Testing an already deployed web app.

If your app is already deployed, you have two options for how you can test it.
You can export functionality from your app and import it into another project
for testing, or you can have QUnit live alongside your app code.

![Use the library by importing your code and the library into a third testing
app.](images/dual_import.png)

The diagram above shows how you can import both QUnit2GS _and_ your project code
into a third app. That app acts like Option #1 above and helps separate your
production code from your testing code.

![Use the library by making your script a webapp that has multiple
pages.](images/single_import_multipage_app.png)

The diagram above shows how you can have QUnit2GS live alongside your production
code. The only hitch is that you'll have to write some kind of router based on
[query string
parameters](https://developers.google.com/apps-script/guides/web#request_parameters)
in order to control which page a user sees when loading your application.

[Learn more about writing your own
router.](https://medium.com/@fro_g/routing-in-javascript-d552ff4d2921)

## Testing procedures and spreadsheet writes

Functions do not need to return a value to be tested. Call the procedure inside
`QUnit.test()`, then assert its effects, such as the value written to a sheet.
Initialize required sheet references in setup, use a fresh disposable fixture
for each test, and compare numbers with numbers rather than coercing strings.

The [spreadsheet procedure example](https://qunitgs2.com/how-to-guides/testing-spreadsheet-code#6-test-a-procedure-that-calls-helpers-and-writes-a-value)
includes a complete `onClick()` runner, nested helper calls, a fake sheet, and
cleanup. It makes no real service calls. A missing sheet reference or helper
exception should be reported as a test failure; a blank page or missing suite
summary never means the procedure passed.

## Large result reports

Reports above 80,000 UTF-8 bytes are automatically gzip-compressed and
base64-encoded when that reduces their stored size. Small reports stay as plain
JSON. `getResultsFromServer()` decompresses transparently and still returns the
same JSON string; no browser or consumer bridge changes are needed.

The library reads both older plain-JSON entries and its versioned compressed
format. Compression is not encryption. Cached results are still temporary,
shared within the same user cache scope, and can be evicted by Google.
Reports that exceed the conservative 100,000-byte stored-value limit even after
compression fail explicitly; split the suite or use console-only reporting.

This requires a published library version containing the fix or the updated
source. Older versions cannot read the new compressed format; rerun tests after
switching versions to replace cached reports.

## Result states

The results page starts with a neutral **Loading test results** message. It only
shows completed pass/fail totals after checking the suite summary against the
returned test and assertion records. An explicit zero-assertion completion is
shown neutrally, not as a passing suite.

No returned payload is **Results unavailable**. Missing completion summaries or
inconsistent records produce **Incomplete results**, keeping usable rows and
labeling unfinished tests with recorded assertion counts only. Loading, parsing,
and rendering errors are displayed as text rather than leaving a passing banner.
Error messages and assertion values are literal text; generated comparison diffs
retain their markup.

This checks one cached response; it does not retry, fix asynchronous scheduling,
or establish that results belong to the latest run. An empty page or missing
summary is not proof that tests passed. These changes require a library version
containing them or the updated source.

## Differences from original QUnit library

QUnitGS2 provides a wrapper to the main QUnit library. It creates the HTML/CSS
to display in an Apps Script web app based on the JSON test results returned by
various QUnit callback functions. This is in contrast to how the [QUnitGS
library based on v1 worked](http://github.com/simula-innovation/qunit/tree/gas/gas),
which was to update the main library to display the HTML as a web app.

The published QUnit library functions are in a separate file for the library
creation and API documentation generation to work.

The GUI is not displayed immediately, but rather only after the tests have run.

Tests are run on Google's servers, not in your browser. The browser only
displays test results.

Uncaught test and setup/teardown hook exceptions are reported as failed
assertions, including their error messages; subsequent tests continue under
QUnit's default exception handling.

If an older library version still loses failures, select a published version
containing the fix or use the updated source. A repository update does not
change the library version selected in your Apps Script project.

Local regression tests can be run with `node --test tests/*.test.cjs` on Node.js
22 or later. Browser integration tests are also available via
`npm run test:browser`; see [tests/README.md](tests/README.md) for setup and scope.

Asynchronous testing is limited. There is no `setTimeout()` function in Google
Apps Script. If you create time-based triggers via the [Script
service](https://developers.google.com/apps-script/reference/script), the
`doGet()` function is more likely to timeout than your test.

HTML and client-side JavaScript is generated using Google's
[HtmlService](https://developers.google.com/apps-script/guides/html).

## Updating this project when QUnit updates

From time to time, [QUnit JS](https://qunitjs.com/) will update and those
updates should be incorporated into this project.

To upgrade to a later version of QUnit, simply:

1. Copy the new version into `qunitjs.gs`.
2. Ensure the main QUnit object is exported from the main Qunit library by
   adding to `exportQUnit()`:
```javascript
if (typeof HtmlService !== "undefined") global$1.QUnit = QUnit;
```
 
3. Create/deploy a new version of the script project. See [Google's guidance on
   creating library
   versions](http://developers.google.com/apps-script/guides/versions).

## QUnit config

Config settings are passed straight through to the main QUnit library. See the
[QUnit.config documentation](https://api.qunitjs.com/config/QUnit.config) for
details.
