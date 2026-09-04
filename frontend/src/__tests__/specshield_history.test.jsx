import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { expect, test, vi, afterEach } from 'vitest';
import SpecShield from '../SpecShield';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('SpecShield session history listing and deletion modal', async () => {
  const mockSessions = [
    { id: 'sess-100', project_name: 'FIRST PROJECT', created_at: '2026-09-05T00:00:00' },
    { id: 'sess-200', project_name: 'SECOND PROJECT', created_at: '2026-09-05T01:00:00' },
  ];

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    // GET session list
    if (url.includes('/api/specshield/sessions') && (!options || options.method === 'GET' || !options.method)) {
      return {
        ok: true,
        status: 200,
        json: async () => mockSessions,
      };
    }
    // GET session detail
    if (url.includes('/api/specshield/sessions/sess-100')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'sess-100',
          project_name: 'FIRST PROJECT',
          documents: [],
          comparisons: [],
        }),
      };
    }
    // DELETE session
    if (url.includes('/api/specshield/sessions/sess-200') && options?.method === 'DELETE') {
      return {
        ok: true,
        status: 204,
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  await act(async () => {
    render(<SpecShield authToken="fake-jwt-token" />);
  });

  // Verify project name appears in session history list
  expect(screen.getAllByText('FIRST PROJECT').length).toBeGreaterThan(0);
  expect(screen.getByText('SECOND PROJECT')).toBeDefined();

  // Click delete icon for sess-200
  const deleteBtns = screen.getAllByTitle('Delete Session');
  expect(deleteBtns.length).toBe(2);

  await act(async () => {
    fireEvent.click(deleteBtns[1]);
  });

  // Verify delete confirm modal appears
  expect(screen.getByText('DELETE AUDIT SESSION')).toBeDefined();

  // Click Confirm Delete
  const confirmBtn = screen.getByText('Confirm Delete');
  await act(async () => {
    fireEvent.click(confirmBtn);
  });

  // Verify DELETE request was sent for sess-200
  const deleteCalls = fetchSpy.mock.calls.filter(c => c[0].includes('/api/specshield/sessions/sess-200') && c[1]?.method === 'DELETE');
  expect(deleteCalls.length).toBe(1);
});
