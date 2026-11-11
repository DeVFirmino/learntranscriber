const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

const { PreferenceField } = loadTsx('src/components/ui/preference-field.tsx', {
  './preference-field.css': {},
});
const { ChoiceTile } = loadTsx('src/components/ui/choice-tile.tsx', {
  './choice-tile.css': {},
  'radix-ui': { RadioGroup: { Item: 'RadioItem', Indicator: 'RadioIndicator' } },
});

test('preference fields associate their visible label and description with a unique group', () => {
  const fields = ['language', 'appearance'].map((id) =>
    PreferenceField({ id, title: id, description: `Choose ${id}`, icon: 'icon', children: 'control' }),
  );
  for (const [index, field] of fields.entries()) {
    const label = elements(field, 'h4')[0];
    const description = elements(field, 'p')[0];
    assert.equal(field.props['aria-labelledby'], label.props.id);
    assert.equal(field.props['aria-describedby'], description.props.id);
    assert.equal(label.props.children, index === 0 ? 'language' : 'appearance');
    assert.ok(elements(field, 'span').some((span) => span.props['aria-hidden'] === 'true'));
  }
  assert.notEqual(fields[0].props['aria-labelledby'], fields[1].props['aria-labelledby']);
});

test('choice tiles preserve native radio events, disabled state and translated accessible names', () => {
  let focused = false;
  const tile = ChoiceTile({
    value: 'dark',
    label: 'Escura',
    disabled: true,
    id: 'dark-choice',
    onFocus: () => {
      focused = true;
    },
    children: 'decorative preview',
  });
  assert.equal(tile.type, 'RadioItem');
  assert.equal(tile.props.value, 'dark');
  assert.equal(tile.props.disabled, true);
  assert.equal(tile.props.id, 'dark-choice');
  assert.equal(tile.props['aria-label'], 'Escura');
  tile.props.onFocus();
  assert.equal(focused, true);
  const preview = elements(tile, 'span').find((span) => span.props.className === 'choice-tile-preview');
  assert.equal(preview.props['aria-hidden'], 'true');
  assert.equal(elements(tile, 'RadioIndicator').length, 1);
  assert.equal(
    elements(ChoiceTile({ value: 'light', label: 'Clara' }), 'span').some(
      (span) => span.props.className === 'choice-tile-preview',
    ),
    false,
  );
});
