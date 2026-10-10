function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  if (parameters.format !== "json") {
    return runLiveTests_("browser", parameters.demo === "failures").html;
  }

  var response = {
    buildId: LIVE_BUILD_ID_,
    runId: parameters.runId,
    status: "error"
  };
  try {
    if (parameters.buildId !== LIVE_BUILD_ID_) {
      response.error = "The requested build is not deployed.";
    } else if (!/^[a-zA-Z0-9-]{1,64}$/.test(parameters.runId || "")) {
      response.error = "A runId of 1-64 letters, digits, or hyphens is required.";
    } else if (parameters.action === "run") {
      completeLiveResponse_(response, runLiveTests_(parameters.runId, false).json);
    } else if (parameters.action === "results") {
      var raw = decodeResultCache_(liveCache_(parameters.runId).get());
      if (raw === null) {
        response.error = "Results are unavailable or evicted. Live tests finish within the run request; no background run is pending.";
      } else {
        completeLiveResponse_(response, raw);
      }
    } else {
      response.error = "The action must be run or results.";
    }
  } catch (error) {
    console.error("QUnitGS2 live runner: " + (error && error.message || String(error)));
    response.status = "error";
    response.error = error && error.message || String(error);
    delete response.summary;
    delete response.tests;
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function runLiveTests_(runId, includeFailures) {
  var cache = liveCache_(runId);
  cache.remove();
  var json;
  var html = run(function() {
    QUnit.config.title = "QUnitGS2 Test";
    [deepEqual, dump, utilities, step].forEach(function(registerTests) {
      registerTests();
    });
    // Preserve async cases in source, but do not execute them on Apps Script.
    modules({ synchronousOnly: true });
    if (includeFailures) dev();
    QUnit.done(function() {
      json = getResultsFromServer();
    });
  });
  completeLiveResponse_({}, json);
  cache.put("qunit_test_results", encodeResultCache_(json));
  cache.flush();
  return { html: html, json: json };
}

function completeLiveResponse_(response, json) {
  var records = JSON.parse(json);
  if (!Array.isArray(records)) throw new Error("Invalid live result records.");
  var summaries = records.filter(function(record) { return record.type === "TESTS_RESULTS_ALL"; });
  var tests = records.filter(function(record) { return record.type === "TESTS_RESULTS_ONE"; })
    .map(function(record) { return record.value; });
  if (summaries.length !== 1 || !tests.length) throw new Error("QUnit did not finish the test run.");
  var summary = summaries[0].value;
  var totals = { passed: 0, failed: 0, total: 0 };
  tests.forEach(function(test) {
    if (!test.results || !Array.isArray(test.assertions) ||
        test.assertions.length !== test.results.total ||
        test.assertions.some(function(assertion) { return typeof assertion.result !== "boolean"; }) ||
        test.assertions.filter(function(assertion) { return !assertion.result; }).length !== test.results.failed) {
      throw new Error("Incomplete live test details.");
    }
    Object.keys(totals).forEach(function(key) {
      var count = test.results[key];
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid live test counts.");
      totals[key] += count;
    });
    if (test.results.passed + test.results.failed !== test.results.total) throw new Error("Inconsistent live test counts.");
  });
  if (!summary || summary.total <= 0 ||
      !Number.isFinite(summary.runtime) || summary.runtime < 0 ||
      Object.keys(totals).some(function(key) { return totals[key] !== summary[key]; })) {
    throw new Error("Live test details do not match the completion summary.");
  }
  response.status = "complete";
  response.summary = summary;
  response.tests = tests;
}

function liveCache_(runId) {
  var store = CacheService.getScriptCache();
  var prefix = "live:" + LIVE_BUILD_ID_ + ":" + runId;
  var value;
  return {
    get: function() {
      if (value !== undefined) {
        return value;
      }
      var count = store.get(prefix);
      if (count === null) {
        return null;
      }
      var chunkCount = Number(count);
      if (!Number.isSafeInteger(chunkCount) || chunkCount < 1 || chunkCount > 1000) {
        throw new Error("Invalid live cache chunk count.");
      }
      var chunks = [];
      for (var i = 0; i < chunkCount; i++) {
        var chunk = store.get(prefix + ":" + i);
        if (chunk === null) {
          return null;
        }
        chunks.push(chunk);
      }
      return chunks.join("");
    },
    put: function(key, data) {
      value = data;
    },
    remove: function() {
      value = null;
      store.remove(prefix);
    },
    flush: function() {
      if (typeof value !== "string") {
        throw new Error("No QUnit results were recorded.");
      }
      // 20,000 Unicode code points fit within 80 KB without splitting surrogates.
      var chunks = value.match(/[\s\S]{1,20000}/gu) || [""];
      for (var i = 0; i < chunks.length; i++) {
        store.put(prefix + ":" + i, chunks[i], 600);
      }
      store.put(prefix, String(chunks.length), 600);
    }
  };
}

// The existing browser RPC reads the latest browser run through the same adapter.
CACHE_ = liveCache_("browser");
