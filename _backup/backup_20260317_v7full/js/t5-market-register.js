/**
 * T5 마켓 대량 자동 등록 — 스마트스토어 커머스 API 연동
 * 파일: js/t5-market-register.js
 *
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js, t5-studio.js
 *
 * 기능:
 *  1. T5 대기열에서 상세페이지 완성된 상품들을 일괄 등록
 *  2. GAS 프록시를 통한 스마트스토어 커머스 API 호출
 *  3. 카테고리 코드 매핑, 가격/배송 설정
 *  4. 등록 결과(성공/실패) 표시 + 실패 시 재시도
 *
 * GAS 프록시 액션:
 *  - 'smartstoreAuth'     : OAuth 토큰 발급
 *  - 'smartstoreRegister' : 상품 등록 API 호출
 *  - 'smartstoreCategory' : 카테고리 코드 검색
 */

// ─── 등록 상태 ───
const T5Register = {
    registering: false,
    results: [],             // 등록 결과 배열
    categoryCache: {},       // 카테고리 코드 캐시
    defaultSettings: {
        deliveryFee: 3000,       // 기본 배송비
        deliveryType: 'DELIVERY', // DELIVERY | FREE
        returnFee: 3000,         // 반품 배송비
        exchangeFee: 6000,       // 교환 배송비
        minPurchaseQty: 1,       // 최소 구매 수량
        maxPurchaseQty: 999,     // 최대 구매 수량
        afterServiceTel: '',     // A/S 전화번호
        afterServiceGuide: '상품 수령 후 7일 이내 교환/반품 가능합니다.',
    },
};

// ═══════════════════════════════════════════════════════════════
// PART 1: T5 UI에 마켓 등록 패널 렌더링
// ═══════════════════════════════════════════════════════════════

function t5RenderRegisterPanel() {
    const panel = document.getElementById('t5-register-panel');
    if (!panel) return;

    const queue = window.T5?.queue || [];
    const doneItems = queue.filter(q => q.status === 'done' && q.html);

    if (!doneItems.length) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    // 스마트스토어 API 키 확인
    const hasApiKey = !!(localStorage.getItem('smartstore-client-id') && localStorage.getItem('smartstore-client-secret'));

    let html = `
        <div class="t5-panel-header">
            <span>🚀 마켓 대량 자동 등록</span>
            <span class="t5-badge-new">NEW</span>
        </div>`;

    if (!hasApiKey) {
        html += `
            <div class="t5-info-msg" style="border-left:3px solid #f59e0b;">
                ⚠️ 스마트스토어 커머스 API 키가 설정되지 않았습니다.<br>
                <span style="font-size:10px;">T7 설정 → 마켓 API 키에서 Client ID / Secret을 입력하세요.</span><br>
                <a href="https://apicenter.commerce.naver.com" target="_blank" style="color:#3b82f6;font-size:10px;">
                    → 네이버 커머스 API 센터에서 발급받기
                </a>
            </div>`;
        panel.innerHTML = html;
        return;
    }

    // 등록 대상 상품 목록
    html += `
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">
            상세페이지 완성 ${doneItems.length}개 상품을 스마트스토어에 일괄 등록합니다.
        </div>

        <!-- 등록 설정 -->
        <div class="t5-reg-settings">
            <div class="t5-reg-setting-row">
                <label>📦 배송비 정책</label>
                <select id="t5-reg-delivery-type" onchange="t5RegUpdateDelivery()">
                    <option value="DELIVERY" selected>유료배송</option>
                    <option value="FREE">무료배송</option>
                    <option value="CONDITIONAL_FREE">조건부 무료</option>
                </select>
            </div>
            <div class="t5-reg-setting-row" id="t5-reg-fee-row">
                <label>배송비 (원)</label>
                <input type="number" id="t5-reg-delivery-fee" value="${T5Register.defaultSettings.deliveryFee}" style="width:100px;">
            </div>
            <div class="t5-reg-setting-row">
                <label>반품 배송비</label>
                <input type="number" id="t5-reg-return-fee" value="${T5Register.defaultSettings.returnFee}" style="width:100px;">
            </div>
            <div class="t5-reg-setting-row">
                <label>A/S 안내 전화</label>
                <input type="text" id="t5-reg-as-tel" value="${T5Register.defaultSettings.afterServiceTel}" placeholder="02-1234-5678" style="width:140px;">
            </div>
        </div>`;

    // 상품 목록 (체크박스)
    html += `
        <div class="t5-reg-items">
            <div class="t5-reg-items-header">
                <input type="checkbox" id="t5-reg-check-all" checked onchange="t5RegToggleAll(this.checked)">
                <span>등록 대상 상품 (${doneItems.length}개)</span>
            </div>`;

    doneItems.forEach(item => {
        const regResult = T5Register.results.find(r => r.id === item.id);
        const statusHtml = regResult
            ? (regResult.success
                ? `<span class="t5-reg-status-ok">✅ 등록완료 <a href="${regResult.productUrl || '#'}" target="_blank" style="color:#3b82f6;font-size:10px;">[보기]</a></span>`
                : `<span class="t5-reg-status-fail">❌ ${regResult.error || '실패'} <button class="t1-mini-btn" onclick="t5RegRetry(${item.id})">재시도</button></span>`)
            : '';

        html += `
            <div class="t5-reg-item">
                <input type="checkbox" class="t5-reg-item-check" data-id="${item.id}" checked>
                <span class="t5-reg-item-name">${escapeHtml(item.name)}</span>
                <span class="t5-reg-item-price">${item.price ? fmtWon(item.price) : '-'}</span>

                <!-- 카테고리 입력 -->
                <div class="t5-reg-item-cat">
                    <input type="text" class="t5-reg-cat-input" data-id="${item.id}"
                           placeholder="카테고리 검색..." value="${item._categoryName || ''}"
                           oninput="t5RegSearchCategory(this,${item.id})">
                    <div class="t5-reg-cat-dropdown" id="t5-reg-cat-dd-${item.id}" style="display:none;"></div>
                </div>

                ${statusHtml}
            </div>`;
    });

    html += `</div>`;

    // 등록 버튼
    html += `
        <div class="t5-reg-btn-row">
            <button class="t5-btn-primary" onclick="t5StartBulkRegister()" style="background:rgba(3,199,90,0.9);"
                    ${T5Register.registering ? 'disabled' : ''}>
                ${T5Register.registering ? '⏳ 등록 중...' : `🚀 스마트스토어 일괄 등록 (${doneItems.length}개)`}
            </button>
        </div>`;

    // 등록 결과 요약
    if (T5Register.results.length) {
        const ok = T5Register.results.filter(r => r.success).length;
        const fail = T5Register.results.filter(r => !r.success).length;
        html += `
            <div class="t5-reg-summary">
                <span style="color:#10b981">✅ 성공 ${ok}개</span>
                ${fail > 0 ? `<span style="color:#ef4444">❌ 실패 ${fail}개</span>` : ''}
                <span style="color:#94a3b8">총 ${T5Register.results.length}개 처리</span>
            </div>`;
    }

    panel.innerHTML = html;
}

function t5RegUpdateDelivery() {
    const type = document.getElementById('t5-reg-delivery-type')?.value;
    const feeRow = document.getElementById('t5-reg-fee-row');
    if (feeRow) feeRow.style.display = type === 'FREE' ? 'none' : 'flex';
}

function t5RegToggleAll(checked) {
    document.querySelectorAll('.t5-reg-item-check').forEach(cb => { cb.checked = checked; });
}

// ═══════════════════════════════════════════════════════════════
// PART 2: 카테고리 코드 검색
// ═══════════════════════════════════════════════════════════════

let _catSearchTimeout = null;
async function t5RegSearchCategory(inputEl, itemId) {
    const query = (inputEl?.value || '').trim();
    const dropdown = document.getElementById(`t5-reg-cat-dd-${itemId}`);
    if (!dropdown) return;

    if (query.length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    // 캐시 확인
    if (T5Register.categoryCache[query]) {
        renderCategoryDropdown(dropdown, T5Register.categoryCache[query], itemId);
        return;
    }

    // 디바운스
    clearTimeout(_catSearchTimeout);
    _catSearchTimeout = setTimeout(async () => {
        dropdown.style.display = 'block';
        dropdown.innerHTML = '<div style="padding:6px;font-size:10px;color:#94a3b8;">검색 중...</div>';

        try {
            const result = await fetchGas('smartstoreCategory', { query });
            if (result?.categories?.length) {
                T5Register.categoryCache[query] = result.categories;
                renderCategoryDropdown(dropdown, result.categories, itemId);
            } else {
                dropdown.innerHTML = '<div style="padding:6px;font-size:10px;color:#94a3b8;">결과 없음</div>';
            }
        } catch (e) {
            dropdown.innerHTML = '<div style="padding:6px;font-size:10px;color:#ef4444;">조회 실패</div>';
        }
    }, 400);
}

function renderCategoryDropdown(dropdown, categories, itemId) {
    dropdown.style.display = 'block';
    dropdown.innerHTML = categories.slice(0, 8).map(cat => `
        <div class="t5-reg-cat-option" onclick="t5RegSelectCategory(${itemId},'${cat.id}','${escapeHtml(cat.name).replace(/'/g, "\\'")}')">
            <span style="font-size:10px;color:#94a3b8">${cat.id}</span>
            <span>${escapeHtml(cat.name)}</span>
        </div>
    `).join('');
}

function t5RegSelectCategory(itemId, catId, catName) {
    // 대기열 아이템에 카테고리 저장
    const queueItem = (window.T5?.queue || []).find(q => q.id === itemId);
    if (queueItem) {
        queueItem._categoryId = catId;
        queueItem._categoryName = catName;
    }

    // UI 업데이트
    const input = document.querySelector(`.t5-reg-cat-input[data-id="${itemId}"]`);
    if (input) input.value = catName;

    const dropdown = document.getElementById(`t5-reg-cat-dd-${itemId}`);
    if (dropdown) dropdown.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// PART 3: 일괄 등록 실행
// ═══════════════════════════════════════════════════════════════

async function t5StartBulkRegister() {
    if (T5Register.registering) return;

    const queue = window.T5?.queue || [];
    const checkedIds = Array.from(document.querySelectorAll('.t5-reg-item-check:checked'))
        .map(cb => parseInt(cb.dataset.id));

    const targets = queue.filter(q => q.status === 'done' && q.html && checkedIds.includes(q.id));
    if (!targets.length) {
        showToast('등록할 상품을 선택하세요');
        return;
    }

    // 카테고리 미설정 체크
    const noCat = targets.filter(t => !t._categoryId);
    if (noCat.length) {
        showToast(`⚠️ ${noCat.length}개 상품의 카테고리가 설정되지 않았습니다.`, false);
        return;
    }

    // 설정값 수집
    const deliveryType = document.getElementById('t5-reg-delivery-type')?.value || 'DELIVERY';
    const deliveryFee = parseInt(document.getElementById('t5-reg-delivery-fee')?.value) || 3000;
    const returnFee = parseInt(document.getElementById('t5-reg-return-fee')?.value) || 3000;
    const asTel = document.getElementById('t5-reg-as-tel')?.value || '';

    T5Register.registering = true;
    T5Register.results = [];
    t5RenderRegisterPanel();

    showToast(`🚀 ${targets.length}개 상품 스마트스토어 등록 시작...`);

    for (const item of targets) {
        try {
            const payload = {
                // 상품 기본 정보
                name: item.name,
                salePrice: item.price || 0,
                stockQuantity: 999,
                categoryId: item._categoryId,

                // 상세페이지 HTML
                detailContent: item.html,

                // 이미지
                representImage: item.image || '',

                // 배송 설정
                deliveryType: deliveryType,
                deliveryFee: deliveryType === 'FREE' ? 0 : deliveryFee,
                returnDeliveryFee: returnFee,
                exchangeDeliveryFee: returnFee * 2,

                // A/S
                afterServiceTel: asTel,
                afterServiceGuide: T5Register.defaultSettings.afterServiceGuide,

                // 판매 설정
                minPurchaseQuantity: T5Register.defaultSettings.minPurchaseQty,
                maxPurchaseQuantity: T5Register.defaultSettings.maxPurchaseQty,
            };

            const result = await fetchGas('smartstoreRegister', payload);

            if (result?.success) {
                T5Register.results.push({
                    id: item.id,
                    success: true,
                    productId: result.productId || '',
                    productUrl: result.productUrl || '',
                });
                showToast(`✅ "${item.name}" 등록 성공`);
            } else {
                T5Register.results.push({
                    id: item.id,
                    success: false,
                    error: result?.error || '알 수 없는 오류',
                });
                showToast(`❌ "${item.name}" 등록 실패: ${result?.error || ''}`, false);
            }
        } catch (e) {
            T5Register.results.push({
                id: item.id,
                success: false,
                error: e.message,
            });
            console.error(`[T5Reg] ${item.name} 등록 오류:`, e);
        }

        // API 부하 방지
        await new Promise(r => setTimeout(r, 1000));
        t5RenderRegisterPanel();
    }

    T5Register.registering = false;
    t5RenderRegisterPanel();

    const okCount = T5Register.results.filter(r => r.success).length;
    const failCount = T5Register.results.filter(r => !r.success).length;
    showToast(`🏁 등록 완료: 성공 ${okCount}개, 실패 ${failCount}개`, okCount > 0 ? 'success' : false);
}

// ─── 재시도 ───
async function t5RegRetry(itemId) {
    // 기존 결과 제거
    T5Register.results = T5Register.results.filter(r => r.id !== itemId);

    // 해당 아이템만 재등록
    const queue = window.T5?.queue || [];
    const item = queue.find(q => q.id === itemId);
    if (!item) return;

    // 체크박스 강제 체크
    const cb = document.querySelector(`.t5-reg-item-check[data-id="${itemId}"]`);
    if (cb) cb.checked = true;

    showToast(`🔄 "${item.name}" 재등록 시도...`);

    // 단건 등록
    try {
        const deliveryType = document.getElementById('t5-reg-delivery-type')?.value || 'DELIVERY';
        const deliveryFee = parseInt(document.getElementById('t5-reg-delivery-fee')?.value) || 3000;
        const returnFee = parseInt(document.getElementById('t5-reg-return-fee')?.value) || 3000;
        const asTel = document.getElementById('t5-reg-as-tel')?.value || '';

        const result = await fetchGas('smartstoreRegister', {
            name: item.name,
            salePrice: item.price || 0,
            stockQuantity: 999,
            categoryId: item._categoryId || '',
            detailContent: item.html,
            representImage: item.image || '',
            deliveryType,
            deliveryFee: deliveryType === 'FREE' ? 0 : deliveryFee,
            returnDeliveryFee: returnFee,
            exchangeDeliveryFee: returnFee * 2,
            afterServiceTel: asTel,
            afterServiceGuide: T5Register.defaultSettings.afterServiceGuide,
            minPurchaseQuantity: 1,
            maxPurchaseQuantity: 999,
        });

        if (result?.success) {
            T5Register.results.push({ id: item.id, success: true, productId: result.productId, productUrl: result.productUrl });
            showToast(`✅ "${item.name}" 재등록 성공`);
        } else {
            T5Register.results.push({ id: item.id, success: false, error: result?.error || '실패' });
            showToast(`❌ 재등록 실패: ${result?.error || ''}`, false);
        }
    } catch (e) {
        T5Register.results.push({ id: item.id, success: false, error: e.message });
    }

    t5RenderRegisterPanel();
}

// ═══════════════════════════════════════════════════════════════
// PART 4: 초기화 & 이벤트 연결
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // T5 대기열 변경 시 등록 패널도 갱신
    const _origRenderQueue = window.t5RenderQueue;
    if (_origRenderQueue) {
        window.t5RenderQueue = function() {
            _origRenderQueue();
            t5RenderRegisterPanel();
        };
    }

    // T5 대기열 처리 완료 시 등록 패널 갱신
    const _origProcessQueue = window.t5ProcessQueue;
    if (_origProcessQueue) {
        window.t5ProcessQueue = async function() {
            await _origProcessQueue();
            t5RenderRegisterPanel();
        };
    }
});

// ─── 전역 노출 ───
window.T5Register = T5Register;
window.t5RenderRegisterPanel = t5RenderRegisterPanel;
window.t5StartBulkRegister = t5StartBulkRegister;
window.t5RegRetry = t5RegRetry;
window.t5RegSearchCategory = t5RegSearchCategory;
window.t5RegSelectCategory = t5RegSelectCategory;
window.t5RegToggleAll = t5RegToggleAll;
window.t5RegUpdateDelivery = t5RegUpdateDelivery;
