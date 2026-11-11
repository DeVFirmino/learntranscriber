const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLiveSpeech } = require('../src/main/application/runtime/live-speech.cjs');

test('the user speaks while an interim caption of their microphone has text in that session', () => {
  const speech = createLiveSpeech();
  assert.equal(speech.speaking('s1'), false);
  speech.heard({ speaker: 'ME', sessionId: 's1', text: 'hello', final: false });
  assert.equal(speech.speaking('s1'), true);
  assert.equal(speech.speaking('s2'), false);
  speech.heard({ speaker: 'THEM', sessionId: 's1', text: 'reply', final: true });
  assert.equal(speech.speaking('s1'), true, 'captions of other speakers do not change it');
});

test('a final, failed or blank caption ends the speech', () => {
  for (const caption of [{ text: 'done', final: true }, { text: 'broken', error: 'failed' }, { text: '   ' }, {}]) {
    const speech = createLiveSpeech();
    speech.heard({ speaker: 'ME', sessionId: 's1', text: 'hello' });
    speech.heard({ speaker: 'ME', sessionId: 's1', ...caption });
    assert.equal(speech.speaking('s1'), false, JSON.stringify(caption));
  }
  assert.doesNotThrow(() => createLiveSpeech().heard(undefined));
});
