/**
 * T7 시스템 설정 — 고도화 모듈
 * 파일: js/t7-settings.js
 * 
 * 연동: config.js의 WholesaleSiteManager, AppConfig
 * 
 * 기능:
 *  1. Apps Script URL 설정 + 연결 테스트 + 자동 연결
 *  2. 도매사이트 관리 (CRUD + API 키)
 *  3. 마켓 API 키 관리 (스마트스토어/쿠팡 등)
 *  4. AI 서비스 키 (Gemini/네이버 검색광고)
 *  5. 🔒 보안 설정 (PIN 변경, 계정별 PIN 관리)
 *  6. 데이터 초기화/백업
 *  
 *  ★ 모든 설정 필드: 값이 존재하면 잠금(readonly) → PIN 인증 후 수정 가능
 */

// ★ PIN 검증 공통 헬퍼
function _t7VerifyPin(promptMsg) {
    const email = (window._userEmail || '').toLowerCase().trim();
    const personalPin = email ? localStorage.getItem('pin-' + email) : null;
    const savedPin = personalPin || localStorage.getItem('master-pin-config') || '0000';
    const entered = prompt(promptMsg || '🔒 수정하려면 PIN을 입력하세요:');
    if (entered === null) return false;
    if (entered !== savedPin) {
        showToast('❌ PIN이 틀렸습니다.', true);
        return false;
    }
    return true;
}

function t7Init() {
    t7RenderScriptUrl();
    t7RenderWholesaleSites();
    t7RenderApiKeys();
    t7RenderAIKeys();
    t7RenderPinSettings();
    t7RenderDataManagement();
    // ★ 페이지 로드 시 GAS 자동 연결
    t7AutoConnect();
}

// ═══ ★ 자동 연결 — 페이지 로드 시 GAS 연결 ═══
async function t7AutoConnect() {
    const url = localStorage.getItem('proxyApiUrl') || localStorage.getItem('script-url') || '';
    if (!url) {
        console.log('[T7] GAS URL 미설정 — 자동 연결 건너뜀');
        if (typeof setSyncStatus === 'function') setSyncStatus('error', 'URL 미설정');
        return;
    }
    // 전역 변수 동기화
    if (typeof window.SCRIPT_URL !== 'undefined') window.SCRIPT_URL = url;
    if (typeof AppConfig !== 'undefined') AppConfig.APPS_SCRIPT_URL = url;
    console.log('[T7] GAS 자동 연결 시도:', url.substring(0, 60) + '...');
    if (typeof setSyncStatus === 'function') setSyncStatus('syncing', '연결 중...');
    try {
        const result = await fetchGas('getConfig', {});
        if (result && result.success !== false) {
            console.log('[T7] ✅ GAS 자동 연결 성공');
            if (typeof setSyncStatus === 'function') setSyncStatus('synced', '연결됨');
        } else {
            console.warn('[T7] ⚠️ GAS 응답 이상:', result);
            if (typeof setSyncStatus === 'function') setSyncStatus('error', '응답 오류');
        }
    } catch(e) {
        console.warn('[T7] ❌ GAS 자동 연결 실패:', e.message);
        if (typeof setSyncStatus === 'function') setSyncStatus('error', '연결 실패');
    }
}

// ═══ 1. Apps Script URL ═══
function t7RenderScriptUrl() {
    const el = document.getElementById('t7-script-section');
    if (!el) return;
    const url = localStorage.getItem('proxyApiUrl') || localStorage.getItem('script-url') || '';
    const isLocked = !!url;  // 값이 있으면 잠금
    const isConnected = !!url;
    el.innerHTML = `
        <div class="t7-form-group">
            <label>GOOGLE APPS SCRIPT URL</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <input type="text" id="t7-script-url" value="${escapeHtml(url)}" 
                    placeholder="https://script.google.com/macros/s/..." style="flex:1;"
                    ${isLocked ? 'readonly style="flex:1;opacity:0.7;cursor:not-allowed;background:rgba(255,255,255,0.02);"' : 'style="flex:1;"'}>
                ${isLocked 
                    ? `<button class="t7-btn t7-btn-lock" onclick="t7UnlockField('script-url')" title="PIN으로 잠금 해제" style="background:#f59e0b;color:#000;font-weight:700;">🔓 해제</button>
                       <button class="t7-btn t7-btn-test" onclick="t7TestScriptUrl()">테스트</button>`
                    : `<button class="t7-btn" onclick="t7SaveScriptUrl()">저장</button>
                       <button class="t7-btn t7-btn-test" onclick="t7TestScriptUrl()">테스트</button>`
                }
            </div>
            <div id="t7-url-status" style="margin-top:8px;font-size:11px;display:flex;align-items:center;gap:6px;">
                <span style="color:${isConnected ? '#10b981' : '#ef4444'};">${isConnected ? '🔒 URL 저장됨 (잠금)' : '● URL 미설정'}</span>
                <span id="t7-test-result" style="color:var(--text-muted);"></span>
            </div>
        </div>
    `;
}

// ★ 필드 잠금 해제 (PIN 인증)
function t7UnlockField(fieldType) {
    if (!_t7VerifyPin('🔓 설정을 수정하려면 PIN을 입력하세요:')) return;
    
    if (fieldType === 'script-url') {
        const input = document.getElementById('t7-script-url');
        if (input) {
            input.readOnly = false;
            input.style.opacity = '1';
            input.style.cursor = 'text';
            input.style.background = '';
            input.focus();
        }
        // 버튼 교체: 🔒 → 저장
        const el = document.getElementById('t7-script-section');
        if (el) {
            const lockBtn = el.querySelector('.t7-btn-lock');
            if (lockBtn) {
                lockBtn.textContent = '저장';
                lockBtn.className = 't7-btn';
                lockBtn.onclick = function() { t7SaveScriptUrl(); };
                lockBtn.title = '';
            }
        }
        showToast('🔓 잠금 해제됨 — 수정 후 저장 버튼을 누르세요');
    }
}

function t7SaveScriptUrl() {
    const url = document.getElementById('t7-script-url')?.value?.trim() || '';
    if (!url) {
        showToast('⚠️ URL을 입력하세요', true);
        return;
    }
    // ★ PIN 인증 필수
    if (!_t7VerifyPin('🔒 설정을 저장하려면 PIN을 입력하세요:')) return;

    // 모든 URL 키에 동기화
    localStorage.setItem('proxyApiUrl', url);
    localStorage.setItem('script-url', url);
    localStorage.setItem('gas-proxy-url', url);
    localStorage.setItem('appsScriptUrl', url);
    // mega-block.js의 전역 변수도 동기화
    if (typeof window.SCRIPT_URL !== 'undefined') window.SCRIPT_URL = url;
    if (typeof AppConfig !== 'undefined') AppConfig.APPS_SCRIPT_URL = url;
    if (typeof setSyncStatus === 'function') setSyncStatus('synced', '연결됨');
    showToast('✅ Script URL 저장 + 잠금 완료');
    t7RenderScriptUrl();  // 잠금 상태로 다시 렌더링
    // 자동 연결 시도
    t7AutoConnect();
}

async function t7TestScriptUrl() {
    const resultEl = document.getElementById('t7-test-result');
    if (resultEl) resultEl.textContent = '⏳ 테스트 중...';
    try {
        const result = await fetchGas('getConfig', {});
        if (resultEl) {
            resultEl.style.color = '#10b981';
            resultEl.textContent = '✅ 서버 연결 성공!';
        }
        if (typeof setSyncStatus === 'function') setSyncStatus('synced', '연결됨');
        showToast('✅ Apps Script 서버 연결 성공!');
    } catch(e) {
        if (resultEl) {
            resultEl.style.color = '#ef4444';
            resultEl.textContent = '❌ 연결 실패: ' + e.message;
        }
        if (typeof setSyncStatus === 'function') setSyncStatus('error', '연결 실패');
        showToast('❌ 연결 실패: ' + e.message, true);
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
        const isLocked = !!apiKey;  // 값이 있으면 잠금
        html += `<div class="t7-site-row">
            <span class="t7-site-status" style="color:${connected ? '#10b981' : '#64748b'}">${connected ? '🟢' : '⬜'}</span>
            <span class="t7-site-name">${escapeHtml(site.name)}</span>
            <span class="t7-site-type">${site.type === 'api' ? 'API' : 'EXCEL'}</span>
            ${site.apiKeyField ? (isLocked 
                ? `<input type="password" id="key-${site.id}" value="${escapeHtml(apiKey)}" class="t7-key-input" readonly style="opacity:0.7;cursor:not-allowed;">
                   <button class="t7-mini-btn" onclick="t7UnlockSiteKey('${site.id}','${site.apiKeyField}')" style="background:#f59e0b;color:#000;font-weight:700;">🔓 해제</button>`
                : `<input type="password" id="key-${site.id}" value="" placeholder="API Key" class="t7-key-input">
                   <button class="t7-mini-btn" onclick="t7SaveSiteKey('${site.id}','${site.apiKeyField}',document.getElementById('key-${site.id}').value)">저장</button>`
            ) : ''}
            <button class="t7-mini-btn t7-btn-del" onclick="t7RemoveSite('${site.id}')">삭제</button>
        </div>`;
    });

    html += '</div>';
    html += `<button class="t7-btn" onclick="t7ShowAddSiteModal()" style="margin-top:8px;">+ 도매사이트 추가</button>`;
    el.innerHTML = html;
}

function t7UnlockSiteKey(siteId, keyField) {
    if (!_t7VerifyPin('🔓 API 키를 수정하려면 PIN을 입력하세요:')) return;
    const input = document.getElementById('key-' + siteId);
    if (input) {
        input.readOnly = false;
        input.style.opacity = '1';
        input.style.cursor = 'text';
        input.type = 'text';  // 편집 시 값 보여주기
        input.focus();
    }
    // 🔒 버튼 → 저장 버튼으로 교체
    const parent = input?.parentElement;
    if (parent) {
        const lockBtn = parent.querySelector('.t7-mini-btn:not(.t7-btn-del)');
        if (lockBtn) {
            lockBtn.textContent = '저장';
            lockBtn.onclick = function() { t7SaveSiteKey(siteId, keyField, input.value); };
        }
    }
    showToast('🔓 잠금 해제됨');
}

function t7SaveSiteKey(siteId, keyField, value) {
    if (!value || !value.trim()) {
        showToast('⚠️ API 키를 입력하세요', true);
        return;
    }
    if (!_t7VerifyPin('🔒 API 키를 저장하려면 PIN을 입력하세요:')) return;
    localStorage.setItem(keyField, value.trim());
    t7RenderWholesaleSites();
    showToast(`🔑 API 키 저장 + 잠금 완료`);
}

function t7RemoveSite(id) {
    if (!confirm('이 도매사이트를 삭제하시겠습니까?')) return;
    if (!_t7VerifyPin('🔒 삭제하려면 PIN을 입력하세요:')) return;
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

// ═══ 3. 마켓 API 키 (잠금 보호) ═══
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

    el.innerHTML = keys.map(k => {
        const savedVal = localStorage.getItem(k.id) || '';
        const isLocked = !!savedVal;
        return `
        <div class="t7-key-row">
            <span class="t7-key-icon">${k.icon}</span>
            <label class="t7-key-label">${k.label}</label>
            <span style="font-size:10px;color:${isLocked ? '#10b981' : '#64748b'};margin-right:4px;">${isLocked ? '🔒' : '○'}</span>
            <input type="password" value="${savedVal}" placeholder="키를 입력하세요" class="t7-key-input" id="t7-key-${k.id}"
                ${isLocked ? 'readonly style="opacity:0.7;cursor:not-allowed;"' : ''}>
            ${isLocked
                ? `<button class="t7-mini-btn" onclick="t7UnlockKey('${k.id}')" style="background:#f59e0b;color:#000;font-weight:700;">🔓 해제</button>`
                : `<button class="t7-mini-btn" onclick="t7SaveKeyWithPin('${k.id}')">저장</button>`
            }
        </div>
    `}).join('');
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

    el.innerHTML = keys.map(k => {
        const savedVal = localStorage.getItem(k.id) || '';
        const isLocked = !!savedVal;
        return `
        <div class="t7-key-row">
            <span class="t7-key-icon">${k.icon}</span>
            <div style="flex:1;">
                <label class="t7-key-label">${k.label}</label>
                ${k.desc ? `<div style="font-size:9px;color:var(--text-muted)">${k.desc}</div>` : ''}
            </div>
            <span style="font-size:10px;color:${isLocked ? '#10b981' : '#64748b'};margin-right:4px;">${isLocked ? '🔒' : '○'}</span>
            <input type="password" value="${savedVal}" placeholder="키를 입력하세요" class="t7-key-input" style="max-width:200px;" id="t7-key-${k.id}"
                ${isLocked ? 'readonly style="max-width:200px;opacity:0.7;cursor:not-allowed;"' : ''}>
            ${isLocked
                ? `<button class="t7-mini-btn" onclick="t7UnlockKey('${k.id}')" style="background:#f59e0b;color:#000;font-weight:700;">🔓 해제</button>`
                : `<button class="t7-mini-btn" onclick="t7SaveKeyWithPin('${k.id}')">저장</button>`
            }
        </div>
    `}).join('');
}

// ★ 키 잠금 해제 (마켓/AI 공통)
function t7UnlockKey(id) {
    if (!_t7VerifyPin('🔓 API 키를 수정하려면 PIN을 입력하세요:')) return;

    const input = document.getElementById('t7-key-' + id);
    if (input) {
        input.readOnly = false;
        input.style.opacity = '1';
        input.style.cursor = 'text';
        input.type = 'text';  // 편집 시 값 보여주기
        input.focus();
    }
    // 🔒 수정 → 저장 버튼으로 교체
    const row = input?.closest('.t7-key-row');
    if (row) {
        const btn = row.querySelector('.t7-mini-btn');
        if (btn) {
            btn.textContent = '저장';
            btn.onclick = function() { t7SaveKeyWithPin(id); };
        }
        // 아이콘도 변경
        const icon = row.querySelector('span[style*="10b981"]');
        if (icon) icon.textContent = '🔓';
    }
    showToast('🔓 잠금 해제됨 — 수정 후 저장 버튼을 누르세요');
}

// PIN 인증 후 키 저장
function t7SaveKeyWithPin(id) {
    const inputEl = document.getElementById('t7-key-' + id);
    if (!inputEl) return;
    const value = inputEl.value.trim();
    if (!value) {
        showToast('⚠️ 키 값을 입력하세요', true);
        return;
    }
    if (!_t7VerifyPin('🔒 API 키를 저장하려면 PIN을 입력하세요:')) return;

    localStorage.setItem(id, value);
    showToast(`🔑 ${id} 저장 + 잠금 완료`);
    // 잠금 상태로 다시 렌더링
    t7RenderApiKeys();
    t7RenderAIKeys();
}

// 이전 호환: PIN 없이 저장 (도매사이트용)
function t7SaveKey(id, value) {
    localStorage.setItem(id, value.trim());
    showToast(`🔑 ${id} 저장 완료`);
}

// ═══ 5. 🔒 보안 설정 (PIN 관리) ═══
function t7RenderPinSettings() {
    const el = document.getElementById('t7-pin-section');
    if (!el) return;

    const email = (window._userEmail || '').toLowerCase().trim();
    const personalPin = email ? localStorage.getItem('pin-' + email) : null;
    const masterPin = localStorage.getItem('master-pin-config') || '0000';
    const hasPersonalPin = !!personalPin;

    el.innerHTML = `
        <div class="t7-form-group" style="margin-bottom:16px;">
            <label>👤 현재 계정</label>
            <div style="font-size:13px;color:var(--text);font-weight:600;">${escapeHtml(email || '(알 수 없음)')}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                PIN 상태: ${hasPersonalPin ? '<span style="color:#10b981;">🟢 개인 PIN 설정됨</span>' : '<span style="color:#f59e0b;">🟡 마스터 PIN 사용 중 (기본: 0000)</span>'}
            </div>
        </div>

        <div class="t7-form-group" style="margin-bottom:16px;">
            <label>🔐 개인 PIN 변경</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <input type="password" id="t7-current-pin" placeholder="현재 PIN" maxlength="4" style="width:100px;text-align:center;letter-spacing:4px;">
                <span style="color:var(--text-muted);">→</span>
                <input type="password" id="t7-new-pin" placeholder="새 PIN" maxlength="4" style="width:100px;text-align:center;letter-spacing:4px;">
                <input type="password" id="t7-confirm-pin" placeholder="확인" maxlength="4" style="width:100px;text-align:center;letter-spacing:4px;">
                <button class="t7-btn" onclick="t7ChangePin()">변경</button>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:6px;">
                ※ 개인 PIN은 이 계정(${escapeHtml(email)})에만 적용됩니다.
            </div>
        </div>

        <div class="t7-form-group">
            <label>🔑 마스터 PIN 변경 (관리자 전용)</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <input type="password" id="t7-master-old" placeholder="현재 마스터 PIN" maxlength="4" style="width:120px;text-align:center;letter-spacing:4px;">
                <span style="color:var(--text-muted);">→</span>
                <input type="password" id="t7-master-new" placeholder="새 마스터 PIN" maxlength="4" style="width:120px;text-align:center;letter-spacing:4px;">
                <button class="t7-btn" onclick="t7ChangeMasterPin()">변경</button>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:6px;">
                ※ 마스터 PIN은 개인 PIN이 없는 모든 사용자에게 적용됩니다.
            </div>
        </div>
    `;
}

function t7ChangePin() {
    const email = (window._userEmail || '').toLowerCase().trim();
    if (!email) { showToast('⚠️ 로그인 후 사용하세요', true); return; }

    const currentEl = document.getElementById('t7-current-pin');
    const newEl = document.getElementById('t7-new-pin');
    const confirmEl = document.getElementById('t7-confirm-pin');

    const current = currentEl?.value || '';
    const newPin = newEl?.value || '';
    const confirmPin = confirmEl?.value || '';

    if (!current) { showToast('⚠️ 현재 PIN을 입력하세요', true); return; }
    if (!newPin || newPin.length !== 4) { showToast('⚠️ 새 PIN은 4자리로 입력하세요', true); return; }
    if (newPin !== confirmPin) { showToast('⚠️ 새 PIN이 일치하지 않습니다', true); return; }

    // 현재 PIN 검증
    const personalPin = localStorage.getItem('pin-' + email);
    const savedPin = personalPin || localStorage.getItem('master-pin-config') || '0000';
    if (current !== savedPin) {
        showToast('❌ 현재 PIN이 틀렸습니다', true);
        return;
    }

    localStorage.setItem('pin-' + email, newPin);
    showToast('✅ 개인 PIN이 변경되었습니다!');
    if (currentEl) currentEl.value = '';
    if (newEl) newEl.value = '';
    if (confirmEl) confirmEl.value = '';
    t7RenderPinSettings();
}

function t7ChangeMasterPin() {
    const oldEl = document.getElementById('t7-master-old');
    const newEl = document.getElementById('t7-master-new');

    const oldPin = oldEl?.value || '';
    const newPin = newEl?.value || '';

    if (!oldPin) { showToast('⚠️ 현재 마스터 PIN을 입력하세요', true); return; }
    if (!newPin || newPin.length !== 4) { showToast('⚠️ 새 마스터 PIN은 4자리로 입력하세요', true); return; }

    const masterPin = localStorage.getItem('master-pin-config') || '0000';
    if (oldPin !== masterPin) {
        showToast('❌ 마스터 PIN이 틀렸습니다', true);
        return;
    }

    localStorage.setItem('master-pin-config', newPin);
    showToast('✅ 마스터 PIN이 변경되었습니다!');
    if (oldEl) oldEl.value = '';
    if (newEl) newEl.value = '';
    t7RenderPinSettings();
}

// ═══ 6. 데이터 관리 ═══
function t7RenderDataManagement() {
    const el = document.getElementById('t7-data-section');
    if (!el) return;

    const keys = ['v5-products', 'v7-orders', 'v7-ledger', 'wholesale-sites-v7', 'search-history'];
    const sizes = keys.map(k => {
        const data = localStorage.getItem(k);
        let count = 0;
        try { count = data ? JSON.parse(data).length : 0; } catch(e) {}
        return { key: k, size: data ? (data.length / 1024).toFixed(1) : 0, count };
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
    if (!_t7VerifyPin('🔒 전체 초기화하려면 PIN을 입력하세요:')) return;
    ['v5-products', 'v7-orders', 'v7-ledger', 'wholesale-sites-v7', 'search-history'].forEach(k => localStorage.removeItem(k));
    showToast('🗑️ 전체 데이터 초기화 완료');
    t7RenderDataManagement();
}

document.addEventListener('DOMContentLoaded', t7Init);

window.t7SaveScriptUrl = t7SaveScriptUrl;
window.t7TestScriptUrl = t7TestScriptUrl;
window.t7AutoConnect = t7AutoConnect;
window.t7UnlockField = t7UnlockField;
window.t7UnlockKey = t7UnlockKey;
window.t7UnlockSiteKey = t7UnlockSiteKey;
window.t7SaveSiteKey = t7SaveSiteKey;
window.t7RemoveSite = t7RemoveSite;
window.t7ShowAddSiteModal = t7ShowAddSiteModal;
window.t7SaveKey = t7SaveKey;
window.t7SaveKeyWithPin = t7SaveKeyWithPin;
window.t7ChangePin = t7ChangePin;
window.t7ChangeMasterPin = t7ChangeMasterPin;
window.t7ExportAll = t7ExportAll;
window.t7ResetAll = t7ResetAll;
