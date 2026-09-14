---
title: 'Test an existing project'
allowCSS: default
allowJS: default
subtitle: 'Add a test runner without replacing your application or exposing tests to its users.'
show_header_image: false
show_clickthrough: true
---

Already have a `doGet()` function? Do not paste a second one into the project.
Choose a separate test project for a production web app, or add a test route
only to a private development app.

===

## Choose an approach

| Situation | Recommended approach |
| --- | --- |
| No web app entry point yet | Add the [quick-start runner](/quick-start-guide) in the same project. |
| Public or production web app | Import your application into a separate test project as a library. |
| Private development web app, accessible only to trusted testers | Route between the app and tests in one `doGet(e)`. |

A test runner executes code, not just a report. If it runs as the deployer,
visitors can trigger tests using that person's permissions. A separate
deployment URL or a hidden query parameter does not, by itself, protect a test
route in publicly deployed code.

## Option 1: Use a separate test project

### Make your application available as a library

In the application project, expose the functions you want to test as top-level
function declarations. For this example, add the following function only if it
does not already exist:

```javascript
function divideThenRound(numerator, denominator) {
  return Math.round(numerator / denominator);
}
```

Follow Google's [create and share a library instructions](https://developers.google.com/apps-script/guides/libraries#create_and_share_a_library)
to create a versioned deployment, share at least view access with your testers,
and copy the application's **Script ID** from **Project Settings**.
Use the script ID, not the web app's deployment ID.

Functions whose names end in `_` are private to an Apps Script library. Test the
public behavior that uses them, or keep their tests in the same project.
Library resource scoping can also differ from running inside the application;
see [Google's resource-scoping guide](https://developers.google.com/apps-script/guides/libraries#resource_scoping).

### Add both libraries to the test project

Create a new Apps Script project named `Application tests`. Add QUnitGS2 as in
the [quick start](/quick-start-guide). Add your application using its script ID
and set its identifier to `AppUnderTest`.

Select a numbered version for each library. Then paste this complete runner
into the test project's `Code.gs`:

```javascript
var QUnit = QUnitGS2.QUnit;

function doGet() {
  QUnitGS2.init();
  registerApplicationTests();
  QUnit.start();
  return QUnitGS2.getHtml();
}

function getResultsFromServer() {
  return QUnitGS2.getResultsFromServer();
}

function registerApplicationTests() {
  QUnit.module("Application library");

  QUnit.test("rounds a fractional result", function(assert) {
    assert.strictEqual(AppUnderTest.divideThenRound(10, 4), 3, "public function");
  });
}
```

Save and open **Deploy > Test deployments > Web app** in the test project.
The `/dev` URL should show **1 test, 1 assertion passed, and 0 failed**.
Your production app's `doGet()` is unchanged.

This tests exported server-side functions, not the production app's HTTP
response or browser interface. Use separate end-to-end checks for those.

### Make sure you are testing the right version

The runner and its libraries have independent versions:

| What changed? | What to update |
| --- | --- |
| Tests in the runner | Save, then reload its `/dev` URL. |
| Application library code | Publish a new application version and select it under `AppUnderTest` in the runner's Libraries list. |
| QUnitGS2 library code | Select a published QUnitGS2 version containing that change. |
| Tests shared at the runner's `/exec` URL | Edit the deployment and select a new runner version. |

An editor of a library can use its **HEAD / Development Mode** option to test
saved, unpublished library changes; an existing library version is still
required. Use this deliberately, and pin a numbered version for reproducible
shared runs. The runner's `/dev` URL does not enable development mode for either
library automatically. Merging a GitHub change does not publish an Apps Script
library version.

## Option 2: Route a private development app

Use this only when everyone who can access the project and its deployments is
trusted to run tests. For a public application, prefer the separate runner.
Do not publish this test route in a public production version.

Start with the quick-start math functions in your private development project.
Replace its `doGet()` with the router below, retaining exactly one
`getResultsFromServer()` bridge. If your app already has a `doGet(e)`, move its
body into `renderApplication_(e)` instead of using the sample HTML return:

```javascript
var QUnit = QUnitGS2.QUnit;

function doGet(e) {
  if (e && e.parameter && e.parameter.page === "tests") {
    return renderTests_();
  }
  return renderApplication_(e);
}

function renderApplication_(e) {
  return HtmlService.createHtmlOutput("<h1>My application</h1>");
}

function renderTests_() {
  QUnitGS2.init();
  registerMathTests();
  QUnit.start();
  return QUnitGS2.getHtml();
}

function getResultsFromServer() {
  return QUnitGS2.getResultsFromServer();
}
```

Keep the existing alias only once if you already have it in another file.
Save and open your private `/dev` URL:

| URL ending | Expected page |
| --- | --- |
| `/dev` | Your application (or the sample "My application" heading) |
| `/dev?page=tests` | The quick-start suite: 2 tests and 2 passing assertions |

If the URL already has query parameters, append `&page=tests` instead of a
second `?`. Bookmark the complete test URL and reload it to rerun tests; the
runner's title link may take you back to the app's base URL.

`getResultsFromServer()` must remain a top-level function without a trailing
underscore, because the results page calls it through `google.script.run`.
The helper functions can be private. Passing a `page` parameter selects a
route; it does not authorize the caller.
