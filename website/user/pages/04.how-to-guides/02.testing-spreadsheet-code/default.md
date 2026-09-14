---
title: 'Test spreadsheet code'
allowCSS: default
allowJS: default
subtitle: 'Test row-processing logic with ordinary arrays before connecting it to Google Sheets.'
show_header_image: false
show_clickthrough: true
---

You do not need a real spreadsheet to test most spreadsheet logic. Read data at
the edge of your application, then pass the resulting rows to a plain
JavaScript function. This example tests an order total without creating,
changing, or deleting any files.

===

## 1. Define the data contract

Assume each input row contains `[item, quantity, unitPrice]`, with no header row.
Quantities and prices must be finite, non-negative numbers; numeric strings are
not accepted. An empty list totals zero. These choices make invalid data visible
instead of silently treating it as a valid order.

In a project with the [quick-start runner](/quick-start-guide), add this function
to `Orders.gs`:

```javascript
function totalFromRows(rows) {
  return rows.reduce(function(total, row) {
    var quantity = row[1];
    var unitPrice = row[2];
    if (typeof quantity !== "number" || !Number.isFinite(quantity) ||
        typeof unitPrice !== "number" || !Number.isFinite(unitPrice) ||
        quantity < 0 || unitPrice < 0) {
      throw new Error("Quantity and price must be non-negative numbers");
    }
    return total + quantity * unitPrice;
  }, 0);
}
```

This is a small calculation example, not a complete currency-handling library.
For money, define your rounding policy or use integer minor units, such as
cents, before choosing expected totals.

## 2. Test the logic using arrays

Add `OrderTests.gs` with:

```javascript
function registerOrderTests() {
  QUnit.module("Orders");

  QUnit.test("totals multiple rows", function(assert) {
    var rows = [["Notebook", 2, 5], ["Pen", 3, 2]];
    assert.strictEqual(totalFromRows(rows), 16, "10 plus 6");
  });

  QUnit.test("totals an empty order", function(assert) {
    assert.strictEqual(totalFromRows([]), 0, "no rows means no charge");
  });

  QUnit.test("accepts zero quantity", function(assert) {
    assert.strictEqual(totalFromRows([["Pen", 0, 2]]), 0, "zero adds nothing");
  });

  QUnit.test("rejects text in a numeric column", function(assert) {
    assert.throws(function() {
      totalFromRows([["Pen", "3", 2]]);
    }, /Quantity and price/, "numeric strings need explicit conversion");
  });

  QUnit.test("rejects negative prices", function(assert) {
    assert.throws(function() {
      totalFromRows([["Pen", 3, -2]]);
    }, /Quantity and price/, "negative prices are invalid");
  });
}
```

In `doGet()`, replace the quick start's `registerMathTests();` call with
`registerOrderTests();`. Keep the alias, `init()`, `start()`, HTML return, and
`getResultsFromServer()` unchanged. Save and reload `/dev`.

**Expected result: 5 tests, 5 assertions passed, and 0 failed.** These tests
need no Sheets authorization because they never call `SpreadsheetApp`.

## 3. Keep spreadsheet access in a small adapter

Once the calculation works, add this function to `Orders.gs`:

```javascript
function totalFromSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return totalFromRows([]);
  }
  return totalFromRows(sheet.getRange(2, 1, lastRow - 1, 3).getValues());
}
```

The adapter assumes row 1 is a header and columns A:C follow the contract above.
It intentionally rejects blank or invalid quantity/price cells in data rows.
Keep unrelated data out of this sheet: `getLastRow()` includes content outside
columns A:C too.

## 4. Check the adapter without a live sheet

Add this test inside `registerOrderTests()`. The small fake object implements
only the methods the adapter calls:

```javascript
QUnit.test("reads data rows without the header", function(assert) {
  assert.expect(3);
  var sheet = {
    getLastRow: function() {
      return 3;
    },
    getRange: function(row, column, height, width) {
      assert.deepEqual([row, column, height, width], [2, 1, 2, 3], "data range");
      return {
        getValues: function() {
          assert.ok(true, "reads the range values");
          return [["Notebook", 2, 5], ["Pen", 3, 2]];
        }
      };
    }
  };
  assert.strictEqual(totalFromSheet(sheet), 16, "adapter uses the calculation");
});
```

You should now have **6 tests and 8 passing assertions**. `assert.expect(3)`
makes a missing interaction fail instead of quietly skipping an assertion.
This fake checks your adapter, not Google's implementation of Sheets.

## 5. Run a separate integration check when needed

Use a disposable spreadsheet with a header row and the same two sample rows.
Keep any real-service check separate from the fast array tests, so ordinary
reloads do not repeatedly access external resources.

For a web app, open the test spreadsheet by its explicit ID with
[`SpreadsheetApp.openById()`](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#openById(String)),
then pass the intended sheet to `totalFromSheet()`. Do not rely on
`getActiveSpreadsheet()` or an active selection: the web app request has no
open spreadsheet UI, even for a bound script.

Confirm the total is `16` and that the identity executing the web app has access
to the test file. Calls to Sheets require authorization and consume service
quotas. If your tests write data, use only fixtures created for testing and
arrange cleanup; never point them at a production spreadsheet.

The same boundary works for email, Drive, and HTTP requests: keep logic in plain
functions and service calls in small adapters. For service errors or timeouts,
see [troubleshooting](/troubleshooting).
