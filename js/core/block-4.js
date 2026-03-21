/* ═══ js/core/block-4.js ═══ */

/**
 * Dashboard V5: Opportunity Engine (T1) Core Logic
 * Handles Seasonal Triggering, AI Scoring, and Supplier Matching
 */

const OpportunityEngine = {
    // 1. Seasonality & Lead Time Logic
    calculateSeasonalityScore: (keyword, currentMonth, events) => {
        const seasonalPeaks = {
            '캠핑': [3, 4, 5, 9, 10], '우산': [6, 7], '에어컨': [5, 6, 7],
            '난로': [10, 11, 12], '선풍기': [5,6,7], '패딩': [9,10,11],
            '수영복': [5,6,7], '핫팩': [10,11,12,1], '제습기': [6,7,8]
        };
        const peaks = seasonalPeaks[keyword] || [];
        if (peaks.includes(currentMonth + 1)) return 95;
        if (peaks.includes(currentMonth)) return 80;
        return 20;
    },

    // 2. 소싱 성향별 가중치 프리셋 (config.js에서 로드)
    WEIGHT_PRESETS: (window.AppConfig && AppConfig.WEIGHT_PRESETS) || {
        balanced: { market: 0.30, growth: 0.25, social: 0.15, roi: 0.15, monopoly: 0.15, label: '균형형' },
    },

    getWeights() {
        const preset = localStorage.getItem('sourcing-style') || 'balanced';
        return this.WEIGHT_PRESETS[preset] || this.WEIGHT_PRESETS.balanced;
    },

    // 3. Weighted Scoring with Monopoly Index
    calculateAIScore: (data) => {
        const {
            searchVolume, productCount,
            reviewVelocity, socialBuzz, estimatedMargin,
            monopolyIndex // V3: 상위독점도 (0~1, 높을수록 독점)
        } = data;

        // Gap Analysis (경쟁강도 V1)
        const gapRatio = searchVolume / (productCount || 1);
        const marketScore = Math.min(gapRatio * 50, 100);

        // Growth Score (판매가속도 V2)
        const growthScore = Math.min((reviewVelocity || 5) * 10, 100);

        // Social Score
        const socialScore = Math.min((socialBuzz || 20) * 5, 100);

        // ROI Score
        const roiScore = Math.min((estimatedMargin || 25) * 2, 100);

        // Monopoly Penalty (상위독점도 V3 — 낮을수록 좋음)
        const mi = monopolyIndex || 0.3; // 기본값 30%
        const monopolyScore = Math.max(0, 100 - (mi * 120)); // 0.7이면 16점, 0.3이면 64점

        // 가중치 적용
        const w = OpportunityEngine.getWeights();
        const totalScore = (marketScore * w.market) + (growthScore * w.growth)
                         + (socialScore * w.social) + (roiScore * w.roi)
                         + (monopolyScore * w.monopoly);
        return Math.round(Math.min(totalScore, 100));
    },

    // 4. Supplier Matching Simulation
    findSuppliers: async (imageUrl) => {
        console.log("Simulating Siamese CNN Image Match for 1688...");
        return [
            { supplier: "Shenzhen Tech", price: 3.5, unit: "USD", moq: 100 },
            { supplier: "Guangzhou Decor", price: 4.2, unit: "USD", moq: 50 }
        ];
    },

    // 5. Recommendation Logic
    getRecommendation: (score) => {
        if (score >= 90) return { action: "STRONG BUY", color: "#2ecc71", comment: "시장 진입 최적기 (위닝 상품)" };
        if (score >= 70) return { action: "BUY", color: "#3498db", comment: "안정적인 마진 확보 가능" };
        if (score >= 40) return { action: "WATCH", color: "#f1c40f", comment: "트렌드 추이 관찰 필요" };
        return { action: "SKIP", color: "#e74c3c", comment: "경쟁 과열 혹은 수요 부족" };
    }
};

// ==================== 브랜드 금지어 사전 (config.js에서 로드) ====================
const BRAND_STOPWORDS = (window.AppConfig && AppConfig.BRAND_STOPWORDS) || [];

/** 브랜드 금지어 필터 — 이름에 브랜드 포함 시 true */
function isBrandItem(name) {
  const n = (name || '').toLowerCase();
  const nNoSpace = n.replace(/\s/g,'');
  return BRAND_STOPWORDS.some(b => {
    const bLower = b.toLowerCase().replace(/\s/g,'');
    // 2글자 이하 브랜드는 단독 단어 매칭 (예: "핑"이 "캠핑"에서 오탐 방지)
    if (bLower.length <= 2) {
      const re = new RegExp('(^|\\s|[^가-힣a-z])' + bLower.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '($|\\s|[^가-힣a-z])', 'i');
      return re.test(n);
    }
    return nNoSpace.includes(bLower);
  });
}

// ==================== V5.5 하이브리드 마진 시뮬레이터 ====================
/**
 * 위탁 vs 사입 실시간 마진 비교 (프론트엔드 JS 구현)
 * @param {Object} p - {marketPrice, wholesalePrice, wholesaleShipping, cn1688PriceCNY, weightKg}
 */
function calculateHybridMargin(p) {
  // T7 소싱 상수에서 읽기
  let sc = {};
  try { sc = JSON.parse(localStorage.getItem('sourcingConstants') || '{}'); } catch(e) {}
  const EXCHANGE_RATE = sc.exchangeRate || parseFloat(localStorage.getItem('exchangeRate')) || 195;
  const FREIGHT_BASE = sc.freightBase || 1000;
  const FREIGHT_PER_KG = sc.freightPerKg || 1500;
  const CUSTOMS_TAX_RATE = (sc.customsTax || 18) / 100;
  const DOMESTIC_SHIP = sc.domesticShipping || 3000;
  const MARKET_FEE = parseFloat(localStorage.getItem('marketFeeRate')) || 0.08;

  const mp = p.marketPrice || 0;
  const fee = Math.round(mp * MARKET_FEE);

  // 루트 A: 국내 위탁 (도매꾹/도매매)
  const dsCost = (p.wholesalePrice || 0) + (p.wholesaleShipping || DOMESTIC_SHIP);
  const dsProfit = mp - dsCost - fee;
  const dsMargin = mp > 0 ? Math.round((dsProfit / mp) * 1000) / 10 : 0;

  // 루트 B: 해외 사입 (1688 Landed Cost) — T7 상수 연동
  const itemKrw = Math.round((p.cn1688PriceCNY || 0) * EXCHANGE_RATE);
  const oceanFreight = FREIGHT_BASE + Math.round((p.weightKg || 0.5) * FREIGHT_PER_KG);
  const customsTax = Math.round((itemKrw + oceanFreight) * CUSTOMS_TAX_RATE);
  const landedCost = itemKrw + oceanFreight + customsTax + DOMESTIC_SHIP;
  const importProfit = mp - landedCost - fee;
  const importMargin = mp > 0 ? Math.round((importProfit / mp) * 1000) / 10 : 0;

  // AI 라벨링 (Action Tree)
  let action = 'HOLD';
  if (isBrandItem(p.keyword || '')) action = 'BRAND_BLOCK';
  else if (importMargin >= 40) action = 'IMPORT';
  else if (dsMargin >= 20) action = 'DROPSHIP';

  return { dsCost, dsProfit, dsMargin, landedCost, importProfit, importMargin, action, fee };
}

/**
 * 절사평균 (Trimmed Mean) — 상하위 극단값 제거 후 평균
 * @param {Array<number>} arr — 가격 배열
 * @param {number} trimPct — 양쪽 절삭 비율 (기본 0.1 = 10%)
 */
function trimmedMean(arr, trimPct = 0.1) {
  if (!arr || arr.length < 3) return arr && arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const sorted = [...arr].sort((a,b)=>a-b);
  const cut = Math.floor(sorted.length * trimPct);
  const trimmed = sorted.slice(cut, sorted.length - cut);
  return Math.round(trimmed.reduce((a,b)=>a+b,0) / trimmed.length);
}

// ==================== V5.5 묶음 상품 마진 시뮬레이터 ====================
window._bundleItems = [];

function addBundleItem(name, cost, qty) {
  name = name || document.getElementById('bundle-item-name')?.value || '상품';
  cost = cost || Number(document.getElementById('bundle-item-cost')?.value) || 0;
  qty = qty || Number(document.getElementById('bundle-item-qty')?.value) || 1;
  window._bundleItems.push({ name, cost, qty });
  renderBundleSim();
}

function removeBundleItem(idx) {
  window._bundleItems.splice(idx, 1);
  renderBundleSim();
}

function calcBundleMargin() {
  const items = window._bundleItems;
  if (items.length === 0) return null;
  const totalCost = items.reduce((sum, i) => sum + (i.cost * i.qty), 0);
  const bundlePrice = Number(document.getElementById('bundle-sell-price')?.value) || 0;
  const feeRate = parseFloat(localStorage.getItem('marketFeeRate')) || 0.08;
  const fee = Math.round(bundlePrice * feeRate);
  const shipping = Number(document.getElementById('bundle-shipping')?.value) || 3000;
  const profit = bundlePrice - totalCost - fee - shipping;
  const margin = bundlePrice > 0 ? Math.round((profit / bundlePrice) * 1000) / 10 : 0;
  return { totalCost, bundlePrice, fee, shipping, profit, margin, itemCount: items.length };
}

function renderBundleSim() {
  const container = document.getElementById('bundle-sim-result');
  if (!container) return;

  const items = window._bundleItems;
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:10px;">상품을 추가하여 묶음 마진을 시뮬레이션하세요.</div>';
    return;
  }

  const r = calcBundleMargin();
  const marginColor = r.margin >= 30 ? '#22c55e' : r.margin >= 15 ? '#f59e0b' : '#ef4444';

  const rows = items.map((it, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;">
      <span style="flex:1;">${it.name} ×${it.qty}</span>
      <span style="font-weight:700;">₩${(it.cost*it.qty).toLocaleString()}</span>
      <span style="cursor:pointer;color:#ef4444;font-size:13px;" onclick="removeBundleItem(${i})">✕</span>
    </div>
  `).join('');

  container.innerHTML = `
    ${rows}
    <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
      <div>총 원가: <b>₩${r.totalCost.toLocaleString()}</b></div>
      <div>수수료: <b>₩${r.fee.toLocaleString()}</b></div>
      <div>배송비: <b>₩${r.shipping.toLocaleString()}</b></div>
      <div style="font-size:14px;font-weight:900;color:${marginColor};">마진: ${r.margin}% (₩${r.profit.toLocaleString()})</div>
    </div>
  `;
}

/**
 * 에버그린/시즌성 판별 — 12개월 검색량 표준편차 기반
 * @param {string} keyword
 */
function getSeasonalityLabel(keyword) {
  // 시즌성 키워드 딕셔너리 (향후 API 연동 시 대체)
  const SEASONAL = {
    '캠핑': 'seasonal', '우산': 'seasonal', '에어컨': 'seasonal', '선풍기': 'seasonal',
    '패딩': 'seasonal', '수영복': 'seasonal', '핫팩': 'seasonal', '제습기': 'seasonal',
    '난로': 'seasonal', '스키': 'seasonal', '히터': 'seasonal',
  };
  if (SEASONAL[keyword]) return { label: '⚠️ 시즌성', cls: 'badge-seasonal' };
  return { label: '🌱 에버그린', cls: 'badge-evergreen' };
}

/**
 * V5.5 고밀도 스크리너 렌더링
 * @param {Array} items — 검색 결과 상품 목록
 * @param {string} keyword — 검색 키워드
 */
/**
 * [V7.1 UX-4] ZONE 3: 시장 vs 도매 요약 비교 카드 렌더링
 * @param {Array} naverItems - 네이버 쇼핑 검색 결과 (B2C)
 * @param {string} keyword - 검색 키워드
 */
function renderZone3Comparison(naverItems, keyword) {
    const container = document.getElementById('v7-market-vs-wholesale');
    const marketList = document.getElementById('zone3-market-list');
    const wholesaleList = document.getElementById('zone3-wholesale-list');
    if (!container || !marketList || !wholesaleList) return;

    // --- 좌측: 시중가 TOP 5 ---
    const top5 = (naverItems || []).slice(0, 5);
    if (top5.length === 0) { container.classList.remove('active'); return; }

    const prices = top5.map(it => parseInt(it.lprice || it.price || 0)).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a,b) => a+b, 0) / prices.length) : 0;

    marketList.innerHTML = top5.map((it, i) => {
        const name = ((it.title || '').replace(/<\/?b>/g, '')).slice(0, 30);
        const price = parseInt(it.lprice || it.price || 0);
        const review = it.reviewCount || 0;
        const rankColor = i < 3 ? '#fbbf24' : '#64748b';
        return '<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;background:rgba(255,255,255,0.02);font-size:0.7rem;">' +
            '<span style="width:16px;text-align:center;font-weight:800;color:' + rankColor + ';">' + (i+1) + '</span>' +
            '<span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + name + '</span>' +
            (review > 0 ? '<span style="font-size:0.55rem;color:#94a3b8;">\ub9ac\ubdf0 ' + review.toLocaleString() + '</span>' : '') +
            '<span style="font-weight:700;color:var(--text);">\u20a9' + price.toLocaleString() + '</span></div>';
    }).join('');

    // --- 우측: 도매가 TOP 5 ---
    const wsItems = (window.currentRenderedItems || [])
        .filter(it => it.sourcing && (it.sourcing.drop || it.sourcing.bulk))
        .map(it => {
            const dc = it.sourcing.drop ? it.sourcing.drop.cost : Infinity;
            const bc = it.sourcing.bulk ? it.sourcing.bulk.cost : Infinity;
            const best = Math.min(dc, bc);
            const margin = (dc <= bc && it.sourcing.drop) ? it.sourcing.drop.margin : (it.sourcing.bulk ? it.sourcing.bulk.margin : 0);
            return { ...it, _bestCost: best, _bestMargin: margin, _src: dc <= bc ? '\uc704\ud0c1' : '\uc0ac\uc785' };
        })
        .filter(it => it._bestCost > 0 && it._bestCost < Infinity)
        .sort((a, b) => a._bestCost - b._bestCost)
        .slice(0, 5);

    if (wsItems.length > 0) {
        wholesaleList.innerHTML = wsItems.map((it, i) => {
            const name = ((it.title || it.name || '').replace(/<\/?b>/g, '')).slice(0, 30);
            const mc = it._bestMargin >= 20 ? '#4ade80' : it._bestMargin >= 10 ? '#fbbf24' : '#ef4444';
            const sl = it._src === '\uc704\ud0c1' ? '\ud83d\udfe2' : '\ud83d\udd25';
            return '<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;background:rgba(255,255,255,0.02);font-size:0.7rem;">' +
                '<span style="width:16px;text-align:center;font-size:0.6rem;">' + sl + '</span>' +
                '<span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + name + '</span>' +
                '<span style="font-weight:700;color:#fbbf24;">\u20a9' + it._bestCost.toLocaleString() + '</span>' +
                '<span style="font-size:0.65rem;font-weight:700;color:' + mc + ';padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.05);">' + it._bestMargin + '%</span></div>';
        }).join('');
    } else {
        wholesaleList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.7rem;">\ub3c4\ub9e4 \ub370\uc774\ud130 \ub85c\ub529 \uc911...<br><small>\uc2a4\ud06c\ub9ac\ub108\uc5d0\uc11c \ud655\uc778\ud558\uc138\uc694</small></div>';
    }

    // 하단 요약
    const lowest = wsItems.length > 0 ? wsItems[0]._bestCost : 0;
    if (avgPrice > 0 && lowest > 0) {
        const gap = Math.round((1 - lowest / avgPrice) * 100);
        let summary = document.getElementById('zone3-gap-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'zone3-gap-summary';
            summary.style.cssText = 'margin-top:8px;padding:8px 12px;border-radius:8px;font-size:0.7rem;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);text-align:center;';
            container.appendChild(summary);
        }
        summary.textContent = '\ud83d\udca1 \uc2dc\uc911 \ud3c9\uade0 \u20a9' + avgPrice.toLocaleString() + ' vs \ub3c4\ub9e4 \ucd5c\uc800 \u20a9' + lowest.toLocaleString() + ' \u2192 \uac00\uaca9 \ucc28\uc774 ' + gap + '%';
        summary.style.color = gap >= 30 ? '#4ade80' : gap >= 15 ? '#fbbf24' : '#ef4444';
    }
    container.classList.add('active');
}

function renderSourcingScreener(items, keyword) {
  const body = document.getElementById('ag-screener-body');
  const section = document.getElementById('ag-screener-section');
  if (!body || !section || !items || items.length === 0) return;

  section.style.display = 'block';

  let dCount = 0, iCount = 0, hCount = 0;

  body.innerHTML = items.map((item, idx) => {
    const name = item.title || item.name || keyword;
    const mp = item.price || item.lprice || 0;

    // [V7] 1차 렌더링: 시장가 60% 추정값 (비동기 실데이터로 2차 업데이트)
    const wholesalePrice = Math.round(mp * 0.60);
    const cn1688Price = Math.round(mp * 0.15 / (parseFloat(localStorage.getItem('exchangeRate')) || 195) * 10) / 10;

    const m = calculateHybridMargin({
      keyword: name, marketPrice: mp,
      wholesalePrice, wholesaleShipping: 3000,
      cn1688PriceCNY: cn1688Price, weightKg: 0.5
    });

    // AI 뱃지
    let badge = '';
    if (m.action === 'BRAND_BLOCK') badge = '<span class="ag-badge badge-hold">🚫 상표권</span>';
    else if (m.action === 'IMPORT') { badge = '<span class="ag-badge badge-import">🔥 사입 캐시카우</span>'; iCount++; }
    else if (m.action === 'DROPSHIP') { badge = '<span class="ag-badge badge-dropship">🟢 위탁 런칭</span>'; dCount++; }
    else { badge = '<span class="ag-badge badge-hold">❌ 보류</span>'; hCount++; }

    // 시즌성 뱃지
    const season = getSeasonalityLabel(keyword);

    // 마진 색상
    const dsColor = m.dsMargin >= 20 ? 'margin-positive' : (m.dsMargin >= 10 ? 'margin-neutral' : 'margin-negative');
    const imColor = m.importMargin >= 40 ? 'margin-positive' : (m.importMargin >= 20 ? 'margin-neutral' : 'margin-negative');

    const shortName = name.length > 28 ? name.substring(0, 28) + '…' : name;

    return `<div class="ag-row" onclick="sendScreenerItemToSimulator('${name.replace(/'/g,"\\'")}', ${mp}, ${m.dsCost}, ${m.landedCost})">
      <div class="ag-keyword">${shortName} <span class="ag-badge ${season.cls}" style="margin-left:4px;font-size:9px;">${season.label}</span></div>
      <div class="ag-price">₩${mp.toLocaleString()}</div>
      <div class="ag-margin-col">
        <div class="margin-cost" data-ws-cost>₩${m.dsCost.toLocaleString()} <span style="font-size:8px;color:#94a3b8;">(추정)</span></div>
        <div class="margin-val ${dsColor}" data-ws-margin>${m.dsMargin}%</div>
      </div>
      <div class="ag-margin-col">
        <div class="margin-cost">₩${m.landedCost.toLocaleString()}</div>
        <div class="margin-val ${imColor}">${m.importMargin}%</div>
      </div>
      <div>${badge}</div>
      <div><button class="btn-studio" onclick="event.stopPropagation(); sendToSimulator()">🚀 전환</button></div>
    </div>`;
  }).join('');

  // 요약 바 업데이트
  const el = (id) => document.getElementById(id);
  if (el('ag-total-count')) el('ag-total-count').textContent = items.length;
  if (el('ag-dropship-count')) el('ag-dropship-count').textContent = dCount;
  if (el('ag-import-count')) el('ag-import-count').textContent = iCount;
  if (el('ag-hold-count')) el('ag-hold-count').textContent = hCount;

  // [V7.1 UX-4] ZONE 3 비교 카드 렌더링
  if (typeof renderZone3Comparison === 'function') renderZone3Comparison(items, keyword);


  // [V7] 2차 비동기: 도매꿈 실데이터로 도매가 업데이트 (3건씩 배치)
  (async function fillRealWholesalePrices() {
    const batchSize = 3;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item, bIdx) => {
        const ridx = i + bIdx;
        const iname = item.title || item.name || keyword;
        const imp = item.price || item.lprice || 0;
        if (imp === 0) return;
        try {
          const domeRes = await fetchGas('domeggookProxy', {
            type: 'search', keyword: iname, market: 'dome', size: 5
          });
          let realPrice = 0;
          if (domeRes && domeRes.success && domeRes.data && domeRes.data.length > 0) {
            const vp = domeRes.data.map(it => parseInt(it.price || it.prc || 0)).filter(p => p > 0).sort((a,b) => a - b);
            if (vp.length > 0) realPrice = vp[0];
          }
          const row = body.querySelector('[data-screener-idx="' + ridx + '"]');
          if (!row || realPrice === 0) return;
          const costEl = row.querySelector('[data-ws-cost]');
          const marginEl = row.querySelector('[data-ws-margin]');
          if (costEl) {
            const dsCost = realPrice + 3000;
            costEl.textContent = '\u20a9' + realPrice.toLocaleString();
            if (marginEl) {
              const dsMargin = Math.round((1 - dsCost / imp) * 100);
              marginEl.textContent = dsMargin + '%';
              marginEl.className = 'margin-val ' + (dsMargin >= 20 ? 'margin-positive' : dsMargin >= 10 ? 'margin-neutral' : 'margin-negative');
            }
          }
        } catch(e) { console.warn('[WholesalePrice]', iname, e); }
      }));
    }
  })();
}

/** 스크리너 행 클릭 → T2 시뮬레이터로 데이터 전송 */
function sendScreenerItemToSimulator(name, marketPrice, dsCost, landedCost) {
  const itemData = {
    title: name,
    name: name,
    price: marketPrice,
    cost: dsCost > 0 ? dsCost : landedCost, // 더 현실적인 원가
    salePrice: marketPrice,
    keyword: name,
  };
  
  if (typeof confirmSourcing === 'function') {
      confirmSourcing(itemData);
  } else if (window.AppEventBus) {
      window.AppEventBus.emit('PRODUCT_SOURCED', itemData);
      if (typeof showTab === 'function') showTab('inventory');
      showToast(`✅ "${name}" 소싱 확정 → T2 마진 계산으로 이동`);
  } else {
      showToast(`이벤트 버스를 찾을 수 없습니다. T2 이동 실패.`, true);
  }
}


/** 🎯 개별 상품 기회 분석 (네이버 검색광고 API 실데이터) */
async function analyzeOpportunityInline(idx) {
    const btn = document.getElementById('opp-btn-' + idx);
    if (!btn) return;
    const row = window._screenerRows && window._screenerRows[idx];
    if (!row) { showToast('⚠️ 상품 데이터를 찾을 수 없습니다.', true); return; }

    const keyword = row.keyword || row.title;
    btn.textContent = '⏳ 분석중...';
    btn.disabled = true;

    try {
        // 1. 네이버 검색광고 API로 월 검색량 가져오기
        const adRes = await window.fetchGas('naverSearchAd', { keywords: [keyword] });
        let monthlySearch = 0, competition = 'UNKNOWN';
        if (adRes && adRes.success && adRes.data && adRes.data.length > 0) {
            const kd = adRes.data[0];
            monthlySearch = (kd.monthlyPcQcCnt || 0) + (kd.monthlyMobileQcCnt || 0);
            competition = kd.compIdx || 'LOW';
        }

        // 2. 네이버 쇼핑 상품수(공급)
        const shopRes = await window.fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 1 });
        let totalProducts = 0;
        if (shopRes && shopRes.success) {
            totalProducts = shopRes.total || (shopRes.data && shopRes.data.total) || 0;
        }

        // 3. 경쟁강도 계산 (수요/공급)
        const demandSupplyGap = totalProducts > 0 ? Math.round(monthlySearch / totalProducts * 100) / 100 : 0;
        let gapGrade = '🔴 과포화';
        let gapColor = '#ef4444';
        if (demandSupplyGap >= 5) { gapGrade = '🟢 블루오션'; gapColor = '#10b981'; }
        else if (demandSupplyGap >= 2) { gapGrade = '🟡 적정'; gapColor = '#f59e0b'; }
        else if (demandSupplyGap >= 1) { gapGrade = '🟠 경쟁'; gapColor = '#f97316'; }

        // 4. AI 점수 업데이트
        const scoreBadge = btn.closest('.ag-screener-row').querySelector('.ai-score-badge');
        if (scoreBadge) {
            const margin = row.margin || 0;
            const realScore = Math.min(100, Math.round(
                (Math.min(40, demandSupplyGap * 8)) +     // 수급갭 40%
                (Math.min(30, margin * 0.6)) +             // 마진 30%
                (Math.min(15, monthlySearch > 10000 ? 15 : monthlySearch / 700)) + // 검색량 15%
                (competition === 'LOW' ? 15 : competition === 'MEDIUM' ? 8 : 3)    // 경쟁도 15%
            ));
            scoreBadge.textContent = realScore;
            scoreBadge.style.background = realScore >= 60 ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#f59e0b,#d97706)';
            scoreBadge.title = '실데이터 기반 점수';
        }

        // 5. 버튼을 결과 뱃지로 교체
        btn.outerHTML = '<div style="display:flex;flex-direction:column;gap:2px;align-items:center;">' +
            '<div style="font-size:0.55rem;color:' + gapColor + ';font-weight:700;">' + gapGrade + '</div>' +
            '<div style="font-size:0.5rem;color:#94a3b8;" title="월 검색량: ' + monthlySearch.toLocaleString() + ' / 상품수: ' + totalProducts.toLocaleString() + '">📊 ' + monthlySearch.toLocaleString() + '</div>' +
            '<div style="font-size:0.5rem;color:#94a3b8;">D/S: ' + demandSupplyGap + '</div>' +
            '</div>';

        showToast('✅ ' + keyword + ' 분석 완료 — ' + gapGrade);
    } catch (err) {
        console.error('기회 분석 오류:', err);
        btn.textContent = '❌ 실패';
        btn.disabled = false;
        showToast('❌ 분석 실패: ' + (err.message || err), true);
    }
}
if (typeof module !== 'undefined') {
    module.exports = OpportunityEngine;
}