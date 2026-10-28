const { reply, required, originOK, hash, redis, jsonBody } = require('../../server/common.cjs');
// Persistent global/IP limits apply across all function instances, even on retries.
const LIMIT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
local all = redis.call('INCR', KEYS[2])
if all == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
if n > 5 or all > 200 then return 0 end
return 1
`;
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'POST' });
  if (!originOK(event)) return reply(403, { error: '허용되지 않는 사이트입니다.' });
  let body;
  try { body = jsonBody(event); } catch { return reply(400, { error: '요청 형식을 확인해 주세요.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: '요청 형식을 확인해 주세요.' });
  if (body.website) return reply(200, { ok: true }); // Honeypot; do not send mail.
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const kind = ['건의사항', '개선사항', '오류 신고'].includes(body.kind) ? body.kind : '건의사항';
  if (message.length < 10 || message.length > 2000) return reply(400, { error: '내용은 10~2,000자로 적어 주세요.' });
  try {
    required('RESEND_API_KEY', 'FEEDBACK_FROM', 'FEEDBACK_TO');
    // Only Netlify's trusted client IP header is used; never X-Forwarded-For.
    const ip = event.headers['x-nf-client-connection-ip'];
    if (!ip) return reply(503, { error: '전송 환경을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.' });
    const allowed = await redis(['EVAL', LIMIT, 2, `history:feedback:ip:${hash(ip)}`, 'history:feedback:global']);
    if (!allowed) return reply(429, { error: '전송 횟수가 많아요. 잠시 쉬었다 다시 보내 주세요.' }, { 'Retry-After': '3600' });
    // Stable payload + key for 24h: provider retries cannot send a second email.
    const digest = hash(`${kind}\n${message}`);
    const key = `history:feedback:dedup:${digest}`;
    const claim = await redis(['SET', key, 'pending', 'NX', 'EX', 60]);
    if (!claim) {
      const state = await redis(['GET', key]);
      return state === 'sent' ? reply(200, { ok: true }) : reply(409, { error: '같은 내용을 처리 중이에요. 잠시 후 다시 시도해 주세요.' });
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `history-feedback-${digest}` },
        body: JSON.stringify({ from: process.env.FEEDBACK_FROM, to: [process.env.FEEDBACK_TO], subject: `[한국사 탐험대] ${kind}`, text: `분류: ${kind}\n\n${message}` }), signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('email');
      const result = await response.json();
      if (!result.id) throw new Error('email');
      await redis(['SET', key, 'sent', 'EX', 86400]);
      return reply(200, { ok: true });
    } catch {
      // Retrying uses the same provider idempotency key, including ambiguous timeouts.
      await redis(['DEL', key]);
      return reply(503, { error: '전송을 완료하지 못했어요. 잠시 후 같은 내용으로 다시 보내 주세요.' });
    }
  } catch { return reply(503, { error: '건의함을 잠시 이용할 수 없어요. 나중에 다시 방문해 주세요.' }); }
};
exports.LIMIT = LIMIT;
