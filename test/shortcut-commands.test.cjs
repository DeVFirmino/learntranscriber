const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createShortcutCommands } = require('../src/main/interface/desktop/shortcut-commands.cjs');

function harness() {
  const calls = [];
  const state = { listening: false, concealed: true, overlayOpacity: 0.95, overlayOnTop: false };
  const commands = createShortcutCommands({
    privacy: () => ({ concealed: state.concealed, toggleConcealment: () => calls.push('conceal') }),
    windows: {
      listening: () => ({ active: state.listening }),
      showOverlay: () => calls.push('show'),
      toggleOverlay: () => calls.push('toggle'),
    },
    settings: () => state,
    saveSettings: (patch) => Object.assign(state, patch),
    changed: () => calls.push('changed'),
    visibility: { press: () => calls.push('visibility') },
    readSelection: () => calls.push('selection'),
    delivery: Object.fromEntries(
      ['main', 'assistant', 'scroll', 'panel', 'notch', 'bar', 'nudge'].map((name) => [
        name,
        (...args) => {
          calls.push([name, ...args]);
          return true;
        },
      ]),
    ),
  });
  return { commands, calls, state };
}

test('record switches its owner with listening state; hiding delegates to visibility without changing capture', () => {
  const h = harness();
  h.commands.record();
  h.state.listening = true;
  h.commands.record();
  h.commands.hide();
  assert.deepEqual(h.calls, ['show', ['main', 'record'], ['assistant', 'analyze'], 'visibility']);
});

test('desktop settings read current values on every command and keep opacity within bounds', () => {
  const h = harness();
  h.commands.onTop();
  assert.equal(h.state.overlayOnTop, true);
  h.commands.onTop();
  assert.equal(h.state.overlayOnTop, false);
  h.commands.opacityUp();
  assert.equal(h.state.overlayOpacity, 1);
  h.state.overlayOpacity = 0.3;
  h.commands.opacityDown();
  assert.equal(h.state.overlayOpacity, 0.25);
});
