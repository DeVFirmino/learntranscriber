const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { sessionMarkdown } = require('../src/main/domain/sessions/markdown-export.cjs');

const open = (path) => createRepositories(openDatabase(path));

test('session transcript and configuration survive reopening; deletion removes full-text results', () => {
  const directory = mkdtempSync(join(tmpdir(), 'learntranscriber-store-'));
  let repos;
  try {
    const path = join(directory, 'data.sqlite');
    repos = open(path);
    const session = repos.sessions.create('Architecture', 'general');
    repos.entries.add(session.id, 'transcript', 'A queue provides asynchronous delivery', 'THEY');
    repos.entries.add(session.id, 'user', 'What did we decide?');
    repos.sessions.update(session.id, { summary: 'Use a bounded queue.' });
    repos.settings.update({
      captureProtection: false,
      hideDock: true,
      overlayOpacity: 0.7,
      stealthMode: true,
      showMenuBarIcon: false,
    });
    assert.equal(repos.sessionSearch.list('asynchronous').length, 1);
    repos.db.close();
    repos = open(path);
    assert.equal(repos.sessions.get(session.id).entries.length, 2);
    assert.equal(repos.settings.read().hideDock, true);
    assert.equal(repos.settings.read().captureProtection, false);
    assert.equal(repos.settings.read().stealthMode, true);
    assert.equal(repos.settings.read().showMenuBarIcon, false);
    assert.match(sessionMarkdown(repos.sessions.get(session.id)), /THEY/);
    repos.sessions.delete(session.id);
    assert.equal(repos.sessionSearch.list('asynchronous').length, 0);
    assert.throws(() => repos.sessions.get(session.id), /not found/);
  } finally {
    repos?.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('renaming a session trims and persists its title without accepting blank or stale writes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'learntranscriber-rename-'));
  const path = join(directory, 'data.sqlite');
  let repos = open(path);
  try {
    const session = repos.sessions.create('Original', 'general');
    assert.equal(repos.sessions.update(session.id, { title: '  Planning notes  ' }).title, 'Planning notes');
    assert.throws(() => repos.sessions.update(session.id, { title: '   ' }), /valid text/);
    assert.throws(() => repos.sessions.update(session.id, { title: 'x'.repeat(121) }), /valid text/);
    assert.equal(repos.sessions.get(session.id).title, 'Planning notes');
    repos.db.close();
    repos = open(path);
    assert.equal(repos.sessions.get(session.id).title, 'Planning notes');
    repos.sessions.delete(session.id);
    assert.throws(() => repos.sessions.update(session.id, { title: 'Late write' }), /not found/);
  } finally {
    repos.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('overview writes reject stale windows and preserve a recoverable current value', () => {
  const repos = open(':memory:');
  try {
    const session = repos.sessions.create('Planning', 'general');
    repos.entries.add(session.id, 'transcript', 'Keep this source', 'THEY');
    assert.equal(repos.sessions.updateSummary(session.id, ' First overview ', '').summary, 'First overview');
    assert.throws(() => repos.sessions.updateSummary(session.id, 'Stale replacement', ''), /another window/);
    assert.equal(repos.sessions.get(session.id).summary, 'First overview');
    assert.equal(repos.sessions.updateSummary(session.id, ' ', 'First overview').summary, '');
    assert.equal(repos.sessions.get(session.id).entries[0].content, 'Keep this source');
    assert.throws(() => repos.sessions.updateSummary(session.id, 'No expectation'), /Invalid overview update/);
    assert.throws(() => repos.sessions.updateSummary('missing', 'Overview', ''), /not found/);
  } finally {
    repos.db.close();
  }
});
test('session route and assistant name remain historical after settings and assistant edits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'learntranscriber-metadata-'));
  const path = join(directory, 'data.sqlite');
  let repos = open(path);
  try {
    repos.settings.update({
      provider: 'custom',
      model: 'original-model',
      transcriptionProvider: 'apple',
      appleSpeechLocale: 'pt-BR',
    });
    const session = repos.sessions.create('Interview', 'general');
    assert.equal(session.provider, 'custom');
    assert.equal(session.model, 'original-model');
    assert.equal(session.transcription_model, 'Apple Speech (pt-BR)');
    assert.equal(session.assistant_name, 'General Assistant');
    repos.assistants.save({ id: 'general', name: 'Renamed assistant', prompt: 'Answer from evidence.' });
    repos.settings.update({ provider: 'openai', model: 'new-model' });
    repos.db.close();
    repos = open(path);
    const historical = repos.sessions.get(session.id);
    assert.equal(historical.model, 'original-model');
    assert.equal(historical.assistant_name, 'General Assistant');
    assert.equal(historical.transcription_model, 'Apple Speech (pt-BR)');
    assert.equal(
      repos.sessions.updateModel(session.id, { provider: 'openai', model: 'new-model', analysisModelSource: 'openai' })
        .model,
      'new-model',
    );
    assert.equal(repos.sessions.get(session.id).assistant_name, 'General Assistant');
  } finally {
    repos.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('local routes record no model until one is named, and explicit metadata overrides the settings', () => {
  const repos = open(':memory:');
  try {
    repos.settings.update({ provider: 'local', transcriptionProvider: 'local' });
    const local = repos.sessions.create('Local', 'general');
    assert.equal(local.provider, 'local');
    assert.equal(local.model, null);
    assert.equal(local.transcription_model, null);
    const named = repos.sessions.create('Named', 'general', { model: 'llama', transcriptionModel: '' });
    assert.equal(named.model, 'llama');
    assert.equal(named.transcription_model, null);
    assert.throws(() => repos.sessions.create('Missing', 'nobody'), /existing assistant/);
  } finally {
    repos.db.close();
  }
});
test('legacy session rows migrate without fabricated route metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'learntranscriber-legacy-session-'));
  const path = join(directory, 'data.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(
    "CREATE TABLE sessions (id TEXT PRIMARY KEY,title TEXT NOT NULL,assistant_id TEXT NOT NULL,started_at TEXT NOT NULL,ended_at TEXT,summary TEXT NOT NULL DEFAULT '',translation TEXT NOT NULL DEFAULT ''); INSERT INTO sessions(id,title,assistant_id,started_at) VALUES ('old','Legacy','general','2025-01-01T00:00:00.000Z')",
  );
  legacy.close();
  const repos = open(path);
  try {
    const session = repos.sessions.get('old');
    assert.equal(session.provider, null);
    assert.equal(session.model, null);
    assert.equal(session.assistant_name, null);
  } finally {
    repos.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('a session patch with one invalid field changes nothing', () => {
  const repos = open(':memory:');
  try {
    const session = repos.sessions.create('Original', 'general');
    assert.throws(() => repos.sessions.update(session.id, { title: 'Changed', summary: 42 }), /Invalid session value/);
    assert.throws(() => repos.sessions.update(session.id, { title: 'Changed', owner: 'x' }), /Invalid session update/);
    assert.equal(repos.sessions.get(session.id).title, 'Original');
    repos.sessions.update(session.id, { title: 'Renamed', summary: 'Done.' });
    assert.equal(repos.sessions.get(session.id).title, 'Renamed');
    assert.equal(repos.sessions.get(session.id).summary, 'Done.');
  } finally {
    repos.db.close();
  }
});
