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
    currentTrack: 'all',    // [NEW] 트랙 필터 (all | trackA | trackB)
    filterStatus: 'all',    // all/sourcing/stocked/selling/soldout
    sortBy: 'newest',       // newest/margin/price/stock
    simMode: 'consign',     // 'consign' | 'global' | 'field'
    pendingQueue: [],       // T1에서 넘어온 대기 상품
};

// ─── 초기화 ───
function t2Init() {
    t2LoadProducts();
    t2LoadVendors();
    t2LoadPendingQueue(); // [NEW] localStorage 연동
    t2InitEventListeners();
    t2RenderDashboard();
    t2RenderProducts();
    t2ShowPendingQueue(); // [NEW] 초기 렌더링 시 대기열 UI 출력
    setTimeout(t2RenderRebalance, 500); // 리밸런싱 추천
}

function t2InitEventListeners() {
    // T1에서 상품 수신
    AppEventBus.on('PRODUCT_SOURCED', (data) => {
        t2AddToPendingQueue(data);
    });

    // 마진 계산 실시간 연동
    const inputs = ['t2-cost', 't2-supply-ship', 't2-market-ship', 't2-fee', 't2-sale-price', 't2-ad-cost'];
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
        sourcingType: productData.sourcingType || productData.sourcing_type || 'unknown', // ★ drop(위탁)/bulk(사입)
        source: productData.source || '',
        sourceUrl: productData.sourceUrl || '',
        image: productData.image || productData.thumbnail_url || '',
        keyword: productData.keyword || '',
        vendor: productData.vendor || '',
        trackingNo: productData.trackingNo || '',
        sourceText: productData.sourceText || '', // [NEW] 도매/시장조사 DOM 스크립트 메타데이터 보존
        // ★ T1 -> T2 B2B 확장 스펙 보존
        adult: productData.adult || false,
        tax: productData.tax || '과세',
        origin: productData.origin || '미상',
        brand: productData.brand || '',
        category: productData.category || '',
        isB2b: productData.isB2b || false,
        hasOption: productData.hasOption || false,
        deliveryFee: parseInt(productData.deliveryFee || 0, 10),
        
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

    // [NEW] 트랙 필터 (Tr.A vs Tr.B)
    if (T2.currentTrack === 'trackA') {
        items = items.filter(p => (p.savedBy || '').includes('Tr.A') || (p.category || '').includes('Tr.A'));
    } else if (T2.currentTrack === 'trackB') {
        items = items.filter(p => (p.savedBy || '').includes('Tr.B') || (!((p.savedBy || '').includes('Tr.A') || (p.category || '').includes('Tr.A')))); // Tr.B거나, Tr.A가 아닌 기존 데이터(레거시) 보장
    }

    // 상태 필터
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
    const stLabel = p.sourcingType === 'drop' ? '🟢위탁' : (p.sourcingType === 'bulk' ? '📦사입' : '');

    let b2bBadges = '';
    if (p.isB2b) b2bBadges += `<span style="font-size:9px; background:#475569; color:#fff; padding:1px 4px; border-radius:3px; margin-right:3px;">폐쇄몰</span>`;
    if (p.adult) b2bBadges += `<span style="font-size:9px; background:#ef4444; color:#fff; padding:1px 4px; border-radius:3px; margin-right:3px;">19금</span>`;
    if (p.tax && p.tax !== '과세') b2bBadges += `<span style="font-size:9px; background:#0ea5e9; color:#fff; padding:1px 4px; border-radius:3px; margin-right:3px;">${escapeHtml(p.tax)}</span>`;
    if (p.hasOption) b2bBadges += `<span style="font-size:9px; border:1px solid #94a3b8; color:#94a3b8; padding:1px 4px; border-radius:3px; margin-right:3px;">옵션있음</span>`;
    if (p.origin && p.origin !== '미상') {
        const oName = p.origin.length > 5 ? p.origin.substring(0, 5) + '..' : p.origin;
        b2bBadges += `<span style="font-size:9px; background:transparent; border:1px dashed #64748b; color:#64748b; padding:1px 4px; border-radius:3px; margin-right:3px;">${escapeHtml(oName)}</span>`;
    }

    // [NEW] Track A 여부에 따라 클릭 액션 분기
    const isTrackA = (p.savedBy || '').includes('Tr.A') || (p.category || '').includes('Tr.A');
    if (isTrackA) {
        b2bBadges += `<span style="font-size:9px; background:rgba(168,85,247,0.15); color:#c084fc; padding:1px 4px; border-radius:3px; margin-right:3px; border:1px solid rgba(168,85,247,0.3); font-weight:700;">📊 벤치마킹 타겟 대상</span>`;
    }

    return `<div class="t2-pcard" onclick="t2CardClick('${p.id}', ${isTrackA})" style="cursor:pointer;">
        <div class="t2-pcard-img">${p.image ? `<img src="${p.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='📦'"/>` : '📦'}</div>
        <div class="t2-pcard-body">
            <div class="t2-pcard-status" style="color:${statusColor}">${t2StatusLabel(p.status)}</div>
            <div class="t2-pcard-name">${escapeHtml(p.name)}</div>
            ${b2bBadges ? `<div style="margin-top:2px; margin-bottom:4px; display:flex; flex-wrap:wrap; gap:2px;">${b2bBadges}</div>` : ''}
            <div class="t2-pcard-meta">
                <span>${typeIcon} ${p.sourceType === 'global' ? '해외사입' : p.sourceType === 'field' ? '현장사입' : '위탁'}${stLabel ? ' · ' + stLabel : ''}</span>
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
            ${(p.status === 'stocked' || p.status === 'selling') ? `<button onclick="event.stopPropagation();t2SendToStudio('${p.id}')" 
                 style="width:100%;padding:6px;margin-top:6px;border-radius:6px;border:1px solid rgba(168,85,247,0.2);background:rgba(168,85,247,0.06);color:#a78bfa;font-size:10px;font-weight:600;cursor:pointer">
                 상세페이지 만들기
                 </button>` : ''}
            ${isTrackA ? `<button onclick="event.stopPropagation();t2AILensSearch('${p.id}')" 
                 style="width:100%;padding:6px;margin-top:6px;border-radius:6px;border:1px solid rgba(14, 165, 233, 0.4);background:rgba(14, 165, 233, 0.1);color:#0ea5e9;font-size:10px;font-weight:700;cursor:pointer">
                 🔍 1688 / 렌즈 원클릭 자동 추적
                 </button>
                 <button onclick="event.stopPropagation();t2PromoteToTrackB('${p.id}')" 
                 style="width:100%;padding:6px;margin-top:4px;border-radius:6px;border:1px solid rgba(16, 185, 129, 0.4);background:rgba(16, 185, 129, 0.1);color:#10b981;font-size:10px;font-weight:700;cursor:pointer">
                 ➕ 실제 소싱 데이터로 편입
                 </button>` : ''}
        </div>
    </div>`;
}

function t2RenderProductRow(p) {
    const marginColor = (p.margin || 0) >= 25 ? 't2-c-green' : (p.margin || 0) >= 15 ? 't2-c-warn' : 't2-c-red';
    const typeIcon = p.sourceType === 'global' ? '✈️' : p.sourceType === 'field' ? '🏪' : '🖥️';
    
    // [NEW] Track A 뱃지 (리스트 뷰)
    const isTrackA = (p.savedBy || '').includes('Tr.A') || (p.category || '').includes('Tr.A');
    const displayExt = isTrackA ? '<br><span style="font-size:9px; color:#c084fc; border:1px solid currentColor; border-radius:3px; padding:1px 3px;">📊 벤치마킹 타겟</span>' : '';

    return `<tr onclick="t2CardClick('${p.id}', ${isTrackA})" style="cursor:pointer;">
        <td><span style="color:${t2StatusColor(p.status)}">${t2StatusLabel(p.status)}</span></td>
        <td style="font-weight:500">${escapeHtml(p.name)}${displayExt}</td>
        <td>${typeIcon}</td>
        <td style="text-align:right">${fmt(p.cost)}</td>
        <td style="text-align:right">${fmt(p.salePrice)}</td>
        <td style="text-align:right" class="${marginColor}" style="font-weight:700">${(p.margin||0).toFixed(1)}%</td>
        <td style="text-align:right">${p.quantity || 0}</td>
        <td>
            ${isTrackA ? `
            <button class="t2-mini-btn" style="color:#0ea5e9; border-color:#0ea5e9; margin-right:4px;" onclick="event.stopPropagation();t2AILensSearch('${p.id}')">🔍 추적</button>
            <button class="t2-mini-btn" style="color:#10b981; border-color:#10b981; margin-right:4px;" onclick="event.stopPropagation();t2PromoteToTrackB('${p.id}')">➕ 편입</button>
            ` : ''}
            <button class="t2-mini-btn" onclick="t2SendToStudio('${p.id}')">T3</button>
            <button class="t2-mini-btn t2-btn-del" onclick="t2DeleteProduct('${p.id}')">삭제</button>
        </td>
    </tr>`;
}

// T2 → T3 전달
function t2SendToStudio(productId) {
    const p = T2.products.find(pr => pr.id == productId);
    if (!p) return;
    sendToStudio({
        title: p.name, name: p.name,
        price: p.salePrice, wholesale_price: p.cost,
        image: p.image, keyword: p.keyword,
        sourceText: p.sourceText || '' // [NEW] 도매/시장 스크립트 데이터 T3 즉각 전달
    });
}

// --- Track A ➡️ Track B AI 자동 이미지 추적 브리지 ---
function t2AILensSearch(productId) {
    const p = T2.products.find(pr => pr.id === productId);
    if (!p) return;
    
    showToast(`🔍 AI 자동 렌즈 추적 시작`, `'${p.name}'\\n구글 쇼핑 렌즈와 1688 자동 검색을 실행합니다.`);
    
    // 1. 구글 렌즈 검색 (강력)
    if (p.image) {
        const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(p.image)}`;
        window.open(lensUrl, '_blank');
    }
    
    // 2. 1688 키워드 검색 (보조, 앞 2단어)
    if (p.name) {
        const shortName = p.name.split(' ').slice(0, 2).join(' ').replace(/[^a-zA-Z0-9가-힣\\s]/g, '');
        const URL1688 = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(shortName)}`;
        setTimeout(() => window.open(URL1688, '_blank'), 500);
    }
}

// --- Track A 대상 벤치마킹 상품을 실제 시뮬레이터(Track B)로 픽업 ---
function t2PromoteToTrackB(productId) {
    const p = T2.products.find(pr => pr.id === productId);
    if (!p) return;
    
    // 시뮬레이터 인풋 폼에 데이터 자동 세팅
    const nameEl = document.getElementById('t2-product-name');
    const priceEl = document.getElementById('t2-sale-price');
    const costEl = document.getElementById('t2-cost');

    if (nameEl) nameEl.value = p.name || '';
    if (priceEl) priceEl.value = p.salePrice || 0;
    if (costEl) costEl.value = p.cost || 0;
    
    // 마진 계산 갱신
    if (priceEl && priceEl.value > 0) priceEl._userEdited = true;
    t2RecalcMargin();
    
    t2SetSimMode('global'); // 사입(글로벌 1688 위주) 탭으로 이동
    
    showToast(`♻️ 벤치마킹 타겟 편입`, `'${p.name}'\\n시뮬레이터로 이동했습니다. 알아낸 [실제 원가]를 입력하세요!`);
    document.querySelector('.t2-module-sim')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const adCost = parseInt(document.getElementById('t2-ad-cost')?.value || 0, 10);
    const feeRate = parseFloat(document.getElementById('t2-fee')?.value || 5.5);
    const targetMargin = parseFloat(document.getElementById('t2-target-margin')?.value || 15);

    if (cost <= 0) return;

    const totalCost = cost + supShip + adCost;
    
    // 역산: 희망 마진율로 필요 판매가 계산
    const multiplier = 1 - (feeRate / 100) - (targetMargin / 100);
    const salePrice = multiplier > 0 ? Math.ceil((totalCost + mktShip) / multiplier) : 0;
    
    // DOM 업데이트
    const salePriceEl = document.getElementById('t2-sale-price');
    if (salePriceEl && !salePriceEl._userEdited) salePriceEl.value = salePrice;
    
    // 판매가를 사용자가 직접 입력한 경우 → 그 값으로 재계산
    const userSalePrice = salePriceEl?._userEdited ? parseInt(salePriceEl.value || 0) : salePrice;
    const finalSalePrice = salePriceEl?._userEdited ? userSalePrice : salePrice;
    const finalFee = Math.round(finalSalePrice * feeRate / 100);
    const finalProfit = finalSalePrice - cost - supShip - mktShip - adCost - finalFee;
    const finalMargin = finalSalePrice > 0 ? ((finalProfit / finalSalePrice) * 100).toFixed(1) : 0;
    const roi = cost > 0 ? ((finalProfit / cost) * 100).toFixed(1) : 0;

    const resultEl = document.getElementById('t2-margin-result');
    if (resultEl) {
        resultEl.innerHTML = `
            <div class="t2-result-grid">
                <div class="t2-result-item">
                    <div class="t2-result-label">${salePriceEl?._userEdited ? '입력 판매가' : '권장 판매가'}</div>
                    <div class="t2-result-val t2-c-green">${fmtWon(finalSalePrice)}</div>
                </div>
                <div class="t2-result-item">
                    <div class="t2-result-label">수수료(마켓)</div>
                    <div class="t2-result-val">${fmtWon(finalFee)}</div>
                </div>
                <div class="t2-result-item">
                    <div class="t2-result-label">광고비(기타)</div>
                    <div class="t2-result-val">${fmtWon(adCost)}</div>
                </div>
                <div class="t2-result-item">
                    <div class="t2-result-label">건당 순이익</div>
                    <div class="t2-result-val" style="color:${finalProfit >= 0 ? '#10b981' : '#ef4444'}">${fmtWon(finalProfit)}</div>
                </div>
                <div class="t2-result-item" style="border-top:1px dashed rgba(255,255,255,0.1); grid-column:1/-1; margin-top:4px; padding-top:12px; display:flex; justify-content:space-around;">
                    <div style="text-align:center;">
                        <span style="font-size:10px;color:var(--text-muted)">최종 안전마진율</span><br>
                        <strong style="font-size:16px;color:${finalMargin >= 20 ? '#10b981' : (finalMargin >= 15 ? '#f59e0b' : '#ef4444')}">${finalMargin}%</strong>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:10px;color:var(--text-muted)">투자수익률 (ROI)</span><br>
                        <strong style="font-size:16px;color:${roi >= 100 ? '#10b981' : (roi >= 50 ? '#f59e0b' : '#ef4444')}">${roi}%</strong>
                    </div>
                </div>
            </div>
        `;
        resultEl.style.display = 'block';
    }

    // 8마켓 비교 테이블
    t2RenderMarketComparison(cost, supShip, mktShip, adCost, finalSalePrice);

    // 위탁↔사입 전환 데이터 저장
    window._t2LastCalc = { cost, supShip, mktShip, adCost, feeRate, salePrice: finalSalePrice, profit: finalProfit, margin: finalMargin };
}

// ─── 판매가 직접 입력 시 역마진 계산 ───
function t2OnSalePriceInput(value) {
    const el = document.getElementById('t2-sale-price');
    if (!el) return;
    const v = parseInt(value || 0);
    if (v > 0) {
        el._userEdited = true;
    } else {
        el._userEdited = false;
    }
    t2RecalcMargin();
}

// 8마켓 비교 테이블
function t2RenderMarketComparison(cost, supShip, mktShip, adCost, salePrice) {
    const el = document.getElementById('t2-market-compare');
    if (!el) return;

    const fees = AppConfig.MARKET_FEES;
    let html = '<div class="t2-market-grid">';
    let bestMarket = null, bestProfit = -Infinity;

    Object.entries(fees).forEach(([key, info]) => {
        const feeAmt = Math.round(salePrice * info.fee / 100);
        const profit = salePrice - cost - supShip - mktShip - adCost - feeAmt;
        const margin = salePrice > 0 ? ((profit / salePrice) * 100).toFixed(1) : 0;

        if (profit > bestProfit) { bestProfit = profit; bestMarket = key; }

        const marginColor = margin >= 20 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444';

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
// PART 8: T1 대기 상품 큐 (localStorage 'v5_t2_sourcing_items' 연동)
// ═══════════════════════════════════════════════════════════════

function t2LoadPendingQueue() {
    try {
        T2.pendingQueue = JSON.parse(localStorage.getItem('v5_t2_sourcing_items') || '[]');
    } catch(e) {
        T2.pendingQueue = [];
    }
}

function t2SavePendingQueue() {
    localStorage.setItem('v5_t2_sourcing_items', JSON.stringify(T2.pendingQueue));
}

function t2AddToPendingQueue(data) {
    T2.pendingQueue.push({
        ...data,
        receivedAt: new Date().toISOString(),
    });
    t2SavePendingQueue();
    t2RenderDashboard();
    t2ShowPendingQueue();
    showToast(`📥 "${data.name}" T1에서 수신 — 대기열에 추가됨`);
}

function t2ShowPendingQueue() {
    const el = document.getElementById('t2-pending-items');
    if (!el) return;

    if (!T2.pendingQueue.length) {
        el.innerHTML = `
            <div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:12px;border:1px dashed rgba(255,255,255,0.1);border-radius:8px;">
                <div style="font-size:32px;margin-bottom:12px;opacity:0.5;">📥</div>
                T1 수집 대기열에서<br>상품을 이관해주세요.
            </div>`;
        return;
    }

    el.innerHTML = T2.pendingQueue.map((item, idx) => {
        var stBadge = item.sourcing_type === 'drop' ? '🟢위탁' : (item.sourcing_type === 'bulk' ? '📦사입' : '');
        return `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:12px; font-weight:700; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.name)}">
                ${escapeHtml(item.name)} ${stBadge ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:rgba(74,222,128,0.1);color:#4ade80;">' + stBadge + '</span>' : ''}
            </div>
            <div style="font-size:11px; color:#94a3b8; display:flex; justify-content:space-between;">
                <span>원가: ${fmtWon(item.wholesale_price || item.cost)}</span>
                <span>판매가: ${fmtWon(item.retail_price || item.salePrice)}</span>
            </div>
            <div style="display:flex; gap:6px; margin-top:4px;">
                <button style="flex:1; padding:6px; font-size:11px; font-weight:700; background:rgba(59,130,246,0.1); color:#3b82f6; border:1px solid rgba(59,130,246,0.5); border-radius:4px; cursor:pointer;" onclick="t2AcceptPending(${idx})">픽업 & 마진 계산</button>
                <button style="padding:6px 10px; font-size:11px; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.5); border-radius:4px; cursor:pointer;" onclick="t2DismissPending(${idx})">삭제</button>
            </div>
        </div>
    `}).join('');

    el.style.display = 'flex';
}

function t2AcceptPending(idx) {
    const item = T2.pendingQueue[idx];
    if (!item) return;

    // 시뮬레이터 필드에 데이터 자동 입력
    const nameEl = document.getElementById('t2-product-name');
    const costEl = document.getElementById('t2-cost');
    if (nameEl) nameEl.value = item.name;
    if (costEl) costEl.value = item.wholesale_price || 0;

    // 위탁인지 사입인지 모드를 T2 시뮬레이터 전역에 잠시 저장 (등록 시 꺼내 쓰기 용도)
    window._t2CurrentPendingItem = item;
    
    // 모드에 따라 탭 UI 전환 자동화 (위탁 -> consign, 사입 -> field)
    if (item.sourcing_type === 'drop') {
        t2SetSimMode('consign');
    } else if (item.sourcing_type === 'bulk') {
        t2SetSimMode('field');
    }

    t2RecalcMargin();

    T2.pendingQueue.splice(idx, 1);
    t2SavePendingQueue();
    t2RenderDashboard();
    t2ShowPendingQueue();
    const stBadge = item.sourcing_type === 'drop' ? '🟢위탁' : (item.sourcing_type === 'bulk' ? '📦사입 ' : '');
    showToast(`✅ ${stBadge} "${item.name}" → 시뮬레이터에 입력됨. 마진 확인 후 저장하세요.`);
}

function t2SendPendingToStudio(idx) {
    const item = T2.pendingQueue[idx];
    if (!item) return;
    sendToStudio(item);
    T2.pendingQueue.splice(idx, 1);
    t2SavePendingQueue();
    t2RenderDashboard();
    t2ShowPendingQueue();
}

function t2DismissPending(idx) {
    T2.pendingQueue.splice(idx, 1);
    t2SavePendingQueue();
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
    const currentItem = window._t2CurrentPendingItem || {};

    t2AddProduct({
        name, cost,
        salePrice: calc?.salePrice || parseInt(document.getElementById('t2-sale-price')?.value || 0, 10) || 0,
        margin: calc?.margin || 0,
        market: document.getElementById('t2-market-select')?.value || 'smartstore',
        fee: parseFloat(document.getElementById('t2-fee')?.value || 5.5),
        supplyShipping: parseInt(document.getElementById('t2-supply-ship')?.value || 0, 10),
        marketShipping: parseInt(document.getElementById('t2-market-ship')?.value || 3000, 10),
        quantity: parseInt(document.getElementById('t2-quantity')?.value || 1, 10),
        sourceType: T2.simMode === 'global' ? 'global' : T2.simMode === 'field' ? 'field' : 'consign',
        sourcingType: document.getElementById('t2-sourcing-type')?.value || currentItem.sourcing_type || 'unknown',
        // 기존 펜딩 아이템에서 추출한 스펙 및 메타데이터 상속 
        sourceUrl: currentItem.source_url || '',
        image: currentItem.thumbnail_url || '',
        keyword: currentItem.keyword || '',
        adult: currentItem.adult || false,
        tax: currentItem.tax || '과세',
        origin: currentItem.origin || '미상',
        brand: currentItem.brand || '',
        category: currentItem.category || '',
        isB2b: currentItem.isB2b || false,
        hasOption: currentItem.hasOption || false,
        deliveryFee: parseInt(currentItem.deliveryFee || 0, 10),
        memo: document.getElementById('t2-memo')?.value || '',
    });

    // 폼 초기화
    ['t2-product-name','t2-cost','t2-memo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// ─── T2 시뮬레이터 입력값을 T3로 직접 전송 ───
function sendToStudioFromT2() {
    const name = document.getElementById('t2-product-name')?.value || '';
    const cost = parseInt(document.getElementById('t2-cost')?.value || 0, 10);
    if (!name) { showToast('상품명을 입력하세요'); return; }

    const calc = window._t2LastCalc || {};
    const salePrice = calc.salePrice || parseInt(document.getElementById('t2-sale-price')?.value || 0, 10) || 0;
    const currentItem = window._t2CurrentPendingItem || {};

    sendToStudio({
        title: name,
        name: name,
        price: salePrice,
        wholesale_price: cost,
        image: currentItem.thumbnail_url || currentItem.image || '',
        keyword: currentItem.keyword || name
    });
    
    showToast(`🎨 "${name}" 스튜디오로 전송 완료!`);
}

// ─── T2 카드 클릭 & 표적 고정 로직 ───
function t2SetTrack(trackValue) {
    T2.currentTrack = trackValue;
    document.querySelectorAll('.t2-track-btn').forEach(b => {
        if (b.onclick.toString().includes(trackValue)) {
            b.classList.add('active');
            b.style.opacity = '1';
        } else {
            b.classList.remove('active');
            b.style.opacity = '0.6';
        }
    });
    t2RenderProducts();
}

function t2CardClick(id, isTrackA) {
    if (isTrackA) {
        t2PinReference(id);
    } else {
        t2LoadSimulator(id);
    }
}

function t2PinReference(id) {
    const p = T2.products.find(x => x.id === id);
    if (!p) return;
    
    const panel = document.getElementById('t2-ref-content');
    if (!panel) return;
    
    // 이 상품의 리뷰수 및 약점 분석은 메모나 카테고리에 직렬화되어 있음 ('리뷰가속도:150')
    const memo = p.memo || '';
    const reviews = memo.match(/리뷰가속도:([0-9]+)/)?.[1] || "정보 없음";
    
    panel.innerHTML = `
        <div class="t2-ref-img">
            ${p.image ? `<img src="${p.image}" alt="">` : '<div style="background:#1e293b;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">📦</div>'}
        </div>
        <div class="t2-ref-title">${escapeHtml(p.name)}</div>
        <div class="t2-ref-price">${fmtWon(p.salePrice || p.cost || 0)} <span style="font-size:12px;color:#94a3b8;font-weight:400">판매가</span></div>
        
        <div class="t2-ref-box">
            <div class="t2-ref-box-label">🔥 리스팅 가속도</div>
            <div class="t2-ref-box-val" style="color:#f59e0b;font-weight:700;">최근 리뷰 ${reviews}개 증가 추이</div>
        </div>
        
        <div class="t2-ref-box">
            <div class="t2-ref-box-label">🎯 공략 한계선 (30% 마진 적용)</div>
            <div class="t2-ref-box-val">우리가 도매에서 <strong style="color:#10b981">${fmtWon(Math.floor((p.salePrice || 0) * 0.5))}원</strong> 이하에 떼오면 승산있음</div>
        </div>
        
        <a href="${p.link || '#'}" target="_blank" style="display:block;text-align:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;color:#cbd5e1;text-decoration:none;font-size:11px;margin-top:10px;border:1px solid rgba(255,255,255,0.1)">🔗 원본 페이지(경쟁사) 열기</a>
    `;
    
    showToast(`🎯 [${p.name}] 마진 계산 벤치마킹 표적으로 고정됨`);
}

function t2LoadSimulator(id) {
    const p = T2.products.find(x => x.id === id);
    if (!p) return;
    
    document.getElementById('t2-product-name').value = p.name || '';
    document.getElementById('t2-cost').value = p.cost || 0;
    document.getElementById('t2-sale-price').value = p.salePrice || 0;
    if (p.salePrice > 0) document.getElementById('t2-sale-price')._userEdited = true;
    
    window._t2CurrentPendingItem = p;
    t2SetSimMode('consign');
    t2RecalcMargin();
    
    showToast(`💡 [${p.name}] 도매 원가 시뮬레이터 로드됨`);
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

// ─── T2 현장 사입 사진 및 정보 기록 로직 ───
async function t2HandleFieldPhotos(files) {
    const previewEl = document.getElementById('t2-field-photo-preview');
    if (!previewEl) return;
    previewEl.innerHTML = ''; 
    window._t2FieldPhotos = []; 
    
    for(let i=0; i<files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            window._t2FieldPhotos.push({
                name: file.name,
                mimeType: file.type,
                data: dataUrl.split(',')[1] 
            });
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.border = '1px solid rgba(255,255,255,0.1)';
            previewEl.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

async function t2SubmitFieldSourcing() {
    const vendor = document.getElementById('t2-field-vendor')?.value;
    const phone = document.getElementById('t2-field-phone')?.value;
    const price = document.getElementById('t2-field-price')?.value;
    const qty = document.getElementById('t2-field-qty')?.value;
    const shipping = document.getElementById('t2-field-shipping')?.value || 0;
    const memo = document.getElementById('t2-field-memo')?.value;
    
    if(!vendor || !price || !qty) {
        showToast('❌ 상호명, 단가, 수량을 모두 입력해주세요.');
        return;
    }
    
    showToast('🚀 현장 사입 정보를 저장 중입니다... (사진 업로드 포함)');
    const submitBtn = document.querySelector('#t2-sim-field button[onclick*="t2SubmitFieldSourcing"]');
    if(submitBtn) submitBtn.disabled = true;
    
    const payload = {
        vendor, phone, price: parseInt(price), qty: parseInt(qty), shipping: parseInt(shipping), memo,
        photos: window._t2FieldPhotos || []
    };
    
    try {
        const res = await fetchGasRetry('submitFieldSourcing', payload);
        if(res && res.success) {
            showToast('✅ 현장 사입 현황이 성공적으로 구글 드라이브와 시트에 저장되었습니다.');
            t2AddProduct({
                name: `[현장사입] ${vendor}`,
                cost: parseInt(price),
                salePrice: 0,
                quantity: parseInt(qty),
                sourceType: 'field',
                sourcingType: 'bulk',
                memo: `연락처: ${phone} / 배송비: ${shipping} / 메모: ${memo}`,
                image: res.photoUrls && res.photoUrls.length > 0 ? res.photoUrls[0] : ''
            });
            
            // 초기화
            window._t2FieldPhotos = [];
            ['t2-field-vendor', 't2-field-phone', 't2-field-price', 't2-field-qty', 't2-field-shipping', 't2-field-memo'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.value = '';
            });
            document.getElementById('t2-field-photo-preview').innerHTML = '';
        } else {
            showToast('❌ 오류 발생: ' + (res?.error || '알 수 없는 서버 오류'));
        }
    } catch (e) {
        showToast('❌ 네트워크 오류가 발생했습니다: ' + e.message);
    } finally {
        if(submitBtn) submitBtn.disabled = false;
    }
}

// [NEW] 트랙 분리 토글 스크립트 연결
function t2SetTrack(trackValue) {
    T2.currentTrack = trackValue;
    
    // UI 버튼 활성화 전환
    document.querySelectorAll('.t2-track-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.opacity = '0.6';
    });
    
    const target = document.querySelector(`.t2-track-btn[onclick*="${trackValue}"]`);
    if (target) {
        target.classList.add('active');
        target.style.opacity = '1';
    }
    
    t2RenderProducts();
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
window.sendToStudioFromT2 = sendToStudioFromT2; // 새로 추가된 T3 직연동 함수
window.t2HandleFieldPhotos = t2HandleFieldPhotos;
window.t2SubmitFieldSourcing = t2SubmitFieldSourcing;
window.t2SetTrack = t2SetTrack;
window.t2RenderRebalance = t2RenderRebalance;
window.t2RebalanceAction = t2RebalanceAction;
window.T2 = T2;

// ═══════════════════════════════════════════════════════════════
// T4에서 주문 확인 시 재고 차감
// ═══════════════════════════════════════════════════════════════
if (typeof AppEventBus !== 'undefined') {
    AppEventBus.on('ORDER_CONFIRMED', function(data) {
        if (!data?.productName) return;
        const idx = T2.products.findIndex(p => (p.name || '') === data.productName);
        if (idx === -1) return;
        const product = T2.products[idx];
        if (product.quantity > 0) {
            product.quantity = Math.max(0, (parseInt(product.quantity) || 0) - (parseInt(data.qty) || 1));
            if (product.quantity <= 0) product.status = 'soldout';
            product.updatedAt = new Date().toISOString();
            t2SaveProducts();
            t2RenderDashboard();
            t2RenderProducts();
            // 재고 부족 알림
            if (product.quantity <= 3) {
                AppEventBus.emit('STOCK_ALERT', { name: product.name });
                showToast(`⚠️ "${product.name}" 재고 ${product.quantity}개 — 재주문 필요`);
            }
        }
    });
}
