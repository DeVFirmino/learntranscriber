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
const { AssistantResponse, ResponseBody, RESPONSE_COMPONENTS } = load('src/components/assistant-response.tsx');
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

test('a quiz block renders choices and check buttons without revealing answers or explanations', () => {
  const quiz = JSON.stringify({
    questions: [
      {
        question: 'Past simple of go?',
        choices: ['goed', 'went', 'gone', 'going'],
        answer: 1,
        explanation: 'Irregular.',
      },
    ],
  });
  const result = render(`Try these.\n\n\`\`\`quiz\n${quiz}\n\`\`\``);
  assert.match(result, /data-practice-quiz/);
  assert.match(result, /role="radiogroup"/);
  assert.equal((result.match(/role="radio"/g) || []).length, 4);
  assert.match(result, /aria-label="went"/);
  assert.doesNotMatch(result, /Irregular\./);
  assert.doesNotMatch(result, /data-code-block/);
  assert.doesNotMatch(result, /&quot;answer&quot;/);
});

test('a malformed quiz block shows a notice with its text collapsed, and a streaming quiz is hidden', () => {
  const malformed = render('```quiz\n{"questions": "nope"}\n```');
  assert.match(malformed, /data-practice-quiz-unavailable/);
  assert.match(malformed, /aria-expanded="false"/);
  assert.doesNotMatch(malformed, /data-code-block/);
  assert.match(render('```json\n{"questions": "nope"}\n```'), /data-code-block/);
  const streaming = render('Here.\n```quiz\n{"questions":[{"answer":1,"explanation":"secret', true);
  assert.doesNotMatch(streaming, /secret/);
  assert.match(streaming, /Here\./);
});

test('a quiz shows one question at a time with steps and arrows for the rest', () => {
  const question = (index) => ({
    question: `Question text ${index}?`,
    choices: [`a${index}`, `b${index}`, `c${index}`, `d${index}`],
    answer: 0,
    explanation: `Because ${index}.`,
  });
  const quiz = JSON.stringify({ questions: [question(1), question(2), question(3)] });
  const result = render(`\`\`\`quiz\n${quiz}\n\`\`\``);
  assert.match(result, /Question text 1\?/);
  assert.doesNotMatch(result, /Question text 2\?/);
  assert.equal((result.match(/role="radio"/g) || []).length, 4);
  assert.equal((result.match(/class="practice-quiz-step"/g) || []).length, 3);
  assert.match(result, /aria-current="step"/);
  assert.match(result, /aria-label="Previous question"[^>]*disabled=""|disabled=""[^>]*aria-label="Previous question"/);
});

test('the Markdown components stay the same across font sizes, so a quiz in progress is not remounted', () => {
  const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.components) return node.props.components;
    const children = [node.props?.children].flat();
    for (const child of children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  const props = { content: 'Text', streaming: false, actions };
  const small = find(ResponseBody({ ...props, fontScale: 1 }));
  const large = find(ResponseBody({ ...props, fontScale: 1.3 }));
  assert.equal(small, RESPONSE_COMPONENTS);
  assert.equal(large, RESPONSE_COMPONENTS);
});
