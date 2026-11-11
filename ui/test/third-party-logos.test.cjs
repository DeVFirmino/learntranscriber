const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadTs } = require('./helpers/load-ts.cjs');
const { THIRD_PARTY_LOGOS, isThirdPartyLogo } = loadTs(
  path.join(__dirname, '../src/settings/icons/third-party-logos.ts'),
);
const { modelLogo } = loadTs(path.join(__dirname, '../src/features/model-logo.ts'));
const assets = path.join(__dirname, '../public/brands');
const sources = JSON.parse(fs.readFileSync(path.join(assets, 'sources.json'), 'utf8'));

test('every bundled product logo matches its recorded original source', () => {
  assert.deepEqual([...new Set(Object.values(THIRD_PARTY_LOGOS))].sort(), Object.keys(sources).sort());
  for (const [file, source] of Object.entries(sources)) {
    assert.match(source.source, /^https:\/\//);
    const bytes = fs.readFileSync(path.join(assets, file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), source.sha256, file);
    if (file.endsWith('.svg')) {
      assert.match(bytes.toString(), /<svg\b/);
      assert.doesNotMatch(bytes.toString(), /<script\b|<foreignObject\b|(?:href|src)=["']https?:/i);
    } else assert.equal(bytes.subarray(1, 4).toString(), 'PNG', file);
  }
});

test('named products use original logos while generic categories stay generic', () => {
  for (const name of ['provider-openai', 'provider-gemini']) assert.equal(isThirdPartyLogo(name), true);
  for (const name of [
    'agent-codex',
    'agent-cursor',
    'agent-claude',
    'tool-notion',
    'tool-obsidian',
    'provider-custom',
    'provider-local',
    'settings',
    'toString',
    '__proto__',
  ])
    assert.equal(isThirdPartyLogo(name), false);
});

test('local models identify known makers and keep unknown imports neutral', () => {
  assert.equal(modelLogo('whisper', 'Whisper Large v3', false), 'model-whisper');
  assert.equal(modelLogo('llm', 'Qwen3-VL 2B', true), 'model-qwen');
  assert.equal(modelLogo('llm', 'Qwen 2.5 1.5B (Instruct)', false), 'model-qwen');
  assert.equal(modelLogo('llm', 'Gemma 3 12B', true), 'model-gemma');
  assert.equal(modelLogo('llm', 'Imported model', false), 'model-text');
  assert.equal(modelLogo('llm', 'Imported vision model', true), 'model-vision');
  assert.equal(modelLogo('llm', 'Not Qwen', false), 'model-text');
});
