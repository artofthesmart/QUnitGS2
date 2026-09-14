---
title: Home
media_order: 'single_import_test_only.png,dual_import.png,single_import_multipage_app.png'
body_classes: 'title-center title-h1h2'
allowCSS: default
allowJS: default
show_header_image: false
show_clickthrough: true
---

QUnit2GS is a Google Apps Script Library that allows Apps Script projects to be
tested using the QUnit JavaScript testing framework -
[qunitjs.com](http://qunitjs.com). Just add this library to your project and
start writing tests in just a few minutes.

---

! Just want the code?  [Click here for the quick start guide.](/quick-start-guide)

[QUnitJS](https://qunitjs.com/) is the easy, universal, and extensible way to quickly test Javascript code. It requires little configuration, making it easy to set up and run tests for all sorts of projects.  This website is dedicated to an open-source adaptation of that code to let you test code you write in [Google Apps Script](https://developers.google.com/apps-script).  Turn your small projects into large ones with [the power of unit testing](https://stackoverflow.com/questions/67299/is-unit-testing-worth-the-effort).

## Installation & Usage
**Summary:**
1. Add the testing library to your project.
2. Add the connecting code to your project code.
3. Deploy as a web app to see test results.
4. Write tests & enjoy.

!!!! You can follow the general instructions belows or, if you're getting stuck, [follow the step-by-step illustrated tutorial](/examples/step-by-step-tutorial).

### Add the testing library

You can either add this library to your project directly by copy-pasting code
from [the latest version here on Github](https://github.com/artofthesmart/QUnitGS2), or you can add the library directly to
your project
([tutorial](https://developers.google.com/apps-script/guides/libraries#using_a_library)).
Here's the library ID for you to copy/paste if you add it directly:
`1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG`

### Add the connecting code

1. Add a `doGet()` function that draws the test results when you request it as a
   webpage:
   
```javascript
// Alias used by the examples below.
var QUnit = QUnitGS2.QUnit;

function doGet() {
   QUnitGS2.init(); // Initializes the library.
    
   /**
   * Add your test functions here.
   */
    
   QUnit.start(); // Starts running tests, notice QUnit vs QUnitGS2.
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

> You can find [more examples here](http://qunitgs2.com/examples) and in the [QUnitGS2 Test
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
webapp.](single_import_test_only.png)

### Option 2: Testing an already deployed web app.

If your app is already deployed, you have two options for how you can test it.
You can export functionality from your app and import it into another project
for testing, or you can have QUnit live alongside your app code.

![Use the library by importing your code and the library into a third testing
app.](dual_import.png)

The diagram above shows how you can import both QUnit2GS _and_ your project code
into a third app. That app acts like Option #1 above and helps separate your
production code from your testing code.

![Use the library by making your script a webapp that has multiple
pages.](single_import_multipage_app.png)

The diagram above shows how you can have QUnit2GS live alongside your production
code. The only hitch is that you'll have to write some kind of router based on
[query string
parameters](https://developers.google.com/apps-script/guides/web#request_parameters)
in order to control which page a user sees when loading your application.

[Learn more about writing your own
router.](https://medium.com/@fro_g/routing-in-javascript-d552ff4d2921)

## Reading test failures

With QUnit's default exception handling, an uncaught exception in a test or in a
`before`, `beforeEach`, `afterEach`, or `after` hook is reported as a failed
assertion. The results page shows the failure message and available source
details, and subsequent tests continue. Use `assert.throws` when an exception
is the expected behavior.

Earlier library versions could lose these failures while generating a diff.
Select a published library version containing the fix, or use the updated
source. Updating this repository or your web app alone does not update a pinned
library version. See the [changelog](https://github.com/artofthesmart/QUnitGS2/blob/master/CHANGELOG.md)
and [test suite guide](/examples/qunitgs2-test-suite) for details.