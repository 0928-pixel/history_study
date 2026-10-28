const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const reply = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(body) });
function required(...names) { for (const name of names) if (!process.env[name]) throw new Error('configuration'); }
function originOK(event) {
  const allowed = (process.env.SITE_ORIGIN || process.env.URL || '').split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(event.headers.origin);
}
function hash(value) {
  required('VISITOR_SECRET');
  if (process.env.VISITOR_SECRET.length < 32) throw new Error('configuration');
  return createHmac('sha256', process.env.VISITOR_SECRET).update(value).digest('hex');
}
function visitor(event) {
  const raw = (event.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('__Host-history-visitor='))?.split('=')[1] || '';
  const [id, sig] = raw.split('.');
  const valid = /^[a-f0-9-]{36}$/.test(id || '') && /^[a-f0-9]{64}$/.test(sig || '') && timingSafeEqual(Buffer.from(sig), Buffer.from(hash(id)));
  const uuid = valid ? id : randomUUID();
  return { id: uuid, cookie: `__Host-history-visitor=${uuid}.${hash(uuid)}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax` };
}
function day(now = Date.now()) { return new Date(now + 9 * 3600000).toISOString().slice(0, 10); }
async function redis(command) {
  required('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('storage');
  const data = await res.json();
  if (data.error) throw new Error('storage');
  return data.result;
}
module.exports = { reply, required, originOK, hash, visitor, day, redis };
