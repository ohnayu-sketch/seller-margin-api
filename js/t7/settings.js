/* ═══ js/t7/settings.js ═══ */
/* T7: API 키 만료 알림 + 설정 */

// ==================== T7: API 키 만료 알림 ====================
function saveAlertEmails() {
    const input = document.getElementById('admin-alert-email');
    if (input) {
        localStorage.setItem('admin-alert-emails', input.value);
        showToast('📧 알림 수신 이메일이 저장되었습니다: ' + input.value);
    }
}

function renderApiExpiryTable() {
    const table = document.getElementById('api-expiry-table');
    const badge = document.getElementById('api-expiry-badge');
    if (!table) return;

    const registry = (typeof AppConfig !== 'undefined' && AppConfig.API_KEY_REGISTRY) || {};
    const now = Date.now();
    let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
    let hasWarning = false;
    const entries = [
        { name: '공공데이터포털 (9개 API)', expiry: '2028-03-10' },
        { name: '네이버 데이터랩', expiry: null },
        { name: '네이버 검색', expiry: null },
        { name: '수출입은행 환율', expiry: null },
        { name: 'Google Vision API', expiry: null },
        { name: 'Gemini AI', expiry: null },
    ];
    // 레지스트리에서 실제 만료일 가져오기
    Object.values(registry).forEach(v => {
        if (v.expiry && v.label) {
            const existing = entries.find(e => e.name.includes(v.label.split(' ')[0]));
            if (existing) existing.expiry = v.expiry;
        }
    });

    entries.forEach(e => {
        let statusHTML = '';
        if (e.expiry) {
            const dday = Math.ceil((new Date(e.expiry) - now) / 86400000);
            if (dday <= 7) { statusHTML = '<span style="color:#ef4444;font-weight:700;">⚠️ D-' + dday + '</span>'; hasWarning = true; }
            else if (dday <= 30) { statusHTML = '<span style="color:#f59e0b;font-weight:600;">D-' + dday + '</span>'; }
            else { statusHTML = '<span style="color:#10b981;">D-' + dday + ' (' + e.expiry + ')</span>'; }
        } else {
            statusHTML = '<span style="color:var(--text-muted);">무기한 ∞</span>';
        }
        html += '<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:6px;"><span>' + e.name + '</span>' + statusHTML + '</div>';
    });
    html += '</div>';
    table.innerHTML = html;

    if (badge) {
        badge.textContent = hasWarning ? '⚠️ 주의' : '정상';
        badge.style.background = hasWarning ? 'var(--danger)' : 'var(--accent)';
    }

    // 이메일 필드 복원
    const emailInput = document.getElementById('admin-alert-email');
    if (emailInput) emailInput.value = localStorage.getItem('admin-alert-emails') || '';
}
setTimeout(renderApiExpiryTable, 2000);

