/**
 * T5 통합 자산 장부 — 자동 기록 + KPI
 * 파일: js/t3-auto-entry.js
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, ui-components.js
 */

const T3Auto = {
    monthlyData: null,
};

// ═══════════════════════════════════════
// 자동 기록 수신
// ═══════════════════════════════════════

// T4 정산완료 → 수입 자동 기록
function t3AutoIncome(data) {
    if (!data) return;

    const entry = {
        type: 'income',
        category: '마켓 정산',
        amount: data.revenue || 0,
        description: `[자동] ${data.product || ''} · ${AppConfig.MARKET_FEES[data.market]?.name || data.market}`,
        market: data.market || '',
        date: data.date || new Date().toISOString(),
        auto: true,
    };

    // GAS에 기록
    fetchGas('autoLedgerEntry', entry).then(() => {
        showToast(`장부 자동 기록: 수입 +${fmtWon(entry.amount)}`);
        t3RefreshDashboard();
    }).catch(e => console.warn('[T3Auto] 수입 기록 실패:', e));
}

// T2 상품 입고 → 지출 자동 기록
function t3AutoExpense(data) {
    if (!data) return;

    const entry = {
        type: 'expense',
        category: '상품 매입',
        amount: data.cost || 0,
        description: `[자동] ${data.name || ''} ${data.qty || 1}개 · ${data.source || ''}`,
        date: data.date || new Date().toISOString(),
        auto: true,
    };

    fetchGas('autoLedgerEntry', entry).then(() => {
        showToast(`장부 자동 기록: 지출 -${fmtWon(entry.amount)}`);
        t3RefreshDashboard();
    }).catch(e => console.warn('[T3Auto] 지출 기록 실패:', e));
}

// 이벤트 리스너 등록
if (typeof AppEventBus !== 'undefined') {
    AppEventBus.on('ORDER_SETTLED', t3AutoIncome);
    AppEventBus.on('PRODUCT_STOCKED', t3AutoExpense);
}

// ═══════════════════════════════════════
// KPI 바 + 마켓별 미니바
// ═══════════════════════════════════════

async function t3RefreshDashboard() {
    try {
        const thisMonth = new Date().toISOString().slice(0, 7);
        const result = await fetchGas('getMonthlySettlement', { yearMonth: thisMonth });
        if (result) T3Auto.monthlyData = result;
    } catch (e) {
        console.warn('[T3Auto] 대시보드 갱신 실패:', e);
    }
    t3RenderKPI();
    t3RenderMarketBars();
}

function t3RenderKPI() {
    const d = T3Auto.monthlyData;
    if (!d) {
        renderKPIBar('t3-dashboard', [
            { value: '-', label: '이번달 수입' },
            { value: '-', label: '이번달 지출' },
            { value: '-', label: '이번달 순이익' },
            { value: '-', label: '전월 대비' },
        ]);
        return;
    }

    const income = d.totalIncome || 0;
    const expense = d.totalExpense || 0;
    const net = income - expense;
    const prevNet = d.prevMonthNet || 0;
    const changeRate = prevNet > 0 ? Math.round((net / prevNet - 1) * 100) : 0;
    const changeStr = (changeRate >= 0 ? '+' : '') + changeRate + '%';

    renderKPIBar('t3-dashboard', [
        { value: fmtWon(income), label: '이번달 수입', color: '#10b981' },
        { value: fmtWon(expense), label: '이번달 지출', color: '#ef4444' },
        { value: fmtWon(net), label: '이번달 순이익', color: net >= 0 ? '#fbbf24' : '#ef4444' },
        { value: changeStr, label: '전월 대비', color: changeRate >= 0 ? '#10b981' : '#ef4444' },
    ]);
}

function t3RenderMarketBars() {
    const el = document.getElementById('t3-market-bars');
    if (!el) return;

    const d = T3Auto.monthlyData;
    if (!d?.marketBreakdown?.length) {
        el.innerHTML = '';
        return;
    }

    const maxVal = Math.max(...d.marketBreakdown.map(m => m.amount || 0), 1);

    el.innerHTML = d.marketBreakdown.map(m => {
        const mkt = AppConfig.MARKET_FEES[m.market] || { name: m.market, color: '#94a3b8' };
        const pct = Math.round((m.amount / maxVal) * 100);
        return `<div class="mbar-row">
            <span class="mbar-name">${mkt.icon || ''} ${mkt.name}</span>
            <div class="mbar-track"><div class="mbar-fill" style="width:${pct}%;background:${mkt.color}"></div></div>
            <span class="mbar-val" style="color:${mkt.color}">${fmtWon(m.amount)}</span>
        </div>`;
    }).join('');
}

// ═══════════════════════════════════════
// 월별 마감
// ═══════════════════════════════════════

async function t3MonthlyClose() {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const confirmed = confirm(`${thisMonth} 이번달을 마감합니다.\n마감 후에는 해당 월 거래 수정 시 경고가 표시됩니다.`);
    if (!confirmed) return;

    try {
        await fetchGas('closeMonth', { yearMonth: thisMonth });
        showToast(`${thisMonth} 마감 완료`);
    } catch (e) {
        showToast('월 마감 실패: ' + e.message, false);
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(t3RefreshDashboard, 500);
});

window.T3Auto = T3Auto;
window.t3RefreshDashboard = t3RefreshDashboard;
window.t3MonthlyClose = t3MonthlyClose;
