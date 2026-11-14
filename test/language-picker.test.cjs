const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLanguagePicker } = require('../src/main/domain/audio/language-picker.cjs');

const final = (text) => ({ type: 'final', text });
const partial = (text) => ({ type: 'partial', text });
const texts = (events) => events.map((event) => event.text);

// What a real Portuguese class looked like: English heard single words, Portuguese whole sentences.
test('the language that recognized whole sentences wins over one that heard single words', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  assert.deepEqual(picker.receive('en-US', final('Yes'), 1000), []);
  assert.deepEqual(picker.receive('en-US', partial('No'), 1500), [], 'nothing is shown before the decision');
  const decided = picker.receive('pt-BR', final('Quando esses neurônios artificiais se organizam sozinhos'), 2000);
  assert.equal(picker.active, 'pt-BR');
  assert.deepEqual(texts(decided), ['Quando esses neurônios artificiais se organizam sozinhos']);
  assert.deepEqual(picker.receive('en-US', final('Send'), 2500), [], 'the other language is never saved');
  assert.deepEqual(texts(picker.receive('pt-BR', final('e a gente passa os dados'), 3000)), [
    'e a gente passa os dados',
  ]);
  assert.deepEqual(texts(picker.receive('pt-BR', partial('camadas'), 3100)), ['camadas']);
});

test('held finals are published in order once the decision comes', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  assert.deepEqual(picker.receive('en-US', final('Today we'), 0), []);
  assert.deepEqual(picker.receive('en-US', final('look at softmax'), 500), []);
  assert.deepEqual(texts(picker.receive('en-US', final('and one hot labels'), 900)), [
    'Today we',
    'look at softmax',
    'and one hot labels',
  ]);
  assert.equal(picker.active, 'en-US');
});

test('a short stretch decides after eight seconds, and a tie goes to the primary', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  picker.receive('en-US', final('Hi'), 0);
  picker.receive('pt-BR', final('Oi'), 100);
  assert.equal(picker.active, null);
  assert.deepEqual(texts(picker.receive('pt-BR', final(''), 8100)), ['Hi']);
  assert.equal(picker.active, 'en-US');
});

test('silence and empty finals decide nothing', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  assert.deepEqual(picker.receive('en-US', final(''), 0), []);
  assert.deepEqual(picker.receive('pt-BR', final(''), 60000), []);
  assert.equal(picker.active, null);
});

test('a clear lead of the other language switches and publishes its recent finals', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  picker.receive('en-US', final('So today we look at one versus rest'), 0);
  assert.equal(picker.active, 'en-US');
  assert.deepEqual(picker.receive('pt-BR', final('Agora vamos falar'), 15000), [], 'one sentence is not enough');
  const switched = picker.receive('pt-BR', final('das camadas ocultas da rede neural profunda'), 21000);
  assert.equal(picker.active, 'pt-BR');
  assert.deepEqual(texts(switched), ['Agora vamos falar', 'das camadas ocultas da rede neural profunda']);
  assert.deepEqual(picker.receive('en-US', final('Yes'), 21500), []);
});

test('a small lead does not switch', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  picker.receive('en-US', final('one two three four five six'), 0);
  assert.deepEqual(picker.receive('pt-BR', final('um dois três quatro cinco seis sete oito'), 1000), []);
  assert.equal(picker.active, 'en-US');
});

test('a dropped recognizer hands the captions to the other language', () => {
  const picker = createLanguagePicker({ primary: 'en-US', alternate: 'pt-BR' });
  picker.drop('pt-BR');
  assert.equal(picker.active, 'en-US');
  assert.deepEqual(texts(picker.receive('en-US', final('Hello'), 0)), ['Hello']);
});
