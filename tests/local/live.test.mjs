import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { build, output, root } from "../../scripts/build.mjs";
import { validateResponse } from "../../scripts/results.mjs";
import { createHtmlService } from "../html-service.cjs";

const buildId = await build();
const bundle = await readFile(path.join(output, "bundle.gs"), "utf8");

function runtime(store = new Map()) {
  const cache = {
    get: key => store.get(key) ?? null,
    remove: key => store.delete(key),
    put: (key, value, ttl) => {
      assert.ok(Buffer.byteLength(value) < 100000, "CacheService entry stays below 100 KB");
      assert.ok(key.length <= 250);
      assert.equal(ttl, 600);
      store.set(key, Buffer.from(value, "utf8").toString("utf8"));
    }
  };
  const context = vm.createContext({
    CacheService: { getUserCache: () => cache, getScriptCache: () => cache },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: text => ({ text, setMimeType(type) { this.type = type; return this; } })
    },
    HtmlService: createHtmlService(name => context._include(name)),
    ScriptApp: { getService: () => ({ getUrl: () => "https://example.test/exec" }) }
  }, { microtaskMode: "afterEvaluate" });
  vm.runInContext(bundle, context, { timeout: 30000 });
  return {
    store,
    evaluate: code => vm.runInContext(code, context, { timeout: 30000 }),
    request(parameters) {
      context.event = { parameter: { format: "json", buildId, runId: "test-run", ...parameters } };
      const output = vm.runInContext("doGet(event)", context, { timeout: 30000 });
      assert.equal(output.type, "application/json");
      return JSON.parse(output.text);
    }
  };
}

test("build is deterministic and contains local sources, tests, and only web-app assets", async () => {
  assert.equal(await build(), buildId);
  assert.equal(await readFile(path.join(output, "bundle.gs"), "utf8"), bundle);
  for (const file of ["QUnitGS2.gs", "qunitjs.gs", "tests/live/test/main/deepEqual.gs"]) {
    assert.ok(bundle.includes(await readFile(path.join(root, file), "utf8")));
  }
  assert.ok(bundle.includes("function dev()"));
  assert.ok(bundle.includes("function timeout()"), "unsupported suites are preserved");
  assert.ok(bundle.includes(await readFile(path.join(root, "tests/live/LICENSE"), "utf8")));
  assert.equal((bundle.match(/^function doGet\(/gm) || []).length, 1);
  const manifest = JSON.parse(await readFile(path.join(output, "appsscript.json"), "utf8"));
  assert.deepEqual(manifest.dependencies, {});
  assert.deepEqual(manifest.webapp, { access: "ANYONE_ANONYMOUS", executeAs: "USER_DEPLOYING" });
  const ignore = await readFile(path.join(output, ".claspignore"), "utf8");
  assert.equal(ignore, "**/**\n!bundle.gs\n!appsscript.json\n!index.html\n!qunit-toolbar.html\n!qunit.js.html\n");
  for (const asset of ["index.html", "qunit-toolbar.html", "qunit.js.html"]) {
    assert.equal(await readFile(path.join(output, asset), "utf8"), await readFile(path.join(root, asset), "utf8"));
  }
  assert.ok(!(await readdir(output)).includes("README.md"));
});

test("the complete imported synchronous suite survives separate Apps Script requests", () => {
  const start = runtime();
  assert.equal(start.request({ action: "run" }).status, "running");
  const result = runtime(start.store).request({ action: "results" });
  assert.equal(validateResponse(result, buildId, "test-run"), "complete");
  assert.equal(result.summary.total, 327);
  assert.equal(result.summary.failed, 0);
  assert.ok(result.tests.some(item => item.results.module === "equiv"));
  assert.ok(result.tests.some(item => item.results.module === "dump"));
  assert.ok(result.tests.some(item => item.results.module === "QUnit.objectType"));
  assert.ok(result.tests.every(item => !item.results.name.includes("FORCE FAILURE")));
  assert.ok(start.store.size > 2, "results exceeding 100 KB are split across entries");
  assert.ok(JSON.stringify(result).length > 100000);
});

test("results are isolated by run and build, and missing chunks never pass", () => {
  const start = runtime();
  start.request({ action: "run" });
  assert.equal(runtime(start.store).request({ action: "results", runId: "another-run" }).status, "pending");
  const stale = runtime(start.store).request({ action: "run", buildId: "old-build" });
  assert.equal(stale.status, "error");
  assert.equal(stale.buildId, buildId);
  const chunk = [...start.store.keys()].find(key => key.endsWith(":0"));
  start.store.delete(chunk);
  assert.equal(runtime(start.store).request({ action: "results" }).status, "pending");
});

test("the JSON protocol retains uncaught exceptions as failures", () => {
  const start = runtime();
  start.evaluate(`var originalUtilities = utilities;
    utilities = function() {
      originalUtilities();
      QUnit.test("runner exception", function() { throw new Error("live failure"); });
    };`);
  start.request({ action: "run" });
  const result = runtime(start.store).request({ action: "results" });
  assert.equal(validateResponse(result, buildId, "test-run"), "complete");
  assert.equal(result.summary.failed, 1);
  const failure = result.tests.find(item => item.results.name === "runner exception");
  assert.ok(failure.assertions[0].message.includes("live failure"));
  assert.equal(failure.assertions[0].result, false);
});

test("invalid JSON requests do not start tests", () => {
  const app = runtime();
  for (const parameters of [
    { action: "run", runId: "" },
    { action: "run", runId: "../invalid" },
    { action: "run", runId: "x".repeat(65) },
    { action: "unknown" }
  ]) {
    assert.equal(app.request(parameters).status, "error");
  }
  assert.equal(app.store.size, 0);
});

test("the browser view and browser RPC still work, including optional failure demos", () => {
  const app = runtime();
  const page = app.evaluate("doGet({parameter: {demo: 'failures'}})");
  assert.match(page.getContent(), /id="qunit-tests"/);
  assert.doesNotMatch(page.getContent(), /<\?/);
  assert.equal(page.getTitle(), "QUnitGS2 Test");
  const records = JSON.parse(runtime(app.store).evaluate("getResultsFromServer()"));
  const summary = records.find(item => item.type === "TESTS_RESULTS_ALL").value;
  assert.ok(summary.failed > 0);
  assert.ok(records.some(item => item.type === "TESTS_RESULTS_ONE" && item.value.results.name.includes("FORCE FAILURE")));
  assert.equal(runtime(app.store).request({ action: "results" }).status, "pending");
});

test("browser runs exclude failure demos unless explicitly requested", () => {
  const app = runtime();
  app.evaluate("doGet()");
  const records = JSON.parse(runtime(app.store).evaluate("getResultsFromServer()"));
  assert.equal(records.find(item => item.type === "TESTS_RESULTS_ALL").value.failed, 0);
});

test("chunking preserves Unicode and cache eviction yields no partial result", () => {
  const app = runtime();
  app.evaluate('var testCache = liveCache_("unicode"); testCache.put("qunit_test_results", "a".repeat(19999) + "\\ud83d\\ude00".repeat(20000)); testCache.flush();');
  const text = runtime(app.store).evaluate('liveCache_("unicode").get()');
  assert.equal(text, "a".repeat(19999) + "\ud83d\ude00".repeat(20000));
  app.store.clear();
  assert.equal(runtime(app.store).evaluate('liveCache_("unicode").get()'), null);
});
