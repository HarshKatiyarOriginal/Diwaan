import { expect, test } from 'vitest';
import { ARCHETYPES } from '../themes/archetypes';

const ARCHETYPE_THEME_FALLBACKS = {
  farmer: 'farm',
  shopkeeper: 'kirana-shop',
  factory_owner: 'paper-factory',
};

function resolveTheme(blueprint) {
  if (!blueprint) return null;
  if (blueprint.visual_theme) {
    const t = ARCHETYPES.find(a => a.id === blueprint.visual_theme);
    if (t) return t;
  }
  const fallbackId = ARCHETYPE_THEME_FALLBACKS[blueprint.archetype];
  return ARCHETYPES.find(a => a.id === fallbackId) || ARCHETYPES[0];
}

test('factory_owner blueprint without visual_theme maps to paper-factory, not kirana-shop', () => {
  const blueprint = { archetype: 'factory_owner' };
  const theme = resolveTheme(blueprint);
  expect(theme.id).toBe('paper-factory');
  expect(theme.id).not.toBe('kirana-shop');
});

test('factory_owner blueprint with tiles-factory visual_theme resolves correctly', () => {
  const blueprint = { archetype: 'factory_owner', visual_theme: 'tiles-factory' };
  const theme = resolveTheme(blueprint);
  expect(theme.id).toBe('tiles-factory');
});

test('farmer blueprint resolves to farm theme', () => {
  const blueprint = { archetype: 'farmer' };
  const theme = resolveTheme(blueprint);
  expect(theme.id).toBe('farm');
});

test('shopkeeper blueprint resolves to kirana-shop theme', () => {
  const blueprint = { archetype: 'shopkeeper' };
  const theme = resolveTheme(blueprint);
  expect(theme.id).toBe('kirana-shop');
});
