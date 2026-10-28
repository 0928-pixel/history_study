(() => {
  'use strict';
  const today = document.getElementById('visitor-today');
  const total = document.getElementById('visitor-total');
  const status = document.getElementById('visitor-status');
  async function loadVisitors(register = false) {
    try {
      const response = await fetch('/.netlify/functions/visitors', { method: register ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.today) || !Number.isSafeInteger(data.total)) throw new Error('invalid');
      today.textContent = data.today.toLocaleString('ko-KR') + '명';
      total.textContent = data.total.toLocaleString('ko-KR') + '명';
      status.textContent = '한국 시간 · 브라우저별 하루 1회, 누적은 일별 합계';
    } catch {
      status.textContent = '통계를 잠시 불러올 수 없어요.';
    }
  }
  // Cross-tab lock prevents the first concurrent tabs creating two visitor cookies.
  const register = () => loadVisitors(true);
  if (navigator.locks) navigator.locks.request('history-visitor', register).catch(() => loadVisitors(false));
  else register();
  let date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  setInterval(() => {
    if (document.hidden) return;
    const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const changed = now !== date; date = now;
    loadVisitors(changed);
  }, 60000);
  const form = document.getElementById('community-feedback-form');
  const result = document.getElementById('feedback-status');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    const message = form.elements.message.value.trim();
    if (message.length < 10) { result.textContent = '내용은 공백을 제외하고 10자 이상 적어 주세요.'; return; }
    const signature = form.elements.kind.value + '\n' + message;
    let previous;
    try { previous = JSON.parse(sessionStorage.getItem('history-feedback-last') || 'null'); } catch {}
    if (previous && previous.signature === signature && Date.now() - previous.at < 86400000) {
      result.textContent = '이 브라우저에서 이미 접수한 의견이에요. 다른 의견을 남겨 주세요.'; return;
    }
    button.disabled = true; result.textContent = '의견을 보내고 있어요…';
    try {
      const fields = new URLSearchParams(new FormData(form));
      fields.set('message', message);
      const response = await fetch(form.getAttribute('action'), {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'same-origin', body: fields.toString(), signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error('접수하지 못했어요. 잠시 후 다시 시도해 주세요.');
      try { sessionStorage.setItem('history-feedback-last', JSON.stringify({ signature, at: Date.now() })); } catch {}
      form.reset(); result.textContent = '소중한 의견을 보냈어요. 더 즐거운 탐험에 도움이 될 거예요!';
    } catch (error) {
      result.textContent = error.name === 'TimeoutError' || error.name === 'TypeError' ? '연결을 확인한 뒤 같은 내용으로 다시 보내 주세요.' : error.message;
    } finally { button.disabled = false; }
  });
})();
