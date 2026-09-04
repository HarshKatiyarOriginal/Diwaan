import { render, screen, act } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import DiwaanSeal from '../components/DiwaanSeal';

test('DiwaanSeal renders CSS ring fallback when WebGL fails', async () => {
  // Render DiwaanSeal with size="large"
  // Three.js in jsdom will throw or trigger onError because canvas context creation fails or mock fails
  const { container } = render(<DiwaanSeal state="generating" size="large" />);

  // Should render CSS fallback ring container
  const sealContainer = container.querySelector('.diwaan-seal-container');
  expect(sealContainer).not.toBeNull();
  expect(sealContainer.classList.contains('generating')).toBe(true);
  expect(screen.getByText('♦')).toBeDefined();
});

test('DiwaanSeal renders CSS ring directly for size="small"', () => {
  const { container } = render(<DiwaanSeal state="static" size="small" />);
  const sealContainer = container.querySelector('.diwaan-seal-container');
  expect(sealContainer).not.toBeNull();
  expect(sealContainer.classList.contains('size-small')).toBe(true);
});
