import { expect, test, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { clearSession } from '../api/client';
import LandingPage from '../LandingPage';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('real clearSession from client.js leaves pending_session_id intact', () => {
  sessionStorage.setItem('diwaan_token', 'old_expired_token');
  sessionStorage.setItem('diwaan_tenant_id', 'tenant-123');
  sessionStorage.setItem('pending_session_id', 'sess-abc-456');

  // Call the real clearSession function
  clearSession();

  expect(sessionStorage.getItem('diwaan_token')).toBeNull();
  expect(sessionStorage.getItem('diwaan_tenant_id')).toBeNull();
  expect(sessionStorage.getItem('pending_session_id')).toBe('sess-abc-456');
});

test('a 401 during LandingPage resume-check GET leaves pending_session_id intact', async () => {
  sessionStorage.setItem('diwaan_token', 'expired_token');
  sessionStorage.setItem('pending_session_id', 'sess-to-resume-789');

  const onAuthExpired = vi.fn();

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url.includes('/api/onboarding/sessions/sess-to-resume-789')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Token expired' }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  await act(async () => {
    render(
      <LandingPage
        authToken="expired_token"
        tenantId="tenant-123"
        initialBlueprint={null}
        onBack={() => {}}
        onAuthExpired={onAuthExpired}
        onLogout={() => {}}
      />
    );
  });

  // Verify onAuthExpired was called
  expect(onAuthExpired).toHaveBeenCalled();

  // Verify pending_session_id is STILL in sessionStorage so user gets another chance after login
  expect(sessionStorage.getItem('pending_session_id')).toBe('sess-to-resume-789');
});
