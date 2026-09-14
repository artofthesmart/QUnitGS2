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

```javascript
1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG
```

Here's the code you need to include:

```javascript
// Optional for easier use.
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