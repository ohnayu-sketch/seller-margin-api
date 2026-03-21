/* ═══ js/t4/finance.js ═══ */
/* T4: 재무 인사이트 - 환율차트, HS-CODE, 관세, 수입규제 */

function renderCashOutComparison() {
  const container = document.getElementById('cashout-comparison');
  if (!container) return;

  const today = new Date();
  const cashOuts = [
    { date: new Date(today.getTime() + 2*86400000), desc: '도매꾹 발주 #1024', amount: 150000 },
    { date: new Date(today.getTime() + 5*86400000), desc: '1688 해외 사입 결제', amount: 480000 },
    { date: new Date(today.getTime() + 10*86400000), desc: '도매매 발주 #2031', amount: 95000 },
    { date: new Date(today.getTime() + 15*86400000), desc: '1688 2차 결제', amount: 320000 },
    { date: new Date(today.getTime() + 22*86400000), desc: '도매꾹 발주 #1089', amount: 210000 },
  ];

  const cashinEl30 = document.getElementById('cashin-30d');
  const cashIn30 = parseInt((cashinEl30?.textContent || '0').replace(/[^0-9]/g,'')) || 0;

  let totalCashOut = 0;
  const rows = cashOuts.map(co => {
    const dateStr = co.date.toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
    totalCashOut += co.amount;
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <div style="min-width:44px;text-align:center;font-size:11px;font-weight:700;color:#ef4444;">${dateStr}</div>
      <div style="width:3px;height:24px;border-radius:2px;background:#ef4444;"></div>
      <div style="flex:1;font-size:11px;color:var(--text);">${co.desc}</div>
      <div style="font-weight:800;font-size:12px;color:#ef4444;">-₩${co.amount.toLocaleString()}</div>
    </div>`;
  }).join('');

  const netFlow = cashIn30 - totalCashOut;
  const netColor = netFlow >= 0 ? '#22c55e' : '#ef4444';
  const netIcon = netFlow >= 0 ? '✅' : '🚨';

  container.innerHTML = `
    <div style="margin-bottom:10px;">${rows}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div style="background:rgba(239,68,68,0.08);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:9px;color:var(--text-muted);">30일 지출</div>
        <div style="font-size:14px;font-weight:800;color:#ef4444;">₩${totalCashOut.toLocaleString()}</div>
      </div>
      <div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:9px;color:var(--text-muted);">30일 입금</div>
        <div style="font-size:14px;font-weight:800;color:#22c55e;">₩${cashIn30.toLocaleString()}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:9px;color:var(--text-muted);">${netIcon} 순현금</div>
        <div style="font-size:14px;font-weight:800;color:${netColor};">₩${netFlow.toLocaleString()}</div>
      </div>
    </div>`;
}

// ==================== V5.5 T4 환율 변동 차트 ====================
function renderExchangeRateChart() {
  const canvas = document.getElementById('chart-exchange-rate');
  if (!canvas) return;

  const baseRate = parseFloat(localStorage.getItem('exchangeRate')) || 195;
  const labels = [], data = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    labels.push(`${d.getMonth()+1}/${d.getDate()}`);
    const variation = (Math.sin(i * 0.5) * 3) + (Math.random() * 2 - 1);
    data.push(Math.round((baseRate + variation) * 10) / 10);
  }

  const ctx = canvas.getContext('2d');
  if (window._exchangeRateChart) window._exchangeRateChart.destroy();

  window._exchangeRateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: '₩/CNY', data, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `₩${c.raw}/CNY` } } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 0, maxTicksLimit: 7 } },
        y: { ticks: { font: { size: 9 }, callback: v => `₩${v}` } }
      }
    }
  });

  const current = data[data.length-1], max = Math.max(...data), min = Math.min(...data);
  const sumEl = document.getElementById('exchange-rate-summary');
  if (sumEl) sumEl.innerHTML = `<span>현재 <b>₩${current}</b></span> · <span style="color:#22c55e;">최저 ₩${min}</span> · <span style="color:#ef4444;">최고 ₩${max}</span>`;
}

function renderMillerOrrChart(L, Z, H, sigma2) {
  const ctx = document.getElementById('chart-miller-orr');
  if (!ctx) return;
  const sigma = Math.sqrt(sigma2);

  // 30일 시뮬레이션
  const days = 30;
  const labels = [];
  const cashLine = [];
  let cash = Z;
  for (let d = 0; d < days; d++) {
    labels.push((d + 1) + '일');
    // 랜덤 워크 (정규분포 근사)
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    cash += z * sigma * 0.3;
    // Miller-Orr 정책 적용
    if (cash > H) cash = Z;
    if (cash < L) cash = Z;
    cashLine.push(Math.round(cash));
  }

  if (_moChart) _moChart.destroy();
  _moChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '현금 잔고', data: cashLine, borderColor: 'var(--accent, #38bdf8)', backgroundColor: 'rgba(56, 189, 248, 0.08)', fill: true, tension: 0.3, pointRadius: 2 },
        { label: '상한 (H)', data: Array(days).fill(H), borderColor: '#22c55e', borderDash: [6, 3], pointRadius: 0, borderWidth: 1.5 },
        { label: '목표 (Z)', data: Array(days).fill(Z), borderColor: 'var(--accent, #38bdf8)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1.5 },
        { label: '하한 (L)', data: Array(days).fill(L), borderColor: '#ef4444', borderDash: [6, 3], pointRadius: 0, borderWidth: 1.5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true, color: '#94a3b8', font: { size: 10 } } } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => (v / 10000).toFixed(0) + '만' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } }
      }
    }
  });
}

// 5. [AI Recommendations] 하위 호환
async function loadAiRecommendations() {
    if (typeof updateOpportunityRadar === 'function') updateOpportunityRadar();
}

async function refreshAiSourcing() {
    const btn = document.getElementById('ai-refresh-btn');
    if (btn) btn.classList.add('spinning');
    showToast("AI 소싱 업데이트를 요청했습니다.");
    try {
        const backendUrl = getBackendUrl();
        await fetch(`${backendUrl}/ai-sourcing-update`, { method: 'POST' });
        setTimeout(() => {
            updateOpportunityRadar();
            if (btn) btn.classList.remove('spinning');
            showToast("AI 추천 데이터가 갱신되었습니다.");
        }, 10000);
    } catch (e) {
        if (btn) btn.classList.remove('spinning');
    }
}

// 6. [Logistics] Global Sourcing Engine UI Bridge

// 실시간 환율 가져오기 (백엔드 → localStorage 캐시 → 기본값)
async function fetchLiveExchangeRate(currency = 'CNY') {
    const cacheKey = 'v5_exchange_rates';
    const cacheTimeKey = 'v5_exchange_rates_ts';
    // 1. localStorage 캐시 확인 (1시간 유효)
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        const ts = parseInt(localStorage.getItem(cacheTimeKey) || '0');
        if (cached[currency] && (Date.now() - ts) < 3600000) {
            return { rate: cached[currency], source: 'local_cache', rates: cached };
        }
    } catch(e) {}
    // 2. 백엔드 API 호출
    try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/exchange-rate`);
        const data = await res.json();
        if (data.success && data.rates) {
            localStorage.setItem(cacheKey, JSON.stringify(data.rates));
            localStorage.setItem(cacheTimeKey, String(Date.now()));
            return { rate: data.rates[currency] || 195, source: data.source, rates: data.rates };
        }
    } catch(e) {
        console.warn('[ExchangeRate] 백엔드 연결 실패, 로컬 폴백 사용');
    }
    // 3. 기본값 폴백 + 전역 변수 강제 할당 (NaN 전파 방지)
    const defaults = { USD: 1350, CNY: 195, JPY: 9.05, EUR: 1470 };
    if (!window.EXCHANGE_RATE) window.EXCHANGE_RATE = 1400;
    return { rate: defaults[currency] || 195, source: 'default', rates: defaults };
}

// 환율 리프레시 버튼 핸들러
async function refreshExchangeRate() {
    // 캐시 무효화 후 재조회
    localStorage.removeItem('v5_exchange_rates_ts');
    const result = await fetchLiveExchangeRate('CNY');
    const exRateInput = document.getElementById('global-exchange-rate');
    if (exRateInput) {
        exRateInput.value = result.rate;
        const sourceLabel = { koreaexim_live: '🟢 실시간', cached_stale: '🟡 캐시', default: '⚪ 기본값', local_cache: '🔵 로컬' };
        showToast(`환율 갱신 완료: 1 CNY = ${result.rate}원 (${sourceLabel[result.source] || result.source})`);
    }
    updateV5LandedCost();
}

async function updateV5LandedCost() {
    const cnyPrice = parseFloat(document.getElementById('global-cny-price')?.value) || 0;
    const exRate = parseFloat(document.getElementById('global-exchange-rate')?.value) || 195;
    const dutyRate = parseFloat(document.getElementById('global-tariff')?.value) || 8;
    const shipping = parseFloat(document.getElementById('global-shipping')?.value) || 0;

    // 백엔드 API 연동 시도 (정밀 계산)
    let usedBackend = false;
    try {
        const backendUrl = getBackendUrl();
        if (backendUrl && cnyPrice > 0) {
            const params = new URLSearchParams({
                local_price: cnyPrice,
                currency: 'CNY',
                category: '기타',
                weight_kg: 1.0,
                is_air: false
            });
            const res = await fetch(`${backendUrl}/landed-cost?${params}`);
            const data = await res.json();
            if (data.success) {
                usedBackend = true;
                const bd = data.breakdown;
                // 환율 필드를 백엔드 반환값으로 동기화
                const exRateInput = document.getElementById('global-exchange-rate');
                if (exRateInput && bd.exchange_rate) exRateInput.value = bd.exchange_rate;

                const landedEl = document.getElementById('global-landing-cost');
                if (landedEl) landedEl.textContent = (typeof fmt === 'function' ? fmt(data.landed_cost) : data.landed_cost) + ' 원';

                const breakdown = document.getElementById('v5-cost-breakdown');
                if (breakdown) {
                    breakdown.style.display = 'block';
                    document.getElementById('v5-break-base').textContent = (typeof fmt === 'function' ? fmt(bd.item_cost_krw) : bd.item_cost_krw) + ' 원';
                    document.getElementById('v5-break-duty').textContent = (typeof fmt === 'function' ? fmt(bd.tariff_amt) : bd.tariff_amt) + ' 원';
                    document.getElementById('v5-break-vat').textContent = (typeof fmt === 'function' ? fmt(bd.vat_amt) : bd.vat_amt) + ' 원';
                }

                if (window._v5CurrentCandidate) {
                    window._v5CurrentCandidate.estimatedBulkCost = data.landed_cost;
                    const currentCost = parseFloat(document.getElementById('costPrice')?.value) || 0;
                    window._v5CurrentCandidate.recommendWholesale = (currentCost > 0 && data.landed_cost < currentCost * 0.8) ? 'Y' : 'N';
                }
            }
        }
    } catch(e) {
        console.warn('[LandedCost] 백엔드 API 호출 실패, 로컬 폴백 사용:', e.message);
    }

    // 로컬 폴백 (백엔드 미연결 시)
    if (!usedBackend && typeof LogisticsEngine !== 'undefined') {
        const res = LogisticsEngine.calculateLandedCost({
            originalPrice: cnyPrice,
            exchangeRate: exRate,
            dutyRate: dutyRate,
            shippingCost: shipping,
            handlingFee: 0,
            isGlobal: true
        });

        const landedEl = document.getElementById('global-landing-cost');
        if (landedEl) landedEl.textContent = typeof fmt === 'function' ? fmt(res.total) + ' 원' : res.total + ' 원';

        const breakdown = document.getElementById('v5-cost-breakdown');
        if (breakdown) {
            breakdown.style.display = 'block';
            document.getElementById('v5-break-base').textContent = (typeof fmt === 'function' ? fmt(res.base) : res.base) + ' 원';
            document.getElementById('v5-break-duty').textContent = (typeof fmt === 'function' ? fmt(res.duty) : res.duty) + ' 원';
            document.getElementById('v5-break-vat').textContent = (typeof fmt === 'function' ? fmt(res.vat) : res.vat) + ' 원';
        }

        if (window._v5CurrentCandidate) {
            window._v5CurrentCandidate.estimatedBulkCost = res.total;
            const currentCost = parseFloat(document.getElementById('costPrice')?.value) || 0;
            window._v5CurrentCandidate.recommendWholesale = (currentCost > 0 && res.total < currentCost * 0.8) ? 'Y' : 'N';
        }
    }
}

// ==================== HS-CODE 관세율 조회 ====================
const HS_CODE_DB = {
  '6109': { name: '면 티셔츠/속옷', rate: 13 },
  '6110': { name: '니트/스웨터', rate: 13 },
  '6203': { name: '남성 정장/바지', rate: 13 },
  '6204': { name: '여성 의류/바지', rate: 13 },
  '6205': { name: '남성 셔츠', rate: 13 },
  '6402': { name: '운동화/고무신발', rate: 13 },
  '6403': { name: '가죽 신발', rate: 13 },
  '6404': { name: '캔버스 신발', rate: 13 },
  '4202': { name: '가방/핸드백', rate: 8 },
  '7113': { name: '귀금속 장신구', rate: 8 },
  '7117': { name: '모조 장신구', rate: 8 },
  '8471': { name: '컴퓨터/노트북', rate: 0 },
  '8517': { name: '스마트폰/무선기기', rate: 0 },
  '8528': { name: 'TV/모니터', rate: 8 },
  '8518': { name: '이어폰/스피커', rate: 8 },
  '3304': { name: '화장품/메이크업', rate: 6.5 },
  '3305': { name: '헤어제품', rate: 6.5 },
  '9503': { name: '장난감', rate: 8 },
  '9504': { name: '게임기', rate: 8 },
  '9506': { name: '운동용품', rate: 8 },
  '3926': { name: '플라스틱 제품', rate: 6.5 },
  '7323': { name: '스테인리스 주방용품', rate: 8 },
  '8516': { name: '전열기/드라이기', rate: 8 },
  '6302': { name: '침구/린넨', rate: 10 },
  '9405': { name: '조명기구', rate: 8 },
};

function setHSCode(code, name, rate) {
  const hsEl = document.getElementById('global-hs-code');
  const tariffEl = document.getElementById('global-tariff');
  const infoEl = document.getElementById('hs-code-info');
  if (hsEl) hsEl.value = code;
  if (tariffEl) { tariffEl.value = rate; }
  if (infoEl) infoEl.innerHTML = `<span style="color:var(--accent);">✅ ${name} (${code}) → 관세 ${rate}%</span>`;
  updateV5LandedCost();
}

// ★ 세관장확인대상물품 DB (HS 4자리 → 확인 의무 기관)
const CUSTOMS_INSPECTION_DB = {
  '8517': { agency: '방송통신위원회', requirement: 'KC 적합성 인증 필요 (무선기기)', risk: 'high' },
  '3304': { agency: '식품의약품안전처', requirement: '화장품 수입판매업 등록 + 안전성 서류 필요', risk: 'high' },
  '3305': { agency: '식품의약품안전처', requirement: '기능성화장품 심사 필요', risk: 'high' },
  '9503': { agency: '산업통상자원부', requirement: 'KC 안전확인 (어린이용품)', risk: 'high' },
  '8516': { agency: '산업통상자원부', requirement: 'KC 안전인증 (전열기기)', risk: 'medium' },
  '8528': { agency: '방송통신위원회', requirement: 'KC 적합성 인증 (디스플레이)', risk: 'medium' },
  '8518': { agency: '방송통신위원회', requirement: 'KC 적합성 인증 (음향기기)', risk: 'medium' },
  '9405': { agency: '산업통상자원부', requirement: 'KC 안전확인 (조명기구)', risk: 'medium' },
  '6302': { agency: '산업통상자원부', requirement: 'KC 품질표시 의무 (섬유)', risk: 'low' },
  '6109': { agency: '산업통상자원부', requirement: 'KC 품질표시 의무 (의류)', risk: 'low' },
  '6110': { agency: '산업통상자원부', requirement: 'KC 품질표시 의무 (니트)', risk: 'low' },
  '6402': { agency: '산업통상자원부', requirement: 'KC 품질표시 의무 (신발)', risk: 'low' },
  '6403': { agency: '산업통상자원부', requirement: 'KC 품질표시 의무 (가죽신발)', risk: 'low' },
};

function lookupHSCode() {
  const hsEl = document.getElementById('global-hs-code');
  const raw = (hsEl?.value || '').replace(/[^0-9]/g, '');
  if (raw.length < 4) {
    // 세관장 결과 숨김
    const ccr = document.getElementById('customs-check-result');
    if (ccr) ccr.style.display = 'none';
    return;
  }

  const key4 = raw.substring(0, 4);
  const match = HS_CODE_DB[key4];
  const infoEl = document.getElementById('hs-code-info');

  if (match) {
    const tariffEl = document.getElementById('global-tariff');
    if (tariffEl) tariffEl.value = match.rate;
    if (infoEl) infoEl.innerHTML = `<span style="color:var(--accent);">✅ ${match.name} → 관세 ${match.rate}%</span>`;
    updateV5LandedCost();
  } else {
    if (infoEl) infoEl.innerHTML = `<span style="color:var(--text-muted);">ℹ️ 코드 미등록 — 관세율을 직접 입력하세요</span>`;
  }

  // ★ 세관장확인대상물품 검사
  checkCustomsInspection(key4);
}

// ★ 세관장확인 검사 함수
function checkCustomsInspection(hsCode4) {
  const ccr = document.getElementById('customs-check-result');
  if (!ccr) return;

  const inspection = CUSTOMS_INSPECTION_DB[hsCode4];
  if (inspection) {
    const riskColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    const riskLabels = { high: '🔴 고위험', medium: '🟡 주의', low: '🟢 경미' };
    ccr.style.display = 'block';
    ccr.style.background = `rgba(${inspection.risk === 'high' ? '239,68,68' : inspection.risk === 'medium' ? '245,158,11' : '16,185,129'},0.06)`;
    ccr.style.border = `1px solid ${riskColors[inspection.risk]}30`;
    ccr.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="font-weight:700;color:${riskColors[inspection.risk]};">${riskLabels[inspection.risk]} 세관장확인 대상</span>
      </div>
      <div style="color:#64748b;line-height:1.4;">
        <div>📋 확인기관: <b>${inspection.agency}</b></div>
        <div>📝 ${inspection.requirement}</div>
      </div>`;
    SystemLogger && SystemLogger.log(`⚠️ HS ${hsCode4}: 세관장확인 대상 — ${inspection.agency}`, 'warning');
  } else {
    ccr.style.display = 'block';
    ccr.style.background = 'rgba(16,185,129,0.04)';
    ccr.style.border = '1px solid rgba(16,185,129,0.15)';
    ccr.innerHTML = `<span style="color:#10b981;font-weight:600;">✅ 세관장확인 불필요 — 일반 통관 가능</span>`;
  }
}

// ★ 관세청 과세환율 UI 업데이트 함수
function updateCustomsExchangePanel() {
  if (typeof SourcingIntel === 'undefined' || !SourcingIntel._data) return;
  const customs = SourcingIntel._data.customs;
  if (!customs || typeof customs !== 'object') {
    // Fallback: 시중 환율 기반 예상 과세 환율 표시
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('customs-usd', '~1,380');
    el('customs-cny', '~190');
    el('customs-jpy', '~9.2');
    el('customs-eur', '~1,500');
    const dateEl = document.getElementById('customs-rate-date');
    if (dateEl) dateEl.textContent = '예상치 (API 미연동)';
    return;
  }
  // 관세청 API 데이터가 있을 때
  const findRate = (cur) => {
    if (Array.isArray(customs)) {
      const found = customs.find(c => (c.cur_unit || '').includes(cur));
      return found ? found.deal_bas_r || found.bkpr || '-' : '-';
    }
    return customs[cur] || '-';
  };
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('customs-usd', findRate('USD'));
  el('customs-cny', findRate('CNY'));
  el('customs-jpy', findRate('JPY'));
  el('customs-eur', findRate('EUR'));
  const dateEl = document.getElementById('customs-rate-date');
  if (dateEl) dateEl.textContent = '관세청 고시 환율';
}

// ★ 수입규제 배너 업데이트 함수
function updateImportRegulationBanner(keyword) {
  const banner = document.getElementById('import-regulation-banner');
  const textEl = document.getElementById('import-regulation-text');
  if (!banner || !textEl) return;

  // KOTRA 수입규제 데이터 확인
  let warnings = [];
  if (typeof SourcingIntel !== 'undefined' && SourcingIntel._data.kotra) {
    const kotra = SourcingIntel._data.kotra;
    if (Array.isArray(kotra)) {
      kotra.forEach(item => {
        if (item.title && keyword && item.title.includes(keyword)) {
          warnings.push(`🌍 ${item.title}`);
        }
      });
    }
  }

  // 키워드 기반 수입규제 매핑
  const IMPORT_WARNS = {
    '식품': '식품 수입 시 식약처 수입신고 + 한글 라벨링 필수',
    '화장품': '화장품 수입판매업 등록 + 전 성분 한글 표기 의무',
    '어린이': '어린이용 제품은 KC 안전확인 + 전자파 적합성 인증 필수',
    '전자': '전기용품 KC 안전인증/확인 + 방송통신 적합성 인증 필수',
    '의약품': '의약품/건강기능식품 수입은 식약처 허가 필수',
    '배터리': '리튬 배터리 포함 제품은 UN38.3 시험성적서 필수',
  };
  Object.entries(IMPORT_WARNS).forEach(([key, msg]) => {
    if (keyword && keyword.includes(key)) warnings.push(`📋 ${msg}`);
  });

  if (warnings.length > 0) {
    banner.style.display = 'block';
    textEl.innerHTML = warnings.map(w => `<div style="margin-bottom:3px;">${w}</div>`).join('');
  } else {
    banner.style.display = 'none';
  }
}

// T2 진입 시 관세환율 패널 자동 업데이트
if (typeof AppEventBus !== 'undefined') {
  AppEventBus.on && AppEventBus.on('TAB_CHANGED', function(data) {
    if (data && data.tab === 'inventory') {
      setTimeout(updateCustomsExchangePanel, 500);
    }
  });
}
// 초기 로드 시에도 시도
setTimeout(updateCustomsExchangePanel, 3000);
function applyGlobalCost() {
    const landedText = document.getElementById('global-landing-cost')?.textContent || '0';
    const landedValue = parseInt(landedText.replace(/[^0-9]/g, '')) || 0;
    const costInput = document.getElementById('costPrice');
    if (costInput && landedValue > 0) {
        costInput.value = landedValue;
        if (typeof recalcMargin === 'function') recalcMargin();
        showToast('계산된 수입 원가를 시뮬레이터 원가 필드에 적용했습니다.');
    }
}

function switchSimulatorMode(mode) {
    const globalSec = document.getElementById('v5-global-section');
    const fieldSec = document.getElementById('v5-field-section');
    const tabs = document.querySelectorAll('.mini-tab');

    if (mode === 'global') {
        if (globalSec) globalSec.style.display = 'block';
        if (fieldSec) fieldSec.style.display = 'none';
        if (tabs[0]) tabs[0].classList.add('active');
        if (tabs[1]) tabs[1].classList.remove('active');
    } else {
        if (globalSec) globalSec.style.display = 'none';
        if (fieldSec) fieldSec.style.display = 'block';
        if (tabs[0]) tabs[0].classList.remove('active');
        if (tabs[1]) tabs[1].classList.add('active');
    }
}

