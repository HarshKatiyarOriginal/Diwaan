const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

let authExpiredCallback = null;

export function setOnAuthExpired(callback) {
  authExpiredCallback = callback;
}

/**
 * Clears authentication state from sessionStorage.
 * Intentionally leaves pending_session_id intact to survive 401 re-logins.
 */
export function clearSession() {
  sessionStorage.removeItem('diwaan_token');
  sessionStorage.removeItem('diwaan_tenant_id');
}

/**
 * Safely decodes base64url-encoded JWT payloads (RFC 7519).
 * Replaces '-' with '+', '_' with '/', pads with '=', then parses JSON.
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format');
  }
  let b64Url = parts[1];
  let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  let pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return JSON.parse(atob(b64 + pad));
}

/**
 * Shared API fetch wrapper that attaches Auth headers, resolves URLs,
 * and intercepts 401 Unauthorized responses to invoke onAuthExpired.
 */
export async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('diwaan_token');
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && authExpiredCallback) {
    authExpiredCallback();
  }

  return response;
}
