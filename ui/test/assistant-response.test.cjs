const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// A module path with its extension: `@/` is the source root, `./` is beside the importing file.
const resolve = (name, from) => {
  const base = name.startsWith('@/')
    ? 'src/' + name.slice(2)
    : require('node:path').join(require('node:path').dirname(from), name);
  return ['.ts', '.tsx'].map((extension) => base + extension).find((file) => fs.existsSync(file)) || base + '.ts';
};
const load = (file) => {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleValue,
    exports: moduleValue.exports,
    URL,
    setTimeout,
    clearTimeout,
    require: (name) => {
      if (name.endsWith('.css')) return {};
      if (name === '@/components/ui/button')
        return { Button: ({ variant: _variant, size: _size, ...props }) => React.createElement('button', props) };
      if (name.startsWith('@/') || name.startsWith('./') || name.startsWith('../')) return load(resolve(name, file));
      return require(name);
    },
  });
  return moduleValue.exports;
};
const { AssistantResponse } = load('src/components/assistant-response.tsx');
const { safeResponseLink } = load('src/features/response-link.ts');
const actions = { copyResponseCode: async () => {}, openResponseLink: async () => {} };
const render = (content, streaming = false) =>
  renderToStaticMarkup(React.createElement(AssistantResponse, { content, streaming, responseId: 'turn-1', actions }));

test('finished assistant text renders GFM tables, lists, links and independent code blocks', () => {
  const content =
    '## Decision\n\n- Keep **evidence**\n- Test `queue`\n\n| Item | Owner |\n| --- | --- |\n| Queue | Me |\n\n```js\nconst first = 1;\n```\n\n```python\nsecond = 2\n```\n\n[Documentation](https://example.com/docs)';
  const result = render(content);
  assert.match(result, /<h3>Decision<\/h3>/);
  assert.match(result, /<strong>evidence<\/strong>/);
  assert.match(result, /<table>/);
  assert.match(result, /<ul>/);
  assert.match(result, /href="https:\/\/example.com\/docs"/);
  assert.equal((result.match(/data-code-block/g) || []).length, 2);
  assert.equal((result.match(/aria-label="Copy code"/g) || []).length, 2);
  assert.match(result.replace(/<[^>]*>/g, ''), /const first = 1;/);
  assert.match(result.replace(/<[^>]*>/g, ''), /second = 2/);
});

test('streaming incomplete fences stay literal until the response finishes', () => {
  const content = 'Preparing **answer**\n\n```js\nconst partial =';
  const result = render(content, true);
  assert.match(result, /data-response-streaming/);
  assert.match(result, /```js/);
  assert.doesNotMatch(result, /<pre|data-code-block|<strong>/);
});

test('response rendering does not execute HTML, unsafe URIs or load model-provided images', () => {
  const result = render(
    '<script>window.bad=true</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n![remote](https://example.com/tracker.png)\n\n[local](file:///tmp/a)',
  );
  assert.doesNotMatch(result, /<script|<img|onerror=|href="(?:javascript:|file:)/);
  assert.match(result, /\[Image: remote\]/);
  assert.equal(safeResponseLink('https://example.com/docs'), 'https://example.com/docs');
  for (const url of [
    'javascript:alert(1)',
    'file:///tmp/a',
    'data:text/html,hi',
    'https://name:password@example.com',
    '/internal',
    '#sessions',
  ])
    assert.equal(safeResponseLink(url), undefined);
});

const { highlightCode } = load('src/features/code-highlight.ts');
test('code uses language tokens and preserves source text without executable markup', () => {
  const code = 'const message = "<img src=x onerror=alert(1)>"; // readable';
  const highlighted = highlightCode(code, 'js');
  assert.match(highlighted, /hljs-keyword/);
  assert.match(highlighted, /hljs-string/);
  assert.match(highlighted, /hljs-comment/);
  assert.doesNotMatch(highlighted, /<img|<script/);
  assert.match(highlighted, /&lt;img/);
  assert.equal(highlightCode('<script>bad()</script>', 'unknown'), '&lt;script&gt;bad()&lt;/script&gt;');
  assert.equal(highlightCode('<'.repeat(50001), 'xml'), '&lt;'.repeat(50001));
});

test('code regions offer keyboard access and line wrapping without changing copy content', () => {
  const result = render('```typescript\nconst value: number = 42;\n```');
  assert.match(result, /data-wrap="true"/);
  assert.match(result, /role="region"/);
  assert.match(result, /tabindex="0"/);
  assert.match(result, /aria-pressed="true"/);
  assert.match(result, /hljs-keyword/);
});
