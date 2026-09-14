function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  if (parameters.format !== "json") {
    runLiveTests_("browser", parameters.demo === "failures");
    return getHtml();
  }

  var response = {
    buildId: LIVE_BUILD_ID_,
    runId: parameters.runId,
    status: "error"
  };
  if (parameters.buildId !== LIVE_BUILD_ID_) {
    response.error = "The requested build is not deployed.";
  } else if (!/^[a-zA-Z0-9-]{1,64}$/.test(parameters.runId || "")) {
    response.error = "A runId of 1-64 letters, digits, or hyphens is required.";
  } else if (parameters.action === "run") {
    runLiveTests_(parameters.runId, false);
    response.status = "running";
  } else if (parameters.action === "results") {
    var raw = liveCache_(parameters.runId).get();
    if (raw === null) {
      response.status = "pending";
    } else {
      var records = JSON.parse(raw);
      var summary = records.find(function(record) {
        return record.type === "TESTS_RESULTS_ALL";
      });
      if (!summary) {
        response.error = "QUnit did not finish the test run.";
      } else {
        response.status = "complete";
        response.summary = summary.value;
        response.tests = records.filter(function(record) {
          return record.type === "TESTS_RESULTS_ONE";
        }).map(function(record) {
          return record.value;
        });
      }
    }
  } else {
    response.error = "The action must be run or results.";
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function runLiveTests_(runId, includeFailures) {
  CACHE_ = liveCache_(runId);
  init();
  QUnit.config.title = "QUnitGS2 Test";
  // Register at invocation time, not file-load time (Apps Script file ordering).
  [deepEqual, dump, utilities].forEach(function(registerTests) {
    registerTests();
  });
  if (includeFailures) {
    dev();
  }
  // Native Promise callbacks finish after doGet returns. Publish only on done,
  // after the library has recorded its summary.
  QUnit.done(function() {
    CACHE_.flush();
  });
  QUnit.start();
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
      var chunks = [];
      for (var i = 0; i < Number(count); i++) {
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
