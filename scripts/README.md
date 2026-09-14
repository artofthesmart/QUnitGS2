# Build and live-test tooling

For a step-by-step process, start with the
[live-test setup guide](../tests/live/README.md#one-time-setup). Run its commands
from the repository root; `.live-test.json` belongs there, not in this directory.
That ignored file must be created separately in each checkout.

`build.mjs` assembles the root library, HTML templates, and `tests/live` into one
Apps Script project in `dist/live`. It preserves source contents, orders the
server code in a single bundle, retains the license notices, and hashes all
shipped inputs into a build ID.
An explicit clasp allowlist excludes local tooling, website content, and results.
Builds require no credentials and do not publish the library.

`test-live.sh` is the shell entry point. `test-live.mjs` validates the local
configuration, builds, pushes with the pinned clasp dependency, updates an
existing deployment (creating a new Apps Script version), and follows
ContentService redirects with wget. It then polls for this build/run's completed
results. `results.mjs` rejects malformed, empty, stale, or inconsistent results
and reports failed assertions.

The local lock prevents overlapping `test:live` commands in one checkout.
Do not deploy to the same test project from multiple checkouts simultaneously.
There is deliberately no automatic project creation, production-library
deployment, remote version deletion, or Google permission setup.

See [`tests/live/README.md`](../tests/live/README.md) for configuration and access
requirements. Keep deployment IDs in ignored `.live-test.json` and credentials
in clasp's own credential store, never in source files.
