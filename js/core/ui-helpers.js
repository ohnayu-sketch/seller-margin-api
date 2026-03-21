/**
 * UI Helpers — showToast, showLoading, 포맷팅 유틸
 */

// 토스트 알림
(function(){
    // toastIn keyframes 동적 주입 (1회만)
    if (!document.getElementById('toast-keyframes')) {
        const style = document.createElement('style');
        style.id = 'toast-keyframes';
        style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(style);
    }
})();
function showToast(msg, type) {
    const el = document.createElement('div');
    el.className = 'v7-toast';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;z-index:99999;animation:toastIn 0.3s ease;max-width:360px;width:auto;text-align:center;opacity:1;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,0.3);white-space:nowrap;';
    if (type === 'success' || type === true) {
        el.style.background = '#10b981'; el.style.color = '#0d0f14';
    } else if (type === 'error' || type === false) {
        el.style.background = '#ef4444'; el.style.color = '#fff';
    } else {
        el.style.background = 'rgba(30,34,48,0.95)'; el.style.color = '#e2e8f0'; el.style.border = '1px solid rgba(255,255,255,0.1)';
    }
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2500);
}

// 로딩 오버레이
function showLoading(show, text) {
    let el = document.getElementById('global-loading');
    if (show) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'global-loading';
            el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99998;flex-direction:column;gap:12px;';
            document.body.appendChild(el);
        }
        el.innerHTML = `<div class="loading-spinner"></div><div style="color:#e2e8f0;font-size:13px;">${text || '처리 중...'}</div>`;
        el.style.display = 'flex';
    } else if (el) {
        el.style.display = 'none';
    }
}

// 숫자 포맷팅
function fmt(n) { return (n || 0).toLocaleString('ko-KR'); }
function fmtWon(n) { return fmt(n) + '원'; }
function fmtPct(n) { return (n || 0).toFixed(1) + '%'; }

// HTML 이스케이프
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 디바운스
function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

window.showToast = showToast;
window.showLoading = showLoading;
window.fmt = fmt;
window.fmtWon = fmtWon;
window.fmtPct = fmtPct;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
