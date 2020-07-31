# QUnitGS2

QUnit2GS is a Google Apps Script Library that allows Apps Script projects to be
tested using the QUnit JavaScript testing framework -
[qunitjs.com](http://qunitjs.com). Just add this library to your project and
start writing tests in just a few minutes.

Read more detailed usage instructions and see examples at
[QUnitGS2.com](http://qunitgs2.com).

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

> Further examples can be seen on the [QUnitGS2 website](#) and in the [QUnitGS2 Test
> project](http://script.google.com/d/1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M/edit).

## Deploy as a web app.

Once the code is in your project, you must either
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
if (typeof HtmlService !== undefined) global$1.QUnit = QUnit;
```
 
3. Create/deploy a new version of the script project. See [Google's guidance on
   creating library
   versions](http://developers.google.com/apps-script/guides/versions).

## QUnit config

Config settings are passed straight through to the main QUnit library. See the
[QUnit.config documentation](https://api.qunitjs.com/config/QUnit.config) for
details.
