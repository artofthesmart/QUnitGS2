const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runSuite } = require('./runner.cjs');

for (const thrown of ["'uh oh'", "new Error('uh oh')"]) {
  test(`records thrown ${thrown} and continues`, () => {
    const { tests, summary } = runSuite(`
      QUnit.test('exception', function() { throw ${thrown}; });
    `);
    assert.equal(tests[0].results.failed, 1);
    assert.match(tests[0].assertions[0].message, /uh oh/);
    assert.equal(tests[0].assertions[0].diff, '');
    assert.equal(Object.hasOwn(tests[0].assertions[0], 'expected'), false);
    assert.equal(summary.failed, 1);
    assert.equal(summary.passed, 1);
    assert.equal(tests.length, 2);
    if (thrown.startsWith('new Error')) {
      assert.match(tests[0].assertions[0].source, /suite\.gs/);
    }
  });
}

for (const hook of ['before', 'beforeEach', 'afterEach', 'after']) {
  test(`records a failing ${hook} hook`, () => {
    const { tests, summary } = runSuite(`
      QUnit.module('hooks', function(hooks) {
        hooks.${hook}(function() { throw new Error('hook failure'); });
        QUnit.test('hook test', function(assert) { assert.ok(true); });
      });
    `);
    assert.equal(summary.failed, 1);
    assert.equal(summary.passed, 2);
    assert.equal(tests.length, 2);
    assert.ok(tests[0].assertions.some(item => !item.result && /hook failure/.test(item.message)));
  });
}

test('retains assertions preceding an exception', () => {
  const { tests, summary } = runSuite(`
    QUnit.test('partial test', function(assert) {
      assert.ok(true, 'before exception');
      throw new Error('after assertion');
    });
  `);
  assert.equal(tests.length, 2);
  assert.equal(tests[0].assertions.length, 2);
  assert.equal(tests[0].assertions[0].message, 'before exception');
  assert.match(tests[0].assertions[1].message, /after assertion/);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
});

test('records every repeated hook failure in a nested module', () => {
  const { tests, summary } = runSuite(`
    QUnit.module('outer', function(hooks) {
      hooks.beforeEach(function() { throw new Error('setup failure'); });
      hooks.afterEach(function() { throw new Error('teardown failure'); });
      QUnit.module('inner', function() {
        QUnit.test('first', function(assert) { assert.ok(true); });
        QUnit.test('second', function(assert) { assert.ok(true); });
      });
    });
  `);
  assert.equal(tests.length, 3);
  for (const item of tests.slice(0, 2)) {
    assert.equal(item.results.failed, 2);
    assert.equal(item.assertions.length, 3);
    assert.match(item.assertions[0].message, /setup failure/);
    assert.match(item.assertions[2].message, /teardown failure/);
  }
  assert.equal(summary.failed, 4);
  assert.equal(summary.passed, 3);
});

test('records failing assert.throws calls as well as expected exceptions', () => {
  const { tests, summary } = runSuite(`
    QUnit.test('throws assertions', function(assert) {
      assert.throws(function() { throw new Error('expected'); }, /expected/);
      assert.throws(function() {}, /missing/, 'missing exception');
      assert.throws(function() { throw new Error('wrong'); }, /expected/, 'wrong exception');
    });
  `);
  assert.equal(tests[0].assertions.length, 3);
  assert.equal(tests[0].assertions[1].message, 'missing exception');
  assert.equal(tests[0].assertions[2].message, 'wrong exception');
  assert.equal(summary.failed, 2);
  assert.equal(summary.passed, 2);
});

for (const [name, source] of [
  ['empty test', ''],
  ['assertion count mismatch', 'assert.expect(1);']
]) {
  test(`records QUnit-generated failure for ${name}`, () => {
    const { tests, summary } = runSuite(`
      QUnit.test('generated failure', function(assert) { ${source} });
    `);
    assert.equal(tests.length, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.passed, 1);
    assert.match(tests[0].assertions[0].message, /Expected/);
    assert.equal(tests[0].assertions[0].diff, '');
  });
}

for (const [name, actual, expected, passed, diff] of [
  ['matching strings', "'hello'", "'hello'", true, '<span>hello</span>'],
  ['overlapping strings', "'hello world'", "'hello there'", false],
  ['unrelated strings', "'abc'", "'xyz'", false, ''],
  ['mixed string and number', '2', "'2'", false],
  ['matching booleans', 'true', 'true', true, ''],
  ['different booleans', 'true', 'false', false, ''],
  ['matching undefined', 'undefined', 'undefined', true, '<span>undefined</span>'],
  ['undefined actual', 'undefined', "'defined'", false],
  ['undefined expected', "'defined'", 'undefined', false],
  ['matching null', 'null', 'null', true, '<span>null</span>'],
  ['null and undefined', 'null', 'undefined', false],
  ['matching objects', '({ value: 1 })', '({ value: 1 })', true, '<span>{\n  &quot;value&quot;: 1\n}</span>'],
  ['different objects', '({ value: 1 })', '({ value: 2 })', false],
  ['matching arrays', '[1, 2]', '[1, 2]', true, '<span>[\n  1,\n  2\n]</span>'],
  ['different arrays', '[1, 2]', '[1, 3]', false],
  ['negative numeric difference', '1', '2', false, '-1'],
  ['NaN', 'NaN', '2', false, ''],
  ['infinity', 'Infinity', '2', false, '+Infinity']
]) {
  test(`serializes ${name} without losing results`, () => {
    const { tests, summary } = runSuite(`
      QUnit.test('comparison', function(assert) {
        assert.deepEqual(${actual}, ${expected}, 'comparison result');
      });
    `);
    assert.equal(tests.length, 2);
    assert.equal(tests[0].assertions[0].result, passed);
    assert.equal(summary.failed, passed ? 0 : 1);
    assert.equal(summary.passed, passed ? 2 : 1);
    assert.equal(typeof tests[0].assertions[0].diff, 'string');
    if (diff !== undefined) assert.equal(tests[0].assertions[0].diff, diff);
    if (name === 'overlapping strings') {
      assert.match(tests[0].assertions[0].diff, /<ins>.*world.*<\/ins>/);
      assert.match(tests[0].assertions[0].diff, /<del>.*there.*<\/del>/);
    }
  });
}

test('preserves ordinary assertions and explicit undefined comparisons', () => {
  const { tests, summary } = runSuite(`
    QUnit.test('comparisons', function(assert) {
      assert.equal(2, 2);
      assert.equal(3, 2);
      assert.strictEqual(undefined, undefined);
      assert.strictEqual('text', undefined);
      assert.deepEqual({ value: 1 }, { value: 1 });
      assert.throws(function() { throw new Error('expected'); }, /expected/);
    });
  `);
  assert.equal(tests[0].assertions.length, 6);
  assert.equal(tests[0].assertions[1].diff, '+1');
  assert.equal(summary.failed, 2);
  assert.equal(summary.passed, 5);
});
