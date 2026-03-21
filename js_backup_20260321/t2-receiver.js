/**
 * T2 재고/사입 관제 — 수신부 렌더링 엔진
 * T1 장바구니에서 localStorage로 전송된 데이터를 T2 탭에 테이블로 출력
 *
 * localStorage key: 'v5_t2_sourcing_items'
 * DOM 타겟: #page-inventory 내부
 * 의존: showTab(), SystemLogger
 */

// ═══════════════ 1. T2 수신 데이터 렌더링 ═══════════════
window.renderT2Inventory = function() {
  // T2 페이지 내 기존 컨텐츠 영역 탐색
  let container = document.getElementById('t2-sourcing-receiver');
  const page = document.getElementById('page-inventory');
  if (!page) return;

  // 수신부 컨테이너가 없으면 page-inventory 최상단에 생성
  if (!container) {
    container = document.createElement('div');
    container.id = 't2-sourcing-receiver';
    container.style.cssText = 'margin-bottom:20px;';
    // page-inventory 최상단에 안전하게 삽입 (prepend: 직접 자식 필요 없음)
    page.prepend(container);
  }

  // 1. localStorage에서 T1 데이터 로드
  let t2Items = [];
  try { t2Items = JSON.parse(localStorage.getItem('v5_t2_sourcing_items') || '[]'); } catch(e) { t2Items = []; }

  // 2. 빈 상태 UI
  if (t2Items.length === 0) {
    container.innerHTML = `
      <div style="padding:32px; text-align:center; background:rgba(30,30,45,0.5); backdrop-filter:blur(8px); border-radius:16px; border:1px dashed rgba(100,116,139,0.4); margin-bottom:16px;">
        <div style="font-size:2rem; margin-bottom:8px;">📦</div>
        <h3 style="color:#e2e8f0; font-size:0.95rem; margin:0 0 6px;">T2 관제망에 적재된 소싱 상품이 없습니다</h3>
        <p style="color:#94a3b8; font-size:0.75rem; margin:0;">T1 소싱 인텔리전스에서 장바구니에 상품을 담아 이관해주세요.</p>
      </div>
    `;
    return;
  }

  // 3. 관제 테이블 렌더링 (glassmorphism)
  const fmt = n => Math.round(n).toLocaleString('ko-KR');

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
      <h3 style="color:#f1f5f9; font-size:0.9rem; font-weight:700; margin:0;">
        🚀 T1→T2 이관 상품
        <span style="background:linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; font-size:0.65rem; padding:2px 10px; border-radius:10px; margin-left:8px;">${t2Items.length}건</span>
      </h3>
      <button onclick="window.clearT2Inventory()"
        style="background:rgba(220,38,38,0.15); border:1px solid rgba(220,38,38,0.3); color:#f87171; padding:5px 12px; border-radius:8px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;"
        onmouseover="this.style.background='rgba(220,38,38,0.3)'" onmouseout="this.style.background='rgba(220,38,38,0.15)'">
        🗑️ 전체 초기화
      </button>
    </div>
    <div style="overflow-x:auto; background:rgba(15,23,42,0.7); backdrop-filter:blur(12px); border:1px solid rgba(71,85,105,0.4); border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,0.2);">
      <table style="width:100%; border-collapse:collapse; font-size:0.75rem; color:#e2e8f0;">
        <thead>
          <tr style="background:rgba(30,41,59,0.8); border-bottom:1px solid rgba(71,85,105,0.5);">
            <th style="padding:10px 14px; text-align:left; font-weight:600; color:#94a3b8; font-size:0.7rem;">#</th>
            <th style="padding:10px 14px; text-align:left; font-weight:600; color:#94a3b8; font-size:0.7rem;">상품 정보</th>
            <th style="padding:10px 14px; text-align:right; font-weight:600; color:#94a3b8; font-size:0.7rem;">B2C 판매가</th>
            <th style="padding:10px 14px; text-align:center; font-weight:600; color:#94a3b8; font-size:0.7rem;">🟢 위탁</th>
            <th style="padding:10px 14px; text-align:center; font-weight:600; color:#94a3b8; font-size:0.7rem;">📦 사입</th>
            <th style="padding:10px 14px; text-align:center; font-weight:600; color:#94a3b8; font-size:0.7rem;">액션</th>
          </tr>
        </thead>
        <tbody>
  `;

  t2Items.forEach((item, idx) => {
    const title = (item.title || item.name || '').replace(/<[^>]*>?/gm, '');
    const retailPrice = parseInt(item.lprice || item.price || 0);
    const drop = item.sourcing && item.sourcing.drop;
    const bulk = item.sourcing && item.sourcing.bulk;

    const dropUI = drop
      ? `<span style="color:#4ade80;font-weight:700;">₩${fmt(drop.price)}</span><br><span style="font-size:0.6rem;color:${drop.margin>=15?'#4ade80':'#fbbf24'};">${drop.margin}%</span>`
      : '<span style="color:#475569;">—</span>';

    const bulkUI = bulk
      ? `<span style="color:#60a5fa;font-weight:700;">₩${fmt(bulk.price)}</span><br><span style="font-size:0.6rem;color:${bulk.margin>=30?'#60a5fa':'#fbbf24'};">${bulk.margin}%</span>`
      : '<span style="color:#475569;">—</span>';

    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s;"
          onmouseover="this.style.background='rgba(59,130,246,0.06)'" onmouseout="this.style.background='transparent'">
        <td style="padding:10px 14px; color:#64748b; font-weight:600;">${idx + 1}</td>
        <td style="padding:10px 14px; max-width:280px;">
          <div style="font-weight:600; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${title}">${title}</div>
          ${item.mallName ? `<div style="font-size:0.6rem;color:#64748b;margin-top:2px;">${item.mallName}</div>` : ''}
        </td>
        <td style="padding:10px 14px; text-align:right; font-weight:600;">₩${fmt(retailPrice)}</td>
        <td style="padding:10px 14px; text-align:center; background:rgba(74,222,128,0.04);">${dropUI}</td>
        <td style="padding:10px 14px; text-align:center; background:rgba(96,165,250,0.04);">${bulkUI}</td>
        <td style="padding:10px 14px; text-align:center;">
          <button onclick="window.removeT2Item(${idx})"
            style="background:transparent; color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:4px 10px; border-radius:6px; font-size:0.65rem; cursor:pointer; transition:all 0.2s;"
            onmouseover="this.style.background='rgba(239,68,68,0.15)'" onmouseout="this.style.background='transparent'">삭제</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  if (typeof SystemLogger !== 'undefined') {
    SystemLogger.log(`📦 T2 수신부: ${t2Items.length}건 렌더링 완료`, 'info');
  }
};

// ═══════════════ 2. 개별 삭제 ═══════════════
window.removeT2Item = function(index) {
  let t2Items = [];
  try { t2Items = JSON.parse(localStorage.getItem('v5_t2_sourcing_items') || '[]'); } catch(e) { t2Items = []; }
  t2Items.splice(index, 1);
  localStorage.setItem('v5_t2_sourcing_items', JSON.stringify(t2Items));
  window.renderT2Inventory();
  if (typeof showToast === 'function') showToast('상품이 삭제되었습니다.');
};

// ═══════════════ 3. 전체 초기화 ═══════════════
window.clearT2Inventory = function() {
  if (!confirm('T2 관제망의 이관 데이터를 모두 삭제하시겠습니까?')) return;
  localStorage.removeItem('v5_t2_sourcing_items');
  window.renderT2Inventory();
  if (typeof showToast === 'function') showToast('T2 이관 데이터가 초기화되었습니다.');
  if (typeof SystemLogger !== 'undefined') {
    SystemLogger.log('🗑️ T2 수신부 전체 초기화', 'warning');
  }
};

// ═══════════════ 4. 초기화 로그 ═══════════════
if (typeof SystemLogger !== 'undefined') {
  SystemLogger.log('📦 T2 수신부 렌더링 엔진 로드 완료', 'success');
}
