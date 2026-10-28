const { reply, originOK, visitor, day, redis } = require('../../server/common.cjs');
// Both counters and the daily dedup marker change in a single atomic operation.
const COUNT = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 172800) then
  redis.call('INCR', KEYS[2])
  redis.call('INCR', KEYS[3])
end
return {redis.call('GET', KEYS[2]) or '0', redis.call('GET', KEYS[3]) or '0'}
`;
exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return reply(405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'GET, POST' });
  if (event.httpMethod === 'POST' && !originOK(event)) return reply(403, { error: '허용되지 않는 사이트입니다.' });
  const headers = {};
  try {
    const date = day();
    let counts;
    if (event.httpMethod === 'POST') {
      const user = visitor(event);
      headers['Set-Cookie'] = user.cookie;
      counts = await redis(['EVAL', COUNT, 3, `history:seen:${date}:${user.id}`, `history:daily:${date}`, 'history:total']);
    } else counts = await redis(['MGET', `history:daily:${date}`, 'history:total']);
    return reply(200, { today: Number(counts[0] || 0), total: Number(counts[1] || 0), date, timezone: 'Asia/Seoul' }, headers);
  } catch { return reply(503, { error: '방문 통계를 잠시 불러올 수 없어요.' }, headers); }
};
exports.COUNT = COUNT;
