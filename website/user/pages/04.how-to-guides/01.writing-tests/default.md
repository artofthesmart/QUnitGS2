---
title: 'Write and organize tests'
allowCSS: default
allowJS: default
subtitle: 'Choose clear assertions, share setup safely, and keep a growing suite manageable.'
show_header_image: false
show_clickthrough: true
---

Start with the [quick start](/quick-start-guide). This guide builds on its
`divideThenRound()` function and `registerMathTests()` suite, adding another
test group without changing how the runner works.

===

## Choose an assertion that explains the contract

An assertion compares what happened with what you expected. Put the actual
value first and the expected value second.

| Use | When you want to check | Example |
| --- | --- | --- |
| `assert.strictEqual` | A value and its type | `assert.strictEqual(total, 3, "three items");` |
| `assert.deepEqual` | The contents of an array or object | `assert.deepEqual(names, ["Ada", "Lin"], "names stay in order");` |
| `assert.ok` | A truthy condition | `assert.ok(total > 0, "total is positive");` |
| `assert.throws` | An expected exception | `assert.throws(function() { parseInput(""); }, /required/, "rejects empty input");` |

The table shows assertion patterns, not a complete test suite. Prefer
`strictEqual` over `equal` when type matters: `equal` can treat `"3"` and `3` as
equivalent. Use `deepEqual` instead of `strictEqual` for two separate arrays
with the same contents.

Name a test after a behavior, such as "rejects an empty email address", and use
assertion messages to explain individual cases. Include a normal input, a
boundary case, and invalid input when your function defines how to handle it.

## Split the runner from test groups

In the quick-start project, move code into script files with these roles.
Apps Script files share a global scope; you do not need imports between them.
Move definitions rather than duplicating them.

| File | Contents |
| --- | --- |
| `Code.gs` | Application functions, including `divideThenRound()` |
| `Tests.gs` | The `QUnit` alias, `doGet()`, and `getResultsFromServer()` |
| `MathTests.gs` | The existing `registerMathTests()` function |
| `ArrayTests.gs` | The new helper and tests below |

Replace the runner in `Tests.gs` with:

```javascript
var QUnit = QUnitGS2.QUnit;

function doGet() {
  QUnitGS2.init();
  registerMathTests();
  registerArrayTests();
  QUnit.start();
  return QUnitGS2.getHtml();
}

function getResultsFromServer() {
  return QUnitGS2.getResultsFromServer();
}
```

Call registration functions only after `init()` and before `start()`. Do not
call them at the top level of a script file, where they can run before setup.
One `QUnit.start()` runs all the registered groups.

## Give every test a fresh fixture

A fixture is the starting data a test needs. Add this to `ArrayTests.gs`:

```javascript
function sortedCopy(values) {
  return values.slice().sort();
}

function registerArrayTests() {
  QUnit.module("Arrays", function(hooks) {
    hooks.beforeEach(function() {
      this.values = ["pear", "apple"];
    });

    QUnit.test("sorts without changing the input", function(assert) {
      assert.deepEqual(sortedCopy(this.values), ["apple", "pear"], "sorted copy");
      assert.deepEqual(this.values, ["pear", "apple"], "input stays unchanged");
    });

    QUnit.test("starts with fresh data", function(assert) {
      this.values.push("plum");
      assert.strictEqual(this.values.length, 3, "this test owns its fixture");
    });
  });
}
```

Save and reload `/dev`. Alongside the quick-start Math tests, you should see
**4 tests, 5 assertions passed, and 0 failed**.

`beforeEach` creates fresh data for each test. Use ordinary `function` callbacks
when using QUnit's `this` test context; arrow functions do not receive that
context. Tests should not depend on another test running first.

For service-backed fixtures, `afterEach` is the place for cleanup. Use only
resources created for that test. Cleanup is not guaranteed if Apps Script
terminates the execution, so keep a way to identify and remove leftovers.

## Test an expected error

Here is a complete additional example. Add both functions to a new script file
and call `registerValidationTests()` in `doGet()` before `QUnit.start()`:

```javascript
function requireName(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Name is required");
  }
  return value.trim();
}

function registerValidationTests() {
  QUnit.module("Validation");

  QUnit.test("trims a valid name", function(assert) {
    assert.strictEqual(requireName(" Ada "), "Ada", "surrounding spaces removed");
  });

  QUnit.test("rejects a blank name", function(assert) {
    assert.throws(function() {
      requireName(" ");
    }, /Name is required/, "blank names are rejected");
  });
}
```

This adds **2 passing tests and 2 assertions**. Pass a function to
`assert.throws`; calling `requireName(" ")` before the assertion would throw
outside its control. Do not catch unexpected exceptions merely to make the
suite appear green. See the [exception reporting guide](/examples/qunitgs2-test-suite#exception-reporting-regressions)
if throwing tests disappear on an older library version.

## Run just the tests you are working on

Add configuration immediately after `QUnitGS2.init()` and before registering
any tests:

```javascript
QUnit.config.filter = "Arrays";
QUnit.config.title = "Array helper tests";
```

The filter matches module and test names. In this example it runs only the two
Array tests, so expect **3 assertions passed**. Remove the filter, or set it to
an empty string, before checking the whole suite. A filter matching no tests is
not a successful run.

QUnitGS2 does not automatically translate a URL such as `?filter=Arrays` into
server-side configuration. Set the filter in code as above. The results page's
**Hide passed tests** checkbox only changes what is displayed; it does not
skip tests or rerun them.

For more APIs, see the [QUnit documentation](https://api.qunitjs.com/).
The bundled engine in this repository is QUnit 2.10.1; newer upstream APIs may
not exist in your selected Apps Script library version. Check `QUnit.version`
when adapting examples.
