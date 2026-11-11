const { availableName, nameKey } = require('../../../domain/assistants/names.cjs');

function up(db) {
  const library = db.prepare('SELECT id, name FROM assistants ORDER BY id').all();
  const assigned = [];
  const update = db.prepare('UPDATE assistants SET name=? WHERE id=?');
  for (const assistant of library) {
    const others = [...assigned, ...library.filter((item) => item.id !== assistant.id)];
    // Reserve existing names, including names already suffixed by the user.
    const earlier = assigned.some((item) => nameKey(item.name) === nameKey(assistant.name));
    const name = earlier ? availableName(assistant.name, others) : assistant.name;
    if (name !== assistant.name) update.run(name, assistant.id);
    assigned.push({ id: assistant.id, name });
  }
}

module.exports = { version: 7, name: 'unique-assistant-names', up };
