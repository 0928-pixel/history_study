const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { day, visitor } = require('../server/common.cjs');
const visits = require('../netlify/functions/visitors.js').handler;
const feedback = require('../netlify/functions/feedback.js').handler;
const originalFetch = global.fetch;
Object.assign(process.env, { SITE_ORIGIN: 'https://example.netlify.app', VISITOR_SECRET: 'test-secret-with-at-least-32-characters', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'fake', RESEND_API_KEY: 'fake', FEEDBACK_FROM: 'test@example.com', FEEDBACK_TO: 'private@example.com' });
afterEach(() => { global.fetch = originalFetch; });
const event = (body = {}, headers = {}) => ({ httpMethod: 'POST', headers: { origin: process.env.SITE_ORIGIN, 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.1', ...headers }, body: JSON.stringify(body) });
const valid = { kind: '개선사항', message: '학습 화면에 새로운 역사 자료를 더해 주세요.' };
function backend({ failEmail = false, failStorage = false, limited = false } = {}) {
  const kv = new Map(), sent = [], calls = [];
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, body, headers: options.headers });
    if (url === 'https://api.resend.com/emails') {
      sent.push({ body, headers: options.headers });
      return { ok: !failEmail, json: async () => ({ id: 'test-email' }) };
    }
    if (failStorage) throw new Error('offline');
    const [command, ...args] = body; let result;
    if (command === 'EVAL' && args[0].includes("KEYS[3]")) {
      const [, , seen, daily, total] = args;
      if (!kv.has(seen)) { kv.set(seen, 1); kv.set(daily, (kv.get(daily) || 0) + 1); kv.set(total, (kv.get(total) || 0) + 1); }
      result = [kv.get(daily), kv.get(total)];
    } else if (command === 'EVAL') result = limited ? 0 : 1;
    else if (command === 'MGET') result = args.map(k => kv.get(k) || null);
    else if (command === 'SET') {
      result = args.includes('NX') && kv.has(args[0]) ? null : 'OK';
      if (result) kv.set(args[0], args[1]);
    } else if (command === 'GET') result = kv.get(args[0]) || null;
    else if (command === 'DEL') { kv.delete(args[0]); result = 1; }
    else throw new Error('Unexpected command');
    return { ok: true, json: async () => ({ result }) };
  };
  return { kv, sent, calls };
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
  assert.equal((await feedback(event(valid, { origin: '' }))).statusCode, 403);
  assert.equal((await feedback({ httpMethod: 'GET' })).statusCode, 405);
});
test('storage failure never fabricates a zero count', async () => {
  backend({ failStorage: true }); const res = await visits(event());
  assert.equal(res.statusCode, 503); assert.equal(JSON.parse(res.body).total, undefined);
});
test('feedback validates input, media type, size and honeypot without email', async () => {
  const b = backend();
  for (const message of ['', 'short', 'x'.repeat(2001)]) assert.equal((await feedback(event({ message }))).statusCode, 400);
  assert.equal((await feedback(event(null))).statusCode, 400);
  assert.equal((await feedback(event(valid, { 'content-type': 'text/plain' }))).statusCode, 400);
  assert.equal((await feedback(event({ message: 'x'.repeat(12001) }))).statusCode, 400);
  assert.equal((await feedback(event({ ...valid, website: 'spam' }))).statusCode, 200);
  assert.equal(b.sent.length, 0);
});
test('server chooses recipient, uses plain text and deduplicates concurrent feedback', async () => {
  const b = backend();
  const responses = await Promise.all(Array.from({ length: 10 }, () => feedback(event({ ...valid, to: 'attacker@example.com' }))));
  assert.equal(b.sent.length, 1);
  assert.ok(responses.some(r => r.statusCode === 200));
  assert.equal((await feedback(event(valid))).statusCode, 200);
  assert.equal(b.sent.length, 1);
  assert.deepEqual(b.sent[0].body.to, ['private@example.com']);
  assert.ok(b.sent[0].body.text.includes(valid.message));
  assert.equal(b.sent[0].body.html, undefined);
  assert.ok(responses.every(r => !r.body.includes('private@example.com')));
  assert.match(b.sent[0].headers['Idempotency-Key'], /^history-feedback-/);
});
test('rate limit and missing trusted IP stop email', async () => {
  const b = backend({ limited: true });
  assert.equal((await feedback(event(valid))).statusCode, 429);
  assert.equal((await feedback(event(valid, { 'x-nf-client-connection-ip': '' }))).statusCode, 503);
  assert.equal(b.sent.length, 0);
});
test('provider error keeps retries possible with same idempotency key', async () => {
  const b = backend({ failEmail: true });
  assert.equal((await feedback(event(valid))).statusCode, 503);
  assert.equal((await feedback(event(valid))).statusCode, 503);
  assert.equal(b.sent[0].headers['Idempotency-Key'], b.sent[1].headers['Idempotency-Key']);
});
test('missing email configuration fails closed', async () => {
  const old = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  try { const b = backend(); assert.equal((await feedback(event(valid))).statusCode, 503); assert.equal(b.sent.length, 0); }
  finally { process.env.RESEND_API_KEY = old; }
});
