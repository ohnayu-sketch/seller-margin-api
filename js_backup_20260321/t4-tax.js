/**
 * T6 재무 인사이트 — 세무 분석
 * 파일: js/t4-tax.js
 * 의존성: fetch-gas.js, ui-helpers.js, ui-components.js, config.js
 */

const T4Tax = {
    annualData: null,
    taxType: 'simplified', // simplified(간이) / general(일반)
};

const VAT_THRESHOLDS = {
    safe: 64000000,     // 6400만원 이하: 안전
    warning: 72000000,  // 7200만원: 주의
    limit: 80000000,    // 8000만원: 전환 의무
};

// ═══════════════════════════════════════
// 사업자 현황 카드
// ═══════════════════════════════════════

async function t4RenderBusinessCard() {
    const el = document.getElementById('t4-business-card');
    if (!el) return;

    try {
        const result = await fetchGas('getAnnualSalesSummary', { year: new Date().getFullYear() });
        if (result) T4Tax.annualData = result;
    } catch (e) {
        console.warn('[T4Tax] 연 매출 데이터 로드 실패:', e);
    }

    const data = T4Tax.annualData;
    if (!data) {
        el.innerHTML = '<div style="padding:12px;color:#64748b;font-size:11px">데이터 로딩 중...</div>';
        return;
    }

    const annual = data.annualSales || 0;
    const pct = Math.min(100, Math.round((annual / VAT_THRESHOLDS.limit) * 100));
    const remaining = Math.max(0, VAT_THRESHOLDS.limit - annual);

    let statusLabel, statusColor, statusBg;
    if (annual >= VAT_THRESHOLDS.limit) {
        statusLabel = '전환 필요';
        statusColor = '#ef4444';
        statusBg = 'rgba(239,68,68,0.1)';
    } else if (annual >= VAT_THRESHOLDS.warning) {
        statusLabel = '위험';
        statusColor = '#ef4444';
        statusBg = 'rgba(239,68,68,0.1)';
    } else if (annual >= VAT_THRESHOLDS.safe) {
        statusLabel = '주의';
        statusColor = '#f59e0b';
        statusBg = 'rgba(245,158,11,0.1)';
    } else {
        statusLabel = '안전';
        statusColor = '#10b981';
        statusBg = 'rgba(16,185,129,0.1)';
    }

    const barColor = annual >= VAT_THRESHOLDS.warning ? '#ef4444'
        : annual >= VAT_THRESHOLDS.safe ? '#f59e0b' : '#10b981';

    el.innerHTML = `
        <div style="background:rgba(22,25,32,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:11px;color:#94a3b8">과세 유형: <strong style="color:#e2e8f0">간이과세자</strong></span>
                <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${statusBg};color:${statusColor}">${statusLabel}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                <span style="color:#64748b">연 누적 매출</span>
                <span style="font-weight:700">${fmtWon(annual)} / ${fmtWon(VAT_THRESHOLDS.limit)}</span>
            </div>
            <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .3s"></div>
            </div>
            <div style="text-align:right;font-size:9px;color:#64748b;margin-top:4px">한도까지 ${fmtWon(remaining)} 남음 (${pct}%)</div>
        </div>`;
}

// ═══════════════════════════════════════
// 간이 vs 일반 과세자 비교
// ═══════════════════════════════════════

function t4RenderVatComparison() {
    const el = document.getElementById('t4-vat-compare');
    if (!el) return;

    const data = T4Tax.annualData;
    if (!data) {
        el.innerHTML = '<div style="font-size:11px;color:#64748b">연 매출 데이터가 필요합니다</div>';
        return;
    }

    const sales = data.annualSales || 0;
    const cost = data.annualCost || 0;

    // 간이과세자 납부세액 (업종별 부가율 15% × 10%)
    const simplifiedVat = Math.round(sales * 0.015);

    // 일반과세자 납부세액
    const generalVat = Math.round((sales / 1.1) * 0.1 - (cost / 1.1) * 0.1);

    const diff = simplifiedVat - generalVat;
    const recommendation = diff > 0
        ? { text: '일반과세자가 유리', color: '#3b82f6', amount: diff }
        : { text: '간이과세자 유지', color: '#10b981', amount: Math.abs(diff) };

    el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div style="background:rgba(22,25,32,0.5);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:10px;color:#64748b;margin-bottom:4px">간이과세자 납부세액</div>
                <div style="font-size:18px;font-weight:800;color:#f59e0b">${fmtWon(simplifiedVat)}</div>
                <div style="font-size:9px;color:#64748b;margin-top:2px">매출 × 1.5%</div>
            </div>
            <div style="background:rgba(22,25,32,0.5);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:10px;color:#64748b;margin-bottom:4px">일반과세자 납부세액</div>
                <div style="font-size:18px;font-weight:800;color:#3b82f6">${fmtWon(Math.max(0, generalVat))}</div>
                <div style="font-size:9px;color:#64748b;margin-top:2px">(매출-매입) × 10%</div>
            </div>
        </div>
        <div style="text-align:center;padding:10px;border-radius:8px;background:rgba(22,25,32,0.3)">
            <span style="font-size:12px;font-weight:700;color:${recommendation.color}">${recommendation.text}</span>
            <span style="font-size:11px;color:#94a3b8"> — 연 ${fmtWon(recommendation.amount)} 절세</span>
        </div>`;
}

// ═══════════════════════════════════════
// 상품별 ROI 분석
// ═══════════════════════════════════════

async function t4RenderProductROI() {
    const el = document.getElementById('t4-product-roi');
    if (!el) return;

    try {
        const result = await fetchGas('getProductROI', {});
        if (!result?.products?.length) {
            el.innerHTML = '<div style="font-size:11px;color:#64748b">판매 데이터가 없습니다</div>';
            return;
        }

        const products = result.products.sort((a, b) => (b.roi || 0) - (a.roi || 0));

        let html = `<table style="width:100%;border-collapse:collapse;font-size:10px">
            <thead><tr style="color:#64748b;border-bottom:1px solid rgba(255,255,255,0.06)">
                <th style="text-align:left;padding:6px 4px">상품명</th>
                <th style="text-align:right;padding:6px 4px">소싱비용</th>
                <th style="text-align:right;padding:6px 4px">총매출</th>
                <th style="text-align:right;padding:6px 4px">순이익</th>
                <th style="text-align:right;padding:6px 4px">ROI</th>
            </tr></thead><tbody>`;

        products.forEach(p => {
            const roiColor = (p.roi || 0) > 0 ? '#10b981' : '#ef4444';
            html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">
                <td style="padding:5px 4px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</td>
                <td style="text-align:right;padding:5px 4px">${fmtWon(p.cost)}</td>
                <td style="text-align:right;padding:5px 4px">${fmtWon(p.revenue)}</td>
                <td style="text-align:right;padding:5px 4px;color:${roiColor}">${fmtWon(p.netIncome)}</td>
                <td style="text-align:right;padding:5px 4px;font-weight:700;color:${roiColor}">${p.roi}%</td>
            </tr>`;
        });

        html += `</tbody></table>`;
        el.innerHTML = html;

    } catch (e) {
        el.innerHTML = '<div style="font-size:11px;color:#ef4444">ROI 데이터 로드 실패</div>';
    }
}

// ═══════════════════════════════════════
// 세후 실질 수익
// ═══════════════════════════════════════

function t4CalcAfterTaxIncome() {
    const data = T4Tax.annualData;
    if (!data) return 0;

    const monthlyNet = (data.annualSales - (data.annualCost || 0)) / 12;
    const monthlyVat = Math.round(data.annualSales * 0.015 / 12); // 간이과세자 기준
    return Math.max(0, Math.round(monthlyNet - monthlyVat));
}

// ═══════════════════════════════════════
// 초기화
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        t4RenderBusinessCard();
    }, 800);
});

window.T4Tax = T4Tax;
window.t4RenderBusinessCard = t4RenderBusinessCard;
window.t4RenderVatComparison = t4RenderVatComparison;
window.t4RenderProductROI = t4RenderProductROI;
window.t4CalcAfterTaxIncome = t4CalcAfterTaxIncome;
