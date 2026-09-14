const path = require('node:path');
const { execFileSync } = require('node:child_process');

function collectSuite(source) {
  // Keep Playwright's stack formatter out of QUnit's stack-source detection.
  return JSON.parse(execFileSync(process.execPath, [
    '-e',
    `const { runSuite } = require(process.argv[1]);
     process.stdout.write(JSON.stringify(runSuite(require('node:fs').readFileSync(0, 'utf8'))));`,
    path.join(__dirname, 'runner.cjs')
  ], { input: source, encoding: 'utf8', timeout: 10000 }));
}

async function openResults(page, suite, { delivery = 'success', error = 'Bridge failed' } = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ results, delivery, error }) => {
    const bridge = {
      withSuccessHandler(callback) { this.success = callback; return this; },
      withFailureHandler(callback) { this.failure = callback; return this; },
      getResultsFromServer() {
        if (delivery === 'throw') throw new Error(error);
        if (delivery === 'manual') return;
        window.setTimeout(() => delivery === 'error'
          ? this.failure(new Error(error)) : this.success(results), 0);
      }
    };
    window.google = { script: { run: bridge } };
  }, { results: suite.resultsString, delivery, error });
  await page.route('**/*', route => route.request().url() === 'https://qunitgs2.test/'
    ? route.fulfill({ contentType: 'text/html', body: suite.html })
    : route.abort());
  await page.goto('https://qunitgs2.test/');
  return errors;
}

module.exports = { collectSuite, openResults };
