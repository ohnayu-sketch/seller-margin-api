/**
 * T4 재무 인사이트 — 고도화 모듈
 * 파일: js/t4-finance.js
 * 
 * 연동: T3 장부(t3GetMonthlyAggregates), T2 재고(v5-products FIFO)
 *       Chart.js CDN 필요
 * 
 * 기능:
 *  1. 월별 매출/지출/순이익 차트 (Chart.js)
 *  2. 마켓별 수익 비교 차트 (도넛)
 *  3. ROI 분석 (투자 대비 수익률)
 *  4. 손익분기점 계산기
 *  5. 재고 자산 가치 추이
 *  6. 카테고리별 지출 분석
 */

const T4 = {
    charts: {},
    period: 6, // 최근 N개월
};

function t4Init() {
    AppEventBus.on('LEDGER_UPDATED', () => setTimeout(t4Refresh, 300));
    t4Refresh();
}

function t4Refresh() {
    t4RenderSummaryCards();
    t4RenderRevenueChart();
    t4RenderMarketChart();
    t4RenderExpenseChart();
    t4RenderROI();
    t4RenderBreakEven();
}

// ═══ 요약 카드 ═══
function t4RenderSummaryCards() {
    const el = document.getElementById('t4-summary');
    if (!el) return;

    const agg = (typeof t3GetMonthlyAggregates === 'function') ? t3GetMonthlyAggregates(1) : [];
    const thisMonth = agg[0] || { income: 0, expense: 0 };
    const net = thisMonth.income - thisMonth.expense;
    const roi = thisMonth.expense > 0 ? ((net / thisMonth.expense) * 100).toFixed(1) : 0;

    // 재고 자산
    const products = JSON.parse(localStorage.getItem('v5-products') || '[]');
    const inventoryValue = products.reduce((s, p) => s + ((p.cost || 0) * (p.quantity || 1)), 0);

    el.innerHTML = `<div class="t4-dash-grid">
        <div class="t4-dash-card"><div class="t4-dash-val t4-c-green">${fmtWon(thisMonth.income)}</div><div class="t4-dash-label">이번달 매출</div></div>
        <div class="t4-dash-card"><div class="t4-dash-val t4-c-red">${fmtWon(thisMonth.expense)}</div><div class="t4-dash-label">이번달 지출</div></div>
        <div class="t4-dash-card"><div class="t4-dash-val" style="color:${net >= 0 ? '#10b981' : '#ef4444'}">${fmtWon(net)}</div><div class="t4-dash-label">순이익</div></div>
        <div class="t4-dash-card"><div class="t4-dash-val" style="color:${roi >= 20 ? '#10b981' : roi >= 0 ? '#f59e0b' : '#ef4444'}">${roi}%</div><div class="t4-dash-label">ROI</div></div>
        <div class="t4-dash-card"><div class="t4-dash-val">${fmtWon(inventoryValue)}</div><div class="t4-dash-label">재고 자산</div></div>
    </div>`;
}

// ═══ 월별 매출/지출 차트 (Bar + Line) ═══
function t4RenderRevenueChart() {
    const canvas = document.getElementById('t4-revenue-chart');
    if (!canvas) return;

    const data = (typeof t3GetMonthlyAggregates === 'function') ? t3GetMonthlyAggregates(T4.period) : [];

    if (T4.charts.revenue) T4.charts.revenue.destroy();
    T4.charts.revenue = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [
                { label: '매출', data: data.map(d => d.income), backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 6 },
                { label: '지출', data: data.map(d => d.expense), backgroundColor: 'rgba(239,68,68,0.4)', borderRadius: 6 },
                { label: '순이익', data: data.map(d => d.income - d.expense), type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 4, tension: 0.3 },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { ticks: { color: '#64748b', callback: v => (v/10000).toFixed(0) + '만' }, grid: { color: 'rgba(255,255,255,0.03)' } }
            }
        }
    });
}

// ═══ 마켓별 수익 도넛 ═══
function t4RenderMarketChart() {
    const canvas = document.getElementById('t4-market-chart');
    if (!canvas) return;

    const ledger = JSON.parse(localStorage.getItem('v7-ledger') || '[]');
    const marketTotals = {};
    ledger.filter(e => e.type === 'income' && e.market).forEach(e => {
        const info = AppConfig?.MARKET_FEES?.[e.market] || {};
        const name = info.name || e.market;
        marketTotals[name] = (marketTotals[name] || 0) + (e.amount || 0);
    });

    const labels = Object.keys(marketTotals);
    const values = Object.values(marketTotals);
    const colors = ['#10b981', '#e44332', '#4285f4', '#ff6f00', '#ff0000', '#e91e63', '#ff5722', '#fee500'];

    if (!labels.length) {
        canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:11px;">마켓별 매출 데이터가 없습니다</div>';
        return;
    }

    if (T4.charts.market) T4.charts.market.destroy();
    T4.charts.market = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 12 } } },
            cutout: '60%',
        }
    });
}

// ═══ 카테고리별 지출 ═══
function t4RenderExpenseChart() {
    const canvas = document.getElementById('t4-expense-chart');
    if (!canvas) return;

    const ledger = JSON.parse(localStorage.getItem('v7-ledger') || '[]');
    const catTotals = {};
    const thisMonth = new Date().toISOString().slice(0, 7);
    ledger.filter(e => e.type === 'expense' && (e.date || '').startsWith(thisMonth)).forEach(e => {
        const cat = e.category || '기타';
        catTotals[cat] = (catTotals[cat] || 0) + (e.amount || 0);
    });

    const labels = Object.keys(catTotals);
    const values = Object.values(catTotals);
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#84cc16'];

    if (!labels.length) return;

    if (T4.charts.expense) T4.charts.expense.destroy();
    T4.charts.expense = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#64748b', callback: v => (v/10000).toFixed(0) + '만' }, grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
            }
        }
    });
}

// ═══ ROI 분석 ═══
function t4RenderROI() {
    const el = document.getElementById('t4-roi-panel');
    if (!el) return;

    const data = (typeof t3GetMonthlyAggregates === 'function') ? t3GetMonthlyAggregates(T4.period) : [];
    if (!data.length) { el.innerHTML = '<div class="t4-empty">데이터가 없습니다</div>'; return; }

    let html = '<div class="t4-roi-list">';
    data.forEach(d => {
        const net = d.income - d.expense;
        const roi = d.expense > 0 ? ((net / d.expense) * 100).toFixed(1) : 0;
        const roiColor = roi >= 30 ? '#10b981' : roi >= 10 ? '#f59e0b' : '#ef4444';
        const barWidth = Math.min(Math.abs(roi), 100);
        html += `<div class="t4-roi-row">
            <span class="t4-roi-month">${d.label}</span>
            <div class="t4-roi-bar-wrap"><div class="t4-roi-bar" style="width:${barWidth}%;background:${roiColor}"></div></div>
            <span class="t4-roi-val" style="color:${roiColor}">${roi}%</span>
            <span class="t4-roi-net">${fmtWon(net)}</span>
        </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
}

// ═══ 손익분기점 계산기 ═══
function t4RenderBreakEven() {
    const el = document.getElementById('t4-bep-result');
    if (!el) return;

    const target = parseInt(document.getElementById('t4-bep-target')?.value || 0, 10);
    const avgProfit = parseInt(document.getElementById('t4-bep-avg-profit')?.value || 0, 10);

    if (target <= 0 || avgProfit <= 0) {
        el.innerHTML = '';
        return;
    }

    const bepQty = Math.ceil(target / avgProfit);
    const bepDaily = (bepQty / 30).toFixed(1);
    const bepRevenue = bepQty * (avgProfit * 3); // 대략 마진30% 가정시 매출

    el.innerHTML = `<div class="t4-bep-grid">
        <div class="t4-bep-card"><div class="t4-bep-val t4-c-green">${bepQty}개</div><div class="t4-bep-label">필요 판매량/월</div></div>
        <div class="t4-bep-card"><div class="t4-bep-val">${bepDaily}개</div><div class="t4-bep-label">일 평균 판매</div></div>
    </div>`;
}

function t4SetPeriod(months) {
    T4.period = months;
    t4Refresh();
    document.querySelectorAll('.t4-period-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.months) === months));
}

document.addEventListener('DOMContentLoaded', t4Init);

window.t4Refresh = t4Refresh;
window.t4SetPeriod = t4SetPeriod;
window.t4RenderBreakEven = t4RenderBreakEven;
window.T4 = T4;
