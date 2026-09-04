import { expect, test } from 'vitest';
import { resolveTheme } from '../LandingPage';

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
