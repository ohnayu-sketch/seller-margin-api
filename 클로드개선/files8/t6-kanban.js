/**
 * T4 OMS 칸반 보드
 * 파일: js/t6-kanban.js
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js, ui-components.js
 *
 * 기능:
 *  1. 칸반 4칼럼: 접수 / 발주확인 / 배송중 / 완료
 *  2. 6단계 파이프라인: 접수→발주확인→배송준비→배송중→배송완료→정산완료
 *  3. 카드 클릭 → 상태 전환
 *  4. KPI 대시보드
 *  5. 마켓 주문 자동 수집
 *  6. 정산완료 시 T5 장부 자동 연결
 */

const T6Kanban = {
    orders: [],
    statusFlow: ['접수', '발주확인', '배송준비', '배송중', '배송완료', '정산완료'],
    kanbanColumns: [
        { key: 'pending',  label: '접수',     statuses: ['접수'], color: '#3b82f6' },
        { key: 'ordered',  label: '발주확인',  statuses: ['발주확인', '배송준비'], color: '#f59e0b' },
        { key: 'shipping', label: '배송중',    statuses: ['배송중'], color: '#a78bfa' },
        { key: 'done',     label: '완료',      statuses: ['배송완료', '정산완료'], color: '#10b981' },
    ],
    marketIcons: {
        smartstore: { name: '스마트스토어', class: 'mk-ss', color: '#03c75a' },
        coupang:    { name: '쿠팡',        class: 'mk-cp', color: '#e44332' },
        gmarket:    { name: 'G마켓',       class: 'mk-gm', color: '#4285f4' },
        '11st':     { name: '11번가',      class: 'mk-11', color: '#ff0000' },
        tmon:       { name: '티몬',        class: 'mk-tm', color: '#ff5722' },
        wemakeprice:{ name: '위메프',      class: 'mk-wm', color: '#e91e63' },
        auction:    { name: '옥션',        class: 'mk-ac', color: '#ff6f00' },
        kakao:      { name: '카카오',      class: 'mk-kk', color: '#fee500' },
    },
};

// ═══════════════════════════════════════
// 초기화
// ═══════════════════════════════════════

async function t6KanbanInit() {
    t6RenderKPI();
    await t6LoadOrders();
    t6RenderKanban();
}

// ═══════════════════════════════════════
// KPI
// ═══════════════════════════════════════

function t6RenderKPI() {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = T6Kanban.orders.filter(o => (o.date || '').startsWith(today)).length;
    const pending = T6Kanban.orders.filter(o => o.status === '접수').length;
    const shipping = T6Kanban.orders.filter(o => o.status === '배송중').length;

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRevenue = T6Kanban.orders
        .filter(o => (o.date || '').startsWith(thisMonth))
        .reduce((sum, o) => sum + (parseInt(o.price) || 0), 0);

    renderKPIBar('t6-kanban-kpi', [
        { value: todayOrders, label: '오늘 주문', color: '#3b82f6' },
        { value: pending, label: '처리 대기', color: pending > 0 ? '#f59e0b' : '#10b981' },
        { value: shipping, label: '배송중' },
        { value: fmtWon(monthRevenue), label: '이번달 매출', color: '#10b981' },
    ]);
}

// ═══════════════════════════════════════
// 주문 로드
// ═══════════════════════════════════════

async function t6LoadOrders() {
    try {
        const result = await fetchGas('getOrders', { limit: 200 });
        if (result?.orders?.length) {
            T6Kanban.orders = result.orders;
        }
    } catch (e) {
        console.warn('[T6Kanban] 주문 로드 실패:', e);
    }
}

// ═══════════════════════════════════════
// 칸반 렌더링
// ═══════════════════════════════════════

function t6RenderKanban() {
    const container = document.getElementById('t6-kanban-board');
    if (!container) return;

    let html = '<div class="kanban-grid">';

    T6Kanban.kanbanColumns.forEach(col => {
        const colOrders = T6Kanban.orders.filter(o => col.statuses.includes(o.status));

        html += `<div class="kanban-col">
            <div class="kanban-col-header">
                <span style="color:${col.color}">● ${col.label}</span>
                <span class="kanban-col-count">${colOrders.length}</span>
            </div>
            <div class="kanban-col-body">`;

        if (!colOrders.length) {
            html += '<div class="kanban-empty">주문 없음</div>';
        }

        colOrders.forEach(order => {
            const mkt = T6Kanban.marketIcons[order.market] || { name: order.market || '', color: '#94a3b8' };
            const timeAgo = _timeAgo(order.date);
            const isDone = col.key === 'done';

            html += `<div class="kanban-card ${isDone ? 'done' : ''}" onclick="t6ShowOrderDetail('${order.id}')">
                <div class="kc-top">
                    <span class="kc-product">${escapeHtml(order.product || '')}</span>
                    <span class="kc-price" style="color:${col.color}">${fmt(order.price || 0)}</span>
                </div>
                <div class="kc-market" style="background:${mkt.color}20;color:${mkt.color}">${mkt.name}</div>
                <div class="kc-meta">
                    <span>${escapeHtml(order.buyer || '')}</span>
                    <span style="color:${col.color}">${timeAgo}</span>
                </div>
            </div>`;
        });

        html += `</div></div>`;
    });

    html += '</div>';

    // 액션 버튼
    html += `<div class="kanban-actions">
        <button class="kanban-btn-primary" onclick="t6FetchMarketOrders()">마켓 주문 수집</button>
        <button class="kanban-btn-secondary" onclick="t6BatchAdvance()">미처리 일괄 발주</button>
    </div>`;

    // 수동 주문 등록 (아코디언)
    html += `<div class="accordion" onclick="toggleAccordion(this)">
        <div class="accordion-header">▸ 수동 주문 등록</div>
        <div class="accordion-body" style="display:none">
            <div id="t6-manual-order-form"></div>
        </div>
    </div>`;

    container.innerHTML = html;

    // 수동 등록 폼 렌더
    t6RenderManualForm();
}

function t6RenderManualForm() {
    const el = document.getElementById('t6-manual-order-form');
    if (!el) return;

    el.innerHTML = `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-bottom:8px">
            <div><label style="font-size:10px;color:#64748b">상품명</label>
                <input type="text" id="t6-new-product" placeholder="상품명" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(22,25,32,0.8);color:#e2e8f0;font-size:11px"></div>
            <div><label style="font-size:10px;color:#64748b">판매가</label>
                <input type="number" id="t6-new-price" placeholder="0" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(22,25,32,0.8);color:#e2e8f0;font-size:11px"></div>
            <div><label style="font-size:10px;color:#64748b">마켓</label>
                <select id="t6-new-market" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(22,25,32,0.8);color:#e2e8f0;font-size:10px">
                    <option value="smartstore">스마트스토어</option><option value="coupang">쿠팡</option>
                    <option value="gmarket">G마켓</option><option value="11st">11번가</option>
                </select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px">
            <div><label style="font-size:10px;color:#64748b">구매자</label>
                <input type="text" id="t6-new-buyer" placeholder="구매자명" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(22,25,32,0.8);color:#e2e8f0;font-size:11px"></div>
            <div><label style="font-size:10px;color:#64748b">수량</label>
                <input type="number" id="t6-new-qty" value="1" min="1" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(22,25,32,0.8);color:#e2e8f0;font-size:11px"></div>
            <button onclick="t6AddManualOrder()" style="padding:6px 14px;border-radius:8px;border:none;background:#10b981;color:#0d0f14;font-size:11px;font-weight:700;cursor:pointer;align-self:end">등록</button>
        </div>`;
}

// ═══════════════════════════════════════
// 주문 상태 전환
// ═══════════════════════════════════════

function t6ShowOrderDetail(orderId) {
    const order = T6Kanban.orders.find(o => o.id === orderId);
    if (!order) return;

    const currentIdx = T6Kanban.statusFlow.indexOf(order.status);
    const nextStatus = currentIdx < T6Kanban.statusFlow.length - 1 ? T6Kanban.statusFlow[currentIdx + 1] : null;

    // 간단한 확인 후 다음 상태로 전환
    if (nextStatus) {
        const confirmed = confirm(`"${order.product}"\n\n현재: ${order.status}\n→ 다음: ${nextStatus}\n\n변경하시겠습니까?`);
        if (confirmed) {
            t6AdvanceOrder(orderId, nextStatus);
        }
    } else {
        showToast('이미 최종 단계(정산완료)입니다');
    }
}

async function t6AdvanceOrder(orderId, newStatus) {
    try {
        await fetchGas('updateOrderStatus', { orderId, status: newStatus });

        const order = T6Kanban.orders.find(o => o.id === orderId);
        if (order) {
            order.status = newStatus;

            // 정산완료 시 → T5 장부에 자동 기록
            if (newStatus === '정산완료') {
                const fee = AppConfig.MARKET_FEES[order.market]?.fee || 5.5;
                const revenue = (parseInt(order.price) || 0) * (parseInt(order.qty) || 1);
                const commission = Math.round(revenue * fee / 100);

                AppEventBus.emit('ORDER_SETTLED', {
                    orderId: order.id,
                    product: order.product,
                    market: order.market,
                    revenue: revenue,
                    commission: commission,
                    netIncome: revenue - commission,
                    date: new Date().toISOString(),
                });
            }
        }

        t6RenderKPI();
        t6RenderKanban();
        showToast(`주문 상태 변경: ${newStatus}`);
    } catch (e) {
        showToast('상태 변경 실패: ' + e.message, false);
    }
}

// ═══════════════════════════════════════
// 마켓 주문 수집
// ═══════════════════════════════════════

async function t6FetchMarketOrders() {
    showToast('마켓 주문 수집 중...');

    try {
        const result = await fetchGas('fetchSmartstoreOrders', {});
        if (result?.orders?.length) {
            const newCount = result.orders.length;
            result.orders.forEach(order => {
                if (!T6Kanban.orders.find(o => o.id === order.id)) {
                    T6Kanban.orders.push({ ...order, status: '접수' });
                }
            });
            t6RenderKPI();
            t6RenderKanban();
            showToast(`신규 주문 ${newCount}건 수집 완료`);
        } else {
            showToast('새 주문이 없습니다');
        }
    } catch (e) {
        showToast('주문 수집 실패: ' + e.message, false);
    }
}

// ═══════════════════════════════════════
// 일괄 발주
// ═══════════════════════════════════════

async function t6BatchAdvance() {
    const pending = T6Kanban.orders.filter(o => o.status === '접수');
    if (!pending.length) { showToast('처리 대기 주문이 없습니다'); return; }

    const confirmed = confirm(`${pending.length}건의 접수 주문을 "발주확인"으로 일괄 전환합니다.`);
    if (!confirmed) return;

    for (const order of pending) {
        await t6AdvanceOrder(order.id, '발주확인');
        await new Promise(r => setTimeout(r, 200));
    }

    showToast(`${pending.length}건 일괄 발주 완료`);
}

// ═══════════════════════════════════════
// 수동 주문 등록
// ═══════════════════════════════════════

async function t6AddManualOrder() {
    const product = document.getElementById('t6-new-product')?.value?.trim();
    const price = parseInt(document.getElementById('t6-new-price')?.value) || 0;
    const market = document.getElementById('t6-new-market')?.value || 'smartstore';
    const buyer = document.getElementById('t6-new-buyer')?.value?.trim() || '';
    const qty = parseInt(document.getElementById('t6-new-qty')?.value) || 1;

    if (!product) { showToast('상품명을 입력하세요'); return; }

    const order = {
        id: 'manual_' + Date.now(),
        product, price, market, buyer, qty,
        status: '접수',
        date: new Date().toISOString(),
    };

    try {
        await fetchGas('addOrder', order);
        T6Kanban.orders.push(order);
        t6RenderKPI();
        t6RenderKanban();
        showToast(`주문 등록: ${product}`);
    } catch (e) {
        showToast('주문 등록 실패: ' + e.message, false);
    }
}

// ═══════════════════════════════════════
// 유틸
// ═══════════════════════════════════════

function _timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return mins + '분 전';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + '시간 전';
    return Math.floor(hours / 24) + '일 전';
}

// ═══════════════════════════════════════
// 초기화
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', t6KanbanInit);

window.T6Kanban = T6Kanban;
window.t6KanbanInit = t6KanbanInit;
window.t6ShowOrderDetail = t6ShowOrderDetail;
window.t6AdvanceOrder = t6AdvanceOrder;
window.t6FetchMarketOrders = t6FetchMarketOrders;
window.t6BatchAdvance = t6BatchAdvance;
window.t6AddManualOrder = t6AddManualOrder;
