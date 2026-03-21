/**
 * T4 OMS 주문관제 — 고도화 모듈
 * 파일: js/t6-oms.js  (내부 변수 T6 — Sacred Zone)
 * 
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js
 * 
 * 연동: T2 상품 데이터(localStorage 'v5-products')를 읽어 주문과 매칭
 *       주문 정산 시 AppEventBus.emit('ORDER_SETTLED') → T5 장부 연동
 * 
 * 기능:
 *  1. KPI 대시보드 (오늘 주문/대기/배송/월매출)
 *  2. 주문 수집 (마켓 API 연동 or 수동 입력)
 *  3. 6단계 파이프라인 (접수→발주확인→배송준비→배송중→배송완료→정산완료) + CS
 *  4. 마켓별 필터 + 상태별 필터 + 날짜별 검색
 *  5. 자동 발주 (도매처 연동 인터페이스)
 *  6. 송장번호 입력/관리
 *  7. CS 대응 (교환/반품/환불)
 *  8. T5 장부 자동 연동 (정산완료 → ORDER_SETTLED)
 */

const T6 = {
    orders: [],
    filterStatus: 'all',
    filterMarket: 'all',
    filterDate: 'today',
    sortBy: 'newest',
    activeSubTab: 'orders', // 'orders' | 'cs'
};

// ═══ 상태 정의 (6단계 파이프라인 + CS 3종) ═══
const T6_STATUSES = [
    { id: 'received',     label: '📥 접수',        color: '#f59e0b', group: 'pipeline' },
    { id: 'confirmed',    label: '✅ 발주확인',    color: '#10b981', group: 'pipeline' },
    { id: 'preparing',    label: '📦 배송준비',    color: '#8b5cf6', group: 'pipeline' },
    { id: 'shipped',      label: '🚚 배송중',      color: '#60a5fa', group: 'pipeline' },
    { id: 'delivered',    label: '✔️ 배송완료',    color: '#22c55e', group: 'pipeline' },
    { id: 'settled',      label: '💰 정산완료',    color: '#10b981', group: 'pipeline' },
    { id: 'exchange',     label: '🔄 교환',        color: '#f97316', group: 'cs' },
    { id: 'return',       label: '↩️ 반품',        color: '#ef4444', group: 'cs' },
    { id: 'refund',       label: '💸 환불',        color: '#ef4444', group: 'cs' },
];
const T6_PIPELINE_ORDER = ['received','confirmed','preparing','shipped','delivered','settled'];
const T6_CS_STATUSES = ['exchange','return','refund'];

// ─── 초기화 ───
function t6Init() {
    t6LoadOrders();
    t6MigrateStatuses(); // 기존 데이터 마이그레이션
    t6RenderDashboard();
    t6RenderOrders();
    AppEventBus.on('PRODUCT_SOURCED', () => t6RenderDashboard());
}

function t6LoadOrders() {
    try { T6.orders = JSON.parse(localStorage.getItem('v7-orders') || '[]'); }
    catch(e) { T6.orders = []; }
}

function t6SaveOrders() {
    localStorage.setItem('v7-orders', JSON.stringify(T6.orders));
}

// 기존 상태값 마이그레이션 (new→received, ordered→confirmed, completed→delivered)
function t6MigrateStatuses() {
    const migMap = { 'new':'received', 'ordered':'confirmed', 'completed':'delivered' };
    let changed = false;
    T6.orders.forEach(o => {
        if (migMap[o.status]) {
            o.status = migMap[o.status];
            if (!o.timeline) o.timeline = [];
            changed = true;
        }
    });
    if (changed) t6SaveOrders();
}

// ═══ KPI 대시보드 (T4-G) ═══
function t6RenderDashboard() {
    const el = document.getElementById('t6-dashboard');
    if (!el) return;

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    const todayOrders = T6.orders.filter(o => (o.createdAt || '').startsWith(today));
    const pendingCount = T6.orders.filter(o => o.status === 'received').length;
    const shippingCount = T6.orders.filter(o => o.status === 'shipped').length;
    const csCount = T6.orders.filter(o => T6_CS_STATUSES.includes(o.status)).length;
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.salePrice || 0), 0);
    const monthOrders = T6.orders.filter(o => (o.createdAt || '').startsWith(thisMonth));
    const monthRevenue = monthOrders.reduce((s, o) => s + (o.salePrice || 0), 0);

    el.innerHTML = `<div class="t6-dash-grid">
        <div class="t6-dash-card"><div class="t6-dash-val">${todayOrders.length}</div><div class="t6-dash-label">오늘 주문</div></div>
        <div class="t6-dash-card ${pendingCount > 0 ? 't6-dash-alert' : ''}"><div class="t6-dash-val" style="color:#f59e0b">${pendingCount}</div><div class="t6-dash-label">처리 대기</div></div>
        <div class="t6-dash-card"><div class="t6-dash-val" style="color:#60a5fa">${shippingCount}</div><div class="t6-dash-label">배송중</div></div>
        <div class="t6-dash-card ${csCount > 0 ? 't6-dash-alert' : ''}"><div class="t6-dash-val" style="color:#ef4444">${csCount}</div><div class="t6-dash-label">CS 대응</div></div>
        <div class="t6-dash-card"><div class="t6-dash-val t6-c-green">${fmtWon(todayRevenue)}</div><div class="t6-dash-label">오늘 매출</div></div>
        <div class="t6-dash-card"><div class="t6-dash-val t6-c-green">${fmtWon(monthRevenue)}</div><div class="t6-dash-label">이번달 매출</div></div>
    </div>
    <!-- 6단계 파이프라인 시각화 -->
    <div class="t6-pipeline-bar">
        ${T6_PIPELINE_ORDER.map(sid => {
            const st = T6_STATUSES.find(s => s.id === sid);
            const cnt = T6.orders.filter(o => o.status === sid).length;
            return `<div class="t6-pipe-step ${cnt > 0 ? 'active' : ''}" onclick="t6SetFilter('status','${sid}')" style="--pipe-color:${st.color}">
                <div class="t6-pipe-count">${cnt}</div>
                <div class="t6-pipe-label">${st.label}</div>
            </div>`;
        }).join('<div class="t6-pipe-arrow">→</div>')}
    </div>`;
}

// ═══ 주문 추가 ═══
function t6AddOrder() {
    const nameEl = document.getElementById('t6-order-product');
    const priceEl = document.getElementById('t6-order-price');
    const marketEl = document.getElementById('t6-order-market');
    const buyerEl = document.getElementById('t6-order-buyer');
    const qtyEl = document.getElementById('t6-order-qty');

    const name = (nameEl?.value || '').trim();
    const salePrice = parseInt(priceEl?.value || 0, 10);
    if (!name) { showToast('상품명을 입력하세요'); return; }

    // T2 상품 매칭
    const products = JSON.parse(localStorage.getItem('v5-products') || '[]');
    const matched = products.find(p => (p.name || '').includes(name) || name.includes(p.name || ''));

    const now = new Date().toISOString();
    const order = {
        id: 'ORD-' + Date.now(),
        productName: name,
        productId: matched?.id || '',
        salePrice: salePrice || matched?.salePrice || 0,
        cost: matched?.cost || 0,
        fee: matched?.fee || 5.5,
        profit: 0,
        quantity: parseInt(qtyEl?.value || 1, 10),
        market: marketEl?.value || 'smartstore',
        buyer: (buyerEl?.value || '').trim(),
        status: 'received',
        trackingNo: '',
        trackingCompany: '',
        wholesaleOrderId: '',
        memo: '',
        timeline: [{ status: 'received', at: now, note: '주문 접수' }],
        createdAt: now,
        updatedAt: now,
    };

    // 수익 계산
    if (order.salePrice > 0 && order.cost > 0) {
        const feeAmt = Math.round(order.salePrice * order.fee / 100);
        order.profit = order.salePrice - order.cost - feeAmt;
    }

    T6.orders.unshift(order);
    t6SaveOrders();
    t6RenderDashboard();
    t6RenderOrders();

    // 폼 초기화
    if (nameEl) nameEl.value = '';
    if (priceEl) priceEl.value = '';
    if (buyerEl) buyerEl.value = '';

    showToast(`📥 주문 접수: "${name}"`);
}

// ═══ 주문 상태 변경 (T4-A: 6단계 + T4-F: 정산 연결) ═══
function t6UpdateStatus(orderId, newStatus) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;

    const prevStatus = order.status;
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    // 타임라인 기록
    if (!order.timeline) order.timeline = [];
    order.timeline.push({
        status: newStatus,
        at: order.updatedAt,
        note: `${t6StatusLabel(prevStatus)} → ${t6StatusLabel(newStatus)}`,
    });

    // ★ T4-F: 정산완료 시 → T5 장부 자동 연결
    if (newStatus === 'settled') {
        const feeAmt = Math.round((order.salePrice || 0) * (order.fee || 5.5) / 100);
        const netProfit = (order.salePrice || 0) - (order.cost || 0) - feeAmt;
        order.profit = netProfit;

        AppEventBus.emit('ORDER_SETTLED', {
            orderId: order.id,
            productName: order.productName,
            salePrice: order.salePrice,
            cost: order.cost,
            fee: feeAmt,
            profit: netProfit,
            quantity: order.quantity,
            market: order.market,
            settledAt: order.updatedAt,
        });

        // appState.sales 호환
        if (!window.appState) window.appState = {};
        if (!window.appState.sales) window.appState.sales = [];
        window.appState.sales.push({
            productName: order.productName,
            quantity: order.quantity,
            salePrice: order.salePrice,
            date: order.updatedAt,
        });
    }

    // 배송완료 시 기존 ORDER_COMPLETED 호환
    if (newStatus === 'delivered') {
        AppEventBus.emit('ORDER_COMPLETED', {
            orderId: order.id,
            productName: order.productName,
            salePrice: order.salePrice,
            cost: order.cost,
            profit: order.profit,
            quantity: order.quantity,
            market: order.market,
            completedAt: order.updatedAt,
        });
    }

    // 재고 자동 차감 (발주확인 시)
    if (newStatus === 'confirmed') {
        AppEventBus.emit('ORDER_CONFIRMED', {
            productId: order.productId,
            productName: order.productName,
            quantity: order.quantity,
        });
    }

    t6SaveOrders();
    t6RenderDashboard();
    t6RenderOrders();
    showToast(`${t6StatusLabel(newStatus)} "${order.productName}"`);
}

// ═══ 원클릭 다음 단계 전환 ═══
function t6NextStep(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;
    const idx = T6_PIPELINE_ORDER.indexOf(order.status);
    if (idx < 0 || idx >= T6_PIPELINE_ORDER.length - 1) return;
    t6UpdateStatus(orderId, T6_PIPELINE_ORDER[idx + 1]);
}

// 송장 입력
function t6SetTracking(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;
    const trackNo = prompt('송장번호를 입력하세요:', order.trackingNo || '');
    if (trackNo === null) return;
    order.trackingNo = trackNo.trim();
    const company = prompt('택배사를 선택하세요 (CJ/한진/롯데/우체국/로젠):', order.trackingCompany || 'CJ');
    if (company) order.trackingCompany = company.trim();
    if (trackNo.trim() && order.status === 'confirmed') {
        t6UpdateStatus(orderId, 'preparing');
    } else {
        order.updatedAt = new Date().toISOString();
        t6SaveOrders();
        t6RenderOrders();
    }
    showToast(`🚚 송장 등록: ${trackNo}`);
}

// 주문 삭제
function t6DeleteOrder(orderId) {
    if (!confirm('이 주문을 삭제하시겠습니까?')) return;
    T6.orders = T6.orders.filter(o => o.id !== orderId);
    t6SaveOrders();
    t6RenderDashboard();
    t6RenderOrders();
}

// ═══ 상태 라벨/색상 ═══
function t6StatusLabel(s) {
    const st = T6_STATUSES.find(x => x.id === s);
    return st ? st.label : s;
}
function t6StatusColor(s) {
    const st = T6_STATUSES.find(x => x.id === s);
    return st ? st.color : '#94a3b8';
}

// ═══ 주문 렌더링 ═══
function t6RenderOrders() {
    const el = document.getElementById('t6-order-list');
    if (!el) return;

    let items = [...T6.orders];

    // CS 서브탭이면 CS만, 아니면 파이프라인만
    if (T6.activeSubTab === 'cs') {
        items = items.filter(o => T6_CS_STATUSES.includes(o.status));
    } else {
        items = items.filter(o => !T6_CS_STATUSES.includes(o.status) || T6.filterStatus === o.status);
    }

    // 필터
    if (T6.filterStatus !== 'all') items = items.filter(o => o.status === T6.filterStatus);
    if (T6.filterMarket !== 'all') items = items.filter(o => o.market === T6.filterMarket);
    if (T6.filterDate === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        items = items.filter(o => (o.createdAt || '').startsWith(today));
    } else if (T6.filterDate === 'week') {
        const week = Date.now() - 7 * 86400000;
        items = items.filter(o => new Date(o.createdAt) >= week);
    } else if (T6.filterDate === 'month') {
        const month = new Date().toISOString().slice(0, 7);
        items = items.filter(o => (o.createdAt || '').startsWith(month));
    }

    // 정렬
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!items.length) {
        el.innerHTML = '<div class="t6-empty">주문 내역이 없습니다</div>';
        return;
    }

    el.innerHTML = `<table class="t6-table">
        <thead><tr><th>상태</th><th>주문번호</th><th>상품명</th><th>마켓</th><th style="text-align:right">판매가</th><th style="text-align:right">수익</th><th>구매자</th><th>송장</th><th>다음단계</th><th>액션</th></tr></thead>
        <tbody>${items.map(o => {
            const profitColor = (o.profit || 0) >= 0 ? '#10b981' : '#ef4444';
            const mktInfo = AppConfig?.MARKET_FEES?.[o.market] || {};
            const pipeIdx = T6_PIPELINE_ORDER.indexOf(o.status);
            const hasNext = pipeIdx >= 0 && pipeIdx < T6_PIPELINE_ORDER.length - 1;
            const nextLabel = hasNext ? t6StatusLabel(T6_PIPELINE_ORDER[pipeIdx + 1]) : '';
            return `<tr>
                <td><span style="color:${t6StatusColor(o.status)};font-weight:600;font-size:10px">${t6StatusLabel(o.status)}</span></td>
                <td style="font-size:9px;color:var(--text-muted)">${o.id}</td>
                <td style="font-weight:500">${escapeHtml(o.productName)}</td>
                <td>${mktInfo.icon || ''} <span style="font-size:10px">${mktInfo.name || o.market}</span></td>
                <td style="text-align:right">${fmtWon(o.salePrice)}</td>
                <td style="text-align:right;color:${profitColor};font-weight:600">${fmtWon(o.profit)}</td>
                <td style="font-size:10px">${escapeHtml(o.buyer || '-')}</td>
                <td>${o.trackingNo ? `<span style="font-size:9px;color:#60a5fa" title="${o.trackingCompany || ''}">${o.trackingNo}</span>` : `<button class="t6-mini-btn" onclick="t6SetTracking('${o.id}')">입력</button>`}</td>
                <td>${hasNext ? `<button class="t6-mini-btn t6-btn-next" onclick="t6NextStep('${o.id}')" title="${nextLabel}">${nextLabel}</button>` : '<span style="font-size:9px;color:#10b981">완료</span>'}</td>
                <td>
                    <select onchange="t6UpdateStatus('${o.id}',this.value)" style="font-size:9px;padding:2px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);">
                        ${T6_STATUSES.map(s => `<option value="${s.id}" ${o.status===s.id?'selected':''}>${s.label}</option>`).join('')}
                    </select>
                    <button class="t6-mini-btn" onclick="t6ShowTimeline('${o.id}')" title="타임라인">📋</button>
                    <button class="t6-mini-btn t6-btn-del" onclick="t6DeleteOrder('${o.id}')">삭제</button>
                </td>
            </tr>`;
        }).join('')}</tbody>
    </table>
    <div class="t6-table-footer">${items.length}건 표시</div>`;
}

// ═══ 타임라인 모달 ═══
function t6ShowTimeline(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order || !order.timeline?.length) { showToast('타임라인 기록이 없습니다'); return; }
    const html = order.timeline.map(t => 
        `<div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">
            <span style="color:${t6StatusColor(t.status)};font-size:12px;min-width:80px">${t6StatusLabel(t.status)}</span>
            <span style="font-size:10px;color:var(--text-muted)">${new Date(t.at).toLocaleString('ko-KR')}</span>
            <span style="font-size:10px">${t.note || ''}</span>
        </div>`
    ).join('');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `<div style="background:var(--surface);border-radius:12px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;"><h4 style="margin:0;">📋 ${escapeHtml(order.productName)} — 타임라인</h4><button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text);">✕</button></div>
        ${html}
    </div>`;
    document.body.appendChild(modal);
}

// ═══ 마켓 API 주문 수집 (T4-B) ═══
async function t6FetchOrders() {
    showLoading(true, '마켓 주문 수집 중...');
    try {
        const result = await fetchGasRetry('fetchSmartstoreOrders', {});
        if (result?.orders?.length) {
            let addCount = 0;
            result.orders.forEach(o => {
                if (!T6.orders.find(ex => ex.id === o.orderId)) {
                    const now = new Date().toISOString();
                    T6.orders.unshift({
                        id: o.orderId || 'ORD-' + Date.now(),
                        productName: o.productName || '',
                        salePrice: parseInt(o.salePrice || 0, 10),
                        cost: 0,
                        fee: 5.5,
                        profit: 0,
                        quantity: parseInt(o.quantity || 1, 10),
                        market: o.market || 'smartstore',
                        buyer: o.buyer || '',
                        status: 'received',
                        trackingNo: '',
                        trackingCompany: '',
                        timeline: [{ status: 'received', at: now, note: 'API 자동 수집' }],
                        createdAt: o.orderDate || now,
                        updatedAt: now,
                    });
                    addCount++;
                }
            });
            t6SaveOrders();
            t6RenderDashboard();
            t6RenderOrders();
            showToast(`📦 ${addCount}건 신규 주문 수집 완료`);
        } else {
            showToast('새 주문이 없습니다');
        }
    } catch(e) {
        showToast('주문 수집 실패: ' + e.message, false);
    } finally {
        showLoading(false);
    }
}

// ═══ 서브탭 전환 (주문관리 | CS관리) ═══
function t6SwitchSubTab(tab) {
    T6.activeSubTab = tab;
    T6.filterStatus = 'all';
    document.querySelectorAll('.t6-subtab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    t6RenderOrders();
}

// 필터
function t6SetFilter(key, val) {
    if (key === 'status') T6.filterStatus = val;
    if (key === 'market') T6.filterMarket = val;
    if (key === 'date') T6.filterDate = val;
    document.querySelectorAll(`.t6-filter-${key}`).forEach(b => b.classList.toggle('active', b.dataset.val === val));
    t6RenderOrders();
}

// ═══════════════════════════════════════════════════════════════
// PART D: T4-C 자동발주 / T4-D 송장 자동등록 / T4-E CS 처리
// ═══════════════════════════════════════════════════════════════

// T4-C: 발주확인 시 도매처 자동발주
async function t6AutoOrder(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;
    if (order.status !== 'confirmed') { showToast('발주확인 상태에서만 가능합니다'); return; }

    showLoading(true, `📦 "${order.productName}" 도매처 자동 발주 중...`);
    try {
        const product = JSON.parse(localStorage.getItem('v5-products') || '[]')
            .find(p => p.name === order.productName);

        const result = await fetchGas('autoPlaceWholesaleOrder', {
            productName: order.productName,
            quantity: order.quantity,
            sourceUrl: product?.sourceUrl || '',
            vendor: product?.vendor || '',
        });

        if (result?.success) {
            order.wholesaleOrderId = result.wholesaleOrderId || '';
            order.timeline.push({ status: 'auto-ordered', at: new Date().toISOString(), note: `도매 발주 완료: ${result.wholesaleOrderId || ''}` });
            t6UpdateStatus(orderId, 'preparing');
            showToast(`✅ 도매처 자동 발주 완료`);
        } else {
            showToast(`⚠️ 자동 발주 실패: ${result?.error || ''}`, false);
        }
    } catch(e) {
        showToast(`❌ 자동 발주 오류: ${e.message}`, false);
    } finally {
        showLoading(false);
    }
}

// T4-D: 배송중 전환 시 마켓에 송장 자동 등록
async function t6AutoRegisterTracking(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;
    if (!order.trackingNo) { showToast('송장번호를 먼저 입력하세요'); return; }

    showLoading(true, '📮 마켓에 송장 자동 등록 중...');
    try {
        const result = await fetchGas('smartstoreUpdateTracking', {
            orderId: order.id,
            trackingNo: order.trackingNo,
            trackingCompany: order.trackingCompany || 'CJ대한통운',
            market: order.market || 'smartstore',
        });

        if (result?.success) {
            order.timeline.push({ status: 'tracking-sent', at: new Date().toISOString(), note: `마켓 송장 등록: ${order.trackingNo}` });
            t6SaveOrders();
            showToast(`✅ ${order.market} 송장 자동 등록 완료: ${order.trackingNo}`);
        } else {
            showToast(`⚠️ 송장 등록 실패: ${result?.error || ''}`, false);
        }
    } catch(e) {
        showToast(`❌ 송장 등록 오류: ${e.message}`, false);
    } finally {
        showLoading(false);
    }
}

// T4-E: CS 처리 (교환/반품/환불)
function t6ProcessCS(orderId, csType) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;

    const csLabels = { exchange: '교환', return: '반품', refund: '환불' };
    const reason = prompt(`${csLabels[csType]} 사유를 입력하세요:`);
    if (!reason) return;

    order.status = csType;
    order.csReason = reason;
    order.csCreatedAt = new Date().toISOString();
    order.timeline.push({
        status: csType,
        at: new Date().toISOString(),
        note: `${csLabels[csType]} 접수: ${reason}`,
    });

    // 환불인 경우 장부에 마이너스 기록
    if (csType === 'refund') {
        AppEventBus.emit('LEDGER_UPDATED', {
            type: 'refund',
            orderId: order.id,
            amount: -(order.salePrice || 0),
        });

        const ledger = JSON.parse(localStorage.getItem('v7-ledger') || '[]');
        ledger.unshift({
            id: 'TXN-' + Date.now(),
            type: 'expense',
            category: '환불 처리',
            amount: order.salePrice || 0,
            desc: `[환불] ${order.productName} — ${reason}`,
            date: new Date().toISOString().slice(0, 10),
            orderId: order.id,
            createdAt: new Date().toISOString(),
        });
        localStorage.setItem('v7-ledger', JSON.stringify(ledger));
    }

    t6SaveOrders();
    t6RenderDashboard();
    t6RenderOrders();
    showToast(`${csLabels[csType]} 접수: ${order.productName}`);
}

// CS 완료 처리
function t6ResolveCS(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order || !['exchange', 'return', 'refund'].includes(order.status)) return;

    order.csResolvedAt = new Date().toISOString();
    order.timeline.push({
        status: 'cs-resolved',
        at: new Date().toISOString(),
        note: `CS 처리 완료`,
    });

    // 교환은 다시 배송준비로, 반품/환불은 정산완료로
    if (order.status === 'exchange') {
        order.status = 'preparing';
    } else {
        order.status = 'settled';
    }

    t6SaveOrders();
    t6RenderDashboard();
    t6RenderOrders();
    showToast(`✅ CS 처리 완료: ${order.productName}`);
}

document.addEventListener('DOMContentLoaded', t6Init);

window.t6AddOrder = t6AddOrder;
window.t6UpdateStatus = t6UpdateStatus;
window.t6NextStep = t6NextStep;
window.t6SetTracking = t6SetTracking;
window.t6DeleteOrder = t6DeleteOrder;
window.t6FetchOrders = t6FetchOrders;
window.t6SetFilter = t6SetFilter;
window.t6SwitchSubTab = t6SwitchSubTab;
window.t6ShowTimeline = t6ShowTimeline;
window.t6AutoOrder = t6AutoOrder;
window.t6AutoRegisterTracking = t6AutoRegisterTracking;
window.t6ProcessCS = t6ProcessCS;
window.t6ResolveCS = t6ResolveCS;
window.T6 = T6;
