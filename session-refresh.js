import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SESSION_KEY = 'reclaim-session-v1';
let inflight = null;

export function readStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

// Supabase rotates refresh tokens, so concurrent refreshes with the same token make all but one fail.
// Every module must refresh through this function: it shares one in-flight request and, when the
// stored token differs from the one the caller used, returns the already-refreshed session.
export function refreshStoredSession(usedRefreshToken) {
  const current = readStoredSession();
  if (!current?.refresh_token) return Promise.reject(new Error('Your session ended. Please sign in again.'));
  if (usedRefreshToken && current.refresh_token !== usedRefreshToken) return Promise.resolve(current);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!response.ok || !data?.access_token) {
        if (response.status >= 400 && response.status < 500) localStorage.removeItem(SESSION_KEY);
        throw new Error('Your session ended. Please sign in again.');
      }
      const next = { ...current, ...data, user: data.user || current.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
