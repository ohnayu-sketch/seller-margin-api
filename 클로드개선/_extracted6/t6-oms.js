/**
 * T6 OMS 주문관제 — 고도화 모듈
 * 파일: js/t6-oms.js
 * 
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js
 * 
 * 연동: T2 상품 데이터(localStorage 'v5-products')를 읽어 주문과 매칭
 *       주문 완료 시 AppEventBus.emit('ORDER_COMPLETED') → T3 장부 연동
 * 
 * 기능:
 *  1. 주문 대시보드 (오늘 주문/발주/배송/CS 현황)
 *  2. 주문 수집 (마켓 API 연동 or 수동 입력)
 *  3. 주문 상태 관리 (신규→확인→발주→배송→완료→CS)
 *  4. 마켓별 필터 + 상태별 필터 + 날짜별 검색
 *  5. 자동 발주 (도매처 연동)
 *  6. 송장번호 입력/관리
 *  7. CS 대응 (교환/반품/환불)
 *  8. T3 장부 자동 연동
 */

const T6 = {
    orders: [],
    filterStatus: 'all',
    filterMarket: 'all',
    filterDate: 'today',
    sortBy: 'newest',
};

// ─── 초기화 ───
function t6Init() {
    t6LoadOrders();
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

// ═══ 대시보드 ═══
function t6RenderDashboard() {
    const el = document.getElementById('t6-dashboard');
    if (!el) return;

    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = T6.orders.filter(o => (o.createdAt || '').startsWith(today));
    const newCount = T6.orders.filter(o => o.status === 'new').length;
    const shippingCount = T6.orders.filter(o => o.status === 'shipped').length;
    const csCount = T6.orders.filter(o => ['exchange', 'return', 'refund'].includes(o.status)).length;
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.salePrice || 0), 0);
    const todayProfit = todayOrders.filter(o => o.status === 'completed')
        .reduce((s, o) => s + (o.profit || 0), 0);

    el.innerHTML = `<div class="t6-dash-grid">
        <div class="t6-dash-card"><div class="t6-dash-val">${todayOrders.length}</div><div class="t6-dash-label">오늘 주문</div></div>
        <div class="t6-dash-card ${newCount > 0 ? 't6-dash-alert' : ''}"><div class="t6-dash-val" style="color:#f59e0b">${newCount}</div><div class="t6-dash-label">미처리</div></div>
        <div class="t6-dash-card"><div class="t6-dash-val" style="color:#60a5fa">${shippingCount}</div><div class="t6-dash-label">배송중</div></div>
        <div class="t6-dash-card ${csCount > 0 ? 't6-dash-alert' : ''}"><div class="t6-dash-val" style="color:#ef4444">${csCount}</div><div class="t6-dash-label">CS 대응</div></div>
        <div class="t6-dash-card"><div class="t6-dash-val t6-c-green">${fmtWon(todayRevenue)}</div><div class="t6-dash-label">오늘 매출</div></div>
        <div class="t6-dash-card"><div class="t6-dash-val t6-c-green">${fmtWon(todayProfit)}</div><div class="t6-dash-label">오늘 순이익</div></div>
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
        status: 'new', // new/confirmed/ordered/shipped/completed/exchange/return/refund
        trackingNo: '',
        trackingCompany: '',
        wholesaleOrderId: '',
        memo: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

    showToast(`📦 주문 등록: "${name}"`);
}

// ═══ 주문 상태 변경 ═══
function t6UpdateStatus(orderId, newStatus) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    if (newStatus === 'completed') {
        // T3 장부에 판매 기록 전달
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

        // appState.sales에도 추가 (FIFO 연동)
        if (!window.appState) window.appState = {};
        if (!window.appState.sales) window.appState.sales = [];
        window.appState.sales.push({
            productName: order.productName,
            quantity: order.quantity,
            salePrice: order.salePrice,
            date: order.updatedAt,
        });
    }

    t6SaveOrders();
    t6RenderDashboard();
    t6RenderOrders();
    showToast(`${t6StatusLabel(newStatus)} "${order.productName}"`);
}

// 송장 입력
function t6SetTracking(orderId) {
    const order = T6.orders.find(o => o.id === orderId);
    if (!order) return;
    const trackNo = prompt('송장번호를 입력하세요:', order.trackingNo || '');
    if (trackNo === null) return;
    order.trackingNo = trackNo.trim();
    if (trackNo.trim()) order.status = 'shipped';
    order.updatedAt = new Date().toISOString();
    t6SaveOrders();
    t6RenderOrders();
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

// 상태 라벨/색상
function t6StatusLabel(s) {
    const m = { 'new':'🆕 신규','confirmed':'✅ 확인','ordered':'📋 발주','shipped':'🚚 배송중','completed':'✔️ 완료','exchange':'🔄 교환','return':'↩️ 반품','refund':'💸 환불' };
    return m[s] || s;
}
function t6StatusColor(s) {
    const m = { 'new':'#f59e0b','confirmed':'#10b981','ordered':'#3b82f6','shipped':'#60a5fa','completed':'#10b981','exchange':'#f97316','return':'#ef4444','refund':'#ef4444' };
    return m[s] || '#94a3b8';
}

// ═══ 주문 렌더링 ═══
function t6RenderOrders() {
    const el = document.getElementById('t6-order-list');
    if (!el) return;

    let items = [...T6.orders];

    // 필터
    if (T6.filterStatus !== 'all') items = items.filter(o => o.status === T6.filterStatus);
    if (T6.filterMarket !== 'all') items = items.filter(o => o.market === T6.filterMarket);
    if (T6.filterDate === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        items = items.filter(o => (o.createdAt || '').startsWith(today));
    } else if (T6.filterDate === 'week') {
        const week = Date.now() - 7 * 86400000;
        items = items.filter(o => new Date(o.createdAt) >= week);
    }

    // 정렬
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!items.length) {
        el.innerHTML = '<div class="t6-empty">주문 내역이 없습니다</div>';
        return;
    }

    el.innerHTML = `<table class="t6-table">
        <thead><tr><th>상태</th><th>주문번호</th><th>상품명</th><th>마켓</th><th style="text-align:right">판매가</th><th style="text-align:right">수익</th><th>구매자</th><th>송장</th><th>액션</th></tr></thead>
        <tbody>${items.map(o => {
            const profitColor = (o.profit || 0) >= 0 ? '#10b981' : '#ef4444';
            const mktInfo = AppConfig?.MARKET_FEES?.[o.market] || {};
            return `<tr>
                <td><span style="color:${t6StatusColor(o.status)};font-weight:600;font-size:10px">${t6StatusLabel(o.status)}</span></td>
                <td style="font-size:9px;color:var(--text-muted)">${o.id}</td>
                <td style="font-weight:500">${escapeHtml(o.productName)}</td>
                <td>${mktInfo.icon || ''} <span style="font-size:10px">${mktInfo.name || o.market}</span></td>
                <td style="text-align:right">${fmtWon(o.salePrice)}</td>
                <td style="text-align:right;color:${profitColor};font-weight:600">${fmtWon(o.profit)}</td>
                <td style="font-size:10px">${escapeHtml(o.buyer || '-')}</td>
                <td>${o.trackingNo ? `<span style="font-size:9px;color:#60a5fa">${o.trackingNo}</span>` : `<button class="t6-mini-btn" onclick="t6SetTracking('${o.id}')">입력</button>`}</td>
                <td>
                    <select onchange="t6UpdateStatus('${o.id}',this.value)" style="font-size:9px;padding:2px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);">
                        ${['new','confirmed','ordered','shipped','completed','exchange','return','refund'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${t6StatusLabel(s)}</option>`).join('')}
                    </select>
                    <button class="t6-mini-btn t6-btn-del" onclick="t6DeleteOrder('${o.id}')">삭제</button>
                </td>
            </tr>`;
        }).join('')}</tbody>
    </table>
    <div class="t6-table-footer">${items.length}건 표시</div>`;
}

// 마켓 API 주문 수집 (GAS 프록시 경유)
async function t6FetchOrders() {
    showLoading(true, '마켓 주문 수집 중...');
    try {
        const result = await fetchGasRetry('fetchOrders', {});
        if (result?.orders?.length) {
            let addCount = 0;
            result.orders.forEach(o => {
                if (!T6.orders.find(ex => ex.id === o.orderId)) {
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
                        status: 'new',
                        trackingNo: '',
                        createdAt: o.orderDate || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
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

// 필터
function t6SetFilter(key, val) {
    if (key === 'status') T6.filterStatus = val;
    if (key === 'market') T6.filterMarket = val;
    if (key === 'date') T6.filterDate = val;
    document.querySelectorAll(`.t6-filter-${key}`).forEach(b => b.classList.toggle('active', b.dataset.val === val));
    t6RenderOrders();
}

document.addEventListener('DOMContentLoaded', t6Init);

window.t6AddOrder = t6AddOrder;
window.t6UpdateStatus = t6UpdateStatus;
window.t6SetTracking = t6SetTracking;
window.t6DeleteOrder = t6DeleteOrder;
window.t6FetchOrders = t6FetchOrders;
window.t6SetFilter = t6SetFilter;
window.T6 = T6;
