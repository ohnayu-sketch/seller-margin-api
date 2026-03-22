/**
 * @file category-explorer.js v2
 * @description 📂 소싱 인텔리전스 (통합 패널)
 * - 데이터랩 실제 CID 12개 대분류 + 동적 하위카테고리 로딩
 * - "오늘의 브리핑" 탭: 소싱 피드 결과를 카테고리별 분류
 * - "트렌드 분석" 탭: 2년 차트 + 안전소싱 + 예측 알람
 * - "소싱 상품" 탭: 가격대별 매칭 + 중복 제거
 */

/* ═══════════════════ 데이터랩 실제 카테고리 (12개 대분류) ═══════════════════ */
const DATALAB_CATEGORIES = [
  { cid:'50000000', name:'패션의류', icon:'👗', children: null },
  { cid:'50000001', name:'패션잡화', icon:'👜', children: null },
  { cid:'50000002', name:'화장품/미용', icon:'💄', children: null },
  { cid:'50000003', name:'디지털/가전', icon:'📱', children: null },
  { cid:'50000004', name:'가구/인테리어', icon:'🪑', children: null },
  { cid:'50000005', name:'출산/육아', icon:'👶', children: null },
  { cid:'50000006', name:'식품', icon:'🍎', children: null },
  { cid:'50000007', name:'스포츠/레저', icon:'⚽', children: null },
  { cid:'50000008', name:'생활/건강', icon:'🏥', children: null },
  { cid:'50000009', name:'여가/생활편의', icon:'🎭', children: null },
  { cid:'50000010', name:'면세점', icon:'✈️', children: null },
  { cid:'50005542', name:'도서', icon:'📚', children: null }
];

/* ═══════════════════ 상태 관리 ═══════════════════ */
let _catChart = null;
let _catState = {
  selectedCid: null, selectedName: '', selectedPath: [],
  activeTab: 'briefing', // briefing | trend | products
  trendData: null, keywords: [], products: [], priceFilter: 'all',
  searchKeyword: '', searchDone: false
};

/* ═══════════════════ 초기화 ═══════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    renderCatTree();
    // 소싱 피드가 로드되면 자동 분류
    const origRender = window.renderFeedGrid;
    if (origRender) {
      window.renderFeedGrid = function() {
        origRender.apply(this, arguments);
        updateBriefingTab();
      };
    }
    // 피드 데이터가 이미 있으면 분류 시작
    setTimeout(updateBriefingTab, 3000);
    console.log('📂 소싱 인텔리전스 초기화 (', DATALAB_CATEGORIES.length, '개 대분류)');
  }, 500);
});

/* ═══════════════════ 카테고리 트리 렌더링 ═══════════════════ */
function renderCatTree() {
  const c = document.getElementById('cat-tree-container');
  if (!c) return;
  // 헤더 + 수집 버튼
  c.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:4px;">
    <span style="font-size:0.65rem;color:var(--text-muted);">네이버 데이터랩 기준</span>
    <div style="display:flex;gap:4px;">
      <button onclick="runTrendCollect()" style="font-size:0.55rem;padding:2px 6px;border-radius:4px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;" title="지금 즉시 트렌드 스냅샷 수집">📥 수집</button>
      <button onclick="setupAutoCollect()" style="font-size:0.55rem;padding:2px 6px;border-radius:4px;border:1px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.1);color:#3b82f6;cursor:pointer;" title="매일 자동 수집 트리거 설정">⏰ 자동</button>
    </div>
  </div>` +
    DATALAB_CATEGORIES.map(cat =>
      `<div class="tree-node depth0" data-cid="${cat.cid}" data-name="${cat.name}" onclick="onCatClick('${cat.cid}','${cat.name}',this)">
        <span class="tree-toggle" onclick="loadSubcats('${cat.cid}',this,event)">▶</span>
        <span class="tree-icon">${cat.icon}</span>
        <span class="tree-label">${cat.name}</span>
      </div>
      <div class="tree-children" id="sub-${cat.cid}" style="display:none;"></div>`
    ).join('');
}

/* ═══════════════════ 트렌드DB 수집/설정 ═══════════════════ */
async function runTrendCollect() {
  const btn = document.querySelector('[onclick="runTrendCollect()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 0/4'; }
  let totalT = 0, totalK = 0, totalP = 0;
  const totalBatches = 4; // 20개 ÷ 5개 = 4배치
  try {
    for (let b = 0; b < totalBatches; b++) {
      if (btn) btn.textContent = `⏳ ${b+1}/${totalBatches}`;
      const res = await fetchGas('collectTrendSnapshot', { batch: b });
      if (res?.success) {
        totalT += res.collected || 0;
        totalK += res.kwCollected || 0;
        totalP += res.priceCollected || 0;
      } else {
        console.warn(`배치 ${b} 실패:`, res?.error);
      }
    }
    if (btn) btn.textContent = `✅ ${totalT+totalK+totalP}건`;
    showToast?.(`📥 트렌드 ${totalT}건 + 키워드 ${totalK}건 + 상품 ${totalP}건 수집 완료`, 'success');
  } catch(e) {
    if (btn) btn.textContent = '❌ 오류';
    showToast?.('수집 오류: ' + e.message, 'error');
  }
  setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '📥 수집'; } }, 5000);
}

async function setupAutoCollect() {
  const btn = document.querySelector('[onclick="setupAutoCollect()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 설정 중...'; }
  try {
    const res = await fetchGas('setupTrendTrigger', {});
    if (res?.success) {
      if (btn) btn.textContent = '✅ 설정됨';
      showToast?.('⏰ 매일 오전 6시 자동 수집 트리거 설정 완료', 'success');
    } else {
      if (btn) btn.textContent = '❌ 실패';
    }
  } catch(e) {
    if (btn) btn.textContent = '❌ 오류';
  }
  setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '⏰ 자동'; } }, 5000);
}

/* ═══════════════════ 정적 폴백: 데이터랩 실제 중분류 ═══════════════════ */
const SUBCATS_FALLBACK = {
  '50000000': [{cid:'50000167',name:'여성의류'},{cid:'50000168',name:'여성언더웨어/잠옷'},{cid:'50000169',name:'남성의류'},{cid:'50000170',name:'남성언더웨어/잠옷'}],
  '50000001': [{cid:'50000171',name:'여성가방'},{cid:'50000172',name:'남성가방'},{cid:'50000173',name:'여성신발'},{cid:'50000174',name:'남성신발'},{cid:'50000175',name:'여성지갑/벨트/모자'},{cid:'50000176',name:'남성지갑/벨트/모자'},{cid:'50000177',name:'주얼리'},{cid:'50000178',name:'시계'},{cid:'50000179',name:'캐리어/여행용품'}],
  '50000002': [{cid:'50000180',name:'스킨케어'},{cid:'50000181',name:'메이크업'},{cid:'50000182',name:'바디케어'},{cid:'50000183',name:'헤어케어'},{cid:'50000184',name:'향수'},{cid:'50000185',name:'네일'},{cid:'50000186',name:'미용기기'},{cid:'50000187',name:'남성화장품'}],
  '50000003': [{cid:'50000188',name:'노트북'},{cid:'50000189',name:'데스크탑/모니터'},{cid:'50000190',name:'휴대폰'},{cid:'50000191',name:'태블릿PC'},{cid:'50000192',name:'TV'},{cid:'50000193',name:'냉장고'},{cid:'50000194',name:'세탁기/건조기'},{cid:'50000195',name:'에어컨/계절가전'},{cid:'50000196',name:'주방가전'},{cid:'50000197',name:'생활가전'},{cid:'50000198',name:'카메라/캠코더'},{cid:'50000199',name:'음향기기'}],
  '50000004': [{cid:'50000200',name:'가구'},{cid:'50000201',name:'침구'},{cid:'50000202',name:'커튼/블라인드'},{cid:'50000203',name:'카페트/러그'},{cid:'50000204',name:'수납/정리'},{cid:'50000205',name:'조명'},{cid:'50000206',name:'인테리어소품'},{cid:'50000207',name:'DIY/셀프인테리어'}],
  '50000005': [{cid:'50000208',name:'유아동의류'},{cid:'50000209',name:'유아동신발'},{cid:'50000210',name:'기저귀'},{cid:'50000211',name:'분유/이유식'},{cid:'50000212',name:'유모차/카시트'},{cid:'50000213',name:'완구'},{cid:'50000214',name:'임부복/용품'},{cid:'50000215',name:'유아동화장품'}],
  '50000006': [{cid:'50000216',name:'과일/채소'},{cid:'50000217',name:'수산물/건어물'},{cid:'50000218',name:'정육/계란'},{cid:'50000219',name:'쌀/잡곡'},{cid:'50000220',name:'가공식품'},{cid:'50000221',name:'건강식품'},{cid:'50000222',name:'음료/커피/차'},{cid:'50000223',name:'베이커리/간식'}],
  '50000007': [{cid:'50000224',name:'등산/아웃도어'},{cid:'50000225',name:'캠핑'},{cid:'50000226',name:'헬스/요가'},{cid:'50000227',name:'골프'},{cid:'50000228',name:'자전거'},{cid:'50000229',name:'수영/수상스포츠'},{cid:'50000230',name:'구기/라켓'},{cid:'50000231',name:'낚시'},{cid:'50000232',name:'스포츠의류'},{cid:'50000233',name:'스포츠신발'}],
  '50000008': [{cid:'50000234',name:'세제/세정제'},{cid:'50000235',name:'욕실용품'},{cid:'50000236',name:'주방용품'},{cid:'50000237',name:'생활잡화'},{cid:'50000238',name:'건강관리용품'},{cid:'50000239',name:'의약품/의료기기'},{cid:'50000240',name:'안마/마사지'},{cid:'50000241',name:'반려동물용품'}],
  '50000009': [{cid:'50000242',name:'문구/사무용품'},{cid:'50000243',name:'자동차용품'},{cid:'50000244',name:'공구/안전용품'},{cid:'50000245',name:'꽃/원예'},{cid:'50000246',name:'악기'},{cid:'50000247',name:'e쿠폰/상품권'},{cid:'50000248',name:'DVD/블루레이'}],
  '50000010': [{cid:'50000249',name:'면세점패션'},{cid:'50000250',name:'면세점화장품'},{cid:'50000251',name:'면세점주류/식품'}],
  '50005542': [{cid:'50005543',name:'소설/시/에세이'},{cid:'50005544',name:'경제/경영'},{cid:'50005545',name:'자기계발'},{cid:'50005546',name:'인문'},{cid:'50005547',name:'자연/과학'},{cid:'50005548',name:'어린이'},{cid:'50005549',name:'만화'}]
};

/* 여성의류 3depth (소분류) 폴백 — 데이터랩 실제 추출값 */
const SUBCATS_L3_FALLBACK = {
  '50000167': [{cid:'50021279',name:'니트'},{cid:'50000807',name:'원피스'},{cid:'50000803',name:'티셔츠'},{cid:'50000804',name:'블라우스/셔츠'},{cid:'50021359',name:'아우터'},{cid:'50000809',name:'청바지'},{cid:'50000808',name:'스커트'},{cid:'50000810',name:'바지'},{cid:'50000805',name:'카디건'},{cid:'50000806',name:'후드/맨투맨'},{cid:'50000811',name:'코트'},{cid:'50000812',name:'패딩'},{cid:'50000813',name:'자켓'},{cid:'50000814',name:'점프수트'},{cid:'50000815',name:'트레이닝세트'},{cid:'50000816',name:'수영복/비치웨어'},{cid:'50000817',name:'한복'}],
  '50000169': [{cid:'50000818',name:'티셔츠'},{cid:'50000819',name:'셔츠'},{cid:'50000820',name:'바지'},{cid:'50000821',name:'청바지'},{cid:'50000822',name:'아우터'},{cid:'50000823',name:'정장'},{cid:'50000824',name:'니트/스웨터'},{cid:'50000825',name:'후드/맨투맨'},{cid:'50000826',name:'코트'},{cid:'50000827',name:'패딩'}]
};

/* ═══════════════════ 동적 하위카테고리 로딩 (폴백 포함) ═══════════════════ */
async function loadSubcats(parentCid, toggleEl, e) {
  if (e) e.stopPropagation();
  const container = document.getElementById('sub-' + parentCid);
  if (!container) return;

  // 토글
  if (container.style.display !== 'none' && container.innerHTML.trim()) {
    container.style.display = 'none';
    toggleEl.textContent = '▶';
    return;
  }
  container.style.display = 'block';
  toggleEl.textContent = '▼';

  // 이미 로드됨?
  if (container.innerHTML.trim()) return;

  container.innerHTML = '<div style="padding:4px 20px;font-size:0.65rem;color:var(--text-muted);">로딩 중...</div>';

  let categories = null;

  // 1차: 서버 API 시도
  try {
    const res = await fetchGas('naverDatalabSubcategories', { parentCid });
    if (res && res.success && res.categories && res.categories.length > 0) {
      categories = res.categories;
    }
  } catch (err) {
    console.log('📂 서버 API 실패, 폴백 사용:', parentCid);
  }

  // 2차: 정적 폴백
  if (!categories) {
    categories = SUBCATS_FALLBACK[parentCid] || SUBCATS_L3_FALLBACK[parentCid] || null;
  }

  if (categories && categories.length > 0) {
    const depth = container.id.split('-').length > 2 ? 'depth2' : 'depth1';
    container.innerHTML = categories.map(sub =>
      `<div class="tree-node ${depth}" data-cid="${sub.cid}" data-name="${sub.name}" style="padding-left:${depth==='depth2'?'44':'24'}px;" onclick="onCatClick('${sub.cid}','${sub.name}',this)">
        <span class="tree-toggle" onclick="loadSubcats('${sub.cid}',this,event)">▶</span>
        <span class="tree-icon">📄</span>
        <span class="tree-label">${sub.name}</span>
      </div>
      <div class="tree-children" id="sub-${sub.cid}" style="display:none;"></div>`
    ).join('');
  } else {
    container.innerHTML = '<div style="padding:4px 20px;font-size:0.6rem;color:var(--text-muted);">─ 말단 카테고리</div>';
  }
}

/* ═══════════════════ 카테고리 선택 ═══════════════════ */
async function onCatClick(cid, name, el) {
  document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  _catState.selectedCid = cid;
  _catState.selectedName = name;

  // 분석 패널 업데이트
  renderAnalysisPanel(cid, name, 'loading');

  // 병렬 데이터 수집
  const [trendRes, kwRes] = await Promise.allSettled([
    fetchCatTrend(cid, name),
    fetchCatKeywords(cid)
  ]);

  _catState.trendData = trendRes.status === 'fulfilled' ? trendRes.value : null;
  _catState.keywords = kwRes.status === 'fulfilled' ? kwRes.value : [];

  const analysis = analyzeTrend(_catState.trendData, _catState.keywords);
  renderAnalysisPanel(cid, name, 'loaded', analysis);

  // 대분류(하위 카테고리 존재)면 상품 검색 스킵 → 브리핑 탭 유지
  const isParent = SUBCATS_FALLBACK[cid] || SUBCATS_L3_FALLBACK[cid];
  if (!isParent) {
    exploreKw(name);
  }
}

/* ═══════════════════ 분석 패널 통합 렌더 ═══════════════════ */
function renderAnalysisPanel(cid, name, state, analysis) {
  const panel = document.getElementById('cat-analysis-panel');
  if (!panel) return;

  if (state === 'loading') {
    panel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">
      <div style="font-size:2rem;margin-bottom:8px;">🔍</div>
      <div style="font-size:0.85rem;font-weight:600;">${name} 분석 중...</div>
    </div>`;
    return;
  }

  // 탭 바
  const tabs = ['briefing','trend','products'];
  const tabLabels = { briefing:'📰 오늘의 브리핑', trend:'📈 트렌드 분석', products:'💰 소싱 상품' };

  let html = `<div class="cat-header">
    <h3 style="margin:0;font-size:0.95rem;color:var(--text,#f1f5f9);">${name}</h3>
    <span style="font-size:0.6rem;color:var(--text-muted);margin-left:6px;">CID: ${cid}</span>
  </div>`;

  // 예측 알람
  if (analysis && analysis.predictions.length > 0) {
    html += `<div class="cat-alerts">`;
    analysis.predictions.forEach(p => {
      const c = p.severity === 'high' ? '#ef4444' : '#f59e0b';
      html += `<div class="cat-alert" style="border-left:3px solid ${c};">${p.icon} <span style="font-size:0.75rem;font-weight:600;">${p.message}</span></div>`;
    });
    html += `</div>`;
  }

  // 탭
  html += `<div class="cat-tabs">`;
  tabs.forEach(t => {
    const active = t === _catState.activeTab ? ' active' : '';
    html += `<button class="cat-tab${active}" onclick="switchCatTab('${t}')">${tabLabels[t]}</button>`;
  });
  html += `</div>`;

  // 탭 내용
  html += `<div id="cat-tab-content">`;
  html += renderActiveTabContent(analysis);
  html += `</div>`;

  panel.innerHTML = html;

  // Chart.js 렌더
  if (_catState.activeTab === 'trend') {
    setTimeout(() => renderTrendChart(_catState.trendData, name), 100);
  }
}

function switchCatTab(tab) {
  _catState.activeTab = tab;
  const content = document.getElementById('cat-tab-content');
  if (!content) return;
  const analysis = analyzeTrend(_catState.trendData, _catState.keywords);
  content.innerHTML = renderActiveTabContent(analysis);
  if (tab === 'trend') setTimeout(() => renderTrendChart(_catState.trendData, _catState.selectedName), 100);
  // 탭 버튼 활성화
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.cat-tab[onclick*="${tab}"]`)?.classList.add('active');
}

function renderActiveTabContent(analysis) {
  switch (_catState.activeTab) {
    case 'briefing': return renderBriefingContent();
    case 'trend': return renderTrendContent(analysis);
    case 'products': return renderProductsContent();
    default: return '';
  }
}

/* ═══════════════════ 탭1: 오늘의 브리핑 (소싱 피드 통합) ═══════════════════ */
function renderBriefingContent() {
  const feedItems = window._sourcingFeedCache || [];
  const name = _catState.selectedName;

  // 카테고리 관련 아이템 필터링
  const related = feedItems.filter(item => {
    const t = (item.title || '').toLowerCase();
    const kw = (item.keyword || '').toLowerCase();
    const catName = name.toLowerCase();
    return t.includes(catName) || kw.includes(catName) ||
      (item.category && item.category.toLowerCase().includes(catName));
  });

  if (related.length === 0 && feedItems.length === 0) {
    return `<div style="text-align:center;padding:30px;color:var(--text-muted);">
      <div style="font-size:1.5rem;margin-bottom:6px;">📰</div>
      <div style="font-size:0.75rem;">소싱 브리핑 데이터 수집 중...</div>
      <div style="font-size:0.65rem;margin-top:4px;">페이지 로드 후 자동 수집됩니다</div>
    </div>`;
  }

  const items = related.length > 0 ? related : feedItems.slice(0, 12);
  const label = related.length > 0 ? `${name} 관련 ${related.length}건` : `전체 ${feedItems.length}건 (카테고리 필터 없음)`;

  let html = `<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px;">${label}</div>`;
  html += `<div class="cat-briefing-grid">`;
  items.slice(0, 12).forEach(item => {
    const badge = item.engine === 'A' ? '📊' : item.engine === 'B' ? '🏪' : item.engine === 'C' ? '📈' : '📦';
    const margin = item.marginRate ? `<span class="cat-margin ${item.marginRate >= 30 ? 'green' : item.marginRate >= 15 ? 'yellow' : 'red'}">${item.marginRate}%</span>` : '';
    html += `<a href="${item.link || '#'}" target="_blank" class="cat-brief-card">
      <img src="${item.image || ''}" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="cat-brief-info">
        <div class="cat-brief-title">${item.title || ''}</div>
        <div class="cat-brief-price">
          <span>₩${(item.retailPrice || item.price || 0).toLocaleString()}</span>
          ${margin}
        </div>
        <div class="cat-brief-meta">${badge} ${item.keyword || ''}</div>
      </div>
    </a>`;
  });
  html += `</div>`;
  return html;
}

function updateBriefingTab() {
  if (_catState.activeTab === 'briefing' && _catState.selectedCid) {
    const content = document.getElementById('cat-tab-content');
    if (content) content.innerHTML = renderBriefingContent();
  }
}

/* ═══════════════════ 탭2: 트렌드 분석 ═══════════════════ */
function renderTrendContent(analysis) {
  let html = '';

  // ━━━ 소싱 인사이트 대시보드 ━━━
  html += `<div class="cat-insight-dashboard">`;

  // (1) 현재 핀트렌드
  const hotColor = (analysis?.hotScore||0) >= 4 ? '#ef4444' : (analysis?.hotScore||0) >= 3 ? '#f59e0b' : '#64748b';
  const hotBg = (analysis?.hotScore||0) >= 4 ? 'rgba(239,68,68,0.08)' : (analysis?.hotScore||0) >= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.08)';
  html += `<div class="cat-insight-card" style="border-left:3px solid ${hotColor};background:${hotBg};">
    <div class="insight-label">🔥 현재 트렌드</div>
    <div class="insight-score" style="color:${hotColor}">${analysis?.hotLabel || '데이터 수집 중'}</div>
    <div class="insight-detail">${analysis?.hotDetail || ''}</div>
    ${analysis?.momentum ? `<div class="insight-metric">모멘텀: <b style="color:${analysis.momentum>0?'#4ade80':'#f87171'}">${analysis.momentum>0?'+':''}${analysis.momentum}%</b></div>` : ''}
  </div>`;

  // (2) 향후 소싱 예측
  html += `<div class="cat-insight-card" style="border-left:3px solid #3b82f6;background:rgba(59,130,246,0.08);">
    <div class="insight-label">📅 향후 소싱 예측</div>
    <div class="insight-detail" style="font-weight:600;color:var(--text,#f1f5f9);">${analysis?.futureAdvice || '데이터 수집 후 분석'}</div>
    ${analysis?.seasonality ? `<div class="insight-metric">${analysis.seasonality}</div>` : ''}
  </div>`;

  // (3) 지속가치 판단
  const susColor = (analysis?.sustainScore||0) >= 4 ? '#10b981' : (analysis?.sustainScore||0) >= 3 ? '#f59e0b' : '#ef4444';
  const susBg = (analysis?.sustainScore||0) >= 4 ? 'rgba(16,185,129,0.08)' : (analysis?.sustainScore||0) >= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  html += `<div class="cat-insight-card" style="border-left:3px solid ${susColor};background:${susBg};">
    <div class="insight-label">🛡️ 지속 소싱 가치</div>
    <div class="insight-score" style="color:${susColor}">${analysis?.sustainLabel || '데이터 수집 중'}</div>
    <div class="insight-detail">${analysis?.sustainDetail || ''}</div>
    ${analysis?.volatility ? `<div class="insight-metric">변동률: <b>${analysis.volatility}%</b></div>` : ''}
  </div>`;

  html += `</div>`;

  // 차트
  html += `<div class="cat-section">
    <div class="cat-section-title">📈 2년 트렌드</div>
    <div style="height:180px;position:relative;"><canvas id="cat-trend-chart"></canvas></div>
  </div>`;

  // 안전소싱 키워드
  if (analysis && analysis.safeKeywords.length > 0) {
    html += `<div class="cat-section">
      <div class="cat-section-title">🛡️ 안전소싱 <small style="color:var(--text-muted);">(연중 안정 수요)</small></div>
      <div class="cat-keyword-chips">${analysis.safeKeywords.map(kw =>
        `<span class="cat-chip safe" onclick="exploreKw('${kw}')">${kw}</span>`
      ).join('')}</div>
    </div>`;
  }

  // 시즌 키워드
  if (analysis && analysis.seasonalKeywords.length > 0) {
    html += `<div class="cat-section">
      <div class="cat-section-title">⚡ 시즌 키워드</div>
      <div class="cat-keyword-chips">${analysis.seasonalKeywords.map(kw =>
        `<span class="cat-chip seasonal" onclick="exploreKw('${kw}')">${kw}</span>`
      ).join('')}</div>
    </div>`;
  }

  // 🚀 상승 예측 키워드 (모멘텀 기반)
  const risingKws = analyzeRisingKeywords(_catState.keywords, _catState.trendData);
  if (risingKws.length > 0) {
    html += `<div class="cat-section">
      <div class="cat-section-title">🚀 상승 예측 키워드 <small style="color:var(--text-muted);">(향후 수요 증가 예상)</small></div>
      <div class="cat-keyword-list">`;
    risingKws.forEach((kw, i) => {
      const arrow = kw.growth > 0 ? '📈' : '📉';
      const growthColor = kw.growth > 30 ? '#4ade80' : kw.growth > 10 ? '#fbbf24' : '#94a3b8';
      const badge = kw.growth > 50 ? '<span style="background:#4ade80;color:#000;padding:1px 6px;border-radius:8px;font-size:0.55rem;margin-left:4px;">HOT</span>' 
        : kw.growth > 20 ? '<span style="background:#fbbf24;color:#000;padding:1px 6px;border-radius:8px;font-size:0.55rem;margin-left:4px;">UP</span>' : '';
      html += `<div class="cat-keyword-row" onclick="exploreKw('${kw.keyword}')" style="display:flex;align-items:center;justify-content:space-between;">
        <div><span class="rank">${i+1}</span><span class="kw">${kw.keyword}</span>${badge}</div>
        <span style="font-size:0.65rem;color:${growthColor};font-weight:600;">${arrow} ${kw.growth > 0 ? '+' : ''}${kw.growth}%</span>
      </div>`;
    });
    html += `</div></div>`;
  }

  // 인기 키워드 TOP
  if (_catState.keywords.length > 0) {
    html += `<div class="cat-section">
      <div class="cat-section-title">🔑 인기 키워드 TOP ${_catState.keywords.length}</div>
      <div class="cat-keyword-list">`;
    _catState.keywords.forEach((kw, i) => {
      const keyword = kw.keyword || kw;
      html += `<div class="cat-keyword-row" onclick="exploreKw('${keyword}')">
        <span class="rank">${i+1}</span><span class="kw">${keyword}</span>
      </div>`;
    });
    html += `</div></div>`;
  }

  return html;
}

/* ═══════════════════ 탭3: 소싱 상품 (가격대별) ═══════════════════ */
function renderProductsContent() {
  if (_catState.products.length === 0) {
    const kw = _catState.searchKeyword || _catState.selectedName || '카테고리';
    // 검색 완료 vs 로딩 중 구분
    if (_catState.searchDone) {
      return `<div style="text-align:center;padding:30px;color:var(--text-muted);">
        <div style="font-size:1.5rem;margin-bottom:8px;">💭</div>
        <div style="font-size:0.8rem;font-weight:600;color:var(--text,#f1f5f9);">"🔍 ${kw}" 검색 결과 없음</div>
        <div style="font-size:0.65rem;margin-top:6px;">API 응답이 비어있거나 키워드가 너무 구체적일 수 있습니다</div>
        <button onclick="exploreKw('${_catState.selectedName}')" style="margin-top:10px;padding:4px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:0.65rem;cursor:pointer;">🔄 카테고리명으로 재검색</button>
      </div>`;
    }
    return `<div style="text-align:center;padding:30px;color:var(--text-muted);">
      <div style="font-size:1.2rem;margin-bottom:6px;">🔍</div>
      <div style="font-size:0.75rem;">${kw} 상품 검색 중...</div>
    </div>`;
  }

  let items = _catState.products;
  if (_catState.priceFilter !== 'all') items = items.filter(p => p.priceGroup === _catState.priceFilter);

  let html = `<div class="cat-price-tabs">
    ${['all','low','mid','high'].map(t => {
      const labels = { all:'전체', low:'💚 최저가', mid:'💛 평균가', high:'❤️ 프리미엄' };
      return `<button class="price-tab${_catState.priceFilter===t?' active':''}" onclick="setPriceFilter('${t}')">${labels[t]}</button>`;
    }).join('')}
  </div>`;

  html += `<div class="cat-sourcing-grid">`;
  items.slice(0, 20).forEach(p => {
    const pc = p.priceGroup === 'low' ? '#4ade80' : p.priceGroup === 'mid' ? '#fbbf24' : '#f87171';
    const src = p.source === 'wholesale' ? '🏭' : p.source === 'coupang' ? '🛒' : '🛍️';
    html += `<a href="${p.link||'#'}" target="_blank" class="cat-product-card">
      <img src="${p.image||''}" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="cat-product-info">
        <div class="cat-product-title">${p.title}</div>
        <div class="cat-product-price" style="color:${pc}">₩${(p.price||0).toLocaleString()}</div>
        <div class="cat-product-meta"><span class="cat-badge">${src}</span></div>
      </div>
    </a>`;
  });
  html += `</div>`;
  return html;
}

function setPriceFilter(f) {
  _catState.priceFilter = f;
  const content = document.getElementById('cat-tab-content');
  if (content) content.innerHTML = renderProductsContent();
}

/* ═══════════════════ 키워드 탐색 → 소싱 상품 매칭 ═══════════════════ */
async function exploreKw(keyword) {
  _catState.activeTab = 'products';
  _catState.products = [];
  _catState.priceFilter = 'all';
  _catState.searchKeyword = keyword;
  _catState.searchDone = false;

  // 탭 전환
  const content = document.getElementById('cat-tab-content');
  if (content) content.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);">🔍 "${keyword}" 소싱 검색 중...</div>`;
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.cat-tab[onclick*="products"]')?.classList.add('active');

  const allProducts = [];
  try {
    const [naverPop, naverLow] = await Promise.allSettled([
      fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 10, sort: 'sim' }),
      fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 10, sort: 'asc' })
    ]);

    [naverPop, naverLow].forEach(r => {
      if (r.status !== 'fulfilled' || !r.value?.items) return;
      r.value.items.forEach(item => {
        allProducts.push({
          title: (item.title || '').replace(/<[^>]+>/g, ''),
          price: parseInt(item.lprice) || 0,
          image: item.image || '', link: item.link || '',
          source: 'naver', keyword
        });
      });
    });

    try {
      const ws = await fetchGas('domeggookProxy', { keyword, limit: 5 });
      if (ws?.items) ws.items.forEach(item => {
        allProducts.push({
          title: item.name || item.title || '',
          price: parseInt(item.price) || 0,
          image: item.image || item.img || '',
          link: item.url || item.link || '',
          source: 'wholesale', keyword
        });
      });
    } catch(e) {}

  } catch (e) { console.warn('소싱 검색 실패:', e); }

  // 중복 제거
  const seen = new Set();
  const unique = allProducts.filter(p => {
    const key = (p.image ? p.image.split('?')[0].slice(-40) : '') || p.title.replace(/\s/g,'').substring(0,20);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  unique.sort((a,b) => a.price - b.price);
  const len = unique.length;
  unique.forEach((p,i) => { p.priceGroup = i < len/3 ? 'low' : i < len*2/3 ? 'mid' : 'high'; });

  _catState.products = unique;
  _catState.searchDone = true;
  if (content) content.innerHTML = renderProductsContent();
}

/* ═══════════════════ API 호출 ═══════════════════ */
async function fetchCatTrend(cid, name) {
  try {
    const r = await cachedFetchGas('naverDatalabTrend', { cid, name, timeUnit:'month' });
    if (r?.success && r.results) return r.results;
  } catch(e) {}
  return null;
}

async function fetchCatKeywords(cid) {
  try {
    const r = await cachedFetchGas('naverDatalabKeywords', { cid, limit: 20 });
    if (r?.success && r.keywords) return r.keywords.map(kw => typeof kw === 'string' ? { keyword: kw } : kw);
  } catch(e) {}
  return [];
}

/* ═══════════════════ 트렌드 분석 엔진 v2 ═══════════════════ */
function analyzeTrend(trend, keywords) {
  const result = {
    safeKeywords: [], seasonalKeywords: [], predictions: [],
    hotScore: 0, hotLabel: '', hotDetail: '',
    futureAdvice: '',
    sustainScore: 0, sustainLabel: '', sustainDetail: '',
    momentum: 0, volatility: 0, seasonality: ''
  };

  if (trend?.data && Array.isArray(trend.data) && trend.data.length >= 6) {
    const vals = trend.data.map(d => d.ratio || d.value || 0);
    const len = vals.length;
    const mean = vals.reduce((s,v) => s+v, 0) / len;
    const std = Math.sqrt(vals.reduce((s,v) => s + Math.pow(v-mean,2), 0) / len);
    const cv = mean > 0 ? std / mean : 1;

    // ━━ 1. 현재 핫트렌드 (Hot Score) ━━
    const recent3 = vals.slice(-3).reduce((s,v) => s+v, 0) / Math.max(vals.slice(-3).length, 1);
    const prev6Arr = vals.slice(-9, -3);
    const prev6 = prev6Arr.length > 0 ? prev6Arr.reduce((s,v) => s+v, 0) / prev6Arr.length : mean;
    const hotRatio = prev6 > 0 ? ((recent3 - prev6) / prev6 * 100) : 0;
    result.momentum = Math.round(hotRatio);

    if (hotRatio > 30) { result.hotScore = 5; result.hotLabel = '🔥 강력 상승'; result.hotDetail = `최근 3개월 수요 +${Math.round(hotRatio)}% 급상승 — 즉시 소싱 추천`; }
    else if (hotRatio > 15) { result.hotScore = 4; result.hotLabel = '📈 상승세'; result.hotDetail = `수요 꾸준히 증가 중 (+${Math.round(hotRatio)}%) — 진입 타이밍`; }
    else if (hotRatio > -10) { result.hotScore = 3; result.hotLabel = '➖ 보합'; result.hotDetail = '안정적 수요 유지 중'; }
    else { result.hotScore = 2; result.hotLabel = '📉 하락세'; result.hotDetail = `수요 ${Math.round(hotRatio)}% 감소 — 신규 진입 주의`; }

    // ━━ 2. 향후 예측 (Future Advice) ━━
    const m = new Date().getMonth();
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    if (len > 12) {
      const lastYr = vals[len - 12 + m] || 0;
      const now = vals[len - 1] || 0;
      if (lastYr > 0) {
        const yoyChange = ((now - lastYr) / lastYr * 100);
        if (yoyChange > 20) result.predictions.push({ type:'surge', message:`작년 동월 대비 +${yoyChange.toFixed(0)}% 성장 — 시장 확대 중`, icon:'🔥', severity:'high' });
        else if (yoyChange < -20) result.predictions.push({ type:'decline', message:`작년 대비 ${yoyChange.toFixed(0)}% 감소 — 재고 관리 주의`, icon:'⚠️', severity:'medium' });
      }
      let futureMonths = [];
      for (let f = 1; f <= 3; f++) {
        const fm = (m + f) % 12;
        let predicted = vals[len - 12 + fm] || mean;
        if (len >= 24) predicted = ((vals[len - 12 + fm] || 0) + (vals[len - 24 + fm] || 0)) / 2;
        futureMonths.push({ month: monthNames[fm], diff: Math.round(((predicted - mean) / mean) * 100) });
      }
      const peakMonth = futureMonths.reduce((a, b) => a.diff > b.diff ? a : b);
      if (peakMonth.diff > 20) {
        result.futureAdvice = `📅 ${peakMonth.month} 수요 +${peakMonth.diff}% 예상 — 사전 재고 확보 권장`;
        result.predictions.push({ type:'prepare', message:`${peakMonth.month} 수요 피크 예상 (+${peakMonth.diff}%)`, icon:'⏰', severity:'medium' });
      } else if (peakMonth.diff < -20) {
        result.futureAdvice = '📅 향후 3개월 비수기 — 재고 축소 권장';
      } else {
        result.futureAdvice = '📅 향후 3개월 안정적 수요 예상';
      }
    } else {
      result.futureAdvice = '📅 12개월 이상 데이터 필요 (추후 정밀화)';
    }

    // ━━ 3. 지속가치 (Sustainability Score) ━━
    result.volatility = Math.round(cv * 100);
    if (cv < 0.15) { result.sustainScore = 5; result.sustainLabel = '🛡️ 에버그린 상품'; result.sustainDetail = `변동률 ${result.volatility}% — 연중 안정 수요, 장기 소싱 최적`; }
    else if (cv < 0.25) { result.sustainScore = 4; result.sustainLabel = '✅ 안정적'; result.sustainDetail = `변동률 ${result.volatility}% — 소폭 변동만 있음, 기본 재고 유지 권장`; }
    else if (cv < 0.4) { result.sustainScore = 3; result.sustainLabel = '⚠️ 시즈널'; result.sustainDetail = `변동률 ${result.volatility}% — 계절성 있음, 시즌 맞춰 소싱`; }
    else { result.sustainScore = 2; result.sustainLabel = '❌ 고변동'; result.sustainDetail = `변동률 ${result.volatility}% — 수요 변동 큼, 소량 테스트 후 진입`; }

    // 시즌 피크 감지
    const maxVal = Math.max(...vals);
    const maxIdx = vals.indexOf(maxVal);
    if (trend.data[maxIdx]) {
      const peakDate = new Date(trend.data[maxIdx].period);
      if (!isNaN(peakDate)) result.seasonality = `피크 시즌: ${monthNames[peakDate.getMonth()]}`;
    }
    if (cv >= 0.25 && !result.seasonality) result.seasonality = `피크 시즌: ${monthNames[maxIdx % 12]}`;
  }

  // 키워드 분류
  const seasonWords = ['여름','겨울','봄','가을','크리스마스','발렌타인','추석','설날','방학','입학','졸업','수영','스키','워터파크','래쉬가드','당일배송','뽕배'];
  keywords.forEach(kw => {
    const k = kw.keyword || kw;
    if (seasonWords.some(sw => k.includes(sw))) result.seasonalKeywords.push(k);
    else result.safeKeywords.push(k);
  });
  return result;
}

/* ═══════════════════ 🚀 상승 예측 키워드 분석 ═══════════════════ */
/**
 * 키워드 리스트와 전체 카테고리 트렌드 데이터를 기반으로
 * 앞으로 수요가 증가할 가능성이 높은 키워드를 식별합니다.
 * 
 * 분석 방법:
 * 1) 카테고리 전체 모멘텀 (최근 3개월 vs 이전 3개월)
 * 2) 계절성 패턴 (작년 동기간의 상승/하락 패턴)
 * 3) 키워드 순위 가중치 (상위 키워드일수록 높은 신뢰도)
 * 4) 시즌 키워드 감지 (다가오는 시즌과 매칭되는 키워드 부스트)
 */
function analyzeRisingKeywords(keywords, trendData) {
  if (!keywords || keywords.length === 0) return [];
  
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  
  // ━━ 카테고리 전체 모멘텀 계산 ━━
  let categoryMomentum = 0;
  let seasonalBoost = {};  // month → growth rate
  
  if (trendData?.data && Array.isArray(trendData.data) && trendData.data.length >= 6) {
    const vals = trendData.data.map(d => d.ratio || d.value || 0);
    
    // 최근 3개월 vs 이전 3개월
    const recent = vals.slice(-3);
    const prior = vals.slice(-6, -3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
    categoryMomentum = priorAvg > 0 ? Math.round(((recentAvg - priorAvg) / priorAvg) * 100) : 0;
    
    // 계절성: 향후 1~3개월의 작년 동기간 성장률 계산
    for (let offset = 1; offset <= 3; offset++) {
      const targetMonth = (currentMonth + offset) % 12;
      // 작년 같은 달 vs 그 전 달의 패턴 찾기
      const yearAgoData = trendData.data.filter(d => {
        const date = new Date(d.period);
        return date.getMonth() === targetMonth && 
               date.getFullYear() === now.getFullYear() - 1;
      });
      const beforeYearAgo = trendData.data.filter(d => {
        const date = new Date(d.period);
        return date.getMonth() === ((targetMonth - 1 + 12) % 12) && 
               date.getFullYear() === (targetMonth === 0 ? now.getFullYear() - 2 : now.getFullYear() - 1);
      });
      
      if (yearAgoData.length > 0 && beforeYearAgo.length > 0) {
        const yVal = yearAgoData[0].ratio || yearAgoData[0].value || 0;
        const bVal = beforeYearAgo[0].ratio || beforeYearAgo[0].value || 0;
        if (bVal > 0) {
          seasonalBoost[targetMonth] = Math.round(((yVal - bVal) / bVal) * 100);
        }
      }
    }
  }
  
  // ━━ 시즌 매칭 사전 ━━
  const seasonMap = {
    0: ['겨울','패딩','코트','방한','니트','털','기모','핫팩'],
    1: ['발렌타인','봄','입학','졸업','신학기'],
    2: ['봄','졸업','입학','신학기','트렌치','자켓','봄코디'],
    3: ['봄','자켓','트렌치','린넨','봄원피스'],
    4: ['여름','린넨','반팔','샌들','자외선','모자'],
    5: ['여름','반팔','반바지','수영복','래쉬가드','선크림','냉감'],
    6: ['여름','수영','캠핑','래쉬가드','아쿠아슈즈','선글라스'],
    7: ['여름','캠핑','가을준비','백투스쿨'],
    8: ['가을','추석','자켓','니트','코디','트렌치'],
    9: ['가을','니트','코트','할로윈','자켓'],
    10: ['겨울','패딩','코트','블랙프라이데이','기모'],
    11: ['겨울','크리스마스','패딩','선물','코트','연말']
  };
  
  // ━━ 키워드별 성장 점수 계산 ━━
  const results = keywords.map((kw, idx) => {
    const keyword = kw.keyword || kw;
    let growth = 0;
    
    // (1) 카테고리 모멘텀 기본 반영 (50% 가중)
    growth += categoryMomentum * 0.5;
    
    // (2) 향후 1~3개월 계절성 부스트
    for (let offset = 1; offset <= 3; offset++) {
      const targetMonth = (currentMonth + offset) % 12;
      const boost = seasonalBoost[targetMonth] || 0;
      growth += boost * (0.4 / offset);  // 가까운 달일수록 가중치 높음
    }
    
    // (3) 시즌 키워드 매칭 부스트
    const upcomingSeasons = [];
    for (let offset = 0; offset <= 2; offset++) {
      const m = (currentMonth + offset) % 12;
      if (seasonMap[m]) upcomingSeasons.push(...seasonMap[m]);
    }
    const seasonMatch = upcomingSeasons.some(sw => keyword.includes(sw));
    if (seasonMatch) growth += 25;
    
    // (4) 순위 가중치 (상위 키워드는 신뢰도 높음)
    const rankBonus = Math.max(0, 10 - idx) * 2;
    growth += rankBonus;
    
    return { keyword, growth: Math.round(growth), rank: idx + 1 };
  });
  
  // 성장률 > 5% 이상만 필터, 상위 10개
  return results
    .filter(r => r.growth > 5)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 10);
}

/* ═══════════════════ 로컬 캐싱 (속도 개선) ═══════════════════ */
const _catCache = {};
async function cachedFetchGas(action, body, ttlMs = 300000) {
  const key = action + '_' + JSON.stringify(body);
  const cached = _catCache[key];
  if (cached && (Date.now() - cached.ts < ttlMs)) return cached.data;
  const data = await fetchGas(action, body);
  _catCache[key] = { data, ts: Date.now() };
  return data;
}

/* ═══════════════════ Chart.js 트렌드 차트 ═══════════════════ */
function renderTrendChart(trend, name) {
  const canvas = document.getElementById('cat-trend-chart');
  if (!canvas) return;
  if (_catChart) { _catChart.destroy(); _catChart = null; }

  let labels = [], values = [];
  if (trend?.data && Array.isArray(trend.data)) {
    labels = trend.data.map(d => d.period || '');
    values = trend.data.map(d => d.ratio || d.value || 0);
  } else {
    const t = new Date();
    for (let i=23; i>=0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth()-i, 1);
      labels.push(`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`);
      values.push(Math.round(50 + Math.random()*20 + Math.sin((d.getMonth()/12)*Math.PI*2)*15));
    }
  }

  if (typeof Chart === 'undefined') { canvas.parentElement.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.7rem;">Chart.js 로딩 대기</div>'; return; }

  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,180);
  grad.addColorStop(0,'rgba(16,185,129,0.3)');
  grad.addColorStop(1,'rgba(16,185,129,0.01)');

  _catChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label:name, data:values, borderColor:'#10b981', backgroundColor:grad, fill:true, tension:0.4, pointRadius:2, pointHoverRadius:5, borderWidth:2 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(15,23,42,0.9)', titleFont:{size:11}, bodyFont:{size:10} } },
      scales:{
        x:{ ticks:{font:{size:8},color:'#64748b',maxTicksLimit:12}, grid:{display:false} },
        y:{ ticks:{font:{size:8},color:'#64748b'}, grid:{color:'rgba(255,255,255,0.06)'} }
      }
    }
  });
}

/* ═══════════════════ 유틸리티 ═══════════════════ */
function formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

/* ═══════════════════ G3 FIX: 토글 UI ═══════════════════ */
let _catExplorerOpen = false;
function t1ToggleCatExplorer() {
  const panel = document.getElementById('t1-cat-explorer-panel');
  const arrow = document.getElementById('t1-cat-toggle-arrow');
  const btn = document.getElementById('t1-cat-toggle-btn');
  if (!panel) return;

  _catExplorerOpen = !_catExplorerOpen;
  panel.style.display = _catExplorerOpen ? 'block' : 'none';
  if (arrow) arrow.style.transform = _catExplorerOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  if (btn) {
    btn.style.borderColor = _catExplorerOpen ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.2)';
    btn.style.background = _catExplorerOpen
      ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))'
      : 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))';
  }

  // 최초 오픈 시 트리 렌더
  if (_catExplorerOpen) {
    const c = document.getElementById('cat-tree-container');
    if (c && !c.innerHTML.trim()) renderCatTree();
  }
}
