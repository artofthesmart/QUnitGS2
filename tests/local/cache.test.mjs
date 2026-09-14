import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createLibrary } from "../runner.cjs";

const valueLimit = 100 * 1024;

class LimitedCache extends Map {
  writes = [];

  set(key, value) {
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes > valueLimit) {
      throw new Error("CacheService value exceeds 100 KB");
    }
    this.writes.push({ key, bytes });
    return super.set(key, value);
  }
}

function runSmallSuite(cache) {
  const library = createLibrary(cache);
  vm.runInContext(`
    init();
    QUnit.test("passing assertion", function(assert) { assert.equal(1, 1); });
    QUnit.test("cached exception", function() { throw new Error("stored failure"); });
    QUnit.test("subsequent test", function(assert) { assert.ok(true); });
    QUnit.start();
  `, library, { filename: "cache-suite.gs", timeout: 5000 });
  return library;
}

test("the unmodified collector persists passing and failing results across requests", () => {
  const cache = new LimitedCache();
  const library = runSmallSuite(cache);
  assert.equal(library.liveCache_, undefined, "the live-project adapter is not loaded");
  const raw = library.getResultsFromServer();
  assert.equal(createLibrary(cache).getResultsFromServer(), raw);
  const records = JSON.parse(raw);
  const summary = records.find(record => record.type === "TESTS_RESULTS_ALL").value;
  assert.equal(summary.total, 3);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  const cases = records.filter(record => record.type === "TESTS_RESULTS_ONE");
  assert.match(cases[1].value.assertions[0].message, /stored failure/);
  assert.equal(cases[2].value.results.failed, 0);
  assert.ok(cache.writes.length > cases.length, "the production collector writes incremental results");
  assert.ok(cache.writes.every(write => write.key === "qunit_test_results" && write.bytes <= valueLimit));
});

test("production init removes the previous report instead of serving stale results", () => {
  const cache = new LimitedCache();
  runSmallSuite(cache);
  const nextRequest = createLibrary(cache);
  assert.notEqual(nextRequest.getResultsFromServer(), null);
  nextRequest.init();
  assert.equal(nextRequest.getResultsFromServer(), null);
  assert.equal(createLibrary(cache).getResultsFromServer(), null);
});

test("production reads return no result after cache eviction", () => {
  const cache = new LimitedCache();
  runSmallSuite(cache);
  cache.delete("qunit_test_results");
  assert.equal(createLibrary(cache).getResultsFromServer(), null);
});

test("the cache substitute enforces the limit in UTF-8 bytes, not characters", () => {
  const cache = new LimitedCache();
  const atLimit = "\u00e9".repeat(valueLimit / 2);
  cache.set("boundary", atLimit);
  assert.equal(cache.writes[0].bytes, valueLimit);
  assert.throws(() => cache.set("boundary", atLimit + "a"), /exceeds 100 KB/);
  assert.equal(cache.get("boundary"), atLimit);
});

test("oversized production reports expose the cache error and retain no completion summary", () => {
  const cache = new LimitedCache();
  const library = createLibrary(cache);
  library.init();
  const onAssertion = library.QUnit.config.callbacks.log[0];
  // Drive the real collector callback directly so its quota error is observable
  // without turning it into an unhandled rejection in QUnit's Promise queue.
  assert.throws(() => {
    for (let i = 0; i < 3; i++) {
      onAssertion({ testId: String(i), result: true, actual: "x".repeat(40000) });
    }
  }, /exceeds 100 KB/);
  assert.equal(cache.writes.length, 2);
  const partial = JSON.parse(createLibrary(cache).getResultsFromServer());
  assert.equal(partial.length, 2);
  assert.ok(partial.every(record => record.type === "TESTS_RESULTS_ONE"));
});
