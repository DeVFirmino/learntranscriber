const { createErrorLog } = require('../infrastructure/files/error-log.cjs');

// A packaged app's console goes nowhere, so main-process errors and warnings are also written to the error log,
// still reaching the console in development.
function composeErrorLog({ app, console, now }) {
  const log = createErrorLog({ directory: app.getPath('logs'), now });
  for (const level of ['error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...parts) => {
      original(...parts);
      log.write(level, parts);
    };
  }
}
module.exports = { composeErrorLog };
