
// JSHint - 20200716
/* jshint asi: true */
/* jshint esversion: 6*/

(function() {"use strict"})()

/**
 *
 * <pre>
 * QUnit2GS is a Google Apps Script Library that allows Apps Script projects to be tested
 * using the QUnit JavaScript testing framework - qunitjs.com.
 
 * << Usage >> 
 
 * - Publish a "doGet()" that calls the following functions:
 *  
 *     function doGet() {
 *       QUnitGS2.init()
 *       userDefinedtestFunctions()
 *       QUnit.start()  
 *       return QUnitGS2.getHtml()
 *     }
 *
 * - Provide a getResultsFromServer() which simply returns QUnitGS2.getResultsFromServer()
 * 
 *   For example: 
 *
 *     function getResultsFromServer() {
 *       return QUnitGS2.getResultsFromServer()
 *     }
 * 
 * Further examples can be seen in the QUnitGS2 Test project:
 * 
 *   script.google.com/d/1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M
 *
 * << Differences from main QUnit library >>
 *
 * - QUnitGS2 provides a wrapper to the main QUnit library. It creates the HTML/CSS
 *   to display in an Apps Script web app based on the JSON test results 
 *   returned by various QUnit callback functions. This is in contrast to how the 
 *   QUnitGS library based on v1 worked, which was to update the main library to 
 *   display the HTML as a web app.
 *
 *     github.com/simula-innovation/qunit/tree/gas/gas
 *
 * - The published QUnit library functions are in a separate file for the library 
 * creation and API documentation generation to work.
 *
 * - The GUI is not displayed immediately, but rather only after the tests have run.
 * 
 * - Tests are run on Google's servers, not in your browser. The browser only 
 * displays test results.
 *
 * - Asynchronous testing is limited. There is no setTimeout() function in Google 
 * Apps Script. If you create time-based triggers via the Script service, the 
 * doGet() function is more likely to timeout than your test.
 *
 * - HTML and client-side JavaScript is generated using Google's HtmlService.
 *
 * << Upgrading QUnitGS2 >>
 *
 * To upgrade to a later version of QUnit simply:
 * 
 * - Copy the new version into qunitjs.gs
 *  
 * - Ensure the main QUnit object is exported from the main Qunit library by 
 *   adding to exportQUnit():
 *
 *       if (typeof HtmlService !== undefined) global$1.QUnit = QUnit;
 * 
 * - Create a new version of the script project. See: 
 *
 *       developers.google.com/apps-script/guides/versions
 * 
 * << QUnit config >>
 *
 * Config settings are passed straight through to the main QUnit library.
 * See https://api.qunitjs.com/config/QUnit.config for details.
 * </pre>
 */
 
function init() {
  
  CACHE_.remove('qunit_test_results')  
  
  QUnit.config.autostart = false;
  
  QUnit.config.storage = {
    store: {},
    setItem: function(key, value) {this.store[key] = value},
    getItem: function(key) {return this.store[key]},
    removeItem: function(key) {delete this.store[key]},
    clear: function() {this.store = {}},
  }
  
  // Set up callbacks that will store the results
  QUnit.done(onAllTestsFinished)  
  QUnit.testDone(onTestDone)
  QUnit.log(onAssertResult)
  return
  
  // Private Functions
  // -----------------
  
  function onAllTestsFinished(details) {
    push('TESTS_RESULTS_ALL', details)    
  }
  
  function onTestDone(details) {
    push('TESTS_RESULTS_ONE', details)    
  }
  
  function onAssertResult(details) {
    push('TESTS_RESULTS_ASSERT', details)    
  }
  
  function push(type, details) {
    
    var cacheString = CACHE_.get('qunit_test_results')
    cache = (cacheString === null) ? [] : JSON.parse(cacheString)
    updateCacheWithTestDetails()
    
    CACHE_.put(
      'qunit_test_results',
      JSON.stringify(cache)
    )
    
    return
    
    // Private Functions
    // -----------------
    
    function updateCacheWithTestDetails() {
    
      if (type === 'TESTS_RESULTS_ASSERT') {
      
        details.expected = typeof details.expected === 'object' ? QUnit.dump.parse(details.expected) : details.expected
        details.actual = typeof details.actual === 'object' ? QUnit.dump.parse(details.actual) : details.actual
        details.diff = getDiff()
        getTest(details.testId).value.assertions.push(details)
        
      } else if (type === 'TESTS_RESULTS_ONE') { 
      
        getTest(details.testId).value.results = details
        
      } else if (type === 'TESTS_RESULTS_ALL') { 
      
        getSummary().value = details
        
      } else {
      
        throw new Error('Bad result type: "' + type + '"')
      }     
      
      return 
      
      // Private Functions
      // -----------------

      function getDiff() {     
      
        var diff
        var showDiff
        
        if (typeof details.actual === "number" && typeof details.expected === "number") {
        
          if (!isNaN(details.actual) && !isNaN(details.expected)) {
          
            showDiff = true
            diff = details.actual - details.expected
            diff = (diff > 0 ? "+" : "") + diff
          }
          
        } else if (typeof details.actual !== "boolean" && typeof details.expected !== "boolean") {
        
          diff = QUnit.diff(details.expected, details.actual)
          
          // don't show diff if there is zero overlap
          showDiff = stripHtml(diff).length !== stripHtml(details.expected).length + stripHtml(details.actual).length;
        }        
        
        return (showDiff) ? diff : ''
        
        // Private Functions
        // -----------------
        
        function stripHtml(string) {  
          // Strip tags, html entity and whitespaces
          return string.replace(/<\/?[^>]+(>|$)/g, "").replace(/&quot;/g, "").replace(/\s+/g, "");
        }        
      }

      function getTest(testId) { 
        
        var test = null
        
        cache.some(item => {
          if (item.type === 'TESTS_RESULTS_ONE' && item.value.id === testId) {
            test = item
            return true
          }
        })
      
        if (test === null) {        
          test = {
            type: 'TESTS_RESULTS_ONE',
            value: {
              id: testId,
              results: {},
              assertions: []
            },
          }
          cache.push(test)
        }
      
        return test
      
      } // init.push.updateCacheWithTestDetails.getTest()
    
    } // init.push.updateCacheWithTestDetails()
  
  } // init.push()
  
  function getSummary() {
    
    var summary = null
      
    cache.some(item => {
      if (item.type === 'TESTS_RESULTS_ALL') {
        summary = item
        return true
      }
    })
    
    if (summary === null) {        
      summary = {
        type: 'TESTS_RESULTS_ALL',
        value: {}
      }
      cache.push(summary)
    }
    
    return summary 
  }
  
} // init()

/**
 * <pre>
 * This is called by the project using the QUnitGS2 library to get the initial HTML
 * displayed by the web app.
 *
 * Once the test results are returned by the main QUnit library client-side JS in
 * the web app will display them appropriately
 * </pre>
 */

function getHtml() {
  
  var mainTemplate = HtmlService.createTemplateFromFile( "index" );
  mainTemplate.title = QUnit.config.title ? QUnit.config.title : "QUnit v2.9.2 for Google Apps Script";
  
  var toolbarTemplate = HtmlService.createTemplateFromFile( "qunit-toolbar" );
  
  if (typeof QUnit.config.cssUrl === "string" ) {
    
    mainTemplate.styles = 
      '<link rel="stylesheet" href="' + QUnit.config.cssUrl + '" type="text/css" media="screen" />'
    
  } else {
    
    mainTemplate.styles = '<link rel="stylesheet" href="https://code.jquery.com/qunit/qunit-2.9.2.css">';
  }
  
  toolbarTemplate.checked = QUnit.config.hidepassed ? "checked='checked'" : "";
  
//  toolbarTemplate.urlConfigs = urlConfigHtml; // TODO
  toolbarTemplate.urlConfigs = '';
  
  var htmlCollection = {main: mainTemplate}
  htmlCollection.toolbar = toolbarTemplate;
    
  testHtml = HtmlService.createHtmlOutput();
  
  htmlCollection.main.testUrl = htmlCollection.toolbar.testUrl = ScriptApp.getService().getUrl();
  htmlCollection.main.hidepassed = QUnit.config.hidepassed;
  htmlCollection.main.toolbar = htmlCollection.toolbar.evaluate().getContent();
  
  return htmlCollection.main.evaluate().setTitle(htmlCollection.main.title);
    
} // getHtml() 

/**
 * Not part of the public API, but has to be global so that the web app can see it
 */

function _include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent()
}

// Apps Script only runs sync, so just run callback immediately
// var setTimeout = function(callback, timeout) {return callback()} // TODO

/**
 * <pre>
 * Simply called by a function in the test project of the same name.
 *
 * For example:
 * 
 *   function getResultsFromServer() {
 *      return QUnitGS2.getResultsFromServer()
 *    }
 *  </pre>
 */

function _getResultsFromServer() {
  return CACHE_.get('qunit_test_results')
}
  
var CACHE_ = CacheService.getScriptCache()
