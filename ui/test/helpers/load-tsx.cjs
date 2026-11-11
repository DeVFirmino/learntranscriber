const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTsx(file, mocks = {}, cache = new Map()) {
  const resolved = path.resolve(file);
  const key = path.relative(process.cwd(), resolved).replaceAll(path.sep, '/');
  if (Object.hasOwn(mocks, key)) return mocks[key];
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const moduleValue = { exports: {} };
  cache.set(resolved, moduleValue);
  const localRequire = (request) => {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    if (!request.startsWith('.') && !request.startsWith('@/')) return require(request);
    const target = request.startsWith('@/')
      ? path.resolve('src', request.slice(2))
      : path.resolve(path.dirname(resolved), request);
    if (target.endsWith('.json')) return require(target);
    const candidate = ['.ts', '.tsx'].map((extension) => target + extension).find(fs.existsSync);
    if (!candidate) throw new Error(`Cannot resolve ${request} from ${file}`);
    return loadTsx(candidate, mocks, cache);
  };
  vm.runInNewContext(source, { module: moduleValue, exports: moduleValue.exports, require: localRequire });
  return moduleValue.exports;
}

function elements(node, name) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, name));
  const matches = node.type === name || node.type?.name === name ? [node] : [];
  return [...matches, ...elements(node.props?.children, name)];
}

module.exports = { loadTsx, elements };
