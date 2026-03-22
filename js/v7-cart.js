/**
 * V7 소싱 장바구니 & 프라이싱 연산 엔진
 * - 다중 선택 장바구니 (Map 기반)
 * - 플로팅 UI (glassmorphism)
 * - 다이내믹 프라이싱 재계산 (원본 스냅샷 기반)
 * - T2 일괄 이관 라우터 (localStorage 포장)
 *
 * 의존: renderHybridScreener(), showTab(), SystemLogger
 * DOM ID: filter-fee, filter-shipping, filter-min-margin
 */

// ═══════════════ 1. 장바구니 전역 상태 ═══════════════
window.sourcingCart = new Map();

/**
 * 체크박스 토글 → 장바구니 추가/제거
 */
window.toggleCartItem = function(productId) {
  const pId = String(productId);
  if (window.sourcingCart.has(pId)) {
    window.sourcingCart.delete(pId);
  } else {
    const items = window.currentRenderedItems || [];
    const item = items.find(i => String(i._idx || i.productId) === pId);
    if (item) window.sourcingCart.set(pId, item);
  }
  window.renderCartUI();
};

// ═══════════════ 2. 플로팅 장바구니 UI ═══════════════
window.renderCartUI = function() {
  let el = document.getElementById('v7-floating-cart');
  if (!el) {
    el = document.createElement('div');
    el.id = 'v7-floating-cart';
    el.style.cssText = `
      position:fixed; bottom:90px; right:20px; width:340px;
      background:rgba(15,23,42,0.92); backdrop-filter:blur(16px);
      border:1px solid rgba(99,102,241,0.4); border-radius:16px;
      box-shadow:0 8px 32px rgba(0,0,0,0.4); padding:16px;
      z-index:9999; transition:all 0.3s ease;
      transform:translateY(120%); opacity:0;
    `;
    document.body.appendChild(el);
  }

  if (window.sourcingCart.size === 0) {
    el.style.transform = 'translateY(120%)';
    el.style.opacity = '0';
    return;
  }

  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';
  const items = Array.from(window.sourcingCart.values());

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <span style="color:#f1f5f9;font-weight:700;font-size:0.85rem;">🛒 소싱 장바구니
        <span style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:0.65rem;padding:2px 8px;border-radius:10px;margin-left:6px;">${items.length}</span>
      </span>
      <button onclick="window.sourcingCart.clear();window.renderCartUI();document.querySelectorAll('.cart-checkbox').forEach(c=>c.checked=false);"
        style="color:#94a3b8;font-size:0.7rem;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all 0.2s;"
        onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">전체 비우기</button>
    </div>
    <div style="max-height:200px;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:4px;">
      ${items.map(i => {
        const title = (i.title || i.name || '').replace(/<[^>]*>?/gm, '');
        const price = parseInt(i.lprice || i.price || 0);
        const margin = i._margin || 0;
        const marginColor = margin >= 20 ? '#4ade80' : margin >= 10 ? '#fbbf24' : '#ef4444';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(30,41,59,0.8);border:1px solid rgba(255,255,255,0.06);border-radius:8px;gap:6px;">
          <span style="color:#cbd5e1;font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;" title="${title}">${title.slice(0,25)}${title.length>25?'…':''}</span>
          <span style="color:#e2e8f0;font-size:0.7rem;font-weight:600;white-space:nowrap;">₩${price.toLocaleString()}</span>
          <span style="color:${marginColor};font-size:0.65rem;font-weight:700;white-space:nowrap;">${margin}%</span>
        </div>`;
      }).join('')}
    </div>
    <button onclick="window.exportCartToT2()"
      style="width:100%;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-weight:700;padding:10px;border:none;border-radius:10px;font-size:0.8rem;cursor:pointer;box-shadow:0 4px 16px rgba(59,130,246,0.3);transition:all 0.2s;"
      onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
      🚀 선택 상품 ${items.length}건 T2 일괄 이관
    </button>
  `;
};

// ═══════════════ 3. 다이내믹 프라이싱 재계산 엔진 ═══════════════
window.applyV7Filter = function() {
  // 원본 스냅샷 확인
  if (!window.v7OriginalFetchedData || window.v7OriginalFetchedData.length === 0) {
    if (typeof showToast === 'function') showToast('먼저 검색을 실행해주세요.', true);
    return;
  }

  // 1. 패널 입력값 추출 (실제 DOM ID에 매핑)
  const feeRate = parseFloat(document.getElementById('filter-fee')?.value || 8) / 100;
  const shipping = parseInt(document.getElementById('filter-shipping')?.value || 3000, 10);
  const minMargin = parseInt(document.getElementById('filter-min-margin')?.value || 0, 10);

  // 2. 원본 데이터 기준 마진 동적 재계산 (불변성 유지)
  const recalculated = window.v7OriginalFetchedData.map(item => {
    const retailPrice = parseInt(item.lprice || item.price || 0, 10);
    if (isNaN(retailPrice) || retailPrice <= 0) return JSON.parse(JSON.stringify(item));

    const feeAmount = Math.round(retailPrice * feeRate);
    const newItem = JSON.parse(JSON.stringify(item));

    // 위탁 마진 재계산
    if (newItem.sourcing && newItem.sourcing.drop && newItem.sourcing.drop.price > 0) {
      const profit = retailPrice - newItem.sourcing.drop.price - shipping - feeAmount;
      newItem.sourcing.drop.margin = Math.round((profit / retailPrice) * 1000) / 10;
    }
    // 사입 마진 재계산
    if (newItem.sourcing && newItem.sourcing.bulk && newItem.sourcing.bulk.price > 0) {
      const profit = retailPrice - newItem.sourcing.bulk.price - Math.round(shipping / 3) - feeAmount;
      newItem.sourcing.bulk.margin = Math.round((profit / retailPrice) * 1000) / 10;
    }

    // 최선 마진 갱신
    const mDrop = (newItem.sourcing && newItem.sourcing.drop) ? newItem.sourcing.drop.margin : -999;
    const mBulk = (newItem.sourcing && newItem.sourcing.bulk) ? newItem.sourcing.bulk.margin : -999;
    newItem._margin = Math.max(mDrop, mBulk);
    if (newItem._margin <= -999) newItem._margin = 0;
    newItem._profit = retailPrice > 0 ? Math.round(retailPrice * newItem._margin / 100) : 0;

    return newItem;
  });

  // 3. 컷오프 필터 (위탁/사입 중 하나라도 minMargin 이상이면 통과)
  const filtered = recalculated.filter(item => {
    if (minMargin === 0) return true;
    const mDrop = (item.sourcing && item.sourcing.drop) ? item.sourcing.drop.margin : -999;
    const mBulk = (item.sourcing && item.sourcing.bulk) ? item.sourcing.bulk.margin : -999;
    return (mDrop >= minMargin || mBulk >= minMargin);
  });

  // 4. 전역 배열 동기화 + 화면 강제 덮어쓰기
  window.currentRenderedItems = filtered;
  if (typeof renderHybridScreener === 'function') {
    const keyword = document.getElementById('v5-search')?.value || '';
    renderHybridScreener(filtered.slice(0, 30), keyword, 0, shipping, feeRate, 0);
  }
  // 장바구니 UI 갱신
  window.renderCartUI();

  // 5. 피드백
  if (typeof showToast === 'function') {
    showToast(`⚡ 프라이싱 엔진 가동! 수수료 ${(feeRate*100).toFixed(1)}% / 배송비 ₩${shipping.toLocaleString()} → ${filtered.length}건 통과`);
  }
  if (typeof SystemLogger !== 'undefined') {
    SystemLogger.log(`[프라이싱 엔진] fee=${(feeRate*100).toFixed(1)}% ship=₩${shipping.toLocaleString()} cutoff=${minMargin}% → ${filtered.length}건`, 'success');
  }
};

// ═══════════════ 4. T2 장바구니 일괄 이관 라우터 ═══════════════
window.exportCartToT2 = function() {
  if (!window.sourcingCart || window.sourcingCart.size === 0) {
    if (typeof showToast === 'function') showToast('장바구니가 비어 있습니다.', true);
    return;
  }

  const exportItems = Array.from(window.sourcingCart.values());

  // 1. T2 로컬 스토리지 병합 (중복 방지)
  let t2Items = [];
  try { t2Items = JSON.parse(localStorage.getItem('v5_t2_sourcing_items') || '[]'); } catch(e) { t2Items = []; }

  exportItems.forEach(newItem => {
    const id = String(newItem._idx || newItem.productId);
    if (!t2Items.find(i => String(i._idx || i.productId) === id)) {
      t2Items.push(newItem);
    }
  });

  // 2. 저장 + 장바구니 초기화
  localStorage.setItem('v5_t2_sourcing_items', JSON.stringify(t2Items));
  window.sourcingCart.clear();
  window.renderCartUI();
  document.querySelectorAll('.cart-checkbox').forEach(cb => cb.checked = false);

  // 3. T2 탭 이동
  if (typeof showTab === 'function') {
    showTab('inventory');
  }

  // 4. 피드백
  if (typeof showToast === 'function') {
    showToast(`🚀 ${exportItems.length}건이 T2 재고 관제로 이관되었습니다!`);
  }
  if (typeof SystemLogger !== 'undefined') {
    SystemLogger.log(`[🚀 T2 이관] ${exportItems.length}건 → localStorage 저장 + T2 탭 이동`, 'success');
  }
};

// 레거시 호환 alias
window.batchTransferToT2 = window.exportCartToT2;

// ═══════════════ 5. 초기화 및 크롬 확장프로그램 연동 ═══════════════
if (typeof SystemLogger !== 'undefined') {
  SystemLogger.log('🛒 V7 장바구니 + 프라이싱 연산 엔진 로드 완료', 'success');
}

// 6. 클리퍼 봇(현장 요원) -> 사이드 패널(지휘소) 직통 통신 로직 병합
function processClipperItemToCart(item) {
    console.log("📥 [장바구니 로직] 클리퍼 요원으로부터 데이터 처리 시작:", item);
    
    // ★ [1688 플랫폼 감지 + 위안화 변환 인터페이스]
    const platform = (item.market || '').toLowerCase();
    const is1688 = platform === '1688' || (item.link || '').includes('1688.com');
    const isTaobao = platform === 'taobao' || (item.link || '').includes('taobao.com');
    const isCoupang = platform === 'coupang' || (item.link || '').includes('coupang.com');
    
    // 플랫폼별 아이콘 매핑
    const platformIcons = {
        'coupang':    '🟠',
        'smartstore': '🟢',
        '1688':       '🇨🇳',
        'taobao':     '🧧',
        'domeggook':  '📦',
        'aliprice':   '🌐'
    };
    const platformIcon = platformIcons[platform] || '🏪';
    
    // 1688/타오바오: 위안화→원화 자동 환산 (TODO: 환율 API 실시간 연동)
    let costKRW = item.cost || item.salePrice || 0;
    let originalCurrency = 'KRW';
    if (is1688 || isTaobao) {
        const CNY_TO_KRW = 195; // 기본 환율 (향후 fx-ticker 실시간 연동)
        // 가격이 원화 기준 1000원 미만이면 위안화로 간주
        if (costKRW > 0 && costKRW < 1000) {
            originalCurrency = 'CNY';
            costKRW = Math.round(costKRW * CNY_TO_KRW);
            console.log(`🇨🇳 [1688 환산] ¥${item.cost} × ${CNY_TO_KRW} = ₩${costKRW}`);
        }
    }
    
    // 클리퍼의 Payload를 대시보드 내부 장바구니 모델로 매핑변환 (Adapter)
    const cartItem = {
        _idx: item.id,
        productId: item.id,
        title: item.name,
        name: item.name,
        lprice: costKRW,
        wholesale_price: costKRW,
        retail_price: item.salePrice || 0,
        image: item.imageUrl,
        thumbnail_url: item.imageUrl,
        link: item.link,
        mallName: item.market,
        sourcing_type: (item.savedBy || '').includes('Tr.B') ? 'drop' : 'benchmark',
        _margin: 0,
        // 플랫폼 메타
        platformIcon: platformIcon,
        originalCurrency: originalCurrency,
        originalPrice: item.cost || 0,
        // 타사 인텔리전스(해킹) 데이터 보존
        intel: item.thirdPartyIntel || {},
        // ★ [신규] 쿠팡 메타데이터 보존
        coupangMeta: isCoupang ? (item.coupangMeta || {}) : undefined,
        // 원본 메타데이터 보존
        sourceText: item.sourceText || '',
        category: item.category || '',
        savedBy: item.savedBy || '',
        receivedAt: new Date().toISOString()
    };
    
    // 1. 지도/패널 전역 장바구니 객체에 강제 주입 (실시간 UI용)
    window.sourcingCart.set(cartItem._idx, cartItem);
    
    // 2. ★ [FIX] localStorage에도 영구 저장 — 새로고침 시 데이터 유실 방지
    try {
        let t2Items = JSON.parse(localStorage.getItem('v5_t2_sourcing_items') || '[]');
        // 중복 방지
        if (!t2Items.find(i => String(i._idx || i.productId || i.id) === String(cartItem._idx))) {
            t2Items.push(cartItem);
            localStorage.setItem('v5_t2_sourcing_items', JSON.stringify(t2Items));
            console.log("💾 [영구 저장] 클리퍼 데이터 → localStorage 저장 완료:", cartItem.name);
        }
    } catch(e) {
        console.error('localStorage 저장 오류:', e);
    }
    
    // 3. T2 Pending Queue UI가 열려있다면 즉시 리렌더링
    if (typeof t2ShowPendingQueue === 'function') {
        // T2 state도 동기화
        if (typeof T2 !== 'undefined' && T2.pendingQueue) {
            T2.pendingQueue.push(cartItem);
        }
        t2ShowPendingQueue();
    }
    if (typeof t2RenderDashboard === 'function') {
        t2RenderDashboard();
    }
    
    // 4. 장바구니 UI 즉시 리렌더링 (화면 갱신)
    if (typeof window.renderCartUI === 'function') {
        window.renderCartUI();
    }
    
    // 5. 성공 토스트 알림
    if (typeof showToast === 'function') {
        showToast(`✅ [${item.market || '클리퍼'}] 상품 수집 완료!`, "장바구니 + T2 대기열에 저장됨");
    }
}

// [네이티브 확장프로그램 직접 구동 시의 레거시 호환 리스너]
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'CLIP_PRODUCT_TO_PANEL') {
            processClipperItemToCart(request.data);
            sendResponse({ status: 'success', message: '사이드 패널 병합 완료' });
        }
        return true; 
    });
}

// [Iframe Bridge 구동 시의 메시지 수신 리스너 (강력한 CSP 우회용)]
window.addEventListener('message', (event) => {
    // 보안상 event.origin 체크 가능하나, 확장프로그램 내부 통신이므로 유연하게 접근
    if (event.data && event.data.type === 'EXT_CLIP') {
        processClipperItemToCart(event.data.payload);
    }
});
