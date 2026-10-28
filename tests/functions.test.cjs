const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { day, visitor } = require('../server/common.cjs');
const visits = require('../netlify/functions/visitors.js').handler;
const originalFetch = global.fetch;
Object.assign(process.env, { SITE_ORIGIN: 'https://example.netlify.app', VISITOR_SECRET: 'test-secret-with-at-least-32-characters', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'fake' });
afterEach(() => { global.fetch = originalFetch; });
const event = (body = {}, headers = {}) => ({ httpMethod: 'POST', headers: { origin: process.env.SITE_ORIGIN, 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.1', ...headers }, body: JSON.stringify(body) });
function backend({ failStorage = false } = {}) {
  const kv = new Map(), calls = [];
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, body, headers: options.headers });
    if (failStorage) throw new Error('offline');
    const [command, ...args] = body; let result;
    if (command === 'EVAL' && args[0].includes("KEYS[3]")) {
      const [, , seen, daily, total] = args;
      if (!kv.has(seen)) { kv.set(seen, 1); kv.set(daily, (kv.get(daily) || 0) + 1); kv.set(total, (kv.get(total) || 0) + 1); }
      result = [kv.get(daily), kv.get(total)];
    }
    else if (command === 'MGET') result = args.map(k => kv.get(k) || null);
    else if (command === 'SET') {
      result = args.includes('NX') && kv.has(args[0]) ? null : 'OK';
      if (result) kv.set(args[0], args[1]);
    } else if (command === 'GET') result = kv.get(args[0]) || null;
    else if (command === 'DEL') { kv.delete(args[0]); result = 1; }
    else throw new Error('Unexpected command');
    return { ok: true, json: async () => ({ result }) };
  };
  return { kv, calls };
}
test('Seoul date changes exactly at midnight KST', () => {
  assert.equal(day(Date.parse('2026-10-28T14:59:59Z')), '2026-10-28');
  assert.equal(day(Date.parse('2026-10-28T15:00:00Z')), '2026-10-29');
});
test('signed HttpOnly cookie is reused and tampering is rejected', () => {
  const first = visitor(event());
  assert.match(first.cookie, /Secure; HttpOnly; SameSite=Lax/);
  assert.equal(visitor(event({}, { cookie: first.cookie })).id, first.id);
  assert.notEqual(visitor(event({}, { cookie: first.cookie.replace(first.id, '00000000-0000-0000-0000-000000000000') })).id, first.id);
});
test('registration uses atomic EVAL; repeat cookie deduplicates and GET does not count', async () => {
  const b = backend(); const first = await visits(event());
  assert.equal(first.statusCode, 200);
  const again = await visits(event({}, { cookie: first.headers['Set-Cookie'] }));
  assert.equal(JSON.parse(again.body).total, 1);
  const read = await visits({ httpMethod: 'GET', headers: {} });
  assert.equal(JSON.parse(read.body).total, 1);
  assert.equal(b.calls[0].body[0], 'EVAL');
  assert.equal(b.calls.at(-1).body[0], 'MGET');
  assert.equal(read.headers['Cache-Control'], 'no-store');
});
test('cross-site POST and unsupported methods are rejected', async () => {
  assert.equal((await visits(event({}, { origin: 'https://attacker.test' }))).statusCode, 403);
  assert.equal((await visits({ httpMethod: 'DELETE' })).statusCode, 405);
});
test('storage failure never fabricates a zero count', async () => {
  backend({ failStorage: true }); const res = await visits(event());
  assert.equal(res.statusCode, 503); assert.equal(JSON.parse(res.body).total, undefined);
});
