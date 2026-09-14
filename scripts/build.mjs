import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const output = path.join(root, "dist/live");

async function sourcesIn(directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await sourcesIn(name));
    } else if (entry.isFile() && entry.name.endsWith(".gs")) {
      files.push(name);
    }
  }
  return files.sort();
}

export async function build() {
  const serverFiles = [
    "QUnitGS2.gs",
    "qunitjs.gs",
    ...await sourcesIn("tests/live/test"),
    "tests/live/Code.gs"
  ];
  const assets = ["index.html", "qunit-toolbar.html", "qunit.js.html"];
  const licenseFiles = ["LICENSE", "tests/live/LICENSE"];
  const files = [...serverFiles, ...assets, "tests/live/appsscript.json", ...licenseFiles];
  const contents = new Map(await Promise.all(files.map(async file =>
    [file, await readFile(path.join(root, file), "utf8")]
  )));
  const hash = createHash("sha256");
  for (const [name, content] of contents) {
    hash.update(name).update("\0").update(content).update("\0");
  }
  const buildId = hash.digest("hex");
  const licenses = [...new Set(licenseFiles.map(file => contents.get(file)))]
    .map(content => `/*\n${content}\n*/\n`).join("\n");
  const bundle = licenses + `var LIVE_BUILD_ID_ = ${JSON.stringify(buildId)};\n` +
    serverFiles.map(file => `// Source: ${file}\n${contents.get(file)}`).join("\n;\n");
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, "bundle.gs"), bundle),
    writeFile(path.join(output, "appsscript.json"), contents.get("tests/live/appsscript.json")),
    writeFile(path.join(output, ".claspignore"),
      "**/**\n!bundle.gs\n!appsscript.json\n!index.html\n!qunit-toolbar.html\n!qunit.js.html\n"),
    writeFile(path.join(root, "dist/build.json"), JSON.stringify({ buildId }, null, 2) + "\n"),
    ...assets.map(file => writeFile(path.join(output, file), contents.get(file)))
  ]);
  return buildId;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built live tests: ${await build()}`);
}
