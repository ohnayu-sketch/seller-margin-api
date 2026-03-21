/**
 * T2 재고/사입 관제 — 고도화 모듈
 * 파일: js/t2-inventory.js
 * 
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js
 * 
 * 기능:
 *  1. 재고 대시보드 (총 재고 가치, 상품 수, 입고/출고 현황)
 *  2. 상품 관리 (카드뷰/리스트뷰 전환, 상태별 필터)
 *  3. 마진 시뮬레이터 (온라인 위탁 + 해외 사입 + 현장 사입)
 *  4. FIFO 재고 단가 엔진
 *  5. 위탁↔사입 전환 시뮬레이션
 *  6. 공급업체 관리
 *  7. T1→T2 수신 대기열 + T2→T3 전달 파이프라인
 */

// ─── 상태 관리 ───
const T2 = {
    products: [],           // 전체 상품 배열
    vendors: [],            // 공급업체 배열
    viewMode: 'card',       // 'card' | 'list'
    filterStatus: 'all',    // all/sourcing/stocked/selling/soldout
    sortBy: 'newest',       // newest/margin/price/stock
    simMode: 'consign',     // 'consign' | 'global' | 'field'
    pendingQueue: [],       // T1에서 넘어온 대기 상품
};

// ─── 초기화 ───
function t2Init() {
    t2LoadProducts();
    t2LoadVendors();
    t2InitEventListeners();
    t2RenderDashboard();
    t2RenderProducts();
    setTimeout(t2RenderRebalance, 500); // 리밸런싱 추천
}

function t2InitEventListeners() {
    // T1에서 상품 수신
    AppEventBus.on('PRODUCT_SOURCED', (data) => {
        t2AddToPendingQueue(data);
    });

    // 마진 계산 실시간 연동
    const inputs = ['t2-cost', 't2-supply-ship', 't2-market-ship', 't2-fee', 't2-sale-price'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', debounce(t2RecalcMargin, 200));
    });
}

// ═══════════════════════════════════════════════════════════════
// PART 1: 재고 대시보드
// ═══════════════════════════════════════════════════════════════

function t2RenderDashboard() {
    const products = T2.products;
    const total = products.length;
    const stocked = products.filter(p => p.status === 'stocked' || p.status === 'selling');
    const totalValue = stocked.reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 1)), 0);
    const totalQty = stocked.reduce((sum, p) => sum + (p.quantity || 1), 0);
    const avgMargin = products.length ? Math.round(products.reduce((s, p) => s + (p.margin || 0), 0) / products.length) : 0;
    const pendingCount = T2.pendingQueue.length;

    const el = document.getElementById('t2-dashboard');
    if (!el) return;

    el.innerHTML = `
        <div class="t2-dash-grid">
            <div class="t2-dash-card">
                <div class="t2-dash-val">${total}</div>
                <div class="t2-dash-label">전체 상품</div>
            </div>
            <div class="t2-dash-card">
                <div class="t2-dash-val t2-c-green">${fmt(totalValue)}원</div>
                <div class="t2-dash-label">총 재고 자산</div>
            </div>
            <div class="t2-dash-card">
                <div class="t2-dash-val">${totalQty}개</div>
                <div class="t2-dash-label">총 재고 수량</div>
            </div>
            <div class="t2-dash-card">
                <div class="t2-dash-val" style="color:${avgMargin >= 25 ? '#10b981' : avgMargin >= 15 ? '#f59e0b' : '#ef4444'}">${avgMargin}%</div>
                <div class="t2-dash-label">평균 마진율</div>
            </div>
            <div class="t2-dash-card ${pendingCount > 0 ? 't2-dash-pending' : ''}">
                <div class="t2-dash-val" style="color:#a78bfa">${pendingCount}</div>
                <div class="t2-dash-label">T1 대기 상품</div>
            </div>
        </div>
    `;

    // 대기 상품이 있으면 알림 배너
    if (pendingCount > 0) {
        el.innerHTML += `
            <div class="t2-pending-banner">
                <span>📥 T1 소싱에서 ${pendingCount}개 상품이 대기 중입니다</span>
                <button class="t2-pending-btn" onclick="t2ShowPendingQueue()">확인하기</button>
            </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════
// PART 2: 상품 관리 (CRUD + 뷰)
// ═══════════════════════════════════════════════════════════════

function t2LoadProducts() {
    try {
        T2.products = JSON.parse(localStorage.getItem('v5-products') || '[]');
    } catch(e) { T2.products = []; }
}

function t2SaveProducts() {
    localStorage.setItem('v5-products', JSON.stringify(T2.products));
}

// 상품 추가 (시뮬레이터에서 확정 시)
function t2AddProduct(productData) {
    const product = {
        id: productData.id || Date.now().toString(),
        name: productData.name || '',
        cost: parseInt(productData.cost || productData.wholesale_price || 0, 10),
        salePrice: parseInt(productData.salePrice || productData.retail_price || 0, 10),
        margin: parseFloat(productData.margin || 0),
        market: productData.market || 'smartstore',
        fee: parseFloat(productData.fee || 5.5),
        supplyShipping: parseInt(productData.supplyShipping || 0, 10),
        marketShipping: parseInt(productData.marketShipping || 3000, 10),
        quantity: parseInt(productData.quantity || 1, 10),
        status: productData.status || 'sourcing', // sourcing/stocked/selling/soldout
        sourceType: productData.sourceType || 'consign', // consign/direct/global
        source: productData.source || '',
        sourceUrl: productData.sourceUrl || '',
        image: productData.image || productData.thumbnail_url || '',
        keyword: productData.keyword || '',
        vendor: productData.vendor || '',
        trackingNo: productData.trackingNo || '',
        expectedDate: productData.expectedDate || '',
        memo: productData.memo || '',
        createdAt: productData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    T2.products.unshift(product);
    t2SaveProducts();
    t2RenderDashboard();
    t2RenderProducts();
    showToast(`✅ "${product.name}" 상품 등록 완료`);
    return product;
}

// 상품 상태 변경
function t2UpdateStatus(id, newStatus) {
    const product = T2.products.find(p => p.id === id);
    if (!product) return;
    product.status = newStatus;
    product.updatedAt = new Date().toISOString();
    t2SaveProducts();
    t2RenderDashboard();
    t2RenderProducts();
    showToast(`📦 "${product.name}" → ${t2StatusLabel(newStatus)}`);
}

// 상품 삭제
function t2DeleteProduct(id) {
    const idx = T2.products.findIndex(p => p.id === id);
    if (idx === -1) return;
    const name = T2.products[idx].name;
    if (!confirm(`"${name}" 상품을 삭제하시겠습니까?`)) return;
    T2.products.splice(idx, 1);
    t2SaveProducts();
    t2RenderDashboard();
    t2RenderProducts();
    showToast(`🗑️ "${name}" 삭제됨`);
}

// 상태 라벨
function t2StatusLabel(status) {
    const map = { sourcing: '🔍 소싱중', stocked: '📦 입고완료', selling: '🟢 판매중', soldout: '⬛ 품절' };
    return map[status] || status;
}

function t2StatusColor(status) {
    const map = { sourcing: '#a78bfa', stocked: '#60a5fa', selling: '#10b981', soldout: '#64748b' };
    return map[status] || '#94a3b8';
}

// 상품 렌더링
function t2RenderProducts() {
    const container = document.getElementById('t2-product-list');
    if (!container) return;

    let items = [...T2.products];

    // 필터
    if (T2.filterStatus !== 'all') {
        items = items.filter(p => p.status === T2.filterStatus);
    }

    // 정렬
    switch (T2.sortBy) {
        case 'margin': items.sort((a, b) => (b.margin || 0) - (a.margin || 0)); break;
        case 'price': items.sort((a, b) => (a.cost || 0) - (b.cost || 0)); break;
        case 'stock': items.sort((a, b) => (b.quantity || 0) - (a.quantity || 0)); break;
        default: items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (!items.length) {
        container.innerHTML = `<div class="t2-empty">
            <div style="font-size:32px;margin-bottom:8px;">📦</div>
            <div>등록된 상품이 없습니다</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">T1 소싱에서 상품을 담거나, 시뮬레이터에서 직접 등록하세요</div>
        </div>`;
        return;
    }

    if (T2.viewMode === 'card') {
        container.innerHTML = `<div class="t2-card-grid">${items.map(t2RenderProductCard).join('')}</div>`;
    } else {
        container.innerHTML = `<table class="t2-prod-table">
            <thead><tr>
                <th>상태</th><th>상품명</th><th>유형</th><th style="text-align:right">원가</th>
                <th style="text-align:right">판매가</th><th style="text-align:right">마진</th>
                <th style="text-align:right">재고</th><th>액션</th>
            </tr></thead>
            <tbody>${items.map(t2RenderProductRow).join('')}</tbody>
        </table>`;
    }
}

function t2RenderProductCard(p) {
    const marginColor = (p.margin || 0) >= 25 ? '#10b981' : (p.margin || 0) >= 15 ? '#f59e0b' : '#ef4444';
    const statusColor = t2StatusColor(p.status);
    const typeIcon = p.sourceType === 'global' ? '✈️' : p.sourceType === 'field' ? '🏪' : '🖥️';

    return `<div class="t2-pcard">
        <div class="t2-pcard-img">${p.image ? `<img src="${p.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='📦'"/>` : '📦'}</div>
        <div class="t2-pcard-body">
            <div class="t2-pcard-status" style="color:${statusColor}">${t2StatusLabel(p.status)}</div>
            <div class="t2-pcard-name">${escapeHtml(p.name)}</div>
            <div class="t2-pcard-meta">
                <span>${typeIcon} ${p.sourceType === 'global' ? '해외사입' : p.sourceType === 'field' ? '현장사입' : '위탁'}</span>
                <span style="color:${marginColor};font-weight:700">${(p.margin || 0).toFixed(1)}%</span>
            </div>
            <div class="t2-pcard-prices">
                <span>원가 ${fmt(p.cost)}</span>
                <span>판매 ${fmt(p.salePrice)}</span>
                <span>재고 ${p.quantity || 0}</span>
            </div>
            ${p.trackingNo ? `<div class="t2-pcard-tracking">🚚 ${p.trackingNo}</div>` : ''}
            <div class="t2-pcard-actions">
                <select onchange="t2UpdateStatus('${p.id}',this.value)" style="font-size:10px;padding:2px 4px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);">
                    ${['sourcing','stocked','selling','soldout'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${t2StatusLabel(s)}</option>`).join('')}
                </select>
                <button class="t2-act-btn" onclick="t2SendToStudio('${p.id}')">T3</button>
                <button class="t2-act-btn t2-btn-del" onclick="t2DeleteProduct('${p.id}')">삭제</button>
            </div>
        </div>
    </div>`;
}

function t2RenderProductRow(p) {
    const marginColor = (p.margin || 0) >= 25 ? 't2-c-green' : (p.margin || 0) >= 15 ? 't2-c-warn' : 't2-c-red';
    const typeIcon = p.sourceType === 'global' ? '✈️' : p.sourceType === 'field' ? '🏪' : '🖥️';

    return `<tr>
        <td><span style="color:${t2StatusColor(p.status)}">${t2StatusLabel(p.status)}</span></td>
        <td style="font-weight:500">${escapeHtml(p.name)}</td>
        <td>${typeIcon}</td>
        <td style="text-align:right">${fmt(p.cost)}</td>
        <td style="text-align:right">${fmt(p.salePrice)}</td>
        <td style="text-align:right" class="${marginColor}" style="font-weight:700">${(p.margin||0).toFixed(1)}%</td>
        <td style="text-align:right">${p.quantity || 0}</td>
        <td>
            <button class="t2-mini-btn" onclick="t2SendToStudio('${p.id}')">T3</button>
            <button class="t2-mini-btn t2-btn-del" onclick="t2DeleteProduct('${p.id}')">삭제</button>
        </td>
    </tr>`;
}

// T2 → T3 전달
function t2SendToStudio(productId) {
    const p = T2.products.find(pr => pr.id === productId);
    if (!p) return;
    sendToStudio({
        title: p.name, name: p.name,
        price: p.salePrice, wholesale_price: p.cost,
        image: p.image, keyword: p.keyword
    });
}

// ═══════════════════════════════════════════════════════════════
// PART 3: 마진 시뮬레이터
// ═══════════════════════════════════════════════════════════════

function t2SetSimMode(mode) {
    T2.simMode = mode;
    ['consign', 'global', 'field'].forEach(m => {
        const panel = document.getElementById('t2-sim-' + m);
        if (panel) panel.style.display = m === mode ? 'block' : 'none';
    });
    document.querySelectorAll('.t2-sim-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
}

function t2RecalcMargin() {
    const cost = parseInt(document.getElementById('t2-cost')?.value || 0, 10);
    const supShip = parseInt(document.getElementById('t2-supply-ship')?.value || 0, 10);
    const mktShip = parseInt(document.getElementById('t2-market-ship')?.value || 0, 10);
    const feeRate = parseFloat(document.getElementById('t2-fee')?.value || 5.5);
    const targetMargin = parseFloat(document.getElementById('t2-target-margin')?.value || 15);

    if (cost <= 0) return;

    const totalCost = cost + supShip;
    
    // 역산: 희망 마진율로 필요 판매가 계산
    // 판매가 = totalCost + mktShip + (판매가 × feeRate/100) + (판매가 × targetMargin/100)
    // 판매가 × (1 - feeRate/100 - targetMargin/100) = totalCost + mktShip
    const multiplier = 1 - (feeRate / 100) - (targetMargin / 100);
    const salePrice = multiplier > 0 ? Math.ceil((totalCost + mktShip) / multiplier) : 0;
    
    const feeAmount = Math.round(salePrice * feeRate / 100);
    const profit = salePrice - totalCost - mktShip - feeAmount;
    const actualMargin = salePrice > 0 ? ((profit / salePrice) * 100).toFixed(1) : 0;

    // DOM 업데이트
    const salePriceEl = document.getElementById('t2-sale-price');
    if (salePriceEl && !salePriceEl._userEdited) salePriceEl.value = salePrice;

    const resultEl = document.getElementById('t2-margin-result');
    if (resultEl) {
        resultEl.innerHTML = `
            <div class="t2-result-grid">
                <div class="t2-result-item">
                    <div class="t2-result-label">권장 판매가</div>
                    <div class="t2-result-val t2-c-green">${fmtWon(salePrice)}</div>
                </div>
                <div class="t2-result-item">
                    <div class="t2-result-label">수수료</div>
                    <div class="t2-result-val">${fmtWon(feeAmount)}</div>
                </div>
                <div class="t2-result-item">
                    <div class="t2-result-label">건당 순이익</div>
                    <div class="t2-result-val" style="color:${profit >= 0 ? '#10b981' : '#ef4444'}">${fmtWon(profit)}</div>
                </div>
                <div class="t2-result-item">
                    <div class="t2-result-label">실제 마진율</div>
                    <div class="t2-result-val" style="color:${actualMargin >= 25 ? '#10b981' : actualMargin >= 15 ? '#f59e0b' : '#ef4444'}">${actualMargin}%</div>
                </div>
            </div>
        `;
        resultEl.style.display = 'block';
    }

    // 8마켓 비교 테이블
    t2RenderMarketComparison(cost, supShip, mktShip, salePrice);

    // 위탁↔사입 전환 데이터 저장
    window._t2LastCalc = { cost, supShip, mktShip, feeRate, salePrice, profit, margin: actualMargin };
}

// 8마켓 비교 테이블
function t2RenderMarketComparison(cost, supShip, mktShip, salePrice) {
    const el = document.getElementById('t2-market-compare');
    if (!el) return;

    const fees = AppConfig.MARKET_FEES;
    let html = '<div class="t2-market-grid">';
    let bestMarket = null, bestProfit = -Infinity;

    Object.entries(fees).forEach(([key, info]) => {
        const feeAmt = Math.round(salePrice * info.fee / 100);
        const profit = salePrice - cost - supShip - mktShip - feeAmt;
        const margin = salePrice > 0 ? ((profit / salePrice) * 100).toFixed(1) : 0;

        if (profit > bestProfit) { bestProfit = profit; bestMarket = key; }

        const marginColor = margin >= 25 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444';

        html += `<div class="t2-mkt-card ${key === bestMarket ? 't2-mkt-best' : ''}" onclick="t2SelectMarket('${key}',${info.fee})">
            <div class="t2-mkt-name">${info.icon} ${info.name}</div>
            <div class="t2-mkt-fee">수수료 ${info.fee}%</div>
            <div class="t2-mkt-profit" style="color:${marginColor}">${fmtWon(profit)}</div>
            <div class="t2-mkt-margin" style="color:${marginColor}">${margin}%</div>
        </div>`;
    });

    html += '</div>';

    // 최적 마켓 표시
    if (bestMarket) {
        const best = fees[bestMarket];
        html += `<div class="t2-best-market">🏆 최적: ${best.name} (마진 ${((bestProfit/salePrice)*100).toFixed(1)}%, 순이익 ${fmtWon(bestProfit)})</div>`;
    }

    el.innerHTML = html;
    el.style.display = 'block';
}

function t2SelectMarket(key, fee) {
    const feeEl = document.getElementById('t2-fee');
    if (feeEl) { feeEl.value = fee; t2RecalcMargin(); }
    document.querySelectorAll('.t2-mkt-card').forEach(c => c.classList.remove('t2-mkt-selected'));
    const card = document.querySelector(`.t2-mkt-card[onclick*="${key}"]`);
    if (card) card.classList.add('t2-mkt-selected');
}

// ═══════════════════════════════════════════════════════════════
// PART 4: 해외 사입 계산기 (Landed Cost)
// ═══════════════════════════════════════════════════════════════

function t2CalcLandedCost() {
    const cnyPrice = parseFloat(document.getElementById('t2-cny-price')?.value || 0);
    const exchangeRate = parseFloat(document.getElementById('t2-exchange-rate')?.value || 195);
    const tariffRate = parseFloat(document.getElementById('t2-tariff')?.value || 8);
    const shippingKrw = parseInt(document.getElementById('t2-global-shipping')?.value || 0, 10);

    const itemKrw = Math.round(cnyPrice * exchangeRate);
    const tariffAmt = Math.round(itemKrw * tariffRate / 100);
    const vatAmt = Math.round((itemKrw + tariffAmt) * 0.1); // 부가세 10%
    const landedCost = itemKrw + tariffAmt + vatAmt + shippingKrw;

    const el = document.getElementById('t2-landed-result');
    if (el) {
        el.innerHTML = `
            <div class="t2-landed-breakdown">
                <div class="t2-landed-row"><span>상품가 (원화)</span><span>${fmtWon(itemKrw)}</span></div>
                <div class="t2-landed-row"><span>관세 (${tariffRate}%)</span><span>${fmtWon(tariffAmt)}</span></div>
                <div class="t2-landed-row"><span>부가세 (10%)</span><span>${fmtWon(vatAmt)}</span></div>
                <div class="t2-landed-row"><span>물류/배대지</span><span>${fmtWon(shippingKrw)}</span></div>
                <div class="t2-landed-total"><span>Landed Cost</span><span>${fmtWon(landedCost)}</span></div>
            </div>
            <button class="t2-apply-cost-btn" onclick="t2ApplyLandedCost(${landedCost})">💰 이 원가로 마진 계산하기</button>
        `;
        el.style.display = 'block';
    }
}

function t2ApplyLandedCost(cost) {
    const costEl = document.getElementById('t2-cost');
    if (costEl) { costEl.value = cost; }
    t2SetSimMode('consign');
    t2RecalcMargin();
    showToast(`✈️ Landed Cost ${fmtWon(cost)} → 마진 계산에 적용`);
}

// ═══════════════════════════════════════════════════════════════
// PART 5: 위탁↔사입 전환 시뮬레이션
// ═══════════════════════════════════════════════════════════════

function t2CompareConsignVsDirect() {
    const calc = window._t2LastCalc;
    if (!calc || calc.cost <= 0) { showToast('먼저 마진 시뮬레이션을 실행하세요'); return; }

    const moq = parseInt(document.getElementById('t2-cvd-moq')?.value || 10, 10);
    const discountPct = parseFloat(document.getElementById('t2-cvd-discount')?.value || 15);

    // 위탁 모델
    const consignProfit = calc.profit;
    const consignMargin = calc.margin;

    // 사입 모델 (MOQ 할인)
    const directCost = Math.round(calc.cost * (1 - discountPct / 100));
    const directInvest = directCost * moq;
    const directFee = Math.round(calc.salePrice * calc.feeRate / 100);
    const directProfit = calc.salePrice - directCost - calc.mktShip - directFee;
    const directMargin = calc.salePrice > 0 ? ((directProfit / calc.salePrice) * 100).toFixed(1) : 0;

    const profitDiff = directProfit - consignProfit;
    const breakEvenQty = profitDiff > 0 ? Math.ceil(directInvest / profitDiff) : Infinity;

    const el = document.getElementById('t2-cvd-result');
    if (el) {
        el.innerHTML = `
            <div class="t2-cvd-compare">
                <div class="t2-cvd-card">
                    <div class="t2-cvd-type">🏷️ 위탁 (단건)</div>
                    <div class="t2-cvd-profit" style="color:#10b981">${fmtWon(consignProfit)}</div>
                    <div class="t2-cvd-detail">마진 ${consignMargin}% · 원가 ${fmtWon(calc.cost)}</div>
                </div>
                <div class="t2-cvd-card">
                    <div class="t2-cvd-type">📦 사입 (단건)</div>
                    <div class="t2-cvd-profit" style="color:#f59e0b">${fmtWon(directProfit)}</div>
                    <div class="t2-cvd-detail">마진 ${directMargin}% · 할인원가 ${fmtWon(directCost)} · 투자금 ${fmtWon(directInvest)}</div>
                </div>
            </div>
            <div class="t2-cvd-verdict">
                ${profitDiff > 0 
                    ? `<strong style="color:#10b981">📦 사입이 단건당 ${fmtWon(profitDiff)} 더 유리!</strong><br>
                       <span style="font-size:11px;color:var(--text-muted)">MOQ ${moq}개 매입 시 투자금 ${fmtWon(directInvest)} · ${breakEvenQty}개 판매 시 회수 · 월 30개 판매 시 +${fmtWon(profitDiff * 30)} 추가 수익</span>`
                    : `<strong style="color:#a78bfa">🏷️ 위탁이 단건당 ${fmtWon(Math.abs(profitDiff))} 더 유리!</strong><br>
                       <span style="font-size:11px;color:var(--text-muted)">사입은 MOQ 매입 부담(${fmtWon(directInvest)}) + 재고 리스크 존재. 위탁 유지 권장.</span>`
                }
            </div>
        `;
        el.style.display = 'block';
    }
}

// ═══════════════════════════════════════════════════════════════
// PART 6: FIFO 재고 단가 엔진
// ═══════════════════════════════════════════════════════════════

function t2RenderFIFO() {
    const products = T2.products.filter(p => p.quantity > 0);
    const sales = window.appState?.sales || [];

    const fifoMap = {};
    products.forEach(p => {
        const name = p.name || '(미지정)';
        if (!fifoMap[name]) fifoMap[name] = { queue: [], totalSold: 0 };
        fifoMap[name].queue.push({ qty: p.quantity || 1, cost: p.cost || 0, date: p.createdAt || '' });
    });

    sales.forEach(s => {
        const name = s.productName || s.name || '';
        if (!fifoMap[name]) return;
        let remaining = parseInt(s.quantity) || 1;
        fifoMap[name].totalSold += remaining;
        while (remaining > 0 && fifoMap[name].queue.length > 0) {
            const lot = fifoMap[name].queue[0];
            if (lot.qty <= remaining) { remaining -= lot.qty; fifoMap[name].queue.shift(); }
            else { lot.qty -= remaining; remaining = 0; }
        }
    });

    let totalQty = 0, totalValue = 0;
    const rows = [];
    Object.entries(fifoMap).forEach(([name, data]) => {
        const remainQty = data.queue.reduce((s, l) => s + l.qty, 0);
        const remainValue = data.queue.reduce((s, l) => s + (l.qty * l.cost), 0);
        const avgCost = remainQty > 0 ? Math.round(remainValue / remainQty) : 0;
        totalQty += remainQty;
        totalValue += remainValue;
        if (remainQty > 0 || data.totalSold > 0) {
            rows.push({ name, remainQty, avgCost, remainValue, sold: data.totalSold });
        }
    });

    const el = document.getElementById('t2-fifo-panel');
    if (!el) return;

    el.innerHTML = `
        <div class="t2-fifo-summary">
            <div class="t2-fifo-stat"><div class="t2-fifo-val">${fmt(totalQty)}개</div><div class="t2-fifo-label">잔여 재고</div></div>
            <div class="t2-fifo-stat"><div class="t2-fifo-val">${fmtWon(totalQty > 0 ? Math.round(totalValue/totalQty) : 0)}</div><div class="t2-fifo-label">FIFO 평균 단가</div></div>
            <div class="t2-fifo-stat"><div class="t2-fifo-val t2-c-green">${fmtWon(totalValue)}</div><div class="t2-fifo-label">재고 자산 가치</div></div>
        </div>
        ${rows.length ? `<table class="t2-fifo-table">
            <thead><tr><th>상품명</th><th style="text-align:right">잔여</th><th style="text-align:right">FIFO 단가</th><th style="text-align:right">자산 가치</th><th style="text-align:right">누적 판매</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
                <td style="font-weight:500">${escapeHtml(r.name)}</td>
                <td style="text-align:right">${r.remainQty}개</td>
                <td style="text-align:right">${fmtWon(r.avgCost)}</td>
                <td style="text-align:right;color:#10b981">${fmtWon(r.remainValue)}</td>
                <td style="text-align:right">${r.sold}개</td>
            </tr>`).join('')}</tbody>
        </table>` : '<div class="t2-empty-small">재고 데이터가 없습니다</div>'}
    `;
}

// ═══════════════════════════════════════════════════════════════
// PART 7: 공급업체 관리
// ═══════════════════════════════════════════════════════════════

function t2LoadVendors() {
    try { T2.vendors = JSON.parse(localStorage.getItem('v5-vendors') || '[]'); }
    catch(e) { T2.vendors = []; }
}

function t2SaveVendor() {
    const vendor = {
        id: document.getElementById('t2-vendor-id')?.value || Date.now().toString(),
        name: document.getElementById('t2-vendor-name')?.value || '',
        rep: document.getElementById('t2-vendor-rep')?.value || '',
        phone: document.getElementById('t2-vendor-phone')?.value || '',
        address: document.getElementById('t2-vendor-address')?.value || '',
        grade: document.getElementById('t2-vendor-grade')?.value || 'B',
        memo: document.getElementById('t2-vendor-memo')?.value || '',
        createdAt: new Date().toISOString(),
    };

    if (!vendor.name) { showToast('상호명을 입력하세요'); return; }

    const idx = T2.vendors.findIndex(v => v.id === vendor.id);
    if (idx >= 0) T2.vendors[idx] = vendor;
    else T2.vendors.push(vendor);

    localStorage.setItem('v5-vendors', JSON.stringify(T2.vendors));
    t2RenderVendors();
    t2CloseVendorModal();
    showToast(`🏢 "${vendor.name}" 공급업체 저장 완료`);
}

function t2RenderVendors() {
    const el = document.getElementById('t2-vendor-list');
    if (!el) return;

    if (!T2.vendors.length) {
        el.innerHTML = '<div class="t2-empty-small">등록된 공급업체가 없습니다</div>';
        return;
    }

    el.innerHTML = T2.vendors.map(v => {
        const gradeColor = v.grade === 'A' ? '#10b981' : v.grade === 'B' ? '#f59e0b' : '#94a3b8';
        return `<div class="t2-vendor-row">
            <span class="t2-vendor-grade" style="color:${gradeColor}">${v.grade}</span>
            <span class="t2-vendor-name">${escapeHtml(v.name)}</span>
            <span class="t2-vendor-phone">${v.phone || '-'}</span>
            <span class="t2-vendor-memo">${escapeHtml((v.memo || '').slice(0, 30))}</span>
            <button class="t2-mini-btn" onclick="t2EditVendor('${v.id}')">편집</button>
        </div>`;
    }).join('');
}

function t2EditVendor(id) {
    const v = T2.vendors.find(ve => ve.id === id);
    if (!v) return;
    ['id','name','rep','phone','address','grade','memo'].forEach(f => {
        const el = document.getElementById('t2-vendor-' + f);
        if (el) el.value = v[f] || '';
    });
    t2ShowVendorModal();
}

function t2ShowVendorModal() {
    const el = document.getElementById('t2-vendor-modal');
    if (el) el.style.display = 'block';
}

function t2CloseVendorModal() {
    const el = document.getElementById('t2-vendor-modal');
    if (el) el.style.display = 'none';
    ['id','name','rep','phone','address','memo'].forEach(f => {
        const inp = document.getElementById('t2-vendor-' + f);
        if (inp) inp.value = '';
    });
}

// ═══════════════════════════════════════════════════════════════
// PART 8: T1 대기 상품 큐
// ═══════════════════════════════════════════════════════════════

function t2AddToPendingQueue(data) {
    T2.pendingQueue.push({
        ...data,
        receivedAt: new Date().toISOString(),
    });
    t2RenderDashboard();
    showToast(`📥 "${data.name}" T1에서 수신 — 대기열에 추가됨`);
}

function t2ShowPendingQueue() {
    const el = document.getElementById('t2-pending-list');
    if (!el) return;

    if (!T2.pendingQueue.length) {
        el.innerHTML = '<div class="t2-empty-small">대기 상품이 없습니다</div>';
        return;
    }

    el.innerHTML = T2.pendingQueue.map((item, idx) => `
        <div class="t2-pending-row">
            <span class="t2-pending-name">${escapeHtml(item.name)}</span>
            <span class="t2-pending-price">도매 ${fmtWon(item.wholesale_price)} / 시중 ${fmtWon(item.retail_price)}</span>
            <button class="t2-act-btn t2-c-green" onclick="t2AcceptPending(${idx})">등록</button>
            <button class="t2-act-btn" onclick="t2SendPendingToStudio(${idx})">T3</button>
            <button class="t2-act-btn t2-btn-del" onclick="t2DismissPending(${idx})">무시</button>
        </div>
    `).join('');

    el.style.display = 'block';
}

function t2AcceptPending(idx) {
    const item = T2.pendingQueue[idx];
    if (!item) return;

    // 시뮬레이터 필드에 데이터 자동 입력
    const nameEl = document.getElementById('t2-product-name');
    const costEl = document.getElementById('t2-cost');
    if (nameEl) nameEl.value = item.name;
    if (costEl) costEl.value = item.wholesale_price || 0;
    t2RecalcMargin();

    T2.pendingQueue.splice(idx, 1);
    t2RenderDashboard();
    t2ShowPendingQueue();
    showToast(`✅ "${item.name}" → 시뮬레이터에 입력됨. 마진 확인 후 저장하세요.`);
}

function t2SendPendingToStudio(idx) {
    const item = T2.pendingQueue[idx];
    if (!item) return;
    sendToStudio(item);
    T2.pendingQueue.splice(idx, 1);
    t2RenderDashboard();
    t2ShowPendingQueue();
}

function t2DismissPending(idx) {
    T2.pendingQueue.splice(idx, 1);
    t2RenderDashboard();
    t2ShowPendingQueue();
}

// ─── 상품 확정 저장 (시뮬레이터 → 상품 목록) ───
function t2SaveFromSimulator() {
    const name = document.getElementById('t2-product-name')?.value || '';
    const cost = parseInt(document.getElementById('t2-cost')?.value || 0, 10);
    if (!name) { showToast('상품명을 입력하세요'); return; }
    if (cost <= 0) { showToast('도매 원가를 입력하세요'); return; }

    const calc = window._t2LastCalc;
    t2AddProduct({
        name, cost,
        salePrice: calc?.salePrice || 0,
        margin: calc?.margin || 0,
        market: document.getElementById('t2-market-select')?.value || 'smartstore',
        fee: parseFloat(document.getElementById('t2-fee')?.value || 5.5),
        supplyShipping: parseInt(document.getElementById('t2-supply-ship')?.value || 0, 10),
        marketShipping: parseInt(document.getElementById('t2-market-ship')?.value || 3000, 10),
        quantity: parseInt(document.getElementById('t2-quantity')?.value || 1, 10),
        sourceType: T2.simMode === 'global' ? 'global' : T2.simMode === 'field' ? 'field' : 'consign',
        memo: document.getElementById('t2-memo')?.value || '',
    });

    // 폼 초기화
    ['t2-product-name','t2-cost','t2-memo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// 필터/뷰 전환
function t2SetViewMode(mode) {
    T2.viewMode = mode;
    document.querySelectorAll('.t2-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === mode));
    t2RenderProducts();
}

function t2SetFilter(status) {
    T2.filterStatus = status;
    document.querySelectorAll('.t2-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.status === status));
    t2RenderProducts();
}

function t2SetSort(sortBy) {
    T2.sortBy = sortBy;
    t2RenderProducts();
}

// ═══════════════════════════════════════════════════════════════
// PART 9: T2-D 리밸런싱 추천
// ═══════════════════════════════════════════════════════════════

function t2RenderRebalance() {
    const el = document.getElementById('t2-rebalance-panel');
    if (!el) return;

    // 최근 7일 판매 기록
    const orders = JSON.parse(localStorage.getItem('v7-orders') || '[]');
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recentSales = orders.filter(o =>
        new Date(o.createdAt) >= sevenDaysAgo &&
        ['delivered', 'settled', 'completed'].includes(o.status)
    );
    const soldNames = new Set(recentSales.map(o => o.productName));

    // 판매중이지만 7일간 판매 없는 상품
    const stale = T2.products.filter(p =>
        p.status === 'selling' && !soldNames.has(p.name) &&
        new Date(p.createdAt) < new Date(Date.now() - 7 * 86400000)
    );

    if (!stale.length) {
        el.style.display = 'none';
        return;
    }

    el.style.display = 'block';
    el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:600;">🔄 리밸런싱 추천</span>
            <span style="font-size:9px;color:#94a3b8;">7일간 판매 0건 상품 ${stale.length}개</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
            ${stale.map(p => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.1);font-size:11px;">
                    <span style="font-size:14px">📦</span>
                    <span style="flex:1;font-weight:500;">${escapeHtml(p.name)}</span>
                    <span style="color:#94a3b8;font-size:10px;">${fmtWon(p.salePrice)}</span>
                    <button class="t2-mini-btn" style="color:#f59e0b" onclick="t2RebalanceAction('${p.id}','lower')">가격 인하</button>
                    <button class="t2-mini-btn" style="color:#60a5fa" onclick="t2RebalanceAction('${p.id}','keyword')">키워드 변경</button>
                    <button class="t2-mini-btn t2-btn-del" onclick="t2RebalanceAction('${p.id}','remove')">판매 중단</button>
                </div>
            `).join('')}
        </div>
    `;
}

function t2RebalanceAction(productId, action) {
    const p = T2.products.find(pr => pr.id === productId);
    if (!p) return;

    if (action === 'lower') {
        const newPrice = Math.round(p.salePrice * 0.9);
        if (confirm(`"${p.name}" 판매가를 ${fmtWon(p.salePrice)} → ${fmtWon(newPrice)} (10% 인하)로 변경하시겠습니까?`)) {
            p.salePrice = newPrice;
            p.updatedAt = new Date().toISOString();
            t2SaveProducts();
            t2RenderProducts();
            t2RenderRebalance();
            showToast(`💰 "${p.name}" 가격 10% 인하 적용`);
        }
    } else if (action === 'keyword') {
        const newKw = prompt('새 키워드를 입력하세요:', p.keyword || p.name);
        if (newKw && newKw.trim()) {
            p.keyword = newKw.trim();
            p.updatedAt = new Date().toISOString();
            t2SaveProducts();
            showToast(`🔑 "${p.name}" 키워드 변경: ${newKw.trim()}`);
        }
    } else if (action === 'remove') {
        if (confirm(`"${p.name}" 판매를 중단하시겠습니까?`)) {
            p.status = 'soldout';
            p.updatedAt = new Date().toISOString();
            t2SaveProducts();
            t2RenderDashboard();
            t2RenderProducts();
            t2RenderRebalance();
            showToast(`⬛ "${p.name}" 판매 중단`);
        }
    }
}

// ─── 초기화 실행 ───
document.addEventListener('DOMContentLoaded', t2Init);

// 전역 노출
window.t2Init = t2Init;
window.t2SetSimMode = t2SetSimMode;
window.t2RecalcMargin = t2RecalcMargin;
window.t2CalcLandedCost = t2CalcLandedCost;
window.t2ApplyLandedCost = t2ApplyLandedCost;
window.t2CompareConsignVsDirect = t2CompareConsignVsDirect;
window.t2RenderFIFO = t2RenderFIFO;
window.t2SaveVendor = t2SaveVendor;
window.t2ShowVendorModal = t2ShowVendorModal;
window.t2CloseVendorModal = t2CloseVendorModal;
window.t2AddProduct = t2AddProduct;
window.t2UpdateStatus = t2UpdateStatus;
window.t2DeleteProduct = t2DeleteProduct;
window.t2SaveFromSimulator = t2SaveFromSimulator;
window.t2SetViewMode = t2SetViewMode;
window.t2SetFilter = t2SetFilter;
window.t2SetSort = t2SetSort;
window.t2ShowPendingQueue = t2ShowPendingQueue;
window.t2AcceptPending = t2AcceptPending;
window.t2SendToStudio = t2SendToStudio;
window.t2RenderRebalance = t2RenderRebalance;
window.t2RebalanceAction = t2RebalanceAction;
window.T2 = T2;
