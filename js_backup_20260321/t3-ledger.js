/**
 * T3 통합 자산 장부 — 고도화 모듈
 * 파일: js/t3-ledger.js
 * 
 * 연동: T2 재고(v5-products), T6 주문(ORDER_COMPLETED 이벤트), FIFO
 *       T4 재무가 이 데이터를 읽어서 차트로 시각화
 * 
 * localStorage 키: 'v7-ledger'
 * 
 * 기능:
 *  1. 입출금 대시보드 (총수입/총지출/순이익/예치금)
 *  2. 거래 내역 CRUD (수입/지출/이체)
 *  3. 마켓별 정산 관리
 *  4. OCR 증빙 자동 입력 (카메라)
 *  5. T6 주문 완료 자동 매출 기록
 *  6. 월별/카테고리별 집계
 */

const T3 = {
    entries: [],
    filterType: 'all',   // all/income/expense/transfer
    filterMonth: '',      // YYYY-MM or ''
    sortBy: 'newest',
};

const ENTRY_CATEGORIES = {
    income: ['마켓 정산', '현금 매출', '환불 수수료 보상', '기타 수입'],
    expense: ['도매 매입', '배송비', '포장재', '마켓 수수료', '광고비', '택배비', '기타 지출'],
    transfer: ['계좌 이체', '예치금 충전', '예치금 출금'],
};

function t3Init() {
    t3LoadEntries();
    t3RenderDashboard();
    t3RenderEntries();
    // T4 OMS 배송 완료 수신 → 자동 매출 기록 (하위 호환)
    AppEventBus.on('ORDER_COMPLETED', t3AutoRecordSale);
    // T4 OMS 정산 완료 수신 → 수수료 분리 기록
    AppEventBus.on('ORDER_SETTLED', t3AutoRecordSettlement);
}

function t3LoadEntries() {
    try { T3.entries = JSON.parse(localStorage.getItem('v7-ledger') || '[]'); }
    catch(e) { T3.entries = []; }
}

function t3SaveEntries() {
    localStorage.setItem('v7-ledger', JSON.stringify(T3.entries));
}

// ═══ 대시보드 ═══
function t3RenderDashboard() {
    const el = document.getElementById('t3-dashboard');
    if (!el) return;

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const monthEntries = T3.entries.filter(e => (e.date || '').startsWith(thisMonth));

    const totalIncome = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const entryCount = monthEntries.length;

    // 마켓별 정산
    const products = JSON.parse(localStorage.getItem('v5-products') || '[]');
    const marketSales = {};
    monthEntries.filter(e => e.type === 'income' && e.market).forEach(e => {
        if (!marketSales[e.market]) marketSales[e.market] = 0;
        marketSales[e.market] += e.amount || 0;
    });

    el.innerHTML = `
        <div class="t3-month-label">${now.getFullYear()}년 ${now.getMonth() + 1}월 장부</div>
        <div class="t3-dash-grid">
            <div class="t3-dash-card"><div class="t3-dash-val t3-c-green">${fmtWon(totalIncome)}</div><div class="t3-dash-label">총 수입</div></div>
            <div class="t3-dash-card"><div class="t3-dash-val t3-c-red">${fmtWon(totalExpense)}</div><div class="t3-dash-label">총 지출</div></div>
            <div class="t3-dash-card"><div class="t3-dash-val" style="color:${netProfit >= 0 ? '#10b981' : '#ef4444'}">${fmtWon(netProfit)}</div><div class="t3-dash-label">순이익</div></div>
            <div class="t3-dash-card"><div class="t3-dash-val">${entryCount}건</div><div class="t3-dash-label">이번달 거래</div></div>
        </div>
        ${Object.keys(marketSales).length ? `<div class="t3-market-summary">
            ${Object.entries(marketSales).map(([mk, amt]) => {
                const info = AppConfig?.MARKET_FEES?.[mk] || {};
                return `<span class="t3-mkt-chip">${info.icon || ''} ${info.name || mk} ${fmtWon(amt)}</span>`;
            }).join('')}
        </div>` : ''}
    `;
}

// ═══ 거래 추가 ═══
function t3AddEntry() {
    const type = document.getElementById('t3-entry-type')?.value || 'income';
    const category = document.getElementById('t3-entry-category')?.value || '';
    const amount = parseInt(document.getElementById('t3-entry-amount')?.value || 0, 10);
    const desc = (document.getElementById('t3-entry-desc')?.value || '').trim();
    const date = document.getElementById('t3-entry-date')?.value || new Date().toISOString().slice(0, 10);
    const market = document.getElementById('t3-entry-market')?.value || '';

    if (amount <= 0) { showToast('금액을 입력하세요'); return; }

    T3.entries.unshift({
        id: 'TXN-' + Date.now(),
        type, category, amount, desc, date, market,
        createdAt: new Date().toISOString(),
    });

    t3SaveEntries();
    t3RenderDashboard();
    t3RenderEntries();

    // 폼 초기화
    ['t3-entry-amount', 't3-entry-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    AppEventBus.emit('LEDGER_UPDATED', { type, amount, date });
    showToast(`📒 ${type === 'income' ? '수입' : type === 'expense' ? '지출' : '이체'} ${fmtWon(amount)} 기록`);
}

// T6 주문 완료 → 자동 매출 기록
function t3AutoRecordSale(data) {
    T3.entries.unshift({
        id: 'TXN-' + Date.now(),
        type: 'income',
        category: '마켓 정산',
        amount: data.salePrice || 0,
        desc: `[자동] ${data.productName} (${data.market || '마켓'})`,
        date: (data.completedAt || new Date().toISOString()).slice(0, 10),
        market: data.market || '',
        orderId: data.orderId || '',
        createdAt: new Date().toISOString(),
    });

    // 매입 비용도 자동 기록
    if (data.cost > 0) {
        T3.entries.unshift({
            id: 'TXN-' + (Date.now() + 1),
            type: 'expense',
            category: '도매 매입',
            amount: data.cost,
            desc: `[자동] ${data.productName} 매입원가`,
            date: (data.completedAt || new Date().toISOString()).slice(0, 10),
            orderId: data.orderId || '',
            createdAt: new Date().toISOString(),
        });
    }

    t3SaveEntries();
    t3RenderDashboard();
    t3RenderEntries();
}

// ★ T5-A: T4 정산완료 → 매출/매입/수수료 3건 분리 기록
function t3AutoRecordSettlement(data) {
    const now = new Date().toISOString();
    const date = (data.settledAt || now).slice(0, 10);

    var stTag = data.sourcingType === 'drop' ? '🟢위탁' : (data.sourcingType === 'bulk' ? '📦사입' : '');
    // 1) 매출
    T3.entries.unshift({
        id: 'TXN-' + Date.now(),
        type: 'income',
        category: '마켓 정산',
        amount: data.salePrice || 0,
        desc: `[정산] ${stTag ? stTag + ' ' : ''}${data.productName} (${data.market || '마켓'}) — ${data.orderId}`,
        date, market: data.market || '', orderId: data.orderId || '',
        sourcingType: data.sourcingType || 'unknown',
        createdAt: now,
    });

    // 2) 매입원가
    if (data.cost > 0) {
        T3.entries.unshift({
            id: 'TXN-' + (Date.now() + 1),
            type: 'expense',
            category: data.sourcingType === 'drop' ? '위탁 매입' : '도매 매입',
            amount: data.cost,
            desc: `[정산] ${stTag ? stTag + ' ' : ''}${data.productName} 매입원가`,
            date, orderId: data.orderId || '',
            sourcingType: data.sourcingType || 'unknown',
            createdAt: now,
        });
    }

    // 3) 수수료
    if (data.fee > 0) {
        T3.entries.unshift({
            id: 'TXN-' + (Date.now() + 2),
            type: 'expense',
            category: '마켓 수수료',
            amount: data.fee,
            desc: `[정산] ${data.productName} 수수료 (${data.market || ''})`,
            date, market: data.market || '', orderId: data.orderId || '',
            createdAt: now,
        });
    }

    t3SaveEntries();
    t3RenderDashboard();
    t3RenderEntries();
    AppEventBus.emit('LEDGER_UPDATED', { type: 'settlement', orderId: data.orderId });

    // ★ GAS 동기화 (비동기)
    if (typeof fetchGas === 'function') {
        fetchGas('writeToLedger', {
            entries: [
                { type: 'income', category: '마켓 정산', amount: data.salePrice, desc: data.productName, date, market: data.market },
                { type: 'expense', category: '도매 매입', amount: data.cost, desc: data.productName, date },
                { type: 'expense', category: '마켓 수수료', amount: data.fee, desc: data.productName, date, market: data.market },
            ]
        }).catch(e => console.warn('[T5] GAS 동기화 실패:', e));
    }

    showToast(`📒 정산 기록: ${data.productName} (순이익 ${fmtWon(data.profit || 0)})`);
}

// 거래 삭제
function t3DeleteEntry(id) {
    if (!confirm('이 거래를 삭제하시겠습니까?')) return;
    T3.entries = T3.entries.filter(e => e.id !== id);
    t3SaveEntries();
    t3RenderDashboard();
    t3RenderEntries();
    AppEventBus.emit('LEDGER_UPDATED');
}

// ═══ 거래 렌더링 ═══
function t3RenderEntries() {
    const el = document.getElementById('t3-entry-list');
    if (!el) return;

    let items = [...T3.entries];
    if (T3.filterType !== 'all') items = items.filter(e => e.type === T3.filterType);
    if (T3.filterMonth) items = items.filter(e => (e.date || '').startsWith(T3.filterMonth));
    items.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    if (!items.length) {
        el.innerHTML = '<div class="t3-empty">거래 내역이 없습니다</div>';
        return;
    }

    el.innerHTML = items.map(e => {
        const isIncome = e.type === 'income';
        const color = isIncome ? '#10b981' : e.type === 'expense' ? '#ef4444' : '#60a5fa';
        const sign = isIncome ? '+' : '-';
        const icon = isIncome ? '💰' : e.type === 'expense' ? '💸' : '🔄';
        var stBadge = e.sourcingType === 'drop' ? ' <span style="font-size:8px;color:#4ade80;font-weight:700">🟢위탁</span>' : (e.sourcingType === 'bulk' ? ' <span style="font-size:8px;color:#60a5fa;font-weight:700">📦사입</span>' : '');
        return `<div class="t3-entry-row">
            <div class="t3-entry-date">${(e.date || '').slice(5)}</div>
            <div class="t3-entry-icon">${icon}</div>
            <div class="t3-entry-info">
                <div class="t3-entry-cat">${e.category || '미분류'}${stBadge}</div>
                <div class="t3-entry-desc">${escapeHtml(e.desc || '')}</div>
            </div>
            <div class="t3-entry-amount" style="color:${color}">${sign}${fmtWon(e.amount)}</div>
            <button class="t3-mini-btn t3-btn-del" onclick="t3DeleteEntry('${e.id}')">삭제</button>
        </div>`;
    }).join('');
}

// 카테고리 옵션 업데이트
function t3UpdateCategories() {
    const type = document.getElementById('t3-entry-type')?.value || 'income';
    const catEl = document.getElementById('t3-entry-category');
    if (!catEl) return;
    const cats = ENTRY_CATEGORIES[type] || [];
    catEl.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// 월별 집계 (T4에서 호출)
function t3GetMonthlyAggregates(months) {
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const ym = d.toISOString().slice(0, 7);
        const entries = T3.entries.filter(e => (e.date || '').startsWith(ym));
        result.push({
            month: ym,
            label: `${d.getMonth() + 1}월`,
            income: entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0),
            expense: entries.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0),
        });
    }
    return result;
}

// 필터
function t3SetFilter(key, val) {
    if (key === 'type') T3.filterType = val;
    if (key === 'month') T3.filterMonth = val;
    document.querySelectorAll(`.t3-filter-${key}`).forEach(b => b.classList.toggle('active', b.dataset.val === val));
    t3RenderEntries();
}

document.addEventListener('DOMContentLoaded', t3Init);

window.t3AddEntry = t3AddEntry;
window.t3DeleteEntry = t3DeleteEntry;
window.t3SetFilter = t3SetFilter;
window.t3UpdateCategories = t3UpdateCategories;
window.t3GetMonthlyAggregates = t3GetMonthlyAggregates;
window.t3AutoRecordSettlement = t3AutoRecordSettlement;
window.T3 = T3;
