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

    // 마켓 인증 여부 알림 (이제 모든 키는 GAS에서 관리되므로 단순 안내만 출력)
    let html = `
        <div class="t5-panel-header">
            <span>🚀 마켓 대량 자동 등록 (스마트스토어 / 쿠팡)</span>
            <span class="t5-badge-new">NEW</span>
        </div>`;

    html += `
        <div class="t5-info-msg" style="border-left:3px solid #3b82f6; margin-bottom:12px;">
            💡 API 자동 송출은 <strong>T7 설정 탭의 [AI 서비스 키]</strong>에서 각 마켓의 인증 정보가 등록된 상태여야 정상 작동합니다.
        </div>`;

    // 등록 대상 상품 목록
    html += `
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">
            상세페이지 완성 ${doneItems.length}개 상품을 스마트스토어에 일괄 등록합니다.
        </div>

        <!-- 등록 설정 -->
        <div class="t5-reg-settings">
            <div class="t5-reg-setting-row" style="margin-bottom:12px;">
                <label>🛒 등록 대상 마켓</label>
                <select id="t5-reg-market-type" style="flex:1;">
                    <option value="smartstore" selected>스마트스토어 (네이버)</option>
                    <option value="coupang">쿠팡 (WING / 로켓)</option>
                </select>
            </div>
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
                <!-- 판매가 수정 및 마진 계산 -->
                <div style="display:flex;align-items:center;gap:4px;min-width:140px;">
                    <input type="number" id="t5-reg-price-${item.id}" value="${item.price || 0}" 
                           onchange="t5RegUpdatePrice(${item.id}, this.value)"
                           style="width:70px;padding:4px 6px;border-radius:4px;border:1px solid #334155;background:transparent;color:#e2e8f0;font-size:11px;">
                    <span style="font-size:11px;color:#94a3b8;">원</span>
                    <button class="t1-mini-btn" onclick="t5ShowMarginCalc(${item.id})" title="마진계산기 열기">📊 ROI</button>
                </div>

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

    // 마진 계산기 모달 (숨김)
    html += `
        <div id="t5-margin-modal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.5);width:320px;">
            <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:14px;">📊 마진율 / ROI 계산기</span>
                <button onclick="document.getElementById('t5-margin-modal').style.display='none'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
            </div>
            <input type="hidden" id="t5-calc-item-id">
            <div style="display:flex;flex-direction:column;gap:12px;font-size:11px;">
                <div>
                    <label style="color:#94a3b8;margin-bottom:4px;display:block;">원가 (도매가)</label>
                    <input type="number" id="t5-calc-cost" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#fff;" oninput="t5DoMarginCalc()">
                </div>
                <div>
                    <label style="color:#94a3b8;margin-bottom:4px;display:block;">판매가</label>
                    <input type="number" id="t5-calc-price" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#fff;" oninput="t5DoMarginCalc()">
                </div>
                <div style="display:flex;gap:10px;">
                    <div style="flex:1">
                        <label style="color:#94a3b8;margin-bottom:4px;display:block;">마켓 수수료(%)</label>
                        <input type="number" id="t5-calc-fee" value="5.5" style="width:100%;padding:8px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#fff;" oninput="t5DoMarginCalc()">
                    </div>
                    <div style="flex:1">
                        <label style="color:#94a3b8;margin-bottom:4px;display:block;">기타/배송비</label>
                        <input type="number" id="t5-calc-misc" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#fff;" oninput="t5DoMarginCalc()">
                    </div>
                </div>
                <div id="t5-calc-result" style="margin-top:6px;padding:12px;background:#1e293b;border-radius:8px;text-align:center;">
                    결과값이 이곳에 표시됩니다.
                </div>
                <button onclick="t5ApplyMarginCalc()" style="padding:12px;background:#10b981;color:#0d0f14;font-size:12px;font-weight:700;border:none;border-radius:8px;cursor:pointer;margin-top:4px;">적용하기</button>
            </div>
        </div>
    `;

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
        const targetMarket = document.getElementById('t5-reg-market-type')?.value || 'smartstore';
        const deliveryType = document.getElementById('t5-reg-delivery-type')?.value || 'DELIVERY';
        const deliveryFee = parseInt(document.getElementById('t5-reg-delivery-fee')?.value) || 3000;
        const returnFee = parseInt(document.getElementById('t5-reg-return-fee')?.value) || 3000;
        const asTel = document.getElementById('t5-reg-as-tel')?.value || '';

        const payload = {
            name: item.name,
            salePrice: item.price || 0,
            stockQuantity: 999,
            categoryId: item._categoryId || '',
            detailContent: item.html,
            representImage: item.image || '',
            marketOptions: item.marketOptions || [],
            deliveryType,
            deliveryFee: deliveryType === 'FREE' ? 0 : deliveryFee,
            returnDeliveryFee: returnFee,
            exchangeDeliveryFee: returnFee * 2,
            afterServiceTel: asTel,
            afterServiceGuide: T5Register.defaultSettings.afterServiceGuide,
            minPurchaseQuantity: 1,
            maxPurchaseQuantity: 999,
        };

        const endpoint = targetMarket === 'coupang' ? 'registerCoupangProduct' : 'registerSmartStoreProduct';
        const result = await fetchGas(endpoint, payload);

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
// ─── 마진율 / ROI 계산기 (팝오버) ───
window.t5RegUpdatePrice = function(id, newPrice) {
    const item = window.T5?.queue?.find(q => q.id === id);
    if (item) item.price = Number(newPrice) || 0;
};

window.t5ShowMarginCalc = function(id) {
    const item = window.T5?.queue?.find(q => q.id === id);
    if (!item) return;
    document.getElementById('t5-calc-item-id').value = id;
    document.getElementById('t5-calc-cost').value = item.cost || 0;
    document.getElementById('t5-calc-price').value = item.price || 0;
    
    // 타겟 마켓에 따른 기본 수수료 세팅
    const market = document.getElementById('t5-reg-market-type')?.value;
    document.getElementById('t5-calc-fee').value = (market === 'coupang') ? 10.8 : 5.5;
    
    document.getElementById('t5-margin-modal').style.display = 'block';
    t5DoMarginCalc();
};

window.t5DoMarginCalc = function() {
    const cost = Number(document.getElementById('t5-calc-cost').value)||0;
    const price = Number(document.getElementById('t5-calc-price').value)||0;
    const feePct = Number(document.getElementById('t5-calc-fee').value)||0;
    const misc = Number(document.getElementById('t5-calc-misc').value)||0;
    
    const feeAmt = price * (feePct / 100);
    const profit = price - cost - feeAmt - misc;
    const marginPct = price > 0 ? (profit / price) * 100 : 0;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    
    const resEl = document.getElementById('t5-calc-result');
    if (profit > 0) {
        resEl.innerHTML = `<div style="color:#10b981;font-size:14px;font-weight:bold;">순이익: ${fmtWon(profit)}원</div><div style="color:#94a3b8;font-size:11px;margin-top:4px;">마진율: ${marginPct.toFixed(1)}% | ROI: ${roi.toFixed(1)}%</div>`;
    } else {
        resEl.innerHTML = `<div style="color:#ef4444;font-size:14px;font-weight:bold;">손실: ${fmtWon(profit)}원</div><div style="color:#94a3b8;font-size:11px;margin-top:4px;">단가 및 부대비용 점검이 필요합니다.</div>`;
    }
};

window.t5ApplyMarginCalc = function() {
    const id = Number(document.getElementById('t5-calc-item-id').value);
    const price = Number(document.getElementById('t5-calc-price').value)||0;
    const cost = Number(document.getElementById('t5-calc-cost').value)||0;
    
    t5RegUpdatePrice(id, price);
    const item = window.T5?.queue?.find(q => q.id === id);
    if(item) {
        item.cost = cost; 
    }
    
    const priceInput = document.getElementById('t5-reg-price-' + id);
    if(priceInput) priceInput.value = price;
    
    document.getElementById('t5-margin-modal').style.display = 'none';
};
