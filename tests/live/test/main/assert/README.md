# Specialized assertion cases

The imported `step.gs` and `timeout.gs` suites exercise QUnit's step tracking and
timeout assertions. They remain outside the default registration list, as in
the original test project. Their presence preserves the cases for future
compatibility work; it does not imply Apps Script supports asynchronous timers.
