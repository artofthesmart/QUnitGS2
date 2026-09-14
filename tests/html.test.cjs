const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createLibrary } = require('./runner.cjs');

test('getHtml binds the real templates and includes the browser script', () => {
  const library = createLibrary();
  library.init();
  const output = library.getHtml();
  assert.equal(output.getTitle(), 'QUnit v2.9.2 for Google Apps Script');
  assert.match(output.getContent(), /href="https:\/\/qunitgs2\.test\/"/);
  assert.match(output.getContent(), /action="https:\/\/qunitgs2\.test\/"/);
  assert.match(output.getContent(), /id="qunit-filter-pass"/);
  assert.match(output.getContent(), /window\.onload = function/);
  assert.match(output.getContent(), /withSuccessHandler\(onSuccess\)/);
  assert.doesNotMatch(output.getContent(), /<\?/);
});

test('getHtml preserves custom title, stylesheet and hidepassed bindings', () => {
  const library = createLibrary();
  library.init();
  library.QUnit.config.title = 'Tests <sample> & results';
  library.QUnit.config.cssUrl = 'https://qunitgs2.test/custom.css';
  library.QUnit.config.hidepassed = true;
  const output = library.getHtml();
  assert.equal(output.getTitle(), library.QUnit.config.title);
  assert.ok(output.getContent().includes('Tests &lt;sample&gt; &amp; results'));
  assert.ok(output.getContent().includes('href="https://qunitgs2.test/custom.css"'));
  assert.ok(output.getContent().includes("checked='checked'"));
});

test('server and browser JavaScript parse without transformation', () => {
  for (const file of ['QUnitGS2.gs', 'qunitjs.gs', 'qunit.js.html']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
      .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
    assert.doesNotThrow(() => new vm.Script(source, { filename: file }));
  }
});
