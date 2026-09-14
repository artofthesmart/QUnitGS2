---
title: 'How-to guides'
allowCSS: default
allowJS: default
content:
    items:
        - '@self.children'
    order:
        by: folder
        dir: asc
    sibling_links: false
show_header_image: false
show_clickthrough: true
render:
    children:
        style: summary
        image: false
        subtitle: true
        category: true
        date: false
        nested_children: true
---

Have the [quick start](/quick-start-guide) working? Pick the task you want to do
next. Each guide explains where to put the code and what result to expect.

| Task | Guide |
| --- | --- |
| Choose assertions, share setup, and run one group of tests | [Write and organize tests](/how-to-guides/writing-tests) |
| Separate spreadsheet access from business logic | [Test spreadsheet code](/how-to-guides/testing-spreadsheet-code) |
| Keep tests separate from a production web app | [Test an existing project](/how-to-guides/testing-existing-projects) |

If you are stuck before your first passing test, use
[troubleshooting](/troubleshooting) or the
[step-by-step tutorial](/examples/step-by-step-tutorial).
