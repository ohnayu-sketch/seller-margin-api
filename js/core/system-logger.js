/**
 * ═══ SystemLogger — 시스템 콘솔 로거 ═══
 * SYSTEM CONSOLE (#sys-console)에 로그를 출력하는 전역 객체
 * mega-block.js, v7-cart.js, t2-receiver.js 등에서 사용
 */
const SystemLogger = {
  _logs: [],
  _maxLogs: 200,
  _visible: false,

  /** 로그 추가 */
  log(msg, level = 'info') {
    const time = new Date().toLocaleTimeString('ko-KR');
    const entry = { msg, level, time };
    this._logs.push(entry);
    if (this._logs.length > this._maxLogs) this._logs.shift();

    const body = document.getElementById('sys-console-body');
    if (!body) return;

    const colors = {
      info: '#60a5fa',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171'
    };
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const div = document.createElement('div');
    div.style.cssText = `padding:3px 0;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.05);color:${colors[level] || colors.info};display:flex;gap:6px;align-items:flex-start;`;
    div.innerHTML = `<span style="color:#64748b;min-width:60px;font-size:10px;">${time}</span><span>${icons[level] || '📝'} ${this._escHtml(msg)}</span>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;

    // 배지 업데이트
    this._updateBadge();
  },

  /** 콘솔 토글 */
  toggle() {
    const el = document.getElementById('sys-console');
    if (!el) return;
    this._visible = !this._visible;
    el.style.display = this._visible ? 'flex' : 'none';
    if (this._visible) this._updateBadge(true);
  },

  /** 초기화 */
  clear() {
    this._logs = [];
    const body = document.getElementById('sys-console-body');
    if (body) body.innerHTML = '<div style="color:#64748b;font-size:11px;text-align:center;padding:20px;">콘솔이 초기화되었습니다.</div>';
    this._updateBadge(true);
  },

  /** 배지 숫자 업데이트 */
  _updateBadge(reset) {
    const badge = document.getElementById('sys-console-badge');
    if (!badge) return;
    if (reset) {
      badge.textContent = '0';
      badge.style.display = 'none';
    } else {
      const n = parseInt(badge.textContent || '0') + 1;
      badge.textContent = n;
      badge.style.display = n > 0 ? 'inline' : 'none';
    }
  },

  /** HTML 이스케이프 */
  _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};

// 부팅 로그
document.addEventListener('DOMContentLoaded', () => {
  SystemLogger.log('🖥️ SYSTEM CONSOLE 초기화 완료', 'success');
});
