const { text } = require('../../domain/shared/text.cjs');

function registerSessionHistory(handle, history) {
  handle('sessions:list', (_event, query) => history.list(query));
  handle('sessions:page', (_event, options) => history.page(options));
  handle('sessions:get', (_event, id) => history.get(text(id, 100)));
  handle('sessions:rename', (_event, input) => history.rename(text(input?.id, 100), input?.title));
  handle('sessions:update-summary', (_event, input) =>
    history.updateSummary(text(input?.id, 100), input?.summary, input?.expectedSummary),
  );
}
module.exports = { registerSessionHistory };
