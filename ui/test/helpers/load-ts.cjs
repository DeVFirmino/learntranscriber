// Loads dependency-free TypeScript modules for node:test. Relative imports of other .ts files are loaded the
// same way; type-only imports are erased by the transpiler.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
function loadTs(file, globals = {}, cache = new Map()) {
  const resolved = path.resolve(file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} };
  cache.set(resolved, moduleValue);
  const localRequire = (request) => {
    if (!request.startsWith('.')) throw new Error(`Unexpected import ${request} in ${file}`);
    return loadTs(
      path.join(path.dirname(resolved), request.endsWith('.ts') ? request : request + '.ts'),
      globals,
      cache,
    );
  };
  vm.runInNewContext(source, { module: moduleValue, exports: moduleValue.exports, require: localRequire, ...globals });
  return moduleValue.exports;
}
module.exports = { loadTs };
