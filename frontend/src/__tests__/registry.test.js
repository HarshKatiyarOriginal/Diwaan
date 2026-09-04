import { expect, test } from 'vitest';
import { COMPONENT_REGISTRY } from '../BlueprintRenderer';

const BACKEND_REGISTRY = [
  "MetricCard",
  "DataTable",
  "ChartWidget",
  "StatusBadge",
  "LedgerToggle",
  "ListWidget"
];

test('component registry parity between frontend and backend schema', () => {
  const frontendKeys = Object.keys(COMPONENT_REGISTRY);
  expect(new Set(frontendKeys)).toEqual(new Set(BACKEND_REGISTRY));
});
