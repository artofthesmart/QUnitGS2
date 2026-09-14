# Regression tests

Run `node --test tests/*.test.cjs` with Node.js 22 or later. No packages are required.

These tests load the bundled QUnit engine and Apps Script wrapper in an isolated
VM with an in-memory CacheService substitute. They cover result collection, not
Google's deployment, cache quotas, or runtime scheduling. Deployed Apps Script
smoke tests are still needed for those boundaries.
