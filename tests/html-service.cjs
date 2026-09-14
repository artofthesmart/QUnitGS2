const fs = require('node:fs');
const path = require('node:path');

function createHtmlService(include) {
  const read = name => fs.readFileSync(path.join(__dirname, '..', `${name}.html`), 'utf8');
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function createHtmlOutput(content = '') {
    let title = '';
    return {
      getContent: () => content,
      getTitle: () => title,
      setTitle(value) { title = value; return this; }
    };
  }

  return {
    createHtmlOutput,
    createHtmlOutputFromFile: name => createHtmlOutput(read(name)),
    createTemplateFromFile(name) {
      const template = {
        evaluate() {
          // Only the printing expressions used by this library are supported.
          const html = read(name).replace(/<\?(!?=)\s*([\s\S]*?)\s*\?>/g, (match, mode, expression) => {
            const included = /^_include\('([^']+)'\)$/.exec(expression);
            let value;
            if (included) {
              value = include(included[1]);
            } else if (Object.hasOwn(template, expression)) {
              value = template[expression];
            } else {
              throw new Error(`Unsupported template expression: ${expression}`);
            }
            return mode === '!=' ? String(value) : escape(value);
          });
          if (html.includes('<?')) throw new Error(`Unprocessed template expression in ${name}`);
          return createHtmlOutput(html);
        }
      };
      return template;
    }
  };
}

module.exports = { createHtmlService };
