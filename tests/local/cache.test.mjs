import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { randomBytes } from "node:crypto";
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

test("incompressible reports expose the cache error and retain no completion summary", () => {
  const cache = new LimitedCache();
  const library = createLibrary(cache);
  library.init();
  const onAssertion = library.QUnit.config.callbacks.log[0];
  // Drive the real collector callback directly so its quota error is observable
  // without turning it into an unhandled rejection in QUnit's Promise queue.
  onAssertion({ testId: "first", result: true, actual: "small" });
  assert.throws(() => onAssertion({
    testId: "large", result: true, actual: randomBytes(80000).toString("base64")
  }), /exceed the 100 KB cache limit even after compression/);
  assert.equal(cache.writes.length, 1);
  const partial = JSON.parse(createLibrary(cache).getResultsFromServer());
  assert.equal(partial.length, 1);
  assert.ok(partial.every(record => record.type === "TESTS_RESULTS_ONE"));
});

test("large production reports complete and survive separate requests with unchanged JSON", () => {
  const cache = new LimitedCache();
  const library = createLibrary(cache);
  vm.runInContext(`
    init();
    QUnit.test("large Unicode values", function(assert) {
      for (var i = 0; i < 4; i++) {
        assert.strictEqual("caf\\u00e9 \\ud83d\\ude00".repeat(4000), "caf\\u00e9 \\ud83d\\ude00".repeat(4000));
      }
    });
    QUnit.test("after compression", function(assert) { assert.ok(true); });
    QUnit.start();
  `, library, { timeout: 5000 });
  const stored = cache.get("qunit_test_results");
  assert.ok(stored.startsWith("QUNITGS2:GZIP:1:"));
  const json = library.getResultsFromServer();
  assert.ok(Buffer.byteLength(json) > valueLimit);
  assert.equal(createLibrary(cache).getResultsFromServer(), json);
  const records = JSON.parse(json);
  assert.equal(records.at(-1).value.total, 5);
  assert.equal(records.at(-1).value.failed, 0);
  assert.equal(records[0].value.assertions[0].actual, "caf\u00e9 \ud83d\ude00".repeat(4000));
  assert.ok(cache.writes.every(write => write.bytes <= 100000));
  const next = createLibrary(cache);
  next.init();
  assert.equal(next.getResultsFromServer(), null);
});

test("cache codec preserves small legacy JSON without requiring compression utilities", () => {
  const json = JSON.stringify([{ type: "TESTS_RESULTS_ALL", value: {
    total: 0, passed: 0, failed: 0, runtime: 0
  } }]);
  const library = createLibrary(new Map([["qunit_test_results", json]]));
  library.Utilities = undefined;
  assert.equal(library.getResultsFromServer(), json);
  assert.equal(library.encodeResultCache_(json), json);
});

test("compression threshold uses UTF-8 bytes and handles supplementary Unicode", () => {
  const library = createLibrary();
  for (const value of ["a", "\u00e9", "\u20ac", "\ud83d\ude00", "\ud800", "\udc00"]) {
    const text = value.repeat(24000);
    assert.equal(library.resultCacheByteLength_(text), Buffer.byteLength(text));
  }
  const atThreshold = JSON.stringify(["a".repeat(79996)]);
  assert.equal(Buffer.byteLength(atThreshold), 80000);
  assert.equal(library.encodeResultCache_(atThreshold), atThreshold);
  const above = JSON.stringify(["\u20ac".repeat(27000)]);
  const stored = library.encodeResultCache_(above);
  assert.ok(stored.startsWith("QUNITGS2:GZIP:1:"));
  assert.equal(library.decodeResultCache_(stored), above);
});

test("compression does not expand incompressible reports that still fit the cache", () => {
  const library = createLibrary();
  const json = JSON.stringify([randomBytes(65000).toString("base64")]);
  assert.ok(Buffer.byteLength(json) > 80000);
  assert.equal(library.encodeResultCache_(json), json);
});

test("corrupted and unsupported cache encodings fail explicitly instead of pretending to complete", () => {
  for (const stored of ["QUNITGS2:GZIP:2:future", "unexpected cache value", "QUNITGS2:GZIP:1:bm90LWd6aXA="]) {
    const library = createLibrary(new Map([["qunit_test_results", stored]]));
    assert.throws(() => library.getResultsFromServer());
  }
});

test("compression service errors propagate without replacing an earlier partial report", () => {
  const cache = new LimitedCache();
  const library = createLibrary(cache);
  library.init();
  const onAssertion = library.QUnit.config.callbacks.log[0];
  onAssertion({ testId: "small", result: true, actual: "first assertion" });
  const previous = cache.get("qunit_test_results");
  library.Utilities.gzip = () => { throw new Error("gzip service failure"); };
  assert.throws(() => onAssertion({
    testId: "large", result: true, actual: "x".repeat(90000)
  }), /gzip service failure/);
  assert.equal(cache.get("qunit_test_results"), previous);
});

test("gzip retrieval supplies the Blob content type required by Apps Script", () => {
  const library = createLibrary();
  const compressed = library.encodeResultCache_(JSON.stringify(["x".repeat(90000)]));
  const originalUngzip = library.Utilities.ungzip;
  let contentType;
  library.Utilities.ungzip = blob => {
    contentType = blob.getContentType();
    return originalUngzip(blob);
  };
  assert.equal(library.decodeResultCache_(compressed), JSON.stringify(["x".repeat(90000)]));
  assert.equal(contentType, "application/x-gzip");
  const bytes = library.Utilities.base64Decode(compressed.slice("QUNITGS2:GZIP:1:".length));
  assert.throws(() => originalUngzip(library.Utilities.newBlob(bytes)), /content type/);
});
