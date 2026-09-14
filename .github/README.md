# Repository automation

`workflows/tests.yml` runs collection, documentation-example, HTML binding, and
Chromium regression tests on Node.js 22 and 24 for pull requests and pushes to
master. The workflow has read-only repository access.

These checks do not deploy the Grav website or publish an Apps Script library.
They use local service substitutes, not a Google account or live script project.
