# Imported live cases

These `.gs` files are the original QUnitGS2-Test cases. `dev.gs` demonstrates
intentional assertion failures; `main/` contains the adapted QUnit suites.
The adjacent `../LICENSE` and `../README.md` record licensing and provenance.

The entry point in `../Code.gs`, not file placement, decides which suites run.
New live cases belong here; register their functions in `runLiveTests_`.
Do not add shell tooling or Node-only tests to this directory.
