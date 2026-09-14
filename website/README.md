# Website source

`user/pages` contains authored Grav pages and their media for QUnitGS2.com.
Keep user-facing usage, troubleshooting, and test instructions in those pages.
Grav themes, plugins, configuration, runtime data, and credentials are not
managed here.

Website publication is separate from merging library code. Local tests check
the documented JavaScript examples, but this repository does not include a
Grav installation or a website deployment command.

## Page structure

`user/pages/01.home` introduces the library, `02.examples` contains walkthroughs
and the reference test suite, and `03.quick-start-guide` is the copy-and-run
entry point. `04.how-to-guides` holds task-focused recipes; `05.troubleshooting`
owns symptom-based diagnosis and runtime limitations.

Numeric folder prefixes control ordering, not public URLs. For example,
`04.how-to-guides/01.writing-tests/default.md` becomes
`/how-to-guides/writing-tests`. Keep existing folder slugs stable so published
links continue to work. Use root-relative links between pages and keep media
beside the page that uses it.

Use `default.md` for an article and `collection.md` for an index listing its
children. Follow the existing YAML front matter, and place `===` after a short
introduction when a collection should show only that summary.

## Writing and checking guides

State prerequisites, where each code block belongs, and the expected result.
Distinguish complete examples from additions or replacements. Use the exact
`QUnitGS2` identifier and `QUnit` alias, register tests between `init()` and
`start()`, and avoid examples that modify real user data.

Run `node --test tests/documentation.test.cjs` from the repository root after
editing examples or links. These checks execute documented JavaScript against
the bundled library and check local page links, anchors, and media. See
[`tests/README.md`](../tests/README.md) for the full suite and its limitations.
No Markdown formatter or Grav build is configured in this checkout.

Before publication, preview the changed pages in the site's Grav installation.
Check navigation, collection summaries, tables, code blocks, and narrow-screen
readability. The tutorial retains historical result screenshots, explicitly
labeled as such; do not use its archived editor screenshots as current setup
instructions.
