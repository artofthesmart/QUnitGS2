import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { root } from "../../scripts/build.mjs";
import { command, fetchResults, validateConfig } from "../../scripts/test-live.mjs";
import { parseResponse, reportResults, validateResponse } from "../../scripts/results.mjs";

function result(failed = false) {
  const counts = { passed: failed ? 0 : 1, failed: failed ? 1 : 0, total: 1 };
  return {
    buildId: "build", runId: "run", status: "complete",
    summary: { ...counts, runtime: 1 },
    tests: [{
      results: { ...counts, module: "module", name: "test" },
      assertions: [{ result: !failed, message: "comparison", expected: 1, actual: failed ? 2 : 1 }]
    }]
  };
}

test("passing and failing assertions produce accurate summaries and exit codes", () => {
  for (const failed of [false, true]) {
    const response = result(failed);
    assert.equal(validateResponse(response, "build", "run"), "complete");
    const lines = [];
    assert.equal(reportResults(response, line => lines.push(line)), failed ? 1 : 0);
    assert.ok(lines.at(-1).includes(`${failed ? 1 : 0} failed`));
    if (failed) {
      assert.ok(lines.some(line => line.includes("FAIL module: test: comparison")));
      assert.ok(lines.some(line => line.includes("expected: 1, actual: 2")));
    }
  }
});

test("sign-in pages, invalid summaries, mismatched runs, and partial results fail closed", () => {
  assert.throws(() => parseResponse("<html>Sign in</html>"), /Expected JSON/);
  for (const response of [
    null,
    {},
    { ...result(), runId: "someone-else" },
    { ...result(), status: "error", error: "execution failed" },
    { ...result(), summary: { passed: 0, failed: 0, total: 0, runtime: 0 } },
    { ...result(), summary: { passed: "1", failed: 0, total: 1, runtime: 0 } },
    { ...result(), summary: { passed: -1, failed: 2, total: 1, runtime: 0 } },
    { ...result(), summary: { passed: 1, failed: 0, total: 2, runtime: 0 } },
    { ...result(), summary: { passed: 1, failed: 0, total: 1, runtime: -1 } },
    { ...result(), tests: [] },
    { ...result(), tests: [{ results: { passed: 1, failed: 0, total: 1 }, assertions: [] }] },
    { ...result(), tests: result(true).tests },
    { ...result(), tests: [...result().tests, ...result().tests] }
  ]) {
    assert.throws(() => validateResponse(response, "build", "run"));
  }
});

test("fetching waits for deployment propagation, starts once, and polls correlated results", async () => {
  const replies = [
    { buildId: "previous-build", runId: "run", status: "error" },
    { buildId: "build", runId: "run", status: "running" },
    { buildId: "build", runId: "run", status: "pending" },
    result()
  ];
  const actions = [];
  const response = await fetchResults("https://example.test/exec", "build", "run", async url => {
    const parameters = new URL(url).searchParams;
    assert.equal(parameters.get("format"), "json");
    assert.equal(parameters.get("buildId"), "build");
    assert.equal(parameters.get("runId"), "run");
    actions.push(parameters.get("action"));
    return JSON.stringify(replies.shift());
  }, async () => {});
  assert.deepEqual(response, result());
  assert.deepEqual(actions, ["run", "run", "results", "results"]);
});

test("fetching has bounded retries and propagates transport and server errors", async () => {
  let attempts = 0;
  await assert.rejects(fetchResults("https://example.test/exec", "build", "run", async () => {
    attempts++;
    return JSON.stringify({ buildId: "build", runId: "run", status: "pending" });
  }, async () => {}), /Timed out/);
  assert.equal(attempts, 12);
  await assert.rejects(fetchResults("https://example.test/exec", "build", "run", async () => {
    throw new Error("wget failed");
  }), /wget failed/);
  await assert.rejects(fetchResults("https://example.test/exec", "build", "run", async () =>
    JSON.stringify({ buildId: "build", runId: "run", status: "error", error: "execution failed" })
  ), /execution failed/);
});

test("configuration rejects placeholders and the published library project", () => {
  const valid = { scriptId: "test-script-12345678901234567890", deploymentId: "AKfy-test-deployment" };
  assert.doesNotThrow(() => validateConfig(valid));
  for (const config of [
    undefined,
    {},
    { ...valid, scriptId: "REPLACE_WITH_TEST_SCRIPT_ID" },
    { ...valid, deploymentId: "https://example.test/exec" },
    { ...valid, scriptId: "1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG" }
  ]) {
    assert.throws(() => validateConfig(config));
  }
});

test("command failures are never reported as success", () => {
  assert.throws(() => command(process.execPath, ["-e", "process.exit(7)"], { stdio: "ignore" }), /failed \(7\)/);
  assert.throws(() => command("/does-not-exist-qunitgs2", []), /ENOENT/);
});

test("the shell command builds, pushes, redeploys, fetches, and cleans up on failure", async t => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "qunitgs2-workflow-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(path.join(root, "scripts"), path.join(directory, "scripts"), { recursive: true });
  await mkdir(path.join(directory, "tests/live/test"), { recursive: true });
  await mkdir(path.join(directory, "node_modules/.bin"), { recursive: true });
  await mkdir(path.join(directory, "bin"));
  for (const file of ["QUnitGS2.gs", "qunitjs.gs", "index.html", "qunit-toolbar.html", "qunit.js.html", "tests/live/Code.gs"]) {
    await writeFile(path.join(directory, file), "// fixture\n");
  }
  await writeFile(path.join(directory, "tests/live/appsscript.json"), "{}");
  await cp(path.join(root, "LICENSE"), path.join(directory, "LICENSE"));
  await cp(path.join(root, "tests/live/LICENSE"), path.join(directory, "tests/live/LICENSE"));
  await writeFile(path.join(directory, ".live-test.json"), JSON.stringify({
    scriptId: "test-script-12345678901234567890", deploymentId: "AKfy-test-deployment"
  }));
  const fakeCommand = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const root = process.env.FIXTURE_ROOT;
fs.appendFileSync(path.join(root, "commands.jsonl"), JSON.stringify({name, args, cwd: process.cwd()}) + "\\n");
if (name === "clasp") {
  if (args.includes(process.env.FAIL_CLASP)) process.exit(9);
} else if (!args.includes("--version")) {
  const url = new URL(args.at(-1));
  const buildId = JSON.parse(fs.readFileSync(path.join(root, "dist/build.json"))).buildId;
  const response = ${JSON.stringify(result())};
  response.buildId = buildId;
  response.runId = url.searchParams.get("runId");
  if (url.searchParams.get("action") === "run") response.status = "running";
  if (process.env.FAIL_ASSERTION) {
    response.summary = {...response.summary, passed: 0, failed: 1};
    response.tests[0].results = {...response.tests[0].results, passed: 0, failed: 1};
    response.tests[0].assertions[0].result = false;
  }
  fs.writeFileSync(args[args.indexOf("--output-document") + 1], JSON.stringify(response));
}
`;
  await writeFile(path.join(directory, "node_modules/.bin/clasp"), fakeCommand, { mode: 0o755 });
  await writeFile(path.join(directory, "bin/wget"), fakeCommand, { mode: 0o755 });
  const env = { ...process.env, FIXTURE_ROOT: directory, PATH: `${directory}/bin:${process.env.PATH}` };
  const run = extra => spawnSync("bash", [path.join(directory, "scripts/test-live.sh")], {
    cwd: tmpdir(), env: { ...env, ...extra }, encoding: "utf8", timeout: 30000
  });
  const passed = run();
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /1\/1 assertions passed; 0 failed/);
  const calls = (await readFile(path.join(directory, "commands.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const claspCalls = calls.filter(call => call.name === "clasp");
  assert.deepEqual(claspCalls.map(call => call.args.find(arg => ["push", "deploy"].includes(arg))), ["push", "deploy"]);
  for (const call of claspCalls) {
    assert.equal(call.cwd, path.join(directory, "dist/live"));
    assert.equal(call.args[call.args.indexOf("--project") + 1], path.join(directory, "dist/live/.clasp.json"));
    assert.equal(call.args[call.args.indexOf("--ignore") + 1], path.join(directory, "dist/live/.claspignore"));
  }
  assert.ok(claspCalls[0].args.includes("--force"));
  assert.equal(claspCalls[1].args[claspCalls[1].args.indexOf("--deploymentId") + 1], "AKfy-test-deployment");
  assert.deepEqual(calls.filter(call => call.name === "wget" && !call.args.includes("--version"))
    .map(call => new URL(call.args.at(-1)).searchParams.get("action")), ["run", "results"]);
  const project = JSON.parse(await readFile(path.join(directory, "dist/live/.clasp.json"), "utf8"));
  assert.equal(project.scriptId, "test-script-12345678901234567890");
  assert.equal(project.rootDir, ".");
  await assert.rejects(readFile(path.join(directory, ".live-test.lock")), { code: "ENOENT" });

  const failed = run({ FAIL_ASSERTION: "1" });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /0\/1 assertions passed; 1 failed/);
  for (const phase of ["push", "deploy"]) {
    await writeFile(path.join(directory, "commands.jsonl"), "");
    const failure = run({ FAIL_CLASP: phase });
    assert.equal(failure.status, 1);
    assert.match(failure.stderr, /clasp failed \(9\)/);
    const log = await readFile(path.join(directory, "commands.jsonl"), "utf8");
    assert.ok(!log.includes("--output-document"), "no test request after deployment failure");
    await assert.rejects(readFile(path.join(directory, ".live-test.lock")), { code: "ENOENT" });
  }
});
