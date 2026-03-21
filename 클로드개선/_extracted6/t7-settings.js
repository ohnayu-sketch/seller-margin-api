/**
 * T7 시스템 설정 — 고도화 모듈
 * 파일: js/t7-settings.js
 * 
 * 연동: config.js의 WholesaleSiteManager, AppConfig
 * 
 * 기능:
 *  1. Apps Script URL 설정
 *  2. 도매사이트 관리 (CRUD + API 키)
 *  3. 마켓 API 키 관리 (스마트스토어/쿠팡 등)
 *  4. AI 서비스 키 (Gemini/네이버 검색광고)
 *  5. 사용자 프로필 (이름, 역할)
 *  6. 데이터 초기화/백업
 */

function t7Init() {
    t7RenderScriptUrl();
    t7RenderWholesaleSites();
    t7RenderApiKeys();
    t7RenderAIKeys();
    t7RenderDataManagement();
}

// ═══ 1. Apps Script URL ═══
function t7RenderScriptUrl() {
    const el = document.getElementById('t7-script-section');
    if (!el) return;
    const url = localStorage.getItem('proxyApiUrl') || localStorage.getItem('script-url') || '';
    el.innerHTML = `
        <div class="t7-form-group">
            <label>Google Apps Script URL</label>
            <div style="display:flex;gap:6px;">
                <input type="text" id="t7-script-url" value="${escapeHtml(url)}" placeholder="https://script.google.com/macros/s/..." style="flex:1;">
                <button class="t7-btn" onclick="t7SaveScriptUrl()">저장</button>
                <button class="t7-btn t7-btn-test" onclick="t7TestScriptUrl()">테스트</button>
            </div>
        </div>
    `;
}

function t7SaveScriptUrl() {
    const url = document.getElementById('t7-script-url')?.value?.trim() || '';
    localStorage.setItem('proxyApiUrl', url);
    localStorage.setItem('script-url', url);
    if (typeof AppConfig !== 'undefined') AppConfig.APPS_SCRIPT_URL = url;
    showToast('✅ Script URL 저장 완료');
}

async function t7TestScriptUrl() {
    try {
        const result = await fetchGas('ping', {});
        showToast(result?.success ? '✅ 서버 연결 성공!' : '⚠️ 응답은 있으나 확인 필요', result?.success);
    } catch(e) {
        showToast('❌ 연결 실패: ' + e.message, false);
    }
}

// ═══ 2. 도매사이트 관리 ═══
function t7RenderWholesaleSites() {
    const el = document.getElementById('t7-wholesale-section');
    if (!el) return;

    const sites = WholesaleSiteManager.getAll();
    let html = '<div class="t7-list">';

    sites.forEach(site => {
        const apiKey = WholesaleSiteManager.getApiKey(site.id);
        const connected = site.type === 'api' && apiKey;
        html += `<div class="t7-site-row">
            <span class="t7-site-status" style="color:${connected ? '#10b981' : '#64748b'}">${connected ? '🟢' : '⬜'}</span>
            <span class="t7-site-name">${escapeHtml(site.name)}</span>
            <span class="t7-site-type">${site.type === 'api' ? 'API' : 'EXCEL'}</span>
            ${site.apiKeyField ? `<input type="password" id="key-${site.id}" value="${escapeHtml(apiKey)}" placeholder="API Key" class="t7-key-input" onchange="t7SaveSiteKey('${site.id}','${site.apiKeyField}',this.value)">` : ''}
            <button class="t7-mini-btn t7-btn-del" onclick="t7RemoveSite('${site.id}')">삭제</button>
        </div>`;
    });

    html += '</div>';
    html += `<button class="t7-btn" onclick="t7ShowAddSiteModal()" style="margin-top:8px;">+ 도매사이트 추가</button>`;
    el.innerHTML = html;
}

function t7SaveSiteKey(siteId, keyField, value) {
    localStorage.setItem(keyField, value.trim());
    t7RenderWholesaleSites();
    showToast(`🔑 API 키 저장 완료`);
}

function t7RemoveSite(id) {
    if (!confirm('이 도매사이트를 삭제하시겠습니까?')) return;
    WholesaleSiteManager.remove(id);
    t7RenderWholesaleSites();
    showToast('🗑️ 도매사이트 삭제됨');
}

function t7ShowAddSiteModal() {
    const name = prompt('도매사이트 이름:');
    if (!name) return;
    const url = prompt('사이트 URL (예: https://example.com):') || '';
    const type = confirm('API 연동을 지원합니까?\n[확인] API / [취소] 엑셀 방식') ? 'api' : 'excel';

    const site = {
        name: name.trim(),
        url: url.trim(),
        type,
        urlPattern: url.replace(/https?:\/\/(www\.)?/, '').split('/')[0],
        apiKeyField: type === 'api' ? 'custom-' + Date.now() + '-key' : '',
        free: true,
    };

    WholesaleSiteManager.add(site);
    t7RenderWholesaleSites();
    showToast(`✅ "${name}" 도매사이트 추가`);
}

// ═══ 3. 마켓 API 키 ═══
function t7RenderApiKeys() {
    const el = document.getElementById('t7-market-keys');
    if (!el) return;

    const keys = [
        { id: 'smartstore-client-id', label: '스마트스토어 Client ID', icon: '🟢' },
        { id: 'smartstore-client-secret', label: '스마트스토어 Client Secret', icon: '🟢' },
        { id: 'coupang-access-key', label: '쿠팡 Access Key', icon: '🟠' },
        { id: 'coupang-secret-key', label: '쿠팡 Secret Key', icon: '🟠' },
        { id: '11st-api-key', label: '11번가 API Key', icon: '🔴' },
    ];

    el.innerHTML = keys.map(k => `
        <div class="t7-key-row">
            <span class="t7-key-icon">${k.icon}</span>
            <label class="t7-key-label">${k.label}</label>
            <input type="password" value="${localStorage.getItem(k.id) || ''}" placeholder="키를 입력하세요" class="t7-key-input" onchange="t7SaveKey('${k.id}',this.value)">
        </div>
    `).join('');
}

// ═══ 4. AI 서비스 키 ═══
function t7RenderAIKeys() {
    const el = document.getElementById('t7-ai-keys');
    if (!el) return;

    const keys = [
        { id: 'GEMINI_API_KEY', label: 'Google Gemini API Key', desc: '상세페이지 AI 카피 + SEO 상품명', icon: '🤖' },
        { id: 'naver-ad-api-key', label: '네이버 검색광고 API Key', desc: '키워드 인텔리전스(월간검색량)', icon: '🔍' },
        { id: 'naver-ad-secret-key', label: '네이버 검색광고 Secret', desc: '', icon: '🔍' },
        { id: 'naver-ad-customer-id', label: '네이버 검색광고 Customer ID', desc: '', icon: '🔍' },
    ];

    el.innerHTML = keys.map(k => `
        <div class="t7-key-row">
            <span class="t7-key-icon">${k.icon}</span>
            <div style="flex:1;">
                <label class="t7-key-label">${k.label}</label>
                ${k.desc ? `<div style="font-size:9px;color:var(--text-muted)">${k.desc}</div>` : ''}
            </div>
            <input type="password" value="${localStorage.getItem(k.id) || ''}" placeholder="키를 입력하세요" class="t7-key-input" style="max-width:200px;" onchange="t7SaveKey('${k.id}',this.value)">
        </div>
    `).join('');
}

function t7SaveKey(id, value) {
    localStorage.setItem(id, value.trim());
    showToast(`🔑 ${id} 저장 완료`);
}

// ═══ 5. 데이터 관리 ═══
function t7RenderDataManagement() {
    const el = document.getElementById('t7-data-section');
    if (!el) return;

    const keys = ['v5-products', 'v7-orders', 'v7-ledger', 'wholesale-sites-v7', 'search-history'];
    const sizes = keys.map(k => {
        const data = localStorage.getItem(k);
        return { key: k, size: data ? (data.length / 1024).toFixed(1) : 0, count: data ? JSON.parse(data).length : 0 };
    });

    el.innerHTML = `<div class="t7-data-list">
        ${sizes.map(s => `<div class="t7-data-row">
            <span class="t7-data-key">${s.key}</span>
            <span class="t7-data-count">${s.count}건</span>
            <span class="t7-data-size">${s.size}KB</span>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="t7-btn" onclick="t7ExportAll()">📦 전체 백업 (JSON)</button>
        <button class="t7-btn t7-btn-del" onclick="t7ResetAll()">🗑️ 전체 초기화</button>
    </div>`;
}

function t7ExportAll() {
    const data = {};
    ['v5-products', 'v7-orders', 'v7-ledger', 'wholesale-sites-v7', 'search-history'].forEach(k => {
        try { data[k] = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) { data[k] = []; }
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seller-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('📦 백업 파일 다운로드');
}

function t7ResetAll() {
    if (!confirm('⚠️ 모든 데이터가 삭제됩니다. 먼저 백업하셨습니까?')) return;
    if (!confirm('정말 삭제하시겠습니까? 복구할 수 없습니다.')) return;
    ['v5-products', 'v7-orders', 'v7-ledger', 'wholesale-sites-v7', 'search-history'].forEach(k => localStorage.removeItem(k));
    showToast('🗑️ 전체 데이터 초기화 완료');
    t7RenderDataManagement();
}

document.addEventListener('DOMContentLoaded', t7Init);

window.t7SaveScriptUrl = t7SaveScriptUrl;
window.t7TestScriptUrl = t7TestScriptUrl;
window.t7SaveSiteKey = t7SaveSiteKey;
window.t7RemoveSite = t7RemoveSite;
window.t7ShowAddSiteModal = t7ShowAddSiteModal;
window.t7SaveKey = t7SaveKey;
window.t7ExportAll = t7ExportAll;
window.t7ResetAll = t7ResetAll;
