# QUnit2GS

QUnit2GS is a Google Apps Script Library that allows Apps Script projects to be
tested using the QUnit JavaScript testing framework -
[qunitjs.com](http://qunitjs.com). Just add this library to your project to
start writing tests in just a few minutes.

Read more detailed usage instructions and see examples at 

> **TODO (ArtOfTheSmart):** Build the microsite and write up some example uses, projects.

## Usage Summary

You can either add this library to your project directly by copy-pasting code
from the latest version here on Github, or you can add the library
directly to your project ([tutorial](https://developers.google.com/apps-script/guides/libraries#using_a_library)). 
Here's the library ID for you to copy/paste if you add it directly: 

> **TODO (ArtOfTheSmart):** Publish to official lib.

In order to use this library, you must either
- publish your script so it can render the HTML results of your tests, or
- write your code in such a way that a different script can test your code.

> **TODO (ArtOfTheSmart):** Add a diagram showing what the content above means.

1. Publish a `doGet()` that calls the following functions:
```javascript
function doGet() {
   QUnitGS2.init()
   userDefinedtestFunctions()
   QUnit.start()  
   return QUnitGS2.getHtml()
}
```

2. Provide a `getResultsFromServer()` which simply returns `QUnitGS2.getResultsFromServer()`
```javascript
function getResultsFromServer() {
   return QUnitGS2.getResultsFromServer()
}
```

!!! Further examples can be seen in the QUnitGS2 Test project:
[script.google.com/d/1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M](http://script.google.com/d/1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M)

## Differences from original QUnit library

QUnitGS2 provides a wrapper to the main QUnit library. It creates the HTML/CSS
to display in an Apps Script web app based on the JSON test results returned by
various QUnit callback functions. This is in contrast to how the [QUnitGS
library based on v1 worked](github.com/simula-innovation/qunit/tree/gas/gas),
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