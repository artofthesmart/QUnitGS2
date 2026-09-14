import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { build, output, root } from "./build.mjs";
import { parseResponse, reportResults, validateResponse } from "./results.mjs";

const libraryId = "1tXPhZmIyYiA_EMpTRJw0QpVGT5Pdb02PpOHCi9A9FFidblOc9CY_VLgG";

export function validateConfig(config) {
  if (!config || typeof config.scriptId !== "string" ||
      !/^[\w-]{20,}$/.test(config.scriptId) || config.scriptId.startsWith("REPLACE_") ||
      typeof config.deploymentId !== "string" || !/^AKfy[\w-]+$/.test(config.deploymentId)) {
    throw new Error("Set scriptId and deploymentId in .live-test.json using a dedicated test project's IDs.");
  }
  if (config.scriptId === libraryId) {
    throw new Error("Refusing to push live tests to the published QUnitGS2 library.");
  }
}

export function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(executable)} failed (${result.signal || result.status}).`);
  }
}

export async function fetchResults(url, buildId, runId, fetch, pause = setTimeout) {
  let action = "run";
  for (let attempt = 0; attempt < 12; attempt++) {
    const request = new URL(url);
    request.search = new URLSearchParams({ format: "json", action, buildId, runId }).toString();
    const response = parseResponse(await fetch(request.href));
    const status = validateResponse(response, buildId, runId);
    if (status === "complete") return response;
    if (status !== "stale") action = "results";
    await pause(5000);
  }
  throw new Error("Timed out waiting for this build's completed results. Check Apps Script Executions for errors; cached results may also have expired or been evicted.");
}

async function main() {
  const configPath = path.join(root, ".live-test.json");
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error("Copy .live-test.example.json to .live-test.json and configure the test project first.");
  }
  validateConfig(config);
  const clasp = path.join(root, "node_modules/.bin/clasp");
  await access(clasp);
  command("wget", ["--version"], { stdio: "ignore" });

  const lock = path.join(root, ".live-test.lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error("A live-test command is already running. If it was interrupted, remove the empty .live-test.lock directory before retrying.");
  }
  try {
    const buildId = await build();
    const project = path.join(output, ".clasp.json");
    await writeFile(project, JSON.stringify({ scriptId: config.scriptId, rootDir: "." }, null, 2) + "\n");
    const projectOptions = ["--project", project, "--ignore", path.join(output, ".claspignore")];
    console.log(`Pushing test build ${buildId} to ${config.scriptId}`);
    command(clasp, [...projectOptions, "push", "--force"], { cwd: output });
    command(clasp, [...projectOptions, "deploy", "--deploymentId", config.deploymentId,
      "--description", `QUnitGS2 test ${buildId.slice(0, 12)}`], { cwd: output });

    const resultsPath = path.join(root, "dist/live-results.json");
    const response = await fetchResults(
      `https://script.google.com/macros/s/${config.deploymentId}/exec`,
      buildId,
      randomUUID(),
      async url => {
        command("wget", ["--no-verbose", "--timeout=360", "--tries=1",
          "--max-redirect=5", "--output-document", resultsPath, url]);
        return readFile(resultsPath, "utf8");
      }
    );
    process.exitCode = reportResults(response);
  } finally {
    await rmdir(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
