function countsAreValid(counts) {
  return counts && ["passed", "failed", "total"].every(key =>
    Number.isSafeInteger(counts[key]) && counts[key] >= 0
  ) && counts.passed + counts.failed === counts.total;
}

export function parseResponse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error("Expected JSON from the test web app. Check its deployment and anonymous access; it may be returning a sign-in or error page.", { cause: error });
  }
}

export function validateResponse(response, buildId, runId) {
  if (!response || typeof response !== "object" || typeof response.buildId !== "string") {
    throw new Error("The endpoint did not return a QUnitGS2 live-test response.");
  }
  if (response.runId !== runId) {
    throw new Error("The endpoint returned results for a different run.");
  }
  if (response.buildId !== buildId) return "stale";
  if (response.status === "error") {
    throw new Error(`Test endpoint error: ${response.error}`);
  }
  if (response.status === "running" || response.status === "pending") {
    return response.status;
  }
  if (response.status !== "complete" ||
      !countsAreValid(response.summary) || response.summary.total === 0 ||
      !Number.isFinite(response.summary.runtime) || response.summary.runtime < 0 ||
      !Array.isArray(response.tests) || response.tests.length === 0) {
    throw new Error("The endpoint returned missing, empty, or invalid test results.");
  }
  const totals = { passed: 0, failed: 0, total: 0 };
  for (const test of response.tests) {
    if (!test || !countsAreValid(test.results) || !Array.isArray(test.assertions) ||
        test.assertions.length !== test.results.total ||
        test.assertions.some(assertion => !assertion || typeof assertion.result !== "boolean") ||
        test.assertions.filter(assertion => !assertion.result).length !== test.results.failed) {
      throw new Error("The endpoint returned incomplete or inconsistent test details.");
    }
    for (const key of Object.keys(totals)) totals[key] += test.results[key];
  }
  if (Object.keys(totals).some(key => totals[key] !== response.summary[key])) {
    throw new Error("The test details do not match the summary.");
  }
  return "complete";
}

export function reportResults(response, log = console.log) {
  for (const test of response.tests) {
    for (const assertion of test.assertions.filter(item => !item.result)) {
      log(`FAIL ${test.results.module}: ${test.results.name}: ${assertion.message || "(no message)"}`);
      log(`  expected: ${JSON.stringify(assertion.expected)}, actual: ${JSON.stringify(assertion.actual)}`);
    }
  }
  const { passed, failed, total, runtime } = response.summary;
  log(`${passed}/${total} assertions passed; ${failed} failed (${runtime} ms).`);
  return failed === 0 ? 0 : 1;
}
