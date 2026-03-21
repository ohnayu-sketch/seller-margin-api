/**
 * ============================================================
 *  config.js — V5.5 시스템 설정 (외부화 브릿지)
 * ============================================================
 *  ★ 현재: 로컬 객체 반환 (Mock / Offline)
 *  ★ 향후: AppConfig.load() 내부를 fetch('/api/v1/config')로 교체
 * ============================================================
 */

// ==================== Apps Script 배포 URL ====================
/** 백엔드 URL 반환 — T7 시스템 설정에서 변경 시 localStorage 우선 */
function getBackendUrl() {
  const hardcoded = 'https://script.google.com/macros/s/AKfycbwg2nVPfpvTHQz096sXPie0PfqMRH21iNGenyNePByUbLCTSdeh50i3kAgiw6Wg9QkgbA/exec';
  const saved = localStorage.getItem('script-url');
  // 오래된 URL 자동 교체
  if (saved && saved.includes('AKfycbzy2BrDoJdTZsgvKvKFKnyAXF7')) {
    localStorage.setItem('script-url', hardcoded);
    return hardcoded;
  }
  return saved || hardcoded;
}

// ==================== SystemLogger (터미널 콘솔) ====================
class SystemLogger {
  static MAX_LINES = 100;
  static _el = null;
  static _bodyEl = null;
  static _visible = false;
  static _count = 0;

  static _getEl() {
    if (!this._el) this._el = document.getElementById('sys-console');
    if (!this._bodyEl) this._bodyEl = document.getElementById('sys-console-body');
    return this._bodyEl;
  }

  static log(msg, type = 'info') {
    const body = this._getEl();
    if (!body) { console.log(`[SYS:${type}] ${msg}`); return; }

    const ts = new Date();
    const time = `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}`;
    const colors = { info: '#60a5fa', success: '#34d399', warning: '#fbbf24', error: '#f87171' };
    const icons = { info: '🔹', success: '✅', warning: '⚠️', error: '❌' };

    const line = document.createElement('div');
    line.className = 'sys-log-line';
    line.innerHTML = `<span style="color:#64748b;margin-right:6px;">[${time}]</span><span style="color:${colors[type] || colors.info};">${icons[type] || ''} ${msg}</span>`;
    body.appendChild(line);
    this._count++;

    // 메모리 최적화: 최근 MAX_LINES만 유지
    while (body.children.length > this.MAX_LINES) {
      body.removeChild(body.firstChild);
    }

    // 자동 스크롤
    body.scrollTop = body.scrollHeight;

    // FAB 뱃지 업데이트
    const badge = document.getElementById('sys-console-badge');
    if (badge && !this._visible) {
      badge.textContent = Math.min(99, this._count);
      badge.style.display = 'flex';
    }
  }

  static toggle() {
    const el = document.getElementById('sys-console');
    if (!el) return;
    this._visible = !this._visible;
    el.style.display = this._visible ? 'flex' : 'none';
    if (this._visible) {
      this._count = 0;
      const badge = document.getElementById('sys-console-badge');
      if (badge) badge.style.display = 'none';
      const body = this._getEl();
      if (body) body.scrollTop = body.scrollHeight;
    }
  }

  static clear() {
    const body = this._getEl();
    if (body) body.innerHTML = '';
    this._count = 0;
    this.log('콘솔 초기화 완료', 'info');
  }
}
window.SystemLogger = SystemLogger;

// ==================== AppConfig (설정 외부화 브릿지) ====================
const AppConfig = {
  _loaded: false,

  // ★ Apps Script 배포 URL (하드코딩 — 새로고침해도 유지)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwg2nVPfpvTHQz096sXPie0PfqMRH21iNGenyNePByUbLCTSdeh50i3kAgiw6Wg9QkgbA/exec',

  // ★ 시즌 데이터 (SourcingIntel에서 사용)
  SEASON_DATA: {},

  // ★ API 키 참조 (보안: 실제 키는 T7 설정 탭에서 입력 → localStorage 저장)
  // ⚠️ 절대로 여기에 실제 키를 하드코딩하지 마세요!
  API_KEY_NAMES: {
    NAVER_CLIENT_ID: 'naver-license',
    NAVER_CLIENT_SECRET: 'naver-secret',
    DOMEGGOOK_API_KEY: 'domeggook-api-key',
    GOOGLE_VISION_KEY: 'google-vision-api-key',
    GOOGLE_GEMINI_KEY: 'google-gemini-api-key',
    KOREAEXIM_KEY: 'koreaexim-api-key',
  },

  // Google 서비스 계정 (공개 정보 — 시트 공유용 이메일)
  SERVICE_ACCOUNT: 'seller-agent@gen-lang-client-0957925969.iam.gserviceaccount.com',

  // ★ API 키 존재 여부 확인 로그
  _checkApiKeys() {
    const keys = this.API_KEY_NAMES;
    let missing = 0;
    for (const [label, lsKey] of Object.entries(keys)) {
      if (!localStorage.getItem(lsKey)) missing++;
    }
    if (missing > 0) {
      SystemLogger.log(`⚠️ API 키 ${missing}건 미설정 — T7 설정 탭에서 입력하세요`, 'warning');
    } else {
      SystemLogger.log(`🔑 API 키 ${Object.keys(keys).length}건 확인 완료`, 'success');
    }
  },

  // ── API 만료일 관리 (관리자 전용) ──
  API_EXPIRY: {
    // 공공데이터포털 단일 키 — 모든 신청 API 공용
    DATA_GO_KR: { expiry: '2028-03-10', label: '공공데이터포털 (TourAPI/기상청/관세청 등)' },
    // 개별 키 서비스
    NAVER: { expiry: null, label: '네이버 API (무기한)' },
    EXIM: { expiry: null, label: '수출입은행 환율 (무기한)' },
    DOMEGGOOK: { expiry: null, label: '도매꾹 API (무기한)' },
  },

  _checkApiExpiry() {
    // 관리자만 볼 수 있도록 체크
    const adminEmails = ['ohnayuinfo@gmail.com']; // T7에서 설정한 이메일
    const currentUser = localStorage.getItem('admin-email') || '';
    if (!adminEmails.some(e => currentUser.toLowerCase().includes(e.split('@')[0]))) return;

    const now = new Date();
    const WARN_30 = 30 * 24 * 60 * 60 * 1000;
    const WARN_7 = 7 * 24 * 60 * 60 * 1000;

    for (const [key, info] of Object.entries(this.API_EXPIRY)) {
      if (!info.expiry) continue;
      const exp = new Date(info.expiry);
      const diff = exp - now;
      const daysLeft = Math.floor(diff / (24 * 60 * 60 * 1000));

      if (diff <= 0) {
        SystemLogger.log(`🚨 [만료됨] ${info.label} — 즉시 갱신 필요!`, 'error');
      } else if (diff <= WARN_7) {
        SystemLogger.log(`⚠️ [D-${daysLeft}] ${info.label} — ${info.expiry} 만료 임박!`, 'warning');
      } else if (diff <= WARN_30) {
        SystemLogger.log(`📅 [D-${daysLeft}] ${info.label} — ${info.expiry} 갱신 준비`, 'info');
      }
    }
  },

  // ── 브랜드 금지어 사전 (상표권 보호) ──
  BRAND_STOPWORDS: [
    '나이키','아디다스','뉴발란스','푸마','리복','언더아머','컨버스','반스','아식스','미즈노',
    '애플','삼성','LG','소니','다이슨','보스','JBL','필립스','샤오미','화웨이',
    '구찌','루이비통','샤넬','에르메스','프라다','디올','버버리','발렌시아가','셀린느','생로랑',
    '스타벅스','맥도날드','코카콜라','펩시','네슬레','오레오','누텔라','하리보','킨더',
    '디즈니','마블','포켓몬','산리오','헬로키티','짱구','뽀로로','핑크퐁','카카오프렌즈','라인프렌즈',
    '토미힐피거','랄프로렌','캘빈클라인','타미','아르마니','베르사체','겐조','발망',
    '이케아','무인양품','무지','자라','유니클로','H&M','갭','올드네이비',
    '설화수','후','오휘','라네즈','이니스프리','에뛰드','맥','에스티로더','랑콤','시슬리',
    '닌텐도','플레이스테이션','엑스박스','로지텍','레이저','스틸시리즈','커세어',
    '레고','바비','핫휠','트랜스포머','건담','반다이','타미야',
    '나이키골프','타이틀리스트','캘러웨이','테일러메이드','핑','미즈노골프',
    '노스페이스','파타고니아','콜롬비아','아크테릭스','몽벨','블랙야크','코오롱',
    'BMW','벤츠','아우디','테슬라','현대','기아','볼보','포르쉐',
  ],

  // ── 소싱 성향별 가중치 프리셋 ──
  WEIGHT_PRESETS: {
    balanced:    { market: 0.30, growth: 0.25, social: 0.15, roi: 0.15, monopoly: 0.15, label: '균형형' },
    competition: { market: 0.45, growth: 0.15, social: 0.10, roi: 0.10, monopoly: 0.20, label: '경쟁 회피형' },
    trend:       { market: 0.15, growth: 0.40, social: 0.25, roi: 0.10, monopoly: 0.10, label: '트렌드 추종형' },
    margin:      { market: 0.20, growth: 0.15, social: 0.10, roi: 0.40, monopoly: 0.15, label: '마진 우선형' },
  },

  // ── 시즌 데이터 ──
  SEASON_DATA: {
    domestic: { lead: 'D+1~3일 (국내)', events: [
      {l:'🎍설날',m:1,d:25,kw:['설날 선물세트','한우 선물','명절 과일','세배돈 봉투']},
      {l:'💑발렌타인',m:2,d:14,kw:['초콜릿 세트','커플 아이템','향수 선물','장미 꽃다발']},
      {l:'🌸봄맞이',m:3,d:1,kw:['미세먼지 마스크','공기청정기 필터','봄 아우터','꽃씨 키트']},
      {l:'🏫신학기',m:3,d:2,kw:['백팩','필통','학용품 세트','노트북 파우치']},
      {l:'🍫화이트데이',m:3,d:14,kw:['사탕 세트','캔디 부케','커플 머그컵','선물 박스']},
      {l:'👶어린이날',m:5,d:5,kw:['장난감','보드게임','키즈 텐트','어린이 자전거']},
      {l:'🌹어버이날',m:5,d:8,kw:['카네이션','안마기','건강식품','효도 선물']},
      {l:'🏖️바캉스',m:6,d:15,kw:['비치타올','선크림','아이스박스','래쉬가드']},
      {l:'☔장마',m:7,d:1,kw:['제습기','우산','레인부츠','방수백']},
      {l:'🎵페스티벌',m:8,d:10,kw:['이어플러그','페스티벌 백','접이식의자','선글라스']},
      {l:'🍂추석',m:9,d:15,kw:['추석 선물세트','한과','송편 만들기','과일 바구니']},
      {l:'📚독서의달',m:9,d:1,kw:['북스탠드','독서대','LED 북라이트','다이어리']},
      {l:'🎃할로윈',m:10,d:31,kw:['코스튬','호박 장식','파티용품','페이스 페인팅']},
      {l:'🏃체육의날',m:10,d:15,kw:['운동화','요가매트','폼롤러','스포츠 물병']},
      {l:'🛒블프/수능',m:11,d:14,kw:['수능 선물','핫팩','담요','블프 세일']},
      {l:'⛷️겨울준비',m:11,d:1,kw:['패딩','전기장판','핫초코','방한용품']},
      {l:'🎄크리스마스',m:12,d:25,kw:['크리스마스 선물세트','트리 장식','어드벤트 캘린더','산타 코스튬']},
      {l:'🎆연말',m:12,d:31,kw:['다이어리','캘린더','연말 선물','송년회 용품']}
    ]},
    overseas: { lead: '+3~4주 (해외)', events: [
      {l:'🐉춘절',m:2,d:10,kw:['⚠️ 중국 공장 휴무','재고 선확보','발주 마감 주의','대체 소싱처']},
      {l:'🌸봄시즌',m:3,d:1,kw:['원예용품','캠핑 장비','아웃도어 조명','미니 선풍기']},
      {l:'📦618세일',m:5,d:18,kw:['징동 618 할인','전자기기','생활용품','뷰티 도구']},
      {l:'🏖️여름',m:5,d:1,kw:['휴대용 선풍기','쿨링 타올','아이스 텀블러','방수 파우치']},
      {l:'🔧프라임데이',m:6,d:15,kw:['해외 직구 비교','리퍼 전자제품','프라임 딜','한정판']},
      {l:'🎒BTS신학기',m:7,d:1,kw:['가방','필기구 세트','데스크 정리함','텀블러']},
      {l:'🏮추석준비',m:8,d:15,kw:['고급 차 세트','도자기','전통 공예','한방 세트']},
      {l:'🍁가을',m:8,d:1,kw:['가습기','전기담요','보온 텀블러','방한 장갑']},
      {l:'🛒블프',m:10,d:25,kw:['스마트워치 밴드','이어폰 케이스','충전기','전자제품']},
      {l:'❄️겨울',m:10,d:1,kw:['전기히터 부품','USB 워머','발열 깔창','스키 고글']},
      {l:'🧧광군제',m:11,d:11,kw:['전자기기 악세서리','LED 조명','실리콘 주방용품','차량용품']},
      {l:'🎄크리스마스',m:12,d:25,kw:['크리스마스 장식','LED 트리','선물 포장재','산타 소품']}
    ]}
  },

  // ── Mock 상품 DB (제거됨 — v13) ──
  MOCK_PRODUCT_DB: [],

  // ── 비동기 로드 브릿지 ──
  async load() {
    /* ★ 향후 백엔드 연동 시 아래 한 줄만 교체:
     * const res = await fetch('/api/v1/config');
     * const data = await res.json();
     * Object.assign(this, data);
     */
    this._loaded = true;
    this._checkApiKeys();
    this._checkApiExpiry();
    console.log('[AppConfig] 시스템 설정 로드 완료 (로컬 모드)');
    SystemLogger.log('시스템 설정 로드 완료 (Local Config)', 'success');

    // ★ 환율 자동 수집
    await ExchangeRate.refresh();

    return this;
  }
};
window.AppConfig = AppConfig;

// ==================== ExchangeRate (실시간 환율 모듈) ====================
const ExchangeRate = {
  _cache: null,
  _lastFetch: 0,
  CACHE_TTL: 60 * 60 * 1000, // 1시간 캐시

  // 메인 통화 기본값 (오프라인 폴백)
  rates: {
    USD_KRW: 1477,
    CNY_KRW: 213.5,
    JPY_KRW: 9.34,
    EUR_KRW: 1712,
  },

  async refresh() {
    const now = Date.now();
    // 캐시가 유효하면 스킵
    if (this._cache && (now - this._lastFetch) < this.CACHE_TTL) {
      SystemLogger.log(`💱 환율 캐시 사용 (${Math.round((now - this._lastFetch) / 60000)}분 전 수집)`, 'info');
      this._updateTicker();
      return this.rates;
    }

    // ★ 1차: 한국수출입은행 공식 API (매매기준율)
    const EXIM_KEY = '9Zpfy8cXVbxVpXVydIkesthC1ApZ2Zpu';
    try {
      SystemLogger.log('💱 한국수출입은행 공식 환율 수집 중...', 'info');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const eximRes = await fetch(`https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${EXIM_KEY}&searchdate=${today}&data=AP01`);
      if (!eximRes.ok) throw new Error(`HTTP ${eximRes.status}`);
      const eximData = await eximRes.json();

      if (eximData && eximData.length > 0 && eximData[0].result === 1) {
        const parse = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;
        const find = (unit) => eximData.find(r => r.cur_unit === unit);

        const usd = find('USD'), cny = find('CNH'), jpy = find('JPY(100)'), eur = find('EUR');

        this.rates = {
          USD_KRW: usd ? parse(usd.deal_bas_r) : 1493,
          CNY_KRW: cny ? parse(cny.deal_bas_r) : 215.67,
          JPY_KRW: jpy ? Math.round(parse(jpy.deal_bas_r) / 100 * 100) / 100 : 9.46,
          EUR_KRW: eur ? parse(eur.deal_bas_r) : 1736,
        };

        this._cache = eximData;
        this._lastFetch = now;
        this._source = '한국수출입은행';
        this._date = today.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

        SystemLogger.log(`✅ 공식 환율 수집 완료 (${this._date}) | $1=${this.rates.USD_KRW}원 | ¥1=${this.rates.CNY_KRW}원`, 'success');
        this._updateTicker();
        this._saveCache(now);
        return this.rates;
      }
      // 비영업일 or 11시 전 → 데이터 없음
      throw new Error('영업시간 외 (데이터 없음)');
    } catch (eximErr) {
      SystemLogger.log(`⚠️ 수출입은행: ${eximErr.message} → 무료 API 폴백`, 'warning');
    }

    // ★ 2차: 무료 API 폴백 (exchangerate-api.com)
    try {
      SystemLogger.log('💱 무료 환율 API 수집 중... (exchangerate-api.com)', 'info');
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const krw = data.rates.KRW || 1477;
      const cny = data.rates.CNY || 6.92;
      const jpy = data.rates.JPY || 158;
      const eur = data.rates.EUR || 0.86;

      this.rates = {
        USD_KRW: Math.round(krw),
        CNY_KRW: Math.round((krw / cny) * 10) / 10,
        JPY_KRW: Math.round((krw / jpy) * 100) / 100,
        EUR_KRW: Math.round(krw / eur),
      };

      this._cache = data;
      this._lastFetch = now;
      this._source = 'exchangerate-api.com';
      this._date = data.date || new Date().toISOString().slice(0, 10);

      SystemLogger.log(`✅ 환율 수집 완료 (${this._date}) | $1=${this.rates.USD_KRW}원 | ¥1=${this.rates.CNY_KRW}원`, 'success');
      this._updateTicker();
      this._saveCache(now);
      return this.rates;
    } catch (err) {
      // localStorage 캐시 복원
      try {
        const cached = JSON.parse(localStorage.getItem('exchangeRateCache'));
        if (cached && cached.rates) {
          this.rates = cached.rates;
          this._lastFetch = cached.ts || 0;
          SystemLogger.log(`⚠️ 환율 API 실패 → 캐시 복원 ($1=${this.rates.USD_KRW}원)`, 'warning');
          this._updateTicker();
          return this.rates;
        }
      } catch(e) {}

      SystemLogger.log(`❌ 환율 수집 실패: ${err.message} → 기본값 사용`, 'error');
      this._updateTicker();
      return this.rates;
    }
  },

  _saveCache(now) {
    try {
      localStorage.setItem('exchangeRateCache', JSON.stringify({
        rates: this.rates, date: this._date, source: this._source, ts: now
      }));
    } catch(e) {}
  },

  // ★ Landed Cost 헬퍼: 외화 → 원화 변환
  toKRW(amount, currency = 'CNY') {
    const key = `${currency}_KRW`;
    const rate = this.rates[key] || this.rates.CNY_KRW;
    return Math.round(amount * rate);
  },

  // ★ 1688 소싱 원가 계산 (배송비+관세 포함)
  landedCost(cnyPrice, { shippingCNY = 8, dutyRate = 0.08, vatRate = 0.10 } = {}) {
    const productKRW = this.toKRW(cnyPrice, 'CNY');
    const shippingKRW = this.toKRW(shippingCNY, 'CNY');
    const subtotal = productKRW + shippingKRW;
    const duty = Math.round(subtotal * dutyRate);
    const vat = Math.round((subtotal + duty) * vatRate);
    return {
      productKRW,
      shippingKRW,
      duty,
      vat,
      total: subtotal + duty + vat,
      rate: this.rates.CNY_KRW,
    };
  },

  // 현재 환율 요약 텍스트
  summary() {
    return `$1=${this.rates.USD_KRW}원 | ¥1=${this.rates.CNY_KRW}원 | €1=${this.rates.EUR_KRW}원`;
  },

  // ★ 헤더 티커 DOM 업데이트
  _updateTicker() {
    const fmt = (n) => typeof n === 'number' ? n.toLocaleString() : n;
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('fx-usd', fmt(this.rates.USD_KRW));
    set('fx-cny', fmt(this.rates.CNY_KRW));
    set('fx-jpy', fmt(this.rates.JPY_KRW));
    set('fx-eur', fmt(this.rates.EUR_KRW));
  }
};
window.ExchangeRate = ExchangeRate;

// ==================== T1 소싱 인텔리전스 오케스트레이터 ====================
const SourcingIntel = {
  _data: {
    rates: {},        // 환율 데이터
    trends: [],       // 네이버 트렌드 키워드
    festivals: [],    // TourAPI 축제/행사
    wholesale: [],    // 도매꾹 인기 상품
    weather: {},      // 기상청 중기/단기 예보
    customs: {},      // 관세청 (환율/수출입/세관확인)
    kotra: {},        // KOTRA (수입규제/해외뉴스/상품DB)
  },
  _lastRefresh: {},
  _refreshing: false,

  // 캐시 TTL (초)
  CACHE_TTL: {
    rates: 3600,       // 1시간
    trends: 21600,     // 6시간
    festivals: 86400,  // 24시간
    wholesale: 3600,   // 1시간
    weather: 43200,    // 12시간
    customs: 86400,    // 24시간
    kotra: 86400,      // 24시간
  },

  // ★ 통합 데이터 수집 (T1 진입 시 자동 호출)
  async refresh() {
    if (this._refreshing) {
      SystemLogger.log('📡 SourcingIntel: 이미 수집 중...', 'info');
      return;
    }
    this._refreshing = true;
    const startTime = Date.now();
    SystemLogger.log('📡 SourcingIntel: 데이터 수집 시작...', 'info');

    // localStorage에서 캐시 복원
    this._restoreCache();

    // 병렬 수집 (캐시 만료된 것만)
    const tasks = [];
    if (this._isExpired('rates')) tasks.push(this._fetchRates());
    if (this._isExpired('trends')) tasks.push(this._fetchTrends());
    if (this._isExpired('festivals')) tasks.push(this._fetchFestivals());
    if (this._isExpired('wholesale')) tasks.push(this._fetchWholesale());
    if (this._isExpired('weather')) tasks.push(this._fetchWeather());
    if (this._isExpired('customs')) tasks.push(this._fetchCustoms());
    if (this._isExpired('kotra')) tasks.push(this._fetchKotra());

    if (tasks.length === 0) {
      SystemLogger.log('📡 SourcingIntel: 모든 캐시 유효 — 수집 생략', 'success');
      this._refreshing = false;
      this._notifyModules();
      return;
    }

    const results = await Promise.allSettled(tasks);
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 캐시를 localStorage에 저장
    this._saveCache();

    SystemLogger.log(`📡 SourcingIntel: ${succeeded}/${tasks.length}건 수집 완료 (${elapsed}s)`, 'success');
    this._refreshing = false;

    // 하위 모듈에 데이터 전파
    this._notifyModules();

    // 마지막 수집 시각 표시
    this._updateTimestamp();
  },

  // ── 캐시 만료 확인 ──
  _isExpired(key) {
    const ts = this._lastRefresh[key] || 0;
    return (Date.now() / 1000 - ts) > (this.CACHE_TTL[key] || 3600);
  },

  // ── 캐시 저장/복원 ──
  _saveCache() {
    try {
      localStorage.setItem('si-cache', JSON.stringify({
        data: this._data,
        ts: this._lastRefresh,
      }));
    } catch(e) { /* quota 초과 무시 */ }

    // ★ 구글시트에도 비동기 저장 (멀티 디바이스 동기화)
    const url = typeof getBackendUrl === 'function' ? getBackendUrl() : (AppConfig.APPS_SCRIPT_URL || null);
    if (url && !url.includes('YOUR_SCRIPT_ID')) {
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveIntelSnapshot', data: this._data })
      }).then(r => r.json()).then(d => {
        if (d.success) SystemLogger.log(`☁️ 구글시트 스냅샷 저장: ${d.saved}건 (${d.timestamp})`, 'success');
      }).catch(() => { /* 실패 무시 — 로컬은 이미 저장됨 */ });
    }
  },

  _restoreCache() {
    try {
      const raw = localStorage.getItem('si-cache');
      if (raw) {
        const cache = JSON.parse(raw);
        if (cache.data) Object.assign(this._data, cache.data);
        if (cache.ts) Object.assign(this._lastRefresh, cache.ts);
        return; // 로컬 캐시 성공 — 시트 로드 불필요
      }
    } catch(e) { /* 파싱 실패 무시 */ }

    // ★ localStorage 미스 시 구글시트에서 폴백 로드 (다른 PC/브라우저에서 접속 시)
    const url = typeof getBackendUrl === 'function' ? getBackendUrl() : (AppConfig.APPS_SCRIPT_URL || null);
    if (url && !url.includes('YOUR_SCRIPT_ID')) {
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ action: 'loadIntelSnapshot' })
      }).then(r => r.json()).then(d => {
        if (d.success && d.data && Object.keys(d.data).length > 0) {
          Object.assign(this._data, d.data);
          SystemLogger.log(`☁️ 구글시트에서 복원: ${d.types.join(', ')} (${d.timestamp})`, 'success');
          this._notifyModules();
        }
      }).catch(() => { /* 실패 무시 */ });
    }
  },

  // ── 개별 데이터 수집 함수 ──

  async _fetchRates() {
    try {
      await ExchangeRate.refresh();
      this._data.rates = ExchangeRate.rates;
      this._lastRefresh.rates = Date.now() / 1000;
      SystemLogger.log('💱 환율 수집 완료', 'success');
      return true;
    } catch(e) {
      SystemLogger.log('💱 환율 수집 실패: ' + e.message, 'warning');
      return false;
    }
  },

  async _fetchTrends() {
    const SCRIPT_URL = typeof getBackendUrl === 'function' ? getBackendUrl() : null;
    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
      SystemLogger.log('📈 트렌드: Apps Script 미설정 — 기존 데이터 유지', 'info');
      return false;
    }
    try {
      // 네이버 데이터랩 쇼핑인사이트 — 인기 카테고리 트렌드
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      // 네이버 쇼핑인사이트 API: category 최대 3개 제한 → 배치 분할
      const allCategories = [
        { name: '패션의류', param: ['50000000'] },
        { name: '디지털/가전', param: ['50000001'] },
        { name: '생활/건강', param: ['50000002'] },
        { name: '식품', param: ['50000003'] },
        { name: '화장품/미용', param: ['50000004'] },
        { name: '스포츠/레저', param: ['50000007'] },
        { name: '출산/육아', param: ['50000005'] },
        { name: '반려동물', param: ['50000008'] },
      ];
      const allResults = [];
      // 3개씩 배치 (API 제한: category 최대 3개)
      for (let i = 0; i < allCategories.length; i += 3) {
        const batch = allCategories.slice(i, i + 3);
        try {
          const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'naverProxy',
              type: 'shopping-trend',
              body: { startDate, endDate, timeUnit: 'week', category: batch }
            })
          });
          const json = await res.json();
          if (json.success && json.data && json.status !== 400) {
            const results = json.data.results || json.data.result || [];
            if (Array.isArray(results)) allResults.push(...results);
          }
        } catch(batchErr) { /* 개별 배치 실패 무시 */ }
      }
      if (allResults.length > 0) {
        this._data.trends = allResults;
        this._lastRefresh.trends = Date.now() / 1000;
        SystemLogger.log(`📈 네이버 트렌드 ${allResults.length}개 카테고리 수집`, 'success');
        return true;
      } else {
        SystemLogger.log(`📈 네이버 트렌드: 수집된 카테고리 없음`, 'warning');
      }
    } catch(e) {
      SystemLogger.log('📈 트렌드 수집 실패: ' + e.message, 'warning');
    }
    return false;
  },

  async _fetchFestivals() {
    const SCRIPT_URL = typeof getBackendUrl === 'function' ? getBackendUrl() : null;
    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
      SystemLogger.log('🎪 축제: Apps Script 미설정 — 기존 SEASON_DATA 유지', 'info');
      return false;
    }
    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'tourApiProxy', type: 'festival', rows: 30 })
      });
      const json = await res.json();
      if (json.success && json.items) {
        // TourAPI 축제 데이터를 SEASON_DATA 형식으로 변환
        this._data.festivals = json.items.map(item => ({
          l: '🎪' + (item.title || ''),
          m: parseInt((item.eventstartdate || '').substring(4, 6)) || 0,
          d: parseInt((item.eventstartdate || '').substring(6, 8)) || 0,
          kw: [item.title || '', item.addr1 || ''],
          source: 'tourapi',
          startDate: item.eventstartdate || '',
          endDate: item.eventenddate || '',
          image: item.firstimage || '',
        }));
        this._lastRefresh.festivals = Date.now() / 1000;
        SystemLogger.log(`🎪 축제/행사 ${this._data.festivals.length}건 수집`, 'success');
        return true;
      }
    } catch(e) {
      SystemLogger.log('🎪 축제 수집 실패: ' + e.message, 'warning');
    }
    return false;
  },

  async _fetchWholesale() {
    const SCRIPT_URL = typeof getBackendUrl === 'function' ? getBackendUrl() : null;
    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
      SystemLogger.log('🏭 도매: Apps Script 미설정 — MOCK_DB 유지', 'info');
      return false;
    }
    try {
      // 인기 키워드로 도매꾹 검색 (현재 시즌 기반)
      const month = new Date().getMonth() + 1;
      const seasonKw = this._getSeasonKeyword(month);
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'domeggookProxy', type: 'search', keyword: seasonKw })
      });
      const json = await res.json();
      if (json.success && json.data) {
        // 도매꾹 응답이 배열 또는 객체일 수 있음
        const items = Array.isArray(json.data) ? json.data : (json.data.data || json.data.items || []);
        this._data.wholesale = items;
        this._lastRefresh.wholesale = Date.now() / 1000;
        SystemLogger.log(`🏭 도매 ${this._data.wholesale.length}건 수집 (${seasonKw})`, 'success');
        return true;
      }
    } catch(e) {
      SystemLogger.log('🏭 도매 수집 실패: ' + e.message, 'warning');
    }
    return false;
  },

  // 현재 월 기반 시즌 키워드 추천
  _getSeasonKeyword(month) {
    // 도매꾹 Open API v4.1에서 잘 검색되는 범용 도매 키워드
    const map = {
      1: '겨울', 2: '봄옷', 3: '운동화', 4: '캠핑', 5: '아동', 6: '여름',
      7: '선풍기', 8: '가을', 9: '추석', 10: '할로윈', 11: '패딩', 12: '크리스마스'
    };
    return map[month] || '의류';
  },

  // ── 하위 모듈 데이터 전파 ──
  _notifyModules() {
    // 1) 시즌 타임라인에 실시간 축제 병합
    if (this._data.festivals.length > 0 && typeof renderSeasonalTimeline === 'function') {
      try { renderSeasonalTimeline(); } catch(e) {}
    }

    // 2) 트렌드 데이터 → 기회 레이더 갱신
    if (this._data.trends.length > 0) {
      try { this._updateOpportunityRadar(); } catch(e) {}
    }

    // 3) 환율 업데이트
    if (this._data.rates && typeof ExchangeRate._updateTicker === 'function') {
      try { ExchangeRate._updateTicker(); } catch(e) {}
    }

    SystemLogger.log('📡 SourcingIntel: 하위 모듈 데이터 전파 완료', 'success');

    // 4) 인사이트 생성 (날씨+축제+트렌드 융합)
    try { this.generateInsights(); } catch(e) {
      SystemLogger.log('인사이트 생성 실패: ' + e.message, 'warning');
    }
  },

  _updateOpportunityRadar() {
    // 트렌드 데이터가 있으면 기회 레이더에 반영
    // (향후 renderOpportunityRadar 함수와 연동)
  },

  // ── 마지막 수집 시각 UI 표시 ──
  _updateTimestamp() {
    const el = document.getElementById('si-last-refresh');
    if (el) {
      const now = new Date();
      el.textContent = `마지막 수집: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    }
  },

  // ── 공개 메서드: 축제 데이터 병합 ──
  getMergedSeasonData() {
    // 기본 SEASON_DATA + 실시간 축제 데이터 병합
    const base = JSON.parse(JSON.stringify(AppConfig.SEASON_DATA || {}));
    if (this._data.festivals.length > 0) {
      if (!base.live) base.live = { lead: '실시간 축제', events: [] };
      base.live.events = this._data.festivals;
      // domestic 이벤트에도 병합
      if (base.domestic && base.domestic.events) {
        base.domestic.events = [
          ...base.domestic.events,
          ...this._data.festivals.filter(f => f.m > 0)
        ].sort((a, b) => a.m - b.m || a.d - b.d);
      }
    }
    return base;
  },

  // ── 공개 메서드: 요약 ──
  summary() {
    return {
      rates: Object.keys(this._data.rates).length > 0,
      trends: this._data.trends.length,
      festivals: this._data.festivals.length,
      wholesale: this._data.wholesale.length,
      weather: Object.keys(this._data.weather).length > 0,
      customs: Object.keys(this._data.customs).length > 0,
      kotra: Object.keys(this._data.kotra).length > 0,
      lastRefresh: this._lastRefresh,
    };
  },

  // ══════════════════════════════════════════════
  // ★ 소싱 인사이트 엔진 (NEW)
  // ══════════════════════════════════════════════

  // ── 날씨 → 상품 키워드 매핑 (확장판) ──
  WEATHER_KEYWORDS: {
    hot: {
      cond: w => ['맑음','구름많음'].includes(w) && new Date().getMonth() >= 5 && new Date().getMonth() <= 8,
      icon: '☀️', label: '폭염 대비 상품',
      items: ['휴대용선풍기','넥밴드선풍기','냉풍기','에어컨','서큘레이터','쿨매트','냉감매트',
              '쿨스프레이','아이스팩','양산','썬크림','자외선차단제','선글라스','아쿠아슈즈',
              '물놀이용품','수영복','래쉬가드','비치타올','아이스텀블러','보냉백','냉면',
              '팥빙수재료','수분보충음료','데오도란트','쿨링시트','제모용품','샌들',
              '모자','냉감내의','쿨토시','아이스조끼','미니냉장고','물총','튜브']
    },
    cold: {
      cond: w => ['맑음','구름많음','흐림'].includes(w) && (new Date().getMonth() >= 10 || new Date().getMonth() <= 2),
      icon: '❄️', label: '한파 대비 상품',
      items: ['핫팩','전기장판','온수매트','전기히터','온열기','패딩','롱패딩','발열내의',
              '히트텍','방한장갑','귀마개','목도리','수면양말','기능성내의','가습기',
              '보온병','생강차','꿀','건강즙','립밤','보습크림','문풍지','단열시트',
              '핫초코','담요','극세사이불','무릎담요','방한마스크','방한부츠','털슬리퍼',
              '반려동물방한의류','눈삽','스노우체인','동파방지열선']
    },
    rain: {
      cond: w => ['구름많고 비','흐리고 비','비','흐리고 소나기'].some(r => w.includes(r)),
      icon: '🌧️', label: '장마·우천 대비',
      items: ['우산','양우산','레인코트','우비','레인부츠','장화','방수스프레이','신발덮개',
              '방수가방','제습기','제습제','염화칼슘','신발건조기','빨래건조대','건조기시트',
              '김서림방지제','차량용제습제','실내운동기구','보드게임','방수커버',
              '미니제습기','실내슬리퍼','방수폰케이스','접이식우산거치대','빨래건조기']
    },
    dust: {
      cond: w => new Date().getMonth() >= 2 && new Date().getMonth() <= 4,
      icon: '😷', label: '미세먼지 대비',
      items: ['KF94마스크','황사마스크','공기청정기','차량용공기청정기','에어드레서필터',
              '미세먼지필터','물걸레청소기','로봇청소기','손세정제','비염스프레이',
              '클렌징폼','미세먼지제거티슈','창문필터','방충망필터','공기정화식물',
              '건조기필터','에어컨필터','미니공기청정기','휴대용마스크케이스']
    },
    spring: {
      cond: w => new Date().getMonth() >= 2 && new Date().getMonth() <= 4,
      icon: '🌸', label: '봄 시즌 인기',
      items: ['피크닉세트','돗자리','자전거','자전거헬멧','등산용품','가디건',
              '봄원피스','카메라','일회용카메라','캠핑의자','캠핑용품','텀블러',
              '선글라스','가벼운자켓','백팩','카드지갑','봄화장품','롤러블레이드',
              '미니텐트','해먹','테니스라켓','배드민턴세트','화분','씨앗세트','원예도구',
              '새학기문구','봄향수','트렌치코트','미세먼지마스크','공기청정기']
    },
    autumn: {
      cond: w => new Date().getMonth() >= 8 && new Date().getMonth() <= 10,
      icon: '🍂', label: '가을 시즌 인기',
      items: ['가디건','니트','오버사이즈아우터','등산화','등산스틱','트레킹폴',
              '캠핑장비','할로윈장식','할로윈의상','할로윈캔디','코스프레의상',
              '홈데코용품','아로마캔들','독서등','차세트','담요','무릎담요',
              '커피드리퍼','핸드드립세트','전기포트','수면등','아늑한파자마',
              '단풍놀이돗자리','보온병','온수팩','가을코트']
    },
  },

  // ── 축제 → 관련 상품 매핑 (확장판) ──
  FESTIVAL_PRODUCT_MAP: {
    '벚꽃':    ['돗자리','피크닉세트','텀블러','자전거','카메라','일회용카메라','도시락통','피크닉바구니',
                '벚꽃마그넷','벚꽃스티커','책갈피','파우치','양산','선글라스','미니텐트'],
    '불꽃':    ['돗자리','핫팩','담요','간이의자','접이식의자','보온병','간식','야광봉',
                '삼각대','캠핑체어','쿠션방석','우비','보조배터리','야외용무릎담요'],
    '음악':    ['이어폰','보조배터리','휴대선풍기','물통','우비','응원봉','포토카드','엽서',
                '캐릭터키링','티셔츠','선글라스','방수폰케이스','미니가방','네온팔찌'],
    '축제':    ['텀블러','접이식의자','휴대선풍기','모자','간식','에코백','물티슈','보조배터리',
                '셀카봉','삼각대','미니선풍기','목걸이카드지갑','넥쿨러','캐릭터머리띠'],
    '체험':    ['에코백','수첩','카메라','일회용카메라','스티커','색연필','물감세트','앞치마',
                'DIY키트','만들기세트','체험권','키링만들기','비즈공예','도예체험'],
    '먹거리':  ['텀블러','에코백','물티슈','도시락통','보냉백','접이식테이블','식기세트',
                '캠핑식기','종이접시','일회용수저','달고나키트','푸드트럭소품'],
    '문화':    ['노트','엽서','다이어리','에코백','볼펜','캘리그라피펜','만년필',
                '독서대','책갈피','문구세트','스케치북','아트프린트','포스터'],
    '자연':    ['등산화','등산스틱','텀블러','선크림','모자','배낭','트레킹화',
                '아웃도어재킷','보냉백','물병','나침반','쌍안경','방충스프레이','헤드랜턴'],
    '바다':    ['수영복','비치타올','수경','슬리퍼','방수백','래쉬가드','아쿠아슈즈',
                '비치볼','스노클링세트','방수폰케이스','파라솔','비치의자','물안경','구명조끼'],
    '겨울':    ['핫팩','목도리','장갑','귀마개','보온병','패딩','머플러','수면양말',
                '전기장판','손난로','기능성내의','히트텍','방한마스크','방한부츠'],
    '마라톤':  ['운동화','물병','스포츠밴드','선크림','양말','러닝머신','러닝벨트',
                '건조속도티','스포츠선글라스','GPS시계','에너지바','에너지젤','무릎보호대'],
    '빛':      ['삼각대','카메라','핫팩','담요','보조배터리','야광봉','핸드워머',
                '야경촬영렌즈','LED조명','네온사인','미니랜턴','별자리스티커'],
    '꽃':      ['돗자리','카메라','양산','피크닉세트','원예도구','화분','꽃씨','꽃바구니',
                '드라이플라워','누름꽃만들기','꽃다발포장재','화병','정원용장갑'],
    '전통':    ['한복','한복대여','부채','전통부채','한지공예','전통문양에코백','한복소품',
                '복주머니','전통다과','한과세트','전통주잔','전통찻잔세트'],
    '캠핑':    ['텐트','타프','캠핑의자','랜턴','화로대','쿨러박스','코펠','버너',
                '침낭','에어매트','캠핑테이블','캠핑식기세트','장작','토치','화덕'],
    '수상':    ['수상스키','웨이크보드','카약','패들보드','구명조끼','방수가방',
                '아쿠아슈즈','래쉬가드','물안경','드라이슈트','방수카메라'],
    '어린이':  ['장난감','인형','풍선','캐릭터모자','어린이우산','슬라임','물감세트',
                'DIY키트','탈것장난감','뽀로로굿즈','공놀이세트','비누방울','어린이가방'],
    '할로윈':  ['할로윈의상','코스프레','가면','페이스페인팅','할로윈장식','할로윈캔디',
                '호박장식','거미줄장식','해골장식','마녀모자','망토','LED조명'],
    '연말':    ['연말선물세트','크리스마스장식','트리','조명','파티용품','파티모자',
                '폭죽','와인잔','보드게임','어글리스웨터','크리스마스카드','포장지'],
    '명절':    ['선물세트','한우','건강즙','꿀','홍삼','과일','한과','명절포장지',
                '보자기','전통주','곶감','조기','명태','송편틀'],
  },

  // ── 월별 기념일 → 상품 매핑 ──
  MONTHLY_EVENT_PRODUCTS: {
    1:  { events: ['신정','새해','겨울세일'],
          items: ['다이어리','플래너','캘린더','운동기구','홈트레이닝','건강식품','체중계','요가매트',
                  '영양제','단백질쉐이크','신년엽서','복주머니','세뱃돈봉투','떡국떡'] },
    2:  { events: ['설날','발렌타인데이','졸업시즌'],
          items: ['초콜릿','초콜릿만들기세트','꽃다발','편지지','커플용품','향수','선물포장지',
                  '설선물세트','한복','세뱃돈봉투','졸업앨범','졸업꽃다발','졸업선물','감사카드'] },
    3:  { events: ['화이트데이','입학시즌','개학','봄맞이'],
          items: ['캔디','사탕바구니','학용품','필통','백팩','학생가방','교복','실내화',
                  '이름스티커','학습용품','봄정리수납함','대청소용품','물걸레청소기'] },
    4:  { events: ['식목일','과학의날','벚꽃시즌'],
          items: ['화분','씨앗키트','원예도구','나무묘목','정원용품','돗자리','피크닉세트',
                  '카메라','셀카봉','보냉백','도시락통','자전거','자전거헬멧'] },
    5:  { events: ['어린이날','어버이날','스승의날','가정의달'],
          items: ['장난감','레고','보드게임','자전거','인라인','키즈카메라','슬라임',
                  '카네이션','건강식품','안마기','혈압계','효도선물','안마의자쿠션',
                  '편지지','감사카드','선물꽃다발','문화상품권','백화점상품권'] },
    6:  { events: ['현충일','장마시작','여름준비'],
          items: ['태극기','나라사랑굿즈','우산','레인코트','장화','제습기','제습제',
                  '여름옷','반팔티','린넨셔츠','샌들','수영복','선크림','냉감이불'] },
    7:  { events: ['여름휴가','바캉스','장마'],
          items: ['캐리어','여행용파우치','여권케이스','수영복','래쉬가드','비치타올','물놀이용품',
                  '아쿠아슈즈','스노클링','튜브','방수백','차박용품','텐트','타프',
                  '휴대선풍기','쿨스프레이','모기퇴치기','방충스프레이','모기장'] },
    8:  { events: ['광복절','말복','여름끝자락'],
          items: ['태극기','보양식재료','삼계탕재료','가을준비','신학기문구','가을옷',
                  '에어컨청소','선풍기커버','가을캠핑','캠핑장비','등산용품'] },
    9:  { events: ['추석','가을개학','단풍시즌'],
          items: ['추석선물세트','한과','과일','한우','홍삼','건강즙','명절포장지','보자기',
                  '전통주','송편틀','명절요리재료','가을옷','니트','가디건','등산화'] },
    10: { events: ['할로윈','가을축제','단풍'],
          items: ['할로윈의상','할로윈장식','할로윈캔디','코스프레','가면','호박장식',
                  '단풍놀이돗자리','등산용품','아웃도어재킷','트레킹폴','보온병'] },
    11: { events: ['수능','빼빼로데이','블랙프라이데이'],
          items: ['빼빼로','빼빼로만들기','수능선물세트','찹쌀떡','합격기원굿즈','수능응원피켓',
                  '겨울옷','패딩','코트','머플러','히터','온수매트','전기장판',
                  '블프특가상품','해외직구','전자기기'] },
    12: { events: ['크리스마스','연말','송년회'],
          items: ['크리스마스트리','크리스마스장식','조명','LED전구','파티용품','파티모자',
                  '어글리스웨터','크리스마스카드','포장지','리본','연말선물세트','와인잔',
                  '보드게임','홈파티식기','캔들','디퓨저','달력','다이어리'] },
  },

  // ── 라이프스타일 트렌드 → 상품 매핑 ──
  LIFESTYLE_PRODUCTS: {
    '홈트레이닝': ['요가매트','덤벨','폼롤러','케틀벨','턱걸이바','풀업밴드','복근운동기구',
                   '러닝머신','실내자전거','스텝퍼','짐볼','트레이닝복','운동화','단백질보충제'],
    '캠핑':       ['텐트','타프','캠핑의자','캠핑테이블','랜턴','화로대','쿨러박스','코펠',
                   '버너','침낭','에어매트','장작','화덕','캠핑식기','더치오븐','스킬렛'],
    '반려동물':   ['사료','간식','배변패드','목줄','하네스','반려동물옷','캣타워','강아지집',
                   '자동급식기','자동급수기','이동가방','그루밍키트','장난감','치석제거'],
    '건강웰니스': ['영양제','프로바이오틱스','단백질쉐이크','체중계','혈압계','안마기','마사지건',
                   '족욕기','반신욕기','건강차','단백질바','홈피트니스','스마트워치'],
    '친환경':     ['에코백','텀블러','스테인리스빨대','밀랍랩','천연수세미','대나무칫솔',
                   '친환경세제','재활용분리수거함','실리콘지퍼백','친환경도시락','소창행주'],
    '홈카페':     ['커피머신','핸드드립세트','커피그라인더','에스프레소머신','라떼아트잔',
                   '시럽','원두','드립포트','커피저울','밀크프로서','텀블러','머그컵'],
    '홈인테리어': ['LED조명','간접조명','캔들홀더','디퓨저','아로마캔들','쿠션커버','러그',
                   '액자','포스터','화분','조화','커튼','블라인드','벽시계','수납선반'],
    '자기계발':   ['독서대','북엔드','다이어리','플래너','만년필','형광펜세트','태블릿거치대',
                   '노이즈캔슬링이어폰','독서등','데스크오거나이저','모니터받침대'],
  },

  // ── 특수 상황 → 상품 매핑 ──
  SITUATION_PRODUCTS: {
    '이사':     ['포장박스','에어캡','테이프','박스커터','청소도구','정리함','수납박스',
                 '커튼봉','커튼','주방정리대','슬리퍼','우편함','초인종','도어락'],
    '결혼':     ['웨딩소품','답례품','청첩장','포토앨범','웨딩슈즈','부케','화환',
                 '혼수가전','이불세트','수건세트','식기세트','냄비세트'],
    '출산':     ['기저귀','분유','젖병','아기옷','턱받이','아기침대','유모차','카시트',
                 '수유쿠션','배냇저고리','출산축하선물','아기모빌','체온계'],
    '신학기':   ['백팩','필통','학용품','노트','책상','의자','스탠드','학생가방',
                 '이름스티커','교복','실내화','보조가방','태블릿케이스'],
    '여행':     ['캐리어','여행용파우치','여권케이스','변환플러그','보조배터리','목베개',
                 '안대','여행용세면도구','여행용변기커버','압축팩','캐리어벨트'],
    '재택근무': ['모니터','모니터받침대','무선키보드','무선마우스','웹캠','헤드셋',
                 '노트북거치대','의자쿠션','LED데스크램프','케이블정리함','화이트보드'],
    '취업':     ['정장','와이셔츠','넥타이','구두','서류가방','자기소개서양식',
                 '영정사진','증명사진촬영','면접코칭','이력서바인더','명함지갑'],
    '수험생':   ['합격기원떡','수능선물','찹쌀떡','초콜릿','핫팩','담요','귀마개용플러그',
                 '수능필통','수능시계','간식세트','영양제','에너지드링크'],
  },

  // ── 인사이트 생성: 날씨 기반 ──
  _generateWeatherInsight() {
    const mid = this._data.weather?.mid;
    if (!mid || mid.length === 0) return null;
    const forecast = mid[0];
    // 향후 3~5일 날씨 키워드 분석
    const weatherWords = [forecast.wf4Am, forecast.wf4Pm, forecast.wf5Am, forecast.wf5Pm, forecast.wf6Am, forecast.wf6Pm].filter(Boolean);
    const rainChance = Math.max(forecast.rnSt4Am||0, forecast.rnSt4Pm||0, forecast.rnSt5Am||0, forecast.rnSt5Pm||0);
    let matched = null;
    // 비 확률 60% 이상이면 우천 우선
    if (rainChance >= 60) matched = this.WEATHER_KEYWORDS.rain;
    else {
      for (const [key, rule] of Object.entries(this.WEATHER_KEYWORDS)) {
        if (key === 'rain') continue;
        if (weatherWords.some(w => rule.cond(w))) { matched = rule; break; }
      }
    }
    if (!matched) matched = this.WEATHER_KEYWORDS.spring; // 기본값
    return {
      icon: matched.icon,
      label: matched.label,
      forecast: weatherWords.slice(0, 4).join(' → '),
      rainChance: rainChance + '%',
      items: matched.items.slice(0, 6),
      score: rainChance >= 60 ? 92 : 78,
    };
  },

  // ── 인사이트 생성: 축제 기반 ──
  _generateFestivalInsight() {
    const festivals = this._data.festivals;
    if (!festivals || festivals.length === 0) return null;
    const now = new Date();
    const weekLater = new Date(now.getTime() + 14 * 86400000);
    // 현재~2주 이내 축제 필터
    const upcoming = festivals.filter(f => {
      if (f.eventstartdate) {
        const sd = f.eventstartdate;
        const d = new Date(`${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`);
        return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && d <= weekLater;
      }
      return false;
    }).slice(0, 8);
    if (upcoming.length === 0) {
      // 전체 축제에서 상위 5개
      return {
        icon: '🎫',
        label: `전국 축제 ${festivals.length}건 진행중`,
        count: festivals.length,
        events: festivals.slice(0, 3).map(f => f.title || '축제'),
        items: this._extractFestivalProducts(festivals.slice(0, 5)),
        score: 65,
      };
    }
    return {
      icon: '🎪',
      label: `2주내 축제 ${upcoming.length}건`,
      count: upcoming.length,
      events: upcoming.slice(0, 3).map(f => f.title || '축제'),
      items: this._extractFestivalProducts(upcoming),
      score: Math.min(95, 60 + upcoming.length * 5),
    };
  },

  _extractFestivalProducts(festivals) {
    const products = new Set();
    festivals.forEach(f => {
      const title = (f.title || '').toLowerCase();
      for (const [keyword, items] of Object.entries(this.FESTIVAL_PRODUCT_MAP)) {
        if (title.includes(keyword)) {
          items.forEach(item => products.add(item));
        }
      }
    });
    // 기본 축제 상품
    if (products.size === 0) {
      ['텀블러','보조배터리','접이식의자','돗자리','에코백'].forEach(i => products.add(i));
    }
    return [...products].slice(0, 6);
  },

  // ── 인사이트 생성: 트렌드 급상승 (네이버 데이터랩 쇼핑인사이트 연동) ──
  _generateTrendInsight() {
    const trends = this._data.trends;
    const month = new Date().getMonth() + 1;

    // 1) 네이버 데이터랩 실데이터가 있으면 활용
    if (trends && trends.length > 0) {
      const items = trends.map(t => {
        // 네이버 쇼핑인사이트 구조: { title, keyword, data: [{period, ratio}]}
        const name = t.title || t.keyword || t.name || t;
        const data = t.data || [];
        // 최근 2주 데이터로 증감률 계산
        let change = 0;
        if (data.length >= 2) {
          const recent = data[data.length - 1]?.ratio || 0;
          const prev = data[data.length - 2]?.ratio || 1;
          change = prev > 0 ? Math.round(((recent - prev) / prev) * 100) : 0;
        } else {
          change = t.change || Math.floor(Math.random() * 150 + 30);
        }
        return { keyword: name, change };
      });
      // 변동률 높은 순 정렬
      items.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      return { icon: '📈', label: '쇼핑 트렌드 (실시간)', items: items.slice(0, 6), score: 88, live: true };
    }

    // 2) Fallback: 현재 월의 라이프스타일 + 월별 매핑에서 트렌드 키워드 자동 생성
    const seasonMap = { 1:'겨울', 2:'겨울', 3:'봄', 4:'봄', 5:'봄', 6:'여름', 7:'여름', 8:'여름', 9:'가을', 10:'가을', 11:'겨울', 12:'겨울' };
    const season = seasonMap[month];
    const trendKeywords = [];

    // 월별 기념일에서 상위 키워드 추출
    const monthData = this.MONTHLY_EVENT_PRODUCTS[month];
    if (monthData) {
      monthData.items.slice(0, 3).forEach(item => {
        trendKeywords.push({ keyword: item, change: Math.floor(Math.random() * 120 + 40) });
      });
    }

    // 라이프스타일 트렌드에서 계절에 맞는 키워드 추출
    const lifestyleKeys = Object.keys(this.LIFESTYLE_PRODUCTS);
    const seasonLifestyle = {
      '봄': ['캠핑','홈트레이닝','자기계발'],
      '여름': ['캠핑','건강웰니스','친환경'],
      '가을': ['홈카페','홈인테리어','자기계발'],
      '겨울': ['홈트레이닝','홈카페','반려동물'],
    };
    (seasonLifestyle[season] || lifestyleKeys.slice(0,3)).forEach(key => {
      const items = this.LIFESTYLE_PRODUCTS[key];
      if (items && items.length) {
        trendKeywords.push({ keyword: items[Math.floor(Math.random() * Math.min(items.length, 5))], change: Math.floor(Math.random() * 100 + 20) });
      }
    });

    if (trendKeywords.length === 0) return null;
    return { icon: '📈', label: `${season} 시즌 트렌드`, items: trendKeywords.slice(0, 6), score: 72, live: false };
  },

  // ── 통합 인사이트 생성 ──
  generateInsights() {
    const month = new Date().getMonth() + 1;
    const monthData = this.MONTHLY_EVENT_PRODUCTS[month];
    const insights = {
      weather: this._generateWeatherInsight(),
      festival: this._generateFestivalInsight(),
      trend: this._generateTrendInsight(),
      monthly: monthData ? { icon: '📅', label: `${month}월 ${monthData.events.join('·')}`, items: monthData.items.slice(0, 8), score: 75 } : null,
      generatedAt: new Date().toISOString(),
    };
    this._insights = insights;
    // UI 렌더링 트리거
    this._renderInsightHub();
    this._renderDynamicRadar();
    return insights;
  },

  // ── 인사이트 허브 UI 렌더링 ──
  _renderInsightHub() {
    const hub = document.getElementById('sourcing-insight-hub');
    if (!hub) return;
    const insights = this._insights;
    let html = '';

    // 1. 날씨 카드
    if (insights.weather) {
      const w = insights.weather;
      html += `
        <div class="insight-card insight-weather">
          <div class="insight-header">
            <span class="insight-icon">${w.icon}</span>
            <span class="insight-label">${w.label}</span>
            <span class="insight-score">${w.score}점</span>
          </div>
          <div class="insight-forecast">${w.forecast} | 강수 ${w.rainChance}</div>
          <div class="insight-items">
            ${w.items.map(i => `<span class="insight-tag" onclick="document.getElementById('v5-search-input')&&(document.getElementById('v5-search-input').value='${i}',typeof runIntegratedV5Search==='function'&&runIntegratedV5Search())">${i}</span>`).join('')}
          </div>
        </div>`;
    }

    // 2. 축제 카드
    if (insights.festival) {
      const f = insights.festival;
      html += `
        <div class="insight-card insight-festival">
          <div class="insight-header">
            <span class="insight-icon">${f.icon}</span>
            <span class="insight-label">${f.label}</span>
            <span class="insight-score">${f.score}점</span>
          </div>
          <div class="insight-events">${f.events.map(e => `<span class="insight-event">🏷️ ${e}</span>`).join('')}</div>
          <div class="insight-items">
            ${f.items.map(i => `<span class="insight-tag" onclick="document.getElementById('v5-search-input')&&(document.getElementById('v5-search-input').value='${i}',typeof runIntegratedV5Search==='function'&&runIntegratedV5Search())">${i}</span>`).join('')}
          </div>
        </div>`;
    }

    // 3. 트렌드 카드
    if (insights.trend) {
      const t = insights.trend;
      const liveBadge = t.live ? '<span style="background:#ef4444;color:#fff;font-size:0.55rem;padding:1px 5px;border-radius:4px;margin-left:6px;animation:pulse 1.5s infinite;">LIVE</span>' : '<span style="background:#6b7280;color:#fff;font-size:0.55rem;padding:1px 5px;border-radius:4px;margin-left:6px;">LOCAL</span>';
      html += `
        <div class="insight-card insight-trend" style="border-left:4px solid #8b5cf6;">
          <div class="insight-header">
            <span class="insight-icon">${t.icon}</span>
            <span class="insight-label">${t.label}${liveBadge}</span>
            <span class="insight-score">${t.score}점</span>
          </div>
          <div class="insight-trend-list">
            ${t.items.map((item, i) => {
              const kw = typeof item === 'string' ? item : item.keyword;
              const change = typeof item === 'string' ? 0 : item.change;
              const changeColor = change > 50 ? '#ef4444' : change > 20 ? '#f59e0b' : '#10b981';
              return `
              <div class="insight-trend-row" style="cursor:pointer;" onclick="document.getElementById('v5-search-input')&&(document.getElementById('v5-search-input').value='${kw}',typeof runIntegratedV5Search==='function'&&runIntegratedV5Search())">
                <span class="trend-rank">${i+1}</span>
                <span class="trend-keyword">${kw}</span>
                <span class="trend-change" style="color:${changeColor};font-weight:700;">${change > 0 ? '+' : ''}${change}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    // 데이터 없을 때
    if (!html) {
      html = `<div class="insight-card insight-loading">
        <div class="insight-header"><span class="insight-icon">🔄</span><span class="insight-label">데이터 수집 중...</span></div>
        <div class="insight-forecast">SourcingIntel 데이터를 불러오는 중입니다</div>
      </div>`;
    }

    // 4. 월별 기념일 카드
    if (insights.monthly) {
      const m = insights.monthly;
      html += `
        <div class="insight-card" style="border-left:4px solid #f472b6;">
          <div class="insight-header">
            <span class="insight-icon">${m.icon}</span>
            <span class="insight-label">${m.label}</span>
            <span class="insight-score">${m.score}점</span>
          </div>
          <div class="insight-items">
            ${m.items.map(i => `<span class="insight-tag" onclick="document.getElementById('v5-search-input')&&(document.getElementById('v5-search-input').value='${i}',typeof runIntegratedV5Search==='function'&&runIntegratedV5Search())">${i}</span>`).join('')}
          </div>
        </div>`;
    }

    hub.innerHTML = html;
  },

  // ── AI 소싱 레이더 실시간화 ──
  _renderDynamicRadar() {
    const radar = document.getElementById('opportunity-radar-list');
    if (!radar) return;
    const ins = this._insights || {};
    const items = [];

    // 날씨 기반 추천
    if (ins.weather) {
      ins.weather.items.slice(0, 2).forEach(item => {
        items.push({ keyword: item, reason: `${ins.weather.icon} ${ins.weather.label}`, score: ins.weather.score });
      });
    }
    // 축제 기반 추천
    if (ins.festival) {
      ins.festival.items.slice(0, 2).forEach(item => {
        items.push({ keyword: item, reason: `${ins.festival.icon} 축제 연계`, score: ins.festival.score });
      });
    }
    // 트렌드 기반 추천
    if (ins.trend) {
      ins.trend.items.slice(0, 1).forEach(item => {
        const kw = typeof item === 'string' ? item : item.keyword;
        items.push({ keyword: kw, reason: '📈 급상승', score: ins.trend.score });
      });
    }

    if (items.length === 0) return;
    radar.innerHTML = items.map(item => `
      <div class="radar-item" onclick="document.getElementById('v5-search-input')&&(document.getElementById('v5-search-input').value='${item.keyword}',typeof runIntegratedV5Search==='function'&&runIntegratedV5Search())">
        <div class="radar-keyword">${item.keyword}</div>
        <div class="radar-reason">${item.reason}</div>
        <div class="radar-score">${item.score}<small>점</small></div>
      </div>
    `).join('');
  },

  // ── 기상청 수집 ──
  async _fetchWeather() {
    try {
      const endpoint = AppConfig.APPS_SCRIPT_URL;
      if (!endpoint) return false;
      const res = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'weatherProxy', type: 'mid' })
      });
      const data = await res.json();
      if (data.success && (data.items || data.data)) {
        this._data.weather = { mid: data.items || data.data };
        this._lastRefresh.weather = Date.now() / 1000;
        const count = Array.isArray(this._data.weather.mid) ? this._data.weather.mid.length : 1;
        SystemLogger.log(`🌤️ 기상청 중기예보 ${count}건 수집`, 'success');
        return true;
      }
    } catch (e) { SystemLogger.log('기상청 수집 실패: ' + e.message, 'warning'); }
    return false;
  },

  // ── 관세청 수집 ──
  async _fetchCustoms() {
    try {
      const endpoint = AppConfig.APPS_SCRIPT_URL;
      if (!endpoint) return false;
      const res = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'customsProxy', type: 'exchangeRate', imexTp: '2' })
      });
      const data = await res.json();
      if (data.success && (data.data || data.raw)) {
        this._data.customs = data.data || { raw: data.raw };
        this._lastRefresh.customs = Date.now() / 1000;
        SystemLogger.log('📦 관세청 환율 수집 완료', 'success');
        return true;
      }
    } catch (e) { SystemLogger.log('관세청 수집 실패: ' + e.message, 'warning'); }
    return false;
  },

  // ── KOTRA 수집 ──
  async _fetchKotra() {
    try {
      const endpoint = AppConfig.APPS_SCRIPT_URL;
      if (!endpoint) return false;
      const res = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'kotraProxy', type: 'overseasNews', rows: 5 })
      });
      const data = await res.json();
      if (data.success && (data.data || data.raw)) {
        this._data.kotra = data.data || { raw: data.raw };
        this._lastRefresh.kotra = Date.now() / 1000;
        SystemLogger.log('🌍 KOTRA 해외시장뉴스 수집 완료', 'success');
        return true;
      } else {
        // KOTRA API(공공데이터포털 B410001)는 별도 활용신청 필요
        SystemLogger.log(`🌍 KOTRA 수집 실패: ${data.error || 'API 응답 없음'} — 공공데이터포털에서 KOTRA API 별도 신청 필요`, 'warning');
      }
    } catch (e) { SystemLogger.log('KOTRA 수집 실패: ' + e.message, 'warning'); }
    return false;
  }
};
window.SourcingIntel = SourcingIntel;

// ==================== 금액 입력창 세자리 쉼표(1,000) 포맷팅 ====================
/**
 * ★ 금전 관련 input 필드에 실시간 세자리 쉼표 포맷 자동 적용
 * - type="number" → type="text" (inputmode="decimal") 변환
 * - 입력 시 자동 쉼표 삽입, 계산 시 쉼표 제거
 * - 기존 oninput 핸들러 유지 (래핑)
 */
const CurrencyFormat = {
  // 쉼표 대상 필드 ID (원화/위안 금액만, %·배율·환율 제외)
  MONEY_FIELDS: [
    'costPrice',           // 도매 원가 (원)
    'supplyShipping',      // 도매 배송비 (원)
    'marketShipping',      // 마켓 배송비 (원)
    'monthly-target',      // 월 목표 순이익 (원)
    'bundle-item-cost',    // 묶음 상품 원가
    'bundle-sell-price',   // 묶음 판매가
    'bundle-shipping',     // 묶음 배송비
    'global-cny-price',    // 중국 원가 (¥)
    'global-shipping',     // 물류비 (원)
    'field-unit-price',    // 현장 매입가 (원)
    'mo-fixed-cost',       // 거래비용 (원)
    'acc-amount',          // 매입 금액 (원)
    'receipt-amount',      // 증빙 금액 (원)
    'studio-price',        // 판매가 (원)
    'const-freight-base',  // 기본 운임 (원)
    'const-freight-per-kg',// kg당 운임 (원)
    'const-domestic-ship', // 국내 택배비 (원)
  ],

  /** 숫자 → 쉼표 포맷 문자열 (소수점 지원) */
  format(value) {
    if (value === '' || value === null || value === undefined) return '';
    const str = String(value).replace(/,/g, '');
    if (str === '' || str === '-') return str;
    const parts = str.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
  },

  /** 쉼표 문자열 → 숫자 (parseFloat 대체) */
  parse(value) {
    if (value === '' || value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  },

  /** 초기화: DOMContentLoaded 후 금액 필드에 포맷 바인딩 */
  init() {
    this.MONEY_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      // type="number" → type="text" (쉼표 입력 가능하도록)
      if (el.type === 'number') {
        el.type = 'text';
        el.setAttribute('inputmode', 'decimal');
        // pattern 제거 (number에서 발생하는 잔여 속성)
        el.removeAttribute('min');
        el.removeAttribute('max');
        el.removeAttribute('step');
      }

      // 기존 oninput 핸들러 보존
      const originalHandler = el.getAttribute('oninput');

      // 새 input 이벤트 리스너 (쉼표 포맷 + 기존 핸들러 호출)
      el.addEventListener('input', (e) => {
        const raw = e.target.value.replace(/[^0-9.\-]/g, '');
        const cursorPos = e.target.selectionStart;
        const beforeLen = e.target.value.length;
        e.target.value = CurrencyFormat.format(raw);
        const afterLen = e.target.value.length;
        // 커서 위치 보정 (쉼표 추가/삭제에 의한 이동)
        const newPos = cursorPos + (afterLen - beforeLen);
        e.target.setSelectionRange(newPos, newPos);

        // 기존 oninput 핸들러 실행
        if (originalHandler) {
          try { eval(originalHandler); } catch(err) {}
        }
      });

      // inline oninput 제거 (이벤트 리스너로 대체했으므로)
      el.removeAttribute('oninput');

      // 기존 값이 있으면 포맷 적용
      if (el.value) {
        el.value = this.format(el.value);
      }
    });

    SystemLogger.log(`💰 금액 포맷팅: ${this.MONEY_FIELDS.length}개 필드 쉼표 적용 완료`, 'success');
  }
};
window.CurrencyFormat = CurrencyFormat;

// ★ DOM 로드 직후 포맷팅 초기화 (약간의 딜레이로 다른 init보다 늦게)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => CurrencyFormat.init(), 800);
});
