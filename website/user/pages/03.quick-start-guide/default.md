---
title: 'Quick Start Guide'
allowCSS: default
allowJS: default
subtitle: 'I''m in a hurry! I know how it works I just need the code to get started.'
show_header_image: false
show_clickthrough: true
---

We've got you covered.

Here's the library ID:

```text
1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG
```

Here's the code you need to include:

```javascript
// Alias used by the examples below.
var QUnit = QUnitGS2.QUnit;

// HTML get function
function doGet() {
   QUnitGS2.init();

   /**
   * Add your test functions here.
   */

   QUnit.start();
   return QUnitGS2.getHtml();
}

// Retrieve test results when ready.
function getResultsFromServer() {
   return QUnitGS2.getResultsFromServer();
}
```

Keep the alias spelled `QUnit` consistently; JavaScript names are case-sensitive.
Register your tests after `QUnitGS2.init()` and before `QUnit.start()`.

### Exceptions and library versions

Uncaught test and setup/teardown hook exceptions are reported as failed
assertions, with their messages, under QUnit's default exception handling.
Subsequent tests continue. For expected exceptions, use `assert.throws`.

If failed tests disappear on an older library version, select a published
version containing the exception-reporting fix or use the updated source.
Redeploying the consumer web app does not by itself change its library version.
The [test suite guide](/examples/qunitgs2-test-suite) explains how to verify
reporting without relying on a blank results page.