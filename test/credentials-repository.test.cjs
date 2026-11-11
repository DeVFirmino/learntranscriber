const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { credentialRepository } = require('../src/main/infrastructure/sqlite/credentials.cjs');

test('credentials store ciphertext per known provider and report only which are present', () => {
  const db = openDatabase(':memory:');
  try {
    const credentials = credentialRepository({ db });
    assert.deepEqual(credentials.status(), {});
    credentials.set('openai', Buffer.from('sealed-openai'));
    credentials.set('smtp', Buffer.from('sealed-smtp'));
    assert.equal(Buffer.from(credentials.get('openai')).toString(), 'sealed-openai');
    assert.deepEqual(credentials.status(), { openai: true, smtp: true });
    credentials.set('openai', null);
    assert.equal(credentials.get('openai'), undefined);
    assert.deepEqual(credentials.status(), { smtp: true });
    assert.throws(() => credentials.set('unknown', Buffer.from('x')), /Invalid provider/);
    assert.deepEqual(credentials.status(), { smtp: true });
  } finally {
    db.close();
  }
});
