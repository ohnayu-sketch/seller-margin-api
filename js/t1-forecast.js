/**
 * @file t1-forecast.js
 * @description 🔮 미래예측 상황판 (Forecast Dashboard)
 *
 * 12개 네이버 데이터랩 대분류 카테고리를 일괄 분석하여
 * - 히트맵 테이블 (모멘텀/변동률/지속가치 한눈에)
 * - HOT 카드 (최상위 트렌드 3개)
 * - 향후 3개월 예측 타임라인
 * 을 하나의 대시보드로 보여줍니다.
 *
 * 의존성: category-explorer.js (DATALAB_CATEGORIES, analyzeTrend, cachedFetchGas)
 *          fetch-gas.js (fetchGas)
 */

/* ═══════════════════ 상수 & 상태 ═══════════════════ */
const FORECAST_CACHE_KEY = 't1_forecast_cache';
const FORECAST_CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

let _forecastState = {
  data: [],       // [{cid, name, icon, analysis, trendData, keywords}]
  loading: false,
  lastRun: 0,
  visible: false
};

/* ═══════════════════ 진입점 ═══════════════════ */
/**
 * 미래예측 상황판 토글 (소싱 레이더 피드 그리드 위에 오버레이)
 */
window.t1ToggleForecast = function() {
  _forecastState.visible = !_forecastState.visible;
  const btn = document.getElementById('t1-forecast-toggle-btn');
  
  if (_forecastState.visible) {
    _renderForecastContainer();
    if (btn) { btn.classList.add('active'); btn.style.background = 'rgba(139,92,246,0.15)'; btn.style.borderColor = '#8b5cf6'; btn.style.color = '#a78bfa'; }
    // 데이터가 없거나 캐시 만료 시 자동 로딩
    if (_forecastState.data.length === 0 || Date.now() - _forecastState.lastRun > FORECAST_CACHE_TTL) {
      _loadCachedForecast() || t1RunForecast();
    } else {
      _renderForecastDashboard();
    }
  } else {
    const panel = document.getElementById('t1-forecast-panel');
    if (panel) panel.remove();
    if (btn) { btn.classList.remove('active'); btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; }
  }
};

/**
 * 전체 12개 카테고리 일괄 분석 실행
 */
window.t1RunForecast = async function() {
  if (_forecastState.loading) return;
  _forecastState.loading = true;
  _renderForecastLoading();

  const categories = typeof DATALAB_CATEGORIES !== 'undefined' ? DATALAB_CATEGORIES : [];
  if (categories.length === 0) {
    _forecastState.loading = false;
    _renderForecastError('DATALAB_CATEGORIES 데이터를 찾을 수 없습니다.');
    return;
  }

  const results = [];
  const total = categories.length;
  
  for (let i = 0; i < total; i++) {
    const cat = categories[i];
    _updateProgress(i + 1, total, cat.name);

    try {
      // 병렬로 트렌드 + 키워드 수집
      const [trendRes, kwRes] = await Promise.allSettled([
        cachedFetchGas('naverDatalabTrend', { cid: cat.cid, name: cat.name, timeUnit: 'month' }),
        cachedFetchGas('naverDatalabKeywords', { cid: cat.cid, limit: 10 })
      ]);

      const trendData = (trendRes.status === 'fulfilled' && trendRes.value?.success) ? trendRes.value.results : null;
      const keywords = (kwRes.status === 'fulfilled' && kwRes.value?.success && kwRes.value?.keywords)
        ? kwRes.value.keywords.map(kw => typeof kw === 'string' ? { keyword: kw } : kw)
        : [];

      const analysis = typeof analyzeTrend === 'function' ? analyzeTrend(trendData, keywords) : null;

      results.push({
        cid: cat.cid,
        name: cat.name,
        icon: cat.icon,
        analysis,
        trendData,
        keywords
      });
    } catch (e) {
      console.warn(`[Forecast] ${cat.name} 분석 실패:`, e);
      results.push({ cid: cat.cid, name: cat.name, icon: cat.icon, analysis: null, trendData: null, keywords: [] });
    }

    // API 부하 방지: 배치 간 480ms 대기
    if (i < total - 1) await _delay(480);
  }

  _forecastState.data = results;
  _forecastState.lastRun = Date.now();
  _forecastState.loading = false;

  // localStorage 캐싱
  _saveForecastCache(results);

  _renderForecastDashboard();
};

/* ═══════════════════ 캐싱 ═══════════════════ */
function _saveForecastCache(data) {
  try {
    const payload = { ts: Date.now(), data: data.map(d => ({
      cid: d.cid, name: d.name, icon: d.icon, analysis: d.analysis,
      keywords: (d.keywords || []).slice(0, 10) // ★ 키워드도 캐시에 포함
    })) };
    localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(payload));
  } catch (e) { console.warn('[Forecast] 캐시 저장 실패', e); }
}

function _loadCachedForecast() {
  try {
    const raw = localStorage.getItem(FORECAST_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > FORECAST_CACHE_TTL) return false;
    _forecastState.data = parsed.data;
    _forecastState.lastRun = parsed.ts;
    return true;
  } catch (e) { return false; }
}

/* ═══════════════════ 렌더링: 컨테이너 ═══════════════════ */
function _renderForecastContainer() {
  let panel = document.getElementById('t1-forecast-panel');
  if (panel) return;

  // 카테고리 탐색기 아래에 삽입
  const anchor = document.getElementById('t1-cat-explorer-section');
  if (!anchor) return;

  panel = document.createElement('div');
  panel.id = 't1-forecast-panel';
  panel.style.cssText = 'margin-bottom:20px; border-radius:16px; border:1px solid rgba(139,92,246,0.15); background:linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,20,50,0.6)); padding:20px; animation:forecastFadeIn 0.3s ease;';
  anchor.parentNode.insertBefore(panel, anchor.nextSibling);
}

/* ═══════════════════ 렌더링: 로딩 ═══════════════════ */
function _renderForecastLoading() {
  const panel = document.getElementById('t1-forecast-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <div style="font-size:2.5rem; margin-bottom:12px; animation:forecastSpin 1.5s linear infinite;">🔮</div>
      <div style="font-size:16px; font-weight:700; color:#a78bfa; margin-bottom:8px;">미래예측 상황판 생성 중...</div>
      <div id="t1-forecast-progress" style="font-size:12px; color:#94a3b8;">12개 카테고리 트렌드 분석 시작</div>
      <div style="max-width:300px; margin:16px auto 0; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden;">
        <div id="t1-forecast-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#8b5cf6,#a78bfa); border-radius:2px; transition:width 0.4s ease;"></div>
      </div>
    </div>`;
}

function _updateProgress(current, total, name) {
  const el = document.getElementById('t1-forecast-progress');
  const bar = document.getElementById('t1-forecast-progress-bar');
  if (el) el.textContent = `${current}/${total} — ${name} 분석 중...`;
  if (bar) bar.style.width = `${Math.round((current / total) * 100)}%`;
}

function _renderForecastError(msg) {
  const panel = document.getElementById('t1-forecast-panel');
  if (!panel) return;
  panel.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;font-size:13px;">❌ ${msg}</div>`;
}

/* ═══════════════════ 렌더링: 메인 대시보드 ═══════════════════ */
function _renderForecastDashboard() {
  const panel = document.getElementById('t1-forecast-panel');
  if (!panel) return;

  const data = _forecastState.data;
  if (!data || data.length === 0) {
    _renderForecastError('분석 데이터가 없습니다.');
    return;
  }

  // 정렬: hotScore → momentum 기준
  const sorted = [...data].sort((a, b) => {
    const aScore = a.analysis?.hotScore || 0;
    const bScore = b.analysis?.hotScore || 0;
    if (bScore !== aScore) return bScore - aScore;
    return (b.analysis?.momentum || 0) - (a.analysis?.momentum || 0);
  });

  const hotTop3 = sorted.filter(d => d.analysis?.hotScore >= 3).slice(0, 3);
  const cacheAge = _forecastState.lastRun ? _formatAge(Date.now() - _forecastState.lastRun) : '없음';

  let html = `
    <!-- 헤더 -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <div style="font-size:18px; font-weight:800; color:#f1f5f9; display:flex; align-items:center; gap:8px;">
          🔮 미래예측 상황판
          <span style="font-size:10px; background:rgba(139,92,246,0.15); color:#a78bfa; padding:2px 8px; border-radius:10px;">12대분류</span>
        </div>
        <div style="font-size:11px; color:#64748b; margin-top:4px;">마지막 분석: ${cacheAge} · 캐시 TTL 6시간</div>
      </div>
      <button onclick="t1RunForecast()" style="padding:8px 16px; border-radius:8px; border:1px solid rgba(139,92,246,0.3); background:rgba(139,92,246,0.08); color:#a78bfa; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(139,92,246,0.15)'" onmouseout="this.style.background='rgba(139,92,246,0.08)'">${_forecastState.loading ? '⏳ 분석 중...' : '🔄 새로 분석'}</button>
    </div>`;

  // ━━━ HOT 카드 (상위 3개) ━━━
  if (hotTop3.length > 0) {
    html += `<div style="display:grid; grid-template-columns:repeat(${Math.min(hotTop3.length, 3)}, 1fr); gap:12px; margin-bottom:20px;">`;
    hotTop3.forEach((item, i) => {
      const a = item.analysis;
      const gradients = [
        'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.03))',
        'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))',
        'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.03))'
      ];
      const borders = ['rgba(239,68,68,0.3)', 'rgba(245,158,11,0.3)', 'rgba(59,130,246,0.3)'];
      const medals = ['🥇', '🥈', '🥉'];

      html += `
        <div style="background:${gradients[i]}; border:1px solid ${borders[i]}; border-radius:12px; padding:16px; transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-size:20px;">${medals[i]}</span>
            <span style="font-size:22px;">${item.icon}</span>
            <span style="font-size:14px; font-weight:800; color:#f1f5f9;">${item.name}</span>
          </div>
          <div style="font-size:12px; font-weight:700; color:${a?.momentum > 0 ? '#4ade80' : '#f87171'}; margin-bottom:4px;">
            ${a?.hotLabel || '—'} ${a?.momentum !== undefined ? (a.momentum > 0 ? '+' : '') + a.momentum + '%' : ''}
          </div>
          <div style="font-size:11px; color:#94a3b8; line-height:1.5;">${a?.hotDetail || '데이터 없음'}</div>
          ${a?.futureAdvice ? `<div style="font-size:10px; color:#60a5fa; margin-top:6px; background:rgba(59,130,246,0.08); padding:4px 8px; border-radius:6px;">${a.futureAdvice}</div>` : ''}
        </div>`;
    });
    html += `</div>`;
  }

  // ━━━ 히트맵 테이블 ━━━
  html += `
    <div style="overflow-x:auto; border-radius:12px; border:1px solid rgba(255,255,255,0.06);">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:rgba(22,25,32,0.8);">
            <th style="padding:10px 12px; text-align:left; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.06);">카테고리</th>
            <th style="padding:10px 8px; text-align:center; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.06);">🔥 트렌드</th>
            <th style="padding:10px 8px; text-align:center; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.06);">📈 모멘텀</th>
            <th style="padding:10px 8px; text-align:center; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.06);">📊 변동률</th>
            <th style="padding:10px 8px; text-align:center; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.06);">🛡️ 지속가치</th>
            <th style="padding:10px 8px; text-align:left; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.06);">📅 향후 예측</th>
          </tr>
        </thead>
        <tbody>`;

  sorted.forEach((item, idx) => {
    const a = item.analysis;
    const rowBg = idx % 2 === 0 ? 'rgba(22,25,32,0.4)' : 'rgba(22,25,32,0.2)';
    const momentumColor = (a?.momentum || 0) > 15 ? '#4ade80' : (a?.momentum || 0) > 0 ? '#86efac' : (a?.momentum || 0) > -10 ? '#94a3b8' : '#f87171';
    const hotBadge = _getHotBadge(a?.hotScore);
    const sustainBadge = _getSustainBadge(a?.sustainScore);
    const volatilityBar = _getVolatilityBar(a?.volatility || 0);
    const rowId = `forecast-row-${item.cid}`;
    const kwCount = (item.keywords || []).length;

    html += `
      <tr id="${rowId}" style="background:${rowBg}; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background='rgba(139,92,246,0.06)'" onmouseout="this.style.background='${rowBg}'" onclick="window._toggleForecastKeywords('${item.cid}')">
        <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.03);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">${item.icon}</span>
            <span style="font-weight:700; color:#e2e8f0;">${item.name}</span>
            ${kwCount > 0 ? `<span style="font-size:9px; background:rgba(139,92,246,0.15); color:#a78bfa; padding:1px 6px; border-radius:8px;">${kwCount}키워드 ▼</span>` : ''}
          </div>
        </td>
        <td style="padding:10px 8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.03);">${hotBadge}</td>
        <td style="padding:10px 8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.03);">
          <span style="font-weight:700; color:${momentumColor};">${a?.momentum !== undefined ? (a.momentum > 0 ? '+' : '') + a.momentum + '%' : '—'}</span>
        </td>
        <td style="padding:10px 8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.03);">${volatilityBar}</td>
        <td style="padding:10px 8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.03);">${sustainBadge}</td>
        <td style="padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.03);">
          <div style="font-size:11px; color:#94a3b8; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a?.futureAdvice || '—'}</div>
        </td>
      </tr>
      <tr id="${rowId}-kw" style="display:none;">
        <td colspan="6" style="padding:0; border-bottom:1px solid rgba(139,92,246,0.1);">
          <div id="${rowId}-kw-body" style="background:rgba(30,20,50,0.5); padding:12px 16px;"></div>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;

  // ━━━ 향후 3개월 타임라인 ━━━
  html += _renderTimeline(sorted);

  panel.innerHTML = html;
}

/* ═══════════════════ 서브 렌더러 ═══════════════════ */
function _getHotBadge(score) {
  if (!score) return '<span style="color:#475569;">—</span>';
  const configs = {
    5: { label: '🔥강력', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    4: { label: '📈상승', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    3: { label: '➖보합', bg: 'rgba(100,116,139,0.1)', color: '#94a3b8' },
    2: { label: '📉하락', bg: 'rgba(96,165,250,0.1)', color: '#60a5fa' }
  };
  const c = configs[score] || configs[2];
  return `<span style="padding:3px 8px; border-radius:8px; font-size:10px; font-weight:700; background:${c.bg}; color:${c.color};">${c.label}</span>`;
}

function _getSustainBadge(score) {
  if (!score) return '<span style="color:#475569;">—</span>';
  const configs = {
    5: { label: '에버그린', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    4: { label: '안정', bg: 'rgba(16,185,129,0.1)', color: '#34d399' },
    3: { label: '시즈널', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
    2: { label: '고변동', bg: 'rgba(239,68,68,0.1)', color: '#f87171' }
  };
  const c = configs[score] || configs[2];
  return `<span style="padding:3px 8px; border-radius:8px; font-size:10px; font-weight:600; background:${c.bg}; color:${c.color};">${c.label}</span>`;
}

function _getVolatilityBar(v) {
  const pct = Math.min(v, 100);
  const barColor = v < 15 ? '#10b981' : v < 25 ? '#34d399' : v < 40 ? '#f59e0b' : '#ef4444';
  return `<div style="display:flex;align-items:center;gap:6px;justify-content:center;">
    <div style="width:50px;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;"></div>
    </div>
    <span style="font-size:10px;color:${barColor};font-weight:600;">${v}%</span>
  </div>`;
}

function _renderTimeline(sorted) {
  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const now = new Date();
  const months = [1, 2, 3].map(offset => monthNames[(now.getMonth() + offset) % 12]);

  // 시즌 키워드 예시
  const seasonHints = {
    '1월': '겨울 아이템, 기모, 방한',
    '2월': '발렌타인, 봄 준비, 입학',
    '3월': '봄 신학기, 트렌치코트',
    '4월': '봄 아이템, 린넨, 자외선',
    '5월': '여름 준비, 선크림, 냉감',
    '6월': '여름 본격, 수영복, 래쉬가드',
    '7월': '캠핑, 수상레저, 아쿠아',
    '8월': '백투스쿨, 가을 준비',
    '9월': '추석, 가을 니트, 자켓',
    '10월': '가을, 할로윈, 코트',
    '11월': '겨울 시작, 블랙프라이데이',
    '12월': '크리스마스, 연말 선물'
  };

  let html = `
    <div style="margin-top:20px; padding:16px; background:rgba(22,25,32,0.5); border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:14px; font-weight:700; color:#f1f5f9; margin-bottom:12px;">📅 향후 3개월 소싱 타임라인</div>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">`;

  months.forEach((month, i) => {
    const hint = seasonHints[month] || '';
    const peakCats = sorted.filter(d => {
      const sa = d.analysis?.seasonality || '';
      return sa.includes(month);
    }).slice(0, 2);

    html += `
      <div style="background:rgba(30,34,48,0.6); border-radius:10px; padding:14px; border:1px solid rgba(255,255,255,0.04);">
        <div style="font-size:14px; font-weight:800; color:#${i === 0 ? 'a78bfa' : i === 1 ? '60a5fa' : '94a3b8'}; margin-bottom:6px;">
          ${i === 0 ? '🔜' : i === 1 ? '📌' : '🔭'} ${month}
        </div>
        <div style="font-size:10px; color:#64748b; margin-bottom:8px;">${hint}</div>
        ${peakCats.length > 0 ? peakCats.map(c => `<div style="font-size:11px; color:#e2e8f0; display:flex; align-items:center; gap:4px; margin-top:3px;">${c.icon} ${c.name} <span style="color:#f59e0b; font-size:9px; font-weight:700;">피크</span></div>`).join('') : '<div style="font-size:10px; color:#475569;">특이 피크 없음</div>'}
      </div>`;
  });

  html += `</div></div>`;
  return html;
}

/* ═══════════════════ 키워드 드릴다운 ═══════════════════ */

/**
 * 히트맵 행 클릭 → 상품 키워드 아코디언 토글
 */
window._toggleForecastKeywords = function(cid) {
  const kwRow = document.getElementById(`forecast-row-${cid}-kw`);
  if (!kwRow) return;

  const isOpen = kwRow.style.display !== 'none';
  // 기존 열린 키워드 행 모두 닫기
  document.querySelectorAll('[id$="-kw"]').forEach(el => { if (el.id.startsWith('forecast-row-')) el.style.display = 'none'; });

  if (isOpen) return; // 이미 열려있으면 닫기만

  kwRow.style.display = '';
  const body = document.getElementById(`forecast-row-${cid}-kw-body`);
  if (!body) return;

  const catData = _forecastState.data.find(d => d.cid === cid);
  const keywords = catData?.keywords || [];

  if (keywords.length === 0) {
    body.innerHTML = `<div style="font-size:12px; color:#64748b; text-align:center; padding:12px;">🔍 이 카테고리의 상품 키워드 데이터가 없습니다. '새로 분석'을 실행해주세요.</div>`;
    return;
  }

  let kwHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span style="font-size:13px; font-weight:700; color:#a78bfa;">🔎 ${catData.icon} ${catData.name} — 인기 상품 키워드</span>
      <span style="font-size:10px; color:#64748b;">${keywords.length}개 감지</span>
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">`;

  keywords.forEach((kw, i) => {
    const keyword = typeof kw === 'string' ? kw : (kw.keyword || kw.name || '');
    if (!keyword) return;
    const rank = i + 1;
    const isTop3 = rank <= 3;
    const bgColor = isTop3 ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.06)';
    const borderColor = isTop3 ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)';
    const textColor = isTop3 ? '#fb923c' : '#c4b5fd';
    const badge = isTop3 ? ['🥇','🥈','🥉'][i] : `#${rank}`;
    const ratio = kw.ratio || kw.searchVolume || '';

    kwHtml += `
      <div onclick="window._forecastSearchKeyword('${keyword.replace(/'/g, "\\'")}')"
        style="display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; 
               background:${bgColor}; border:1px solid ${borderColor}; cursor:pointer;
               transition:all 0.2s; flex-shrink:0;"
        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(139,92,246,0.15)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <span style="font-size:11px; min-width:20px;">${badge}</span>
        <span style="font-size:12px; font-weight:700; color:${textColor};">${keyword}</span>
        ${ratio ? `<span style="font-size:9px; color:#64748b; margin-left:4px;">(${ratio})</span>` : ''}
        <span style="font-size:9px; color:#6366f1;">🔗소싱</span>
      </div>`;
  });

  kwHtml += `</div>
    <div style="margin-top:10px; font-size:10px; color:#475569;">💡 키워드 클릭 → T1 소싱 검색에 자동 입력됩니다</div>`;
  body.innerHTML = kwHtml;
};

/**
 * 키워드 클릭 → T1 소싱 검색에 자동 입력 + 검색 실행
 */
window._forecastSearchKeyword = function(keyword) {
  const searchInput = document.getElementById('v5-search');
  if (searchInput) {
    searchInput.value = keyword;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // 미래예측 상황판 닫기
  _forecastState.visible = false;
  const panel = document.getElementById('t1-forecast-panel');
  if (panel) panel.remove();
  const btn = document.getElementById('t1-forecast-toggle-btn');
  if (btn) { btn.classList.remove('active'); btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; }
  // 검색 실행
  const searchBtn = document.getElementById('v5-search-btn') || document.querySelector('[onclick*="v7Search"]');
  if (searchBtn) searchBtn.click();
  if (typeof showToast === 'function') showToast(`🔎 "${keyword}" 소싱 검색 실행`);
};

/* ═══════════════════ 유틸 ═══════════════════ */
function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function _formatAge(ms) {
  if (ms < 60000) return '방금 전';
  if (ms < 3600000) return `${Math.round(ms / 60000)}분 전`;
  return `${Math.round(ms / 3600000)}시간 전`;
}

/* ═══════════════════ CSS 애니메이션 (동적 삽입) ═══════════════════ */
(function injectForecastStyles() {
  if (document.getElementById('forecast-styles')) return;
  const style = document.createElement('style');
  style.id = 'forecast-styles';
  style.textContent = `
    @keyframes forecastFadeIn {
      from { opacity:0; transform:translateY(10px); }
      to { opacity:1; transform:translateY(0); }
    }
    @keyframes forecastSpin {
      from { transform:rotate(0deg); }
      to { transform:rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
})();
