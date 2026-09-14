# Adapted QUnit suites

`deepEqual.gs`, `dump.gs`, and `utilities.gs` supply the default synchronous
suite. Other files are preserved from the old repository but remain unregistered
because of Apps Script async/timer limitations or their original disabled state.
`assert/` holds specialized assertion API cases.

Keep the existing QUnit test registration style. Enabling an archived suite
requires establishing that it completes on Apps Script; merely including its
source in the bundle does not run it.
