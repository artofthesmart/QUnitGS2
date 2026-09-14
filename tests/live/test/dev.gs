// These tests force a fail

function dev() {

  QUnit.module( "group a" );

  QUnit.test("Test1", function(assert) {
    assert.ok(true, "Test1a - Multiple asserts in on test - Passed!");
    assert.ok(true, "Test1b Passed!");
    assert.ok(true, "Test1c Passed!");
  });

  QUnit.test("Test2 - FORCE FAILURE", function(assert) {
    assert.ok(false, "Test2a - Force fail!");  
    assert.equal(1, 2, "Test2c - Force number fail");
    assert.equal(true, false, "Test2d - Force bool fail");
    assert.equal('abc', 'def', "Test2e - Force string fail");
  });

  QUnit.test("Test3 - FORCE FAILURE", function(assert) {
    assert.ok(false, "Test3 - Force fail!");
  });

  QUnit.test('Test 4 - deepEqual - FORCE FAILURE', function( assert ) {
  
    assert.deepEqual( {
      a: 'Albert',
      b: 'Berta',
      num: 123
    }, {
      a: 'Albert',
      b: 'Berta',
      num: '123' // Fails: the number `123` is not strictly equal to the string `'123'`.
    });    
  })

  QUnit.test('Test 4 - deepEqual pass', function( assert ) {
  
    assert.deepEqual( {
      a: 'Albert',
      b: 'Berta',
      num: 123,
      obj: {
        c: 'a',
        d: 'c'
      }      
    }, {
      a: 'Albert',
      b: 'Berta',
      num: 123,
      obj: {
        c: 'a',
        d: 'c'
      }
    });
  })

  QUnit.module( "group b" );

  QUnit.test("square() Test", function(assert) {
    var result = square_(2);
    assert.equal(result, 4, "square(2) equals 4 - new module");
  });
  
  function square_(x) {return x * x;}
}
