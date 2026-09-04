import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import SpecShield from '../SpecShield';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

test('SpecShield actually starts pollTask on upload and clears timers on unmount', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    // 1. Upload document (POST .../documents)
    if (url.includes('/documents')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'processing', task_id: 'task-999', document_id: 'doc-1' }),
      };
    }
    // 2. Create session (POST .../sessions)
    if (url.includes('/api/specshield/sessions') && options?.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'sess-123', project_name: 'ALPHA PROJ' }),
      };
    }
    // 3. Task status check (/api/tasks/task-999)
    if (url.includes('/api/tasks/task-999')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'PENDING' }),
      };
    }
    // 4. Session detail GET (/api/specshield/sessions/sess-123)
    if (url.includes('/api/specshield/sessions/sess-123')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'sess-123',
          project_name: 'ALPHA PROJ',
          documents: [{ id: 'doc-1', filename: 'spec.pdf', doc_type: 'blueprint', status: 'processing' }],
          comparisons: [],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  const { container, unmount } = render(
    <SpecShield authToken="fake-token" onLaunchDiwaan={() => {}} onLogout={() => {}} />
  );

  // 1. Submit project name in modal
  const nameInput = screen.getByPlaceholderText(/DATA CENTER ALPHA/i);
  fireEvent.change(nameInput, { target: { value: 'ALPHA PROJ' } });

  const createBtn = screen.getByText('CREATE SESSION');
  await act(async () => {
    fireEvent.click(createBtn);
  });

  // 2. Simulate document upload
  const fileInput = container.querySelector('input[type="file"]');
  const file = new File(['dummy content'], 'spec.pdf', { type: 'application/pdf' });

  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [file] } });
  });

  // 3. Advance timer while mounted — verify polling IS actively firing
  await act(async () => {
    vi.advanceTimersByTime(6500); // Should fire ~2 times (3000ms interval)
  });

  const activeTaskPollCount = fetchSpy.mock.calls.filter(c => c[0].includes('/api/tasks/task-999')).length;
  expect(activeTaskPollCount).toBeGreaterThan(0);

  // 4. Unmount component while poll task is active
  unmount();

  // 5. Advance timer after unmount
  await act(async () => {
    vi.advanceTimersByTime(12000);
  });

  const postUnmountTaskPollCount = fetchSpy.mock.calls.filter(c => c[0].includes('/api/tasks/task-999')).length;

  // Confirm no further task poll fetches happened after unmount
  expect(postUnmountTaskPollCount).toBe(activeTaskPollCount);
});
