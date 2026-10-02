import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
let calls = 0;
let reply = { ok: true, status: 200, body: { access_token: 'new', refresh_token: 'r2' } };
globalThis.fetch = async () => {
  calls++;
  await new Promise((r) => setTimeout(r, 10));
  return { ok: reply.ok, status: reply.status, text: async () => JSON.stringify(reply.body) };
};

const { refreshStoredSession } = await import('../session-refresh.js');
const KEY = 'reclaim-session-v1';

test('concurrent refreshes share one request', async () => {
  store.set(KEY, JSON.stringify({ access_token: 'old', refresh_token: 'r1', user: { id: 'u' } }));
  calls = 0;
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => refreshStoredSession('r1')));
  assert.equal(calls, 1);
  assert.equal(a.access_token, 'new');
  assert.equal(b, a);
  assert.equal(c, a);
  assert.equal(JSON.parse(store.get(KEY)).user.id, 'u');
});

test('a caller holding an already-rotated token gets the stored session without a request', async () => {
  calls = 0;
  const next = await refreshStoredSession('r1');
  assert.equal(calls, 0);
  assert.equal(next.refresh_token, 'r2');
});

test('a rejected refresh clears the stored session', async () => {
  reply = { ok: false, status: 400, body: { error: 'invalid_grant' } };
  await assert.rejects(refreshStoredSession('r2'), /session ended/i);
  assert.equal(store.has(KEY), false);
});

test('a network failure keeps the stored session', async () => {
  store.set(KEY, JSON.stringify({ refresh_token: 'r3' }));
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(refreshStoredSession('r3'));
  assert.equal(store.has(KEY), true);
});
