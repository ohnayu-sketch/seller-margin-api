/* ═══ js/core/mega-block.js ═══ */

window.onerror = function(msg, url, lineNo, columnNo, error) {
      console.error('Fatal Error:', msg, 'at', lineNo + ':' + columnNo, error);
      // PIN 인증 완료 후(appReady=true)에는 rescue-ui를 띄우지 않음 (비치명적 오류 무시)
      if (window.appReady) return false;
      try {
        const loader = document.getElementById('loading');
        if (loader) loader.style.display = 'none';
      } catch(e) {}
      return false;
    };
    // Rescue Timer: PIN 모달 대기 시간 포함 60초로 연장
    window._rescueTimer = setTimeout(() => {
      // PIN 모달이 열려있거나 appReady가 true이면 rescue-ui를 띄우지 않음
      const pinModal = document.getElementById('pin-modal');
      const pinVisible = pinModal && pinModal.style.display !== 'none';
      if (!window.appReady && !pinVisible) {
        console.warn('[Rescue] Initializing too slow or crashed. Showing Rescue UI.');
        const rescue = document.getElementById('rescue-ui');
        if (rescue) rescue.style.display = 'flex';
      }
    }, 60000);



const SHEET_ID = '1qs-dbzR-necdSo-MfV-hoIgAb65aaBflQVVg6JkFHFA';
const SHEET_NAME = '상품목록';
const SHEET_SALES = '판매기록';
const SHEET_ACCOUNTING = '매입매출';
const SHEET_MONTHLY = '월별통계';
const CONFIG_SHEET = '설정';

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  try {
    const action = e.parameter.action || (e.postData ? JSON.parse(e.postData.contents).action : null);
    const body = e.postData ? JSON.parse(e.postData.contents) : {};
    const params = e.parameter || {};
    if (action === 'getProducts') response.setContent(JSON.stringify(getProducts()));
    else if (action === 'saveProduct') response.setContent(JSON.stringify(saveProduct(body)));
    else if (action === 'updateProduct') response.setContent(JSON.stringify(updateProduct(body)));
    else if (action === 'deleteProduct') response.setContent(JSON.stringify(deleteProduct(body.id)));
    else if (action === 'clearAll') response.setContent(JSON.stringify(clearAll()));
    else if (action === 'getConfig') response.setContent(JSON.stringify(getConfig()));
    else if (action === 'saveConfig') response.setContent(JSON.stringify(saveConfig(body)));
    else if (action === 'saveSalesRecord') response.setContent(JSON.stringify(saveSalesRecord(body)));
    else if (action === 'saveAccountingRecord') response.setContent(JSON.stringify(saveAccountingRecord(body)));
    else if (action === 'getSalesRecords') response.setContent(JSON.stringify(getSalesRecords(body.month ? body : params)));
    else if (action === 'getAccountingRecords') response.setContent(JSON.stringify(getAccountingRecords(body.month ? body : params)));
    else response.setContent(JSON.stringify({ success: false, error: 'unknown action' }));
  } catch (err) {
    response.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }
  return response;
}

function initConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([['키', '값']]);
    sheet.getRange(1, 1, 1, 2).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.appendRow(['email1', '']);
    sheet.appendRow(['email2', '']);
  }
  return sheet;
}

function getConfig() {
  const sheet = initConfigSheet();
  const data = sheet.getDataRange().getValues();
  const config = {};
  data.slice(1).forEach(function (row) { if (row[0]) config[row[0]] = row[1]; });
  return { success: true, config: config };
}

function saveConfig(data) {
  const sheet = initConfigSheet();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'email1') sheet.getRange(i + 1, 2).setValue(data.email1 || '');
    if (rows[i][0] === 'email2') sheet.getRange(i + 1, 2).setValue(data.email2 || '');
  }
  return { success: true };
}

var PRODUCT_HEADERS = ['ID', '상품명', '원가', '도매배송비', '마켓배송비', '마켓', '수수료(%)', '판매가', '수수료금액', '순이익', '마진율(%)', '저장일시', '저장자', '카테고리', '경쟁강도', '시중최저가', '시중평균가', '판매결정', '판매시작일'];
var PRODUCT_COLS = 19;

function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, PRODUCT_COLS).setValues([PRODUCT_HEADERS]);
    sheet.getRange(1, 1, 1, PRODUCT_COLS).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setProductListHeaders() {
  const sheet = initSheet();
  var headers = ['카테고리', '경쟁강도', '시중최저가', '시중평균가', '판매결정', '판매시작일'];
  var range = sheet.getRange(1, 14, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1a1a2e');
  range.setFontColor('#4ade80');
  range.setFontWeight('bold');
  Logger.log('상품목록 14~19열 헤더 적용 완료.');
}

function getProducts() {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, products: [] };
  const colCount = Math.max(PRODUCT_COLS, sheet.getLastColumn());
  const data = sheet.getRange(2, 1, last, colCount).getValues();
  return {
    success: true,
    products: data.filter(function (r) { return r[0] !== ''; }).map(function (r) {
      return {
        id: r[0], name: r[1], cost: r[2], supShip: r[3], mktShip: r[4],
        market: r[5], fee: r[6], salePrice: r[7], feeAmt: r[8],
        profit: r[9], margin: r[10], savedAt: r[11], savedBy: r[12],
        category: r[13], competitionLevel: r[14], minMarketPrice: r[15], avgMarketPrice: r[16],
        sellDecision: r[17], sellStartDate: r[18]
      };
    })
  };
}

function saveProduct(data) {
  const sheet = initSheet();
  data.products.forEach(function (p) {
    const row = [
      p.id, p.name, p.cost, p.supShip, p.mktShip,
      p.market, p.fee, p.salePrice, p.feeAmt,
      p.profit, p.margin, p.savedAt, p.savedBy || '남편',
      p.category || '', p.competitionLevel || '', p.minMarketPrice || '', p.avgMarketPrice || '',
      p.sellDecision || 'N', p.sellStartDate || ''
    ];
    sheet.appendRow(row);
    const rowNum = sheet.getLastRow();
    const bgColor = p.margin >= 20 ? '#c6efce' : p.margin >= 10 ? '#ffeb9c' : '#ffc7ce';
    sheet.getRange(rowNum, 1, rowNum, PRODUCT_COLS).setBackground(bgColor).setFontColor('#1a1a1a');
  });
  return { success: true };
}

function updateProduct(data) {
  const id = data.id;
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: false };
  const colCount = Math.max(PRODUCT_COLS, sheet.getLastColumn());
  const rows = sheet.getRange(2, 1, last, colCount).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      const rowIdx = i + 2;
      if (data.sellDecision !== undefined) sheet.getRange(rowIdx, 18).setValue(data.sellDecision);
      if (data.sellStartDate !== undefined) sheet.getRange(rowIdx, 19).setValue(data.sellStartDate);
      return { success: true };
    }
  }
  return { success: false };
}

function deleteProduct(id) {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: false };
  const data = sheet.getRange(2, 1, last, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }
  return { success: false };
}

function clearAll() {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  return { success: true };
}

function initSalesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SALES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SALES);
    sheet.getRange(1, 1, 1, 11).setValues([['날짜', '상품ID', '상품명', '마켓', '판매수량', '판매가', '매출', '원가합계', '순이익', '마진율', '저장자']]);
    sheet.getRange(1, 1, 1, 11).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveSalesRecord(data) {
  const sheet = initSalesSheet();
  const r = data.record || data;
  const revenue = (r.salePrice || 0) * (r.quantity || 0);
  const costSum = r.costSum || 0;
  const profit = revenue - costSum - (r.feeAmt || 0);
  const marginPct = revenue > 0 ? Math.round(profit / revenue * 1000) / 10 : 0;
  sheet.appendRow([
    r.date || new Date().toISOString().slice(0, 10),
    r.productId || '', r.productName || '', r.market || '',
    r.quantity || 0, r.salePrice || 0, revenue, costSum, profit, marginPct,
    r.savedBy || '남편'
  ]);
  return { success: true };
}

function getSalesRecords(params) {
  const sheet = initSalesSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, records: [] };
  const data = sheet.getRange(2, 1, last, 11).getValues();
  let list = data.map(function (r) {
    return { date: r[0], productId: r[1], productName: r[2], market: r[3], quantity: r[4], salePrice: r[5], revenue: r[6], costSum: r[7], profit: r[8], margin: r[9], savedBy: r[10] };
  });
  if (params && params.month) {
    const yyyymm = String(params.month);
    list = list.filter(function (r) { return String(r.date).slice(0, 7) === yyyymm; });
  }
  return { success: true, records: list };
}

function initAccountingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ACCOUNTING);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ACCOUNTING);
    sheet.getRange(1, 1, 1, 9).setValues([['날짜', '구분', '거래처', '품목', '공급가액', '세액', '합계', '증빙유형', '메모']]);
    sheet.getRange(1, 1, 1, 9).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveAccountingRecord(data) {
  const sheet = initAccountingSheet();
  const r = data.record || data;
  const amount = r.amount || r.공급가액 || 0;
  const tax = r.tax || r.세액 || 0;
  const total = amount + tax;
  sheet.appendRow([
    r.date || new Date().toISOString().slice(0, 10),
    r.type || r.구분 || '매출',
    r.partner || r.거래처 || '',
    r.item || r.품목 || '',
    amount, tax, total,
    r.evidenceType || r.증빙유형 || '기타',
    r.memo || r.메모 || ''
  ]);
  return { success: true };
}

function getAccountingRecords(params) {
  const sheet = initAccountingSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, records: [] };
  const data = sheet.getRange(2, 1, last, 9).getValues();
  let list = data.map(function (r) {
    return { date: r[0], type: r[1], partner: r[2], item: r[3], amount: r[4], tax: r[5], total: r[6], evidenceType: r[7], memo: r[8] };
  });
  if (params && params.month) {
    const yyyymm = String(params.month);
    list = list.filter(function (r) { return String(r.date).slice(0, 7) === yyyymm; });
  }
  if (params && params.type) list = list.filter(function (r) { return r.type === params.type; });
  return { success: true, records: list };
}

function initMonthlySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MONTHLY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MONTHLY);
    sheet.getRange(1, 1, 1, 8).setValues([['연월', '총매출', '총매입', '순이익', '마진율', '카테고리별매출', '마켓별매출', '부가세예상']]);
    sheet.getRange(1, 1, 1, 8).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateMonthlyReport() {
  console.warn('[TODO] generateMonthlyReport는 아직 미구현입니다. GAS 서버 측 함수를 사용하세요.');
  initMonthlySheet();
  return { success: false, message: '월간 리포트 기능은 아직 개발 중입니다.' };
}

function calculateSimplifiedVAT(year) {
  console.warn('[TODO] calculateSimplifiedVAT는 아직 미구현입니다. GAS 서버 측 함수를 사용하세요.');
  return { success: false, year: year, message: '부가세 계산 기능은 아직 개발 중입니다.' };
}

function organizeGoogleDrive() {
  console.warn('[TODO] organizeGoogleDrive는 아직 미구현입니다.');
  return { success: false, message: '구글 드라이브 정리 기능은 아직 개발 중입니다.' };
}



// ==================== STRICT BYPASS (최우선 로그인 유지) ====================
(function strictBypass() {
  if (localStorage.getItem('isLoggedIn') === 'true') {
    const ls = document.getElementById('login-screen');
    const aw = document.getElementById('app-wrapper');
    if (ls) { ls.style.display = 'none'; ls.classList.add('hidden'); }
    if (aw) aw.style.display = 'block';
    console.log('⚡ [StrictBypass] 로그인 화면 원천 차단 됨');

    // 강제 화면 제어: 기본 탭 깜빡임 전면 방어
    let savedTab = localStorage.getItem('lastTab');
    if (!savedTab || savedTab === 'null' || savedTab === 'undefined') savedTab = 'calc';
    console.log('[Navigation] Restoring last tab:', savedTab);

    // 하드코딩된 페이지 및 탭 액티브 상태 해제
    document.querySelectorAll('.tab, .tab-bar-item, .page').forEach(el => {
      el.classList.remove('active');
    });

    const targetPage = document.getElementById('page-' + savedTab);
    if (targetPage) {
      targetPage.classList.add('active');
      targetPage.style.opacity = '1';
    }

    // 일치하는 메뉴 활성화 표출
    document.querySelectorAll('.tab, .tab-bar-item').forEach(el => {
      const onclickAttr = el.getAttribute('onclick') || '';
      if (onclickAttr.indexOf(`'${savedTab}'`) !== -1 || onclickAttr.indexOf(`"${savedTab}"`) !== -1) {
        el.classList.add('active');
      }
    });

    // ----------------------------------------------------
    // [서브 탭 복제] 마진계산기 내부 (직접입력 vs 도매검색)
    let savedCalcSubTab = localStorage.getItem('lastCalcSubTab') || 'direct';
    const cd = document.getElementById('calc-section-direct');
    const cs = document.getElementById('calc-section-search');
    const bd = document.getElementById('calc-tab-direct');
    const bs = document.getElementById('calc-tab-search');
    if (cd && cs && bd && bs) {
      if (savedCalcSubTab === 'search') {
        cd.style.display = 'none';
        cs.style.display = 'block';
        bd.classList.remove('active');
        bs.classList.add('active');
      } else {
        cd.style.display = 'block';
        cs.style.display = 'none';
        bd.classList.add('active');
        bs.classList.remove('active');
      }
    }

    // [서브 탭 복제] 소싱 모드 내부 (온라인 vs 현장사입)
    let savedSourcingMode = localStorage.getItem('sourcing-mode') || 'online';
    const mo = document.getElementById('mode-online');
    const md = document.getElementById('mode-direct');
    const ds = document.getElementById('direct-sourcing-section');
    if (mo && md && ds) {
      if (savedSourcingMode === 'direct') {
        mo.classList.remove('active');
        md.classList.add('active');
        ds.style.display = 'block';
      } else {
        mo.classList.add('active');
        md.classList.remove('active');
        ds.style.display = 'none';
      }
    }

    console.log('⚡ [StrictBypass] 모든 하위 서브 라우팅 렌더링 완료 됨');

    // [데이터 복원] 입력 폼 실시간 임시저장 내용(Data Hydration)
    let calcDraftStr = localStorage.getItem('calcDraft');
    if (calcDraftStr) {
      try {
        let draft = JSON.parse(calcDraftStr);
        for (let id in draft) {
          let el = document.getElementById(id);
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            el.value = draft[id];
          }
        }
        console.log('⚡ [DataHydration] 입력창 데이터 자동 복원 완료');
      } catch(e) {}
    }
  }
})();

// [실시간 추적] StrictBypass 외부 영역이나, HTML 상단에 파싱된 상태에서 이벤트 위임
(function setupInputTracker() {
  const calcPageObserver = document.getElementById('page-calc');
  if (calcPageObserver) {
    calcPageObserver.addEventListener('input', (e) => {
      if ((e.target.tagName === 'INPUT' && e.target.type !== 'file' && e.target.type !== 'checkbox' && e.target.type !== 'radio') || e.target.tagName === 'TEXTAREA') {
        if (!e.target.id) return;
        let draft = {};
        try { draft = JSON.parse(localStorage.getItem('calcDraft')) || {}; } catch(err){}
        draft[e.target.id] = e.target.value;
        localStorage.setItem('calcDraft', JSON.stringify(draft));
      }
    });
  }
})();

function clearCalcData(silent) {
  localStorage.removeItem('calcDraft');
  const calcPage = document.getElementById('page-calc');
  if (calcPage) {
    calcPage.querySelectorAll('input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea').forEach(el => {
      el.value = '';
    });
    const feeSingle = document.getElementById('fee-single'); if(feeSingle) feeSingle.value = '6.6';
    const tgMgn = document.getElementById('targetMargin'); if(tgMgn) tgMgn.value = '15';
    const tgMgnSl = document.getElementById('targetMarginSlider'); if(tgMgnSl) tgMgnSl.value = '15';
  }
  if (typeof recalcMargin === 'function') recalcMargin();
  if (silent !== true && typeof showToast === 'function') showToast('지정한 데이터가 초기화되었습니다.', false);
}

// ==================== CONFIG ====================
// ★ URL 해상도: T7 수동 설정 → AppConfig 하드코딩 → getBackendUrl 폴백
let SCRIPT_URL = localStorage.getItem('script-url')
    || (typeof AppConfig !== 'undefined' && AppConfig.APPS_SCRIPT_URL)
    || '';

// config.js fallback (SourcingIntel 등 하위 모듈용)
function getBackendUrl() {
  return localStorage.getItem('proxyApiUrl')
      || localStorage.getItem('script-url')
      || (typeof AppConfig !== 'undefined' && AppConfig.APPS_SCRIPT_URL)
      || '';
}
let API_URL = getBackendUrl();

// ==================== STATE ====================
window.appState = { products: [], sales: [], stats: {} };
let products = [];
let salesRecords = [];
let accountingRecords = [];
let currentUser = localStorage.getItem('seller-user') || '';
window._userEmail = '';

/** API 키 수정 권한: ADMIN_EMAILS 중 첫 번째(ohnayu@gmail.com)만 가능 */
function isApiAdmin() {
  const email = (window._userEmail || '').toLowerCase().trim();
  return email === 'ohnayu@gmail.com' || email === 'bypass@local';
}
let markets = { smart: true, coupang: true, open: true };
window._lastSearch = null;
let _salesRecordProduct = null;

const MARKET_FEES = {
  smartstore:   { name: '스마트스토어', fee: 6.6, color: '#03c75a' },
  coupang:      { name: '쿠팡',        fee: 8.0, color: '#ff6900' },
  '11st':       { name: '11번가',      fee: 8.0, color: '#ff0000' },
  gmarket:      { name: 'G마켓',       fee: 9.0, color: '#ff6600' },
  auction:      { name: '옥션',        fee: 9.0, color: '#ff0000' },
  wemakeprice:  { name: '위메프',      fee: 6.0, color: '#8b0085' },
  tmon:         { name: '티몬',        fee: 6.0, color: '#ff4500' },
  kakaoshopping:{ name: '카카오쇼핑',  fee: 5.5, color: '#fee500' },
};
const MARKET_IDS = Object.keys(MARKET_FEES);
const MARKET_INFO = Object.fromEntries(MARKET_IDS.map(k => [k, { name: MARKET_FEES[k].name, class: k, color: MARKET_FEES[k].color }]));
// 하위 호환
markets = Object.fromEntries(MARKET_IDS.map(k => [k, true]));

// ==================== GOOGLE AUTH CONFIG ====================
const CLIENT_ID = '985307778387-1v16a641sg34lsmsdbliamfcettauto6.apps.googleusercontent.com';
// ⚠️ 허용할 구글 이메일 주소 2개를 아래에 입력하세요
const ALLOWED_EMAILS = [
  localStorage.getItem('allowed-email-1') || '',
  localStorage.getItem('allowed-email-2') || '',
].filter(Boolean);

let googleUser = null;

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Init] DOMContentLoaded - Starting Auth Check');
  try {
    var search = window.location.search || '';

    if (search.indexOf('invite=') !== -1) {
      const urlParams = new URLSearchParams(search);
      const inviteEmail = urlParams.get('invite');
      if (inviteEmail) {
        console.log('[Init] Invite link detected:', inviteEmail);
        localStorage.setItem('invited-email', inviteEmail.toLowerCase());
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    if (search.indexOf('skip_auth=1') !== -1) {
      console.log('[Init] Skip Auth detected');
      onAuthSuccess('bypass@local', '우회');
      return;
    }

    // [개발 편의 우회] 로컬 개발 상태 모드 강제 바이패스
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') {
      console.log('[Init] Localhost/File Dev Bypass -> Auto Login');
      onAuthSuccess('dev@local', '개발자');
      return;
    }

    var hash = (window.location.hash || '').replace(/^#/, '');
    if (hash.indexOf('id_token=') !== -1 || hash.indexOf('error=') !== -1) {
      console.log('[Init] OAuth Redirect detected');
      if (typeof processGoogleUserFromHash === 'function') processGoogleUserFromHash();
      return;
    }
    var savedEmail = sessionStorage.getItem('auth-email') || localStorage.getItem('auth-email');
    var savedName = sessionStorage.getItem('auth-name') || localStorage.getItem('auth-name');
    var isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (isLoggedIn && savedEmail && savedName) {
      console.log('[Init] Auto-login from storage bypass:', savedEmail);
      if (typeof isAllowed === 'function' && isAllowed(savedEmail)) {
        onAuthSuccess(savedEmail, savedName);
        return; // 로그인 화면 표출 즉시 건너뛰기(Bypass)
      } else {
        console.warn('[Init] Saved session is not allowed or invalid:', savedEmail);
        showLoginScreen();
      }
    } else {
      console.log('[Init] No saved session, showing login screen');
      showLoginScreen();
      if (search.indexOf('oauth_debug=1') !== -1 && typeof _oauthDebug === 'function') {
        var redirectUri = window.location.origin + window.location.pathname + (search || '');
        _oauthDebug('리디렉션 URI (구글 콘솔에 이 주소 추가):', { redirect_uri: redirectUri });
        var hint = document.getElementById('login-redirect-uri-hint');
            if (hint) { hint.style.display = 'block'; hint.innerHTML = '아래를 그대로 구글 콘솔 → 승인된 리디렉션 URI에 추가하세요:<br><code style="font-size:11px">' + redirectUri + '</code>'; }
      }
      // T7 Initialization: Hydrate platforms and security fields (New V6.0 Logic)
      if (typeof renderPlatforms === 'function') renderPlatforms();
      const configEmails = localStorage.getItem('allowed-emails-config');
      if (configEmails) {
          const el = document.getElementById('allowed-emails-config');
          if (el) el.value = configEmails;
      }
      const configPin = localStorage.getItem('master-pin-config');
      if (configPin) {
          const el = document.getElementById('master-pin-config');
          if (el) el.value = configPin;
      }
    }
  } catch (err) {
    console.error('[Init] Fatal Error in DOMContentLoaded:', err);
    window.onerror(err.message, window.location.href, 0, 0, err);
  }
});

function showLoginScreen() {
  console.log('[UI] Showing login screen');
  window.appReady = true; // [Rescue] 로그인 화면이 떴으므로 자가 복구 팝업 방지
  if (window._rescueTimer) clearTimeout(window._rescueTimer);

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    loginScreen.classList.remove('hidden');
    loginScreen.style.display = 'flex';
  }

  const appWrapper = document.getElementById('app-wrapper');
  if (appWrapper) appWrapper.style.display = 'none';

  const accessDenied = document.getElementById('access-denied');
  if (accessDenied) accessDenied.style.display = 'none';

  var resetArea = document.getElementById('login-reset-pw-area');
  if (resetArea) resetArea.style.display = (window.location.search || '').indexOf('reset_pw=1') !== -1 ? 'block' : 'none';
}

// 비밀번호 잊었을 때: 주소에 ?reset_pw=1 붙여서 열면 표시되는 버튼으로 0000 복구
function resetAppPasswordToDefault() {
  localStorage.removeItem('app-login-password');
  var pwEl = document.getElementById('login-password');
  if (pwEl) pwEl.value = '';
  if (typeof showToast === 'function') showToast('비밀번호가 0000으로 초기화되었습니다. 다시 로그인하세요.');
}



// --- 접근 권한 초대 (Admin) ---
function generateInviteLink() {
  const emailInput = document.getElementById('invite-email-input');
  if (!emailInput) return;
  const email = emailInput.value.trim();
  if (!email) {
    if (typeof showToast === 'function') showToast('초대할 이메일을 입력하세요.', true);
    return;
  }
  const baseUrl = window.location.origin + window.location.pathname;
  const inviteUrl = baseUrl + '?invite=' + encodeURIComponent(email);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      if (typeof showToast === 'function') showToast('초대 링크가 복사되었습니다. (대상: ' + email + ')');
      emailInput.value = '';
    }).catch(err => {
      if (typeof showToast === 'function') showToast('링크를 직접 복사하세요: ' + inviteUrl, true);
    });
  } else {
    prompt('다음 링크를 복사하여 전달하세요:', inviteUrl);
  }
}

// ---------- 구글 OAuth (리디렉트 방식 + 디버그 로그) ----------
function startGoogleOAuth() {
  if (window.location.protocol === 'file:') {
    alert("오류: 로컬 파일(file://) 환경에서는 구글 로그인을 사용할 수 없습니다.\nGitHub Pages 도메인이나 로컬 웹 서버(http://127.0.0.1...)를 통해 접속해 주세요.");
    return;
  }
  var nonce = Math.random().toString(36).slice(2) + Date.now();
  try { sessionStorage.setItem('oauth-nonce', nonce); } catch(e) {}
  // 정확한 현재 프로토콜, 호스트(포트 포함), 경로명을 결합
  var base = window.location.protocol + '//' + window.location.host + window.location.pathname;
  var search = (window.location.search || '').indexOf('oauth_debug=1') !== -1 ? window.location.search : '';
  var redirectUri = base + search;
  console.log('--- [Google OAuth 준비] ---');
  console.log('현재 설정된 리디렉션 URI:', redirectUri);
  console.log('※ 이 URI (' + redirectUri + ') 가 Google Cloud Console의 [승인된 리디렉션 URI] 목록에 정확히 등록되어 있어야 400 invalid_request 에러가 발생하지 않습니다.');

  var params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token token',
    scope: 'openid email profile',
    nonce: nonce
  });
  var url = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  if (typeof _oauthDebug === 'function') _oauthDebug('리디렉트 시도', { redirect_uri: redirectUri });
  window.location.assign(url);
}

function processGoogleUserFromHash() {
  var hash = (window.location.hash || '').replace(/^#/, '');
  if (typeof _oauthDebug === 'function') _oauthDebug('복귀 hash', { hash: hash.substring(0, 80) + (hash.length > 80 ? '...' : '') });
  var params = new URLSearchParams(hash);
  var error = params.get('error');
  if (error) {
    if (typeof _oauthDebug === 'function') _oauthDebug('OAuth 오류', { error: error, description: params.get('error_description') });
    if (typeof showToast === 'function') showToast('구글 로그인 오류: ' + (params.get('error_description') || error), true);
    window.location.hash = '';
    showLoginScreen();
    return;
  }
  var idToken = params.get('id_token');
  if (!idToken) {
    if (typeof _oauthDebug === 'function') _oauthDebug('hash에 id_token 없음');
    showLoginScreen();
    return;
  }
  var storedNonce = '';
  try { storedNonce = sessionStorage.getItem('oauth-nonce') || ''; } catch(e) {}
  var payload = null;
  try {
    var parts = idToken.split('.');
    if (parts.length < 2) throw new Error('invalid JWT');
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (e) {
    if (typeof _oauthDebug === 'function') _oauthDebug('JWT 파싱 실패', { err: String(e) });
    showLoginScreen();
    return;
  }
  if (payload.nonce && storedNonce && payload.nonce !== storedNonce) {
    if (typeof _oauthDebug === 'function') _oauthDebug('nonce 불일치');
    showLoginScreen();
    return;
  }
  var email = (payload.email || '').trim();
  var name = (payload.name || payload.email || '사용자').trim();
  try { sessionStorage.removeItem('oauth-nonce'); } catch(e) {}
  window.location.hash = '';
  if (typeof _oauthDebug === 'function') _oauthDebug('로그인 처리', { email: email, name: name });
  processGoogleUser(email, name);
}

function processGoogleUser(email, name) {
  if (!isAllowed(email)) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').style.display = 'none';
    var denied = document.getElementById('access-denied');
    var deniedEmail = document.getElementById('denied-email');
    if (denied) denied.style.display = 'flex'; // 수정: classList add show -> style display = flex
    if (deniedEmail) deniedEmail.textContent = email;
    if (typeof _oauthDebug === 'function') _oauthDebug('접근 거부 (허용 목록에 없음)', { email: email });
    return;
  }
  try {
    sessionStorage.setItem('auth-email', email);
    sessionStorage.setItem('auth-name', name);
    localStorage.setItem('auth-email', email);
    localStorage.setItem('auth-name', name);
    localStorage.setItem('isLoggedIn', 'true');
  } catch(e) {}
  onAuthSuccess(email, name);
}

const ADMIN_EMAILS = ['ohnayu@gmail.com', 'ohhhjs90@gmail.com'];
let sessionTimeoutTimer = null;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function resetSessionTimer() {
    if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
    sessionTimeoutTimer = setTimeout(() => {
        showToast('보안을 위해 30분간 활동이 없어 자동 로그아웃되었습니다.', true);
        setTimeout(signOut, 2000);
    }, SESSION_TIMEOUT_MS);
}

['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetSessionTimer, { passive: true });
});

function showPinModal() {
    // 🛡️ [로컬 디버깅 및 E2E 테스트 보안 우회]
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        window.appReady = true;
        const wrapper = document.getElementById('app-wrapper');
        if (wrapper) {
            wrapper.style.filter = 'none';
            wrapper.style.pointerEvents = 'auto';
        }
        console.log('[Dev] Localhost detected. PIN lock bypassed.');
        return;
    }

    const modal = document.getElementById('pin-modal');
    if (modal) {
        // 모달을 body 직계 자식으로 이동 (app-wrapper의 blur/pointer-events 영향 차단)
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        // PIN 입력창에 자동 포커스 (100ms 지연으로 브라우저 정합성 보장)
        setTimeout(function() {
            const pinInput = document.getElementById('pin-digit');
            if (pinInput) { pinInput.value = ''; pinInput.focus(); }
        }, 150);
        // 배경 앱을 블러 처리
        const wrapper = document.getElementById('app-wrapper');
        if (wrapper) {
            wrapper.style.filter = 'blur(8px)';
            wrapper.style.pointerEvents = 'none';
        }
    }
}

function verifyPin() {
    const entered = document.getElementById('pin-digit').value;
    const errEl = document.getElementById('pin-error-msg');
    const pinInput = document.getElementById('pin-digit');

    // 빈 입력 체크
    if (!entered || entered.trim() === '') {
      if (errEl) { errEl.textContent = '⚠️ PIN을 입력해주세요.'; errEl.style.display = 'block'; }
      if (pinInput) { pinInput.style.borderColor = '#f59e0b'; pinInput.focus(); }
      return;
    }

    const email = (window._userEmail || '').toLowerCase().trim();
    const personalPin = email ? localStorage.getItem('pin-' + email) : null;
    const savedPin = personalPin || localStorage.getItem('master-pin-config') || '0000';
    if (entered === savedPin) {
        if (errEl) errEl.style.display = 'none';
        document.getElementById('pin-modal').style.display = 'none';
        const wrapper = document.getElementById('app-wrapper');
        if (wrapper) {
            wrapper.style.filter = 'none';
            wrapper.style.pointerEvents = 'auto';
        }
        window.appReady = true;
        if (window._rescueTimer) { clearTimeout(window._rescueTimer); window._rescueTimer = null; }
        const rescueEl = document.getElementById('rescue-ui');
        if (rescueEl) rescueEl.style.display = 'none';
        if (!personalPin && email) {
          showToast('✅ 인증됨! T7 설정에서 개인 PIN을 설정하세요.');
        } else {
          showToast('인증되었습니다. 대시보드 액세스를 허용합니다.');
        }
        resetSessionTimer();
    } else {
        if (errEl) { errEl.textContent = '❌ PIN이 틀렸습니다. 다시 시도해주세요.'; errEl.style.display = 'block'; }
        if (pinInput) { pinInput.style.borderColor = '#ef4444'; pinInput.value = ''; pinInput.focus(); pinInput.classList.add('shake'); setTimeout(() => pinInput.classList.remove('shake'), 500); }
        showToast('PIN 번호가 틀렸습니다.', true);
    }
}

function isAllowed(email) {
  if (!email) return false;
  const targetEmail = email.toLowerCase().trim();
  if (ADMIN_EMAILS.includes(targetEmail)) return true;
  const extraEmails = (localStorage.getItem('allowed-emails-config') || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);
  if (extraEmails.includes(targetEmail)) return true;
  const invitedEmail = (localStorage.getItem('invited-email') || '').toLowerCase().trim();
  if (invitedEmail && invitedEmail === targetEmail) return true;
  return false;
}

function onAuthSuccess(email, name) {
  console.log('[Auth] onAuthSuccess started for:', email);
  try {
    const loginScreen = document.getElementById('login-screen');
    const accessDenied = document.getElementById('access-denied');
    const appWrapper = document.getElementById('app-wrapper');

    if (loginScreen) { loginScreen.classList.add('hidden'); loginScreen.style.display = 'none'; }
    if (accessDenied) accessDenied.classList.remove('show');
    if (appWrapper) appWrapper.style.display = 'block';

    showPinModal();

    const email1 = (localStorage.getItem('allowed-email-1') || '').trim();
    window._userEmail = email;
    // ★ auth-email을 저장하여 showTab 등 권한 체크 시 참조 가능하도록
    try {
      localStorage.setItem('auth-email', email);
      sessionStorage.setItem('auth-email', email);
    } catch(e) {}
    const _e = (email || '').toLowerCase().trim();
    window.currentUser = (_e === 'ohnayu@gmail.com' || _e === 'bypass@local' || ADMIN_EMAILS.includes(_e)) ? '남편' : '아내';

    const badgeEl = document.getElementById('user-badge');
    if (badgeEl) badgeEl.textContent = window.currentUser === '남편' ? '👨 ' + window.currentUser : '👩 ' + window.currentUser;
    const displayEl = document.getElementById('current-user-display');
    if (displayEl) displayEl.textContent = `${window.currentUser} (${email})`;

    const savedUrl = localStorage.getItem('script-url');
    if (savedUrl) {
      const urlInput = document.getElementById('script-url-input');
      if (urlInput) urlInput.value = savedUrl;
      // 구글 시트 연결 상태 복원
      const badge = document.getElementById('sheet-status-badge');
      if (badge) { badge.textContent = '연결됨'; badge.style.background = 'var(--success, #22c55e)'; }
      const sheetEl = document.getElementById('display-sheet-id');
      if (sheetEl) { sheetEl.textContent = SHEET_ID; }
      loadProducts();
    } else {
      setSyncStatus('error', 'URL 미설정');
    }

    const savedApiUrl = getBackendUrl();
    const be = document.getElementById('api-backendUrl');
    if (be && savedApiUrl) be.value = savedApiUrl;

    let lastTab = localStorage.getItem('lastTab');
    if (!lastTab || lastTab === 'null' || lastTab === 'undefined' || !TAB_IDS.includes(lastTab)) {
      lastTab = 'sourcing';
    }
    showTab(lastTab);

    // 🛡️ [V5.5] 탭에 관계없이 API 키/설정 필드를 localStorage에서 DOM에 바인딩
    // showTab('setup') 안에서만 loadApiKeys()가 호출되어 초기 진입시 누락되는 문제 해결
    setTimeout(() => {
      if (typeof loadApiKeys === 'function') loadApiKeys();
      console.log('🛡️ [initApp] 시스템 설정 값 DOM 바인딩 완료');
    }, 300);

    window.appReady = true;
    // T7 PIN 소유자 표시
    const pinOwner = document.getElementById('pin-owner-display');
    if (pinOwner) pinOwner.textContent = (window.currentUser || '') + ' (' + email + ')';
    // 비관리자에게 T7 탭 숨기기
    const tabSetup = document.getElementById('tab-setup');
    if (tabSetup) tabSetup.style.display = (ADMIN_EMAILS.includes(email.toLowerCase().trim()) || email.toLowerCase().trim() === 'bypass@local') ? '' : 'none';
    if (typeof loadVendors === 'function') loadVendors();
    if (typeof loadAiRecommendations === 'function') loadAiRecommendations();
    console.log('[Auth] onAuthSuccess completed.');
  } catch (err) {
    console.error('[Auth] Error in onAuthSuccess:', err);
  }
}

const originalShowTab = window.showTab;
window.showTab = function(name) {
    // T7(setup)은 관리자만 접근 가능
    if (name === 'setup') {
        const userEmail = (localStorage.getItem('auth-email') || '').toLowerCase();
        if (!ADMIN_EMAILS.includes(userEmail) && userEmail !== 'bypass@local') {
            showToast('⚠️ 접근 권한이 없습니다. 관리자만 접근 가능합니다.', true);
            return;
        }
    }

    // === 모든 페이지 숨김 ===
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
        p.style.opacity = '0';
    });

    // === 대상 페이지 표시 ===
    const page = document.getElementById('page-' + name);
    if (page) {
        page.style.display = 'block';
        page.classList.add('active');
        requestAnimationFrame(() => {
            page.style.opacity = '1';
            window.dispatchEvent(new Event('resize'));
            if (name === 'finance' && typeof syncStateAndRender === 'function') {
                syncStateAndRender('finance');
            }
        });
    }

    // === 상단 탭 하이라이트 (data-tab 기반, 순서 무관) ===
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });

    // === 상단 내비게이션 링크 활성화 ===
    const links = document.querySelectorAll('.nav-links a');
    links.forEach(l => {
        l.classList.remove('active');
        if (l.getAttribute('onclick')?.includes(`'${name}'`)) l.classList.add('active');
    });

    // === 하단 탭바 동기화 ===
    document.querySelectorAll('.tab-bar-item').forEach(item => {
        const onclickAttr = item.getAttribute('onclick') || '';
        item.classList.toggle('active', onclickAttr.includes(`'${name}'`));
    });

    localStorage.setItem('lastTab', name);
};


function handleCredentialResponse(response) {
  if (response.credential) {
    try {
      const payloadBase64 = response.credential.split('.')[1];
      const decodedPayload = JSON.parse(decodeURIComponent(escape(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')))));

      // 사용자 지시: 콜백 내부 누락 방지 및 팩트체크 콘솔 출력
      localStorage.setItem('isLoggedIn', 'true');
      console.log('✅ [Fact Check] handleCredentialResponse 내 isLoggedIn 정상 저장:', localStorage.getItem('isLoggedIn'));

      if (typeof processGoogleUser === 'function') {
        processGoogleUser(decodedPayload.email, decodedPayload.name);
      } else if (typeof onAuthSuccess === 'function') {
        onAuthSuccess(decodedPayload.email, decodedPayload.name, response.credential);
      }
    } catch(e) {
      console.error("JWT Decode error", e);
      if(typeof showToast === 'function') showToast('인증 처리 중 오류가 발생했습니다.', true);
    }
  }
}

function signOut() {
  try {
    sessionStorage.removeItem('auth-email');
    sessionStorage.removeItem('auth-name');
    localStorage.removeItem('auth-email');
    localStorage.removeItem('auth-name');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('lastTab');
  } catch(e) {}
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  location.reload();
}

// 🛡️ [시스템 설정 보호] 캐시 초기화 시 API 키와 시스템 설정은 보존
function safeClearCache() {
  const PROTECTED_PREFIXES = [
    'google-gemini-api-key', 'google-vision-api-key',
    'naver-license', 'naver-secret',
    'domeggook-api-key', 'koreaexim-api-key',
    'script-url', 'proxyApiUrl', 'api-url', 'backendUrl',
    'marketFeeRate', 'minMarginFilter',
    'app-login-password', 'system-settings',
    'BRAND_STOPWORDS', 'allowed-emails'
  ];
  // 1. 보호 대상 키-값 백업
  const backup = {};
  PROTECTED_PREFIXES.forEach(prefix => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(prefix)) {
        backup[key] = localStorage.getItem(key);
      }
    }
  });
  // 2. 전체 초기화
  localStorage.clear();
  sessionStorage.clear();
  // 3. 보호 대상 복원
  Object.keys(backup).forEach(key => {
    localStorage.setItem(key, backup[key]);
  });
  console.log('🛡️ safeClearCache: ' + Object.keys(backup).length + '개 시스템 설정 보존 완료');
  location.reload();
}

// ==================== USER ====================
function showUserModal() { /* 구글 로그인으로 대체됨 */ }
function setUser(name) { /* 구글 로그인으로 대체됨 */ }

// ==================== SYNC STATUS ====================
function setSyncStatus(state, label) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  dot.className = 'sync-dot ' + state;
  lbl.textContent = label;
}

// ==================== TABS ====================
// ==================== TABS ====================
const TAB_IDS = ['sourcing', 'inventory', 'studio', 'oms', 'ledger', 'finance', 'setup'];
let currentTabIndex = () => TAB_IDS.findIndex(id => document.getElementById('page-' + id)?.classList.contains('active'));
function nextTab() { const i = currentTabIndex(); if (i < TAB_IDS.length - 1 && i >= 0) showTab(TAB_IDS[i + 1]); }
function prevTab() { const i = currentTabIndex(); if (i > 0) showTab(TAB_IDS[i - 1]); }

(function setupSwipe() {
  let startX = 0;
  const area = document.querySelector('.content-area');
  if (!area) return;
  area.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
  area.addEventListener('touchend', function(e) {
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) nextTab(); else prevTab();
  }, { passive: true });
})();

async function syncStateAndRender(name) {
  // 데이터 동기화가 필요한 탭들
  if (name === 'ledger' || name === 'finance') {
    if (appState.sales.length === 0 && SCRIPT_URL) {
      try {
        const sData = await fetchSheetApi(SCRIPT_URL, 'getSalesRecords');
        if (sData.success) {
          appState.sales = sData.records || [];
          salesRecords = appState.sales;
        }
      } catch (e) {
        console.error('Failed to sync sales:', e);
      }
    }
  }

  // 각 탭별 렌더링 로직
  if (name === 'sourcing') {
    if (typeof loadSeasonPage === 'function') loadSeasonPage();
  }
  if (name === 'simulator') {
    recalcMargin();
    renderHistory();
  }
  if (name === 'ledger') {
    renderList();
    loadSalesPage();
  }
  if (name === 'finance') {
    if (typeof updateFinanceDashboard === 'function') {
      updateFinanceDashboard();
    }
  }
  if (name === 'setup') {
    if (typeof renderStats === 'function') renderStats();
    if (typeof loadApiKeys === 'function') loadApiKeys();
  }
}

/** 소싱 성향 설정 (T7) */
function setSourcingStyle(style) {
  localStorage.setItem('sourcing-style', style);
  document.querySelectorAll('.sourcing-style-btn').forEach(btn => {
    const isActive = btn.dataset.style === style;
    btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
    btn.style.background = isActive ? 'var(--surface2)' : 'var(--surface)';
    btn.style.boxShadow = isActive ? '0 0 0 2px var(--accent)' : 'none';
  });
  const labels = {balanced:'균형형',competition:'경쟁 회피형',trend:'트렌드 추종형',margin:'마진 우선형'};
  showToast(`소싱 성향: ${labels[style] || style} 적용 완료`);
}
// 페이지 로드 시 저장된 성향 반영
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('sourcing-style') || 'balanced';
  setTimeout(() => setSourcingStyle(saved), 300);
});

// ==================== V5.5 T7 수수료율 / 소싱 상수 저장/로드 ====================
/** 마켓별 수수료율 저장 */
function saveMarketFees() {
  const fees = {
    '네이버': Number(document.getElementById('fee-naver')?.value) || 8,
    '쿠팡': Number(document.getElementById('fee-coupang')?.value) || 10.8,
    '11번가': Number(document.getElementById('fee-11st')?.value) || 9,
    '위메프': Number(document.getElementById('fee-wemakeprice')?.value) || 11,
  };
  localStorage.setItem('marketFees', JSON.stringify(fees));
  localStorage.setItem('marketFeeRate', (fees['네이버'] / 100).toString());
  showToast('마켓 수수료율 저장 완료');
}

/** 소싱 상수 저장 */
function saveSourcingConstants() {
  const c = {
    exchangeRate: Number(document.getElementById('const-exchange')?.value) || 195,
    freightBase: Number(document.getElementById('const-freight-base')?.value) || 1000,
    freightPerKg: Number(document.getElementById('const-freight-per-kg')?.value) || 1500,
    customsTax: Number(document.getElementById('const-customs-tax')?.value) || 18,
    domesticShipping: Number(document.getElementById('const-domestic-ship')?.value) || 3000,
  };
  localStorage.setItem('exchangeRate', c.exchangeRate.toString());
  localStorage.setItem('sourcingConstants', JSON.stringify(c));
  showToast('소싱 상수 저장 완료');
}

/** T7 설정값 로드 (페이지 로드 시) */
function loadT7Settings() {
  try {
    const fees = JSON.parse(localStorage.getItem('marketFees') || '{}');
    if (fees['네이버']) document.getElementById('fee-naver').value = fees['네이버'];
    if (fees['쿠팡']) document.getElementById('fee-coupang').value = fees['쿠팡'];
    if (fees['11번가']) document.getElementById('fee-11st').value = fees['11번가'];
    if (fees['위메프']) document.getElementById('fee-wemakeprice').value = fees['위메프'];

    const c = JSON.parse(localStorage.getItem('sourcingConstants') || '{}');
    if (c.exchangeRate) document.getElementById('const-exchange').value = c.exchangeRate;
    if (c.freightBase) document.getElementById('const-freight-base').value = c.freightBase;
    if (c.freightPerKg) document.getElementById('const-freight-per-kg').value = c.freightPerKg;
    if (c.customsTax) document.getElementById('const-customs-tax').value = c.customsTax;
    if (c.domesticShipping) document.getElementById('const-domestic-ship').value = c.domesticShipping;
  } catch(e) { /* 첫 방문 시 기본값 사용 */ }
}
document.addEventListener('DOMContentLoaded', () => setTimeout(loadT7Settings, 500));

// ==================== V5.5 카테고리 트리 JS ====================
/** 카테고리 그룹 토글 (자식 접기/펴기) */
function toggleCatGroup(el) {
  const children = el.nextElementSibling;
  if (children && children.classList.contains('cat-children')) {
    const isOpen = children.style.display !== 'none';
    children.style.display = isOpen ? 'none' : 'block';
    const arrow = el.querySelector('span');
    if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
  }
}

// 📌 [Core Utility] 모든 주변 모듈의 펄스(Pulse)를 중앙 엔진으로 쏘아주는 배관 함수
window.triggerUnifiedSearch = function(keyword) {
  const mainInput = document.getElementById('v5-search-input');
  const mainSearchSection = document.getElementById('tab-sourcing');
  if (mainInput) {
    mainInput.value = keyword;
    if (mainSearchSection) mainSearchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof runIntegratedV5Search === 'function') setTimeout(runIntegratedV5Search, 300);
  }
};

// 수동 검색 스무스 라우팅
window.focusManualSearch = function(keyword) {
  const manualTarget = document.getElementById('통합-공급처-검색') || document.getElementById('sourcing-b2b-section');
  if (manualTarget) {
    manualTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const b2bInput = manualTarget.querySelector('input');
    if (b2bInput) { b2bInput.value = keyword; b2bInput.focus(); }
    if(typeof showToast === 'function') showToast(`'${keyword}' 수동 소싱을 시작합니다.`);
  }
};

// 🚀 T2로 담기: 아키텍처 표준 (AppEventBus + 탭 전환) 파이프라인 결합
window.handleTransferToT2 = function(itemStr) {
  try {
    const itemData = JSON.parse(decodeURIComponent(itemStr));
    if (typeof confirmSourcing === 'function') confirmSourcing(itemData);
    else if (window.AppEventBus) window.AppEventBus.emit('PRODUCT_SOURCED', itemData);
    if (typeof showTab === 'function') showTab('inventory');
  } catch(e) { console.error("T2 이관 파이프라인 오류:", e); }
};

document.addEventListener('DOMContentLoaded', () => {
    const si = document.getElementById('v5-search-input');
    if(si) {
        si.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof runIntegratedV5Search === 'function') runIntegratedV5Search();
            }
        });
    }
});

/** 카테고리 리프 클릭 시 자동 검색 */
function searchByCategory(keyword) {
  document.querySelectorAll('.cat-leaf').forEach(l => l.style.fontWeight = '');
  if(window.event && window.event.target) window.event.target.style.fontWeight = '800';
  window.triggerUnifiedSearch(keyword);
}

// ==================== V5.5 AI Score 고급 지표 ====================
/**
 * V2 판매 가속도 (Sales Velocity)
 * 네이버 쇼핑 검색 결과의 리뷰수 기반 주당 판매량 추정
 * 리뷰 작성 비율 ≈ 구매자의 3% → 역산하여 판매량 산출
 */
function calcSalesVelocity(product) {
  if (!product) return 0;
  const reviewCount = parseInt(product.reviewCount || product.mallCount || 0);
  if (reviewCount > 0) {
    // 리뷰 작성 비율 3%로 추정: 리뷰 100개 ≒ 누적 판매 3,333건
    const estimatedTotalSales = Math.round(reviewCount / 0.03);
    // 평균 등록 기간 12주(3개월) 가정 → 주당 판매량
    const weeklyEstimate = Math.round(estimatedTotalSales / 12);
    return Math.min(weeklyEstimate, 9999); // 상한 캡
  }
  return 0; // 데이터 없으면 0 (Mock 금지)
}

/**
 * V4 트렌드 모멘텀 (Trend Momentum)
 * fetchRealTrendSlope가 sessionStorage에 캐시한 기울기 데이터 활용
 * >1.5 = 급상승, <0.7 = 하락세, 1.0 = 중립(데이터 미수집)
 */
function calcTrendMomentum(keyword) {
  if (!keyword) return 1.0;
  const cacheKey = 'trend_slope_' + keyword;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached !== null) {
    const slope = parseFloat(cached);
    // 기울기(%)를 모멘텀 비율로 변환: +20% → 1.2, -10% → 0.9
    return Math.round((1 + slope / 100) * 10) / 10;
  }
  return 1.0; // 캐시 없으면 중립값 (Mock 아님, 데이터 미수집)
}

/**
 * V5.5 향상된 AI Score (V1/V2/V3/V4 통합)
 * @returns {Object} { score, velocity, momentum, components }
 */
function calcEnhancedAIScore(product, keyword) {
  const velocity = calcSalesVelocity(product);
  const momentum = calcTrendMomentum(keyword);

  // 기존 aiScore에 V2/V4 보너스/감점
  const baseScore = product.aiScore || 50;
  let bonus = 0;

  // V2: 판매 가속도 보너스 (주간 리뷰 30개 이상 → +5점)
  if (velocity >= 30) bonus += 5;
  else if (velocity >= 15) bonus += 2;

  // V4: 트렌드 모멘텀 (1.5 이상 → +8점, 0.7 미만 → -5점)
  if (momentum >= 1.5) bonus += 8;
  else if (momentum >= 1.2) bonus += 3;
  else if (momentum < 0.7) bonus -= 5;

  const enhanced = Math.max(0, Math.min(100, baseScore + bonus));
  return { score: enhanced, velocity, momentum, bonus };
}

let _showTabSkipPush = false;
function showTab(name) {
  try { localStorage.setItem('lastTab', name); } catch(e) {}

  // ★ SPA 뒤로가기 지원: hash 기반 히스토리 관리
  if (!_showTabSkipPush) {
    const newHash = '#tab-' + name;
    if (location.hash !== newHash) {
      try {
        history.pushState({ tab: name }, '', newHash);
      } catch(e) {
        // file:// 프로토콜 fallback
        location.hash = newHash;
      }
    }
  }
  _showTabSkipPush = false;

  // 상단 메인 탭 활성화 (data-tab 기반, 순서 무관)
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === name);
  });

  // 하단 퀵 모바일 탭 바 활성화 (.tab-bar-item)
  document.querySelectorAll('.tab-bar-item').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === name);
  });

  // 모든 페이지 섹션 숨기기 및 선택 페이지 노출
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
    p.style.removeProperty('opacity');  // CSS 트랜지션에 위임
    p.style.removeProperty('transform');
  });

  const targetPage = document.getElementById('page-' + name);
  if (targetPage) {
    targetPage.classList.add('active');
    targetPage.style.display = 'block';
    targetPage.style.opacity = '1';
    targetPage.style.transform = 'translateY(0)';
  }

  // 설정 탭(T7) 진입 시 보안 및 API 데이터 로드
  if (name === 'setup') {
    const e1 = localStorage.getItem('allowed-email-1') || '';
    const e2 = localStorage.getItem('allowed-email-2') || '';
    const email1El = document.getElementById('email-1-input');
    const email2El = document.getElementById('email-2-input');
    if (email1El) email1El.value = e1;
    if (email2El) email2El.value = e2;
    if (typeof loadApiKeys === 'function') loadApiKeys();
  }

  // ★ T1 소싱 인텔리전스: 탭 진입 시 데이터 자동 수집
  if (name === 'sourcing' && typeof SourcingIntel !== 'undefined') {
    SourcingIntel.refresh();  // 비동기 — 캐시 유효하면 즉시 반환
  }

  // 핵심 비즈니스 로직 렌더링 동기화
  if (typeof syncStateAndRender === 'function') {
    syncStateAndRender(name);
  }
}

// ★ SPA 뒤로가기/앞으로가기 처리
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.tab) {
    _showTabSkipPush = true;
    showTab(e.state.tab);
  } else {
    // hash에서 탭 이름 추출
    const hash = location.hash;
    if (hash && hash.startsWith('#tab-')) {
      _showTabSkipPush = true;
      showTab(hash.replace('#tab-', ''));
    }
  }
});

// 페이지 로드 시 hash 확인
window.addEventListener('DOMContentLoaded', function() {
  const hash = location.hash;
  if (hash && hash.startsWith('#tab-')) {
    const tabName = hash.replace('#tab-', '');
    if (['sourcing','inventory','ledger','finance','studio','oms','setup'].includes(tabName)) {
      setTimeout(() => { _showTabSkipPush = true; showTab(tabName); }, 100);
    }
  }
});

// ==================== CALCULATE ====================
function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
function fmtPct(n) { const v = parseFloat(n); return (isNaN(v) ? '0.0' : v.toFixed(1)) + '%'; }

function onCalcMarketChange() {
  const sel = document.getElementById('calc-market-select');
  const id = (sel && sel.value) || 'smartstore';
  const info = MARKET_FEES[id];
  const feeInput = document.getElementById('fee-single');
  if (feeInput && info) feeInput.value = info.fee;
}

function setMargin(val, btn) {
  var v = Math.max(1, Math.min(80, parseInt(val, 10) || 15));
  document.getElementById('targetMargin').value = v;
  var sl = document.getElementById('targetMarginSlider');
  if (sl) sl.value = v;
  document.querySelectorAll('.margin-presets .preset-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  recalcMargin();
}
function syncMarginFromSlider() {
  var sl = document.getElementById('targetMarginSlider');
  if (sl) setMargin(sl.value, null);
}
function syncMarginFromInput() {
  var inp = document.getElementById('targetMargin');
  var v = Math.max(1, Math.min(80, parseFloat(inp.value) || 15));
  inp.value = v;
  var sl = document.getElementById('targetMarginSlider');
  if (sl) sl.value = v;
  recalcMargin();
}
function roundTo10(value) {
  if (value <= 0 || isNaN(value)) return 0;
  return Math.round(value / 10) * 10;
}
function setSupplyShipping(v) {
  var el = document.getElementById('supplyShipping');
  if (el) { el.value = v; recalcMargin(); }
}
function setMarketShipping(v) {
  var el = document.getElementById('marketShipping');
  if (el) { el.value = v; recalcMargin(); }
}
function setShip(type, val) {
  if (type === 'sup') setSupplyShipping(val); else setMarketShipping(val);
}
function showCalcSubTab(tab) {
  try { localStorage.setItem('lastCalcSubTab', tab); } catch(e) {}
  var direct = document.getElementById('calc-section-direct');
  var search = document.getElementById('calc-section-search');
  var btnDirect = document.getElementById('calc-tab-direct');
  var btnSearch = document.getElementById('calc-tab-search');
  if (tab === 'search') {
    if (direct) direct.style.display = 'none';
    if (search) search.style.display = 'block';
    if (btnDirect) btnDirect.classList.remove('active');
    if (btnSearch) btnSearch.classList.add('active');
    var key = localStorage.getItem(API_KEYS.domeggook) || '';
    var msg = document.getElementById('domeggook-key-msg');
    if (msg) msg.textContent = key ? '도매꾹 API 키가 설정되어 있습니다. 검색어를 입력 후 검색하세요.' : '설정 탭에서 도매꾹 API 키를 입력하면 검색할 수 있습니다.';
  } else {
    if (direct) direct.style.display = 'block';
    if (search) search.style.display = 'none';
    if (btnDirect) btnDirect.classList.add('active');
    if (btnSearch) btnSearch.classList.remove('active');
  }
}



function getInputs() {
  const sel = document.getElementById('calc-market-select');
  const marketId = (sel && sel.value) || 'smartstore';
  const feeVal = parseFloat(document.getElementById('fee-single').value) || MARKET_FEES[marketId].fee;
  const fees = {};
  MARKET_IDS.forEach(k => { fees[k] = k === marketId ? feeVal : MARKET_FEES[k].fee; });
  return {
    name: document.getElementById('productName').value.trim() || '미입력 상품',
    cost: parseFloat(document.getElementById('costPrice').value) || 0,
    supShip: parseFloat(document.getElementById('supplyShipping').value) || 0,
    mktShip: parseFloat(document.getElementById('marketShipping').value) || 0,
    target: parseFloat(document.getElementById('targetMargin').value) || 0,
    selectedMarketId: marketId,
    fees
  };
}

// ==================== C-1: 시중가 조회 ====================
function competitionLabel(score) {
  if (score <= 33) return { text: '🟢 낮음', cls: 'competition-low' };
  if (score <= 66) return { text: '🟡 보통', cls: 'competition-mid' };
  return { text: '🔴 높음', cls: 'competition-high' };
}
async function fetchMarketPrice() {
  const name = document.getElementById('productName').value.trim();
  if (!name) { showToast('상품명을 입력하세요', true); return; }
  const base = getBackendUrl();
  if (!base) { showToast('설정에서 백엔드 API URL을 입력하세요', true); showTab('setup'); return; }
  const btn = document.getElementById('btn-market-search');
  btn.disabled = true;
  const box = document.getElementById('market-price-box');
  try {
    const searchUrl = base + '/search?query=' + encodeURIComponent(name) + '&display=35&include_trend=true';
    const [searchRes, categoryRes, statsRes] = await Promise.all([
      fetch(searchUrl, { headers: getApiHeaders() }),
      fetch(base + '/category?query=' + encodeURIComponent(name), { headers: getApiHeaders() }),
      fetch(base + '/product-stats?query=' + encodeURIComponent(name), { headers: getApiHeaders() })
    ]);
    const search = await searchRes.json();
    const category = await categoryRes.json();
    const stats = await statsRes.json();
    if (!search.success) { showToast(search.error || '시중가 조회 실패', true); btn.disabled = false; return; }

    // 시중가 결과 박스 강제 표시
    if (box) box.style.display = 'block';

    const minP = search.min_price || 0;
    const avgP = search.avg_price || 0;
    const maxP = search.max_price || 0;
    document.getElementById('mp-min').textContent = fmt(minP) + '원';
    document.getElementById('mp-avg').textContent = fmt(avgP) + '원';
    document.getElementById('mp-max').textContent = fmt(maxP) + '원';

    const sellerCount = search.seller_count ?? stats.seller_count ?? null;
    document.getElementById('mp-sellers').textContent = sellerCount != null ? fmt(sellerCount) + '개' : '—';
    const score = (stats.success && stats.competition_score != null) ? stats.competition_score : 50;
    const comp = competitionLabel(score);
    const compEl = document.getElementById('mp-competition');
    if (compEl) {
      compEl.textContent = comp.text;
      compEl.className = 'competition-badge ' + comp.cls;
    }

    const catVal = (category.success && category.category) ? category.category : '';
    const catAuto = document.getElementById('mp-category-auto');
    if (catAuto) catAuto.textContent = catVal ? '추천: ' + catVal : '—';
    const catSelect = document.getElementById('mp-category-select');
    if (catSelect) catSelect.value = catVal || '';

    const refPrice = document.getElementById('ref-price');
    if (refPrice) refPrice.value = avgP > 0 ? avgP : '';

    const trendSection = document.getElementById('mp-trend-section');
    if (search.trend && search.trend.success) {
      const t = search.trend;
      trendSection.style.display = 'block';
      document.getElementById('mp-trend-text').textContent = (t.season_desc || '—');
      document.getElementById('mp-season').textContent = (t.season_icon || '') + ' ' + (t.season || '—');
      const miniChart = document.getElementById('mp-mini-chart');
      if (miniChart && t.monthly_data && t.monthly_data.length) {
        const maxR = Math.max(...t.monthly_data);
        const h = 36;
        miniChart.innerHTML = t.monthly_data.map(r => '<span style="height:' + (maxR > 0 ? Math.max(2, (r / maxR * h)) : 0) + 'px" title="' + r + '"></span>').join('');
      }
    } else if (trendSection) {
      trendSection.style.display = 'none';
    }

    // 결과 렌더링
    if (search.items && search.items.length > 0) {
      renderSourcingCards(search.items, minP, avgP, maxP);
    } else if (search.top_items && search.top_items.length > 0) {
      // items가 없으면 top_items 시도 (구버전 호환)
      renderSourcingCards(search.top_items.map(it=>({name:it.title, price:it.price, link:it.link, image:it.image})), minP, avgP, maxP);
    }

    // 도매 통합 검색 자동 트리거 (1차)
    const wholesaleInput = document.getElementById('unified-wholesale-input');
    if (wholesaleInput) {
      wholesaleInput.value = name;
      runUnifiedSearch(true); // silent
    }

    saveToHistory(name, { min_price: minP, avg_price: avgP, max_price: maxP });
    showToast('시중가 조회 완료');
  } catch (e) {
    console.error(e);
    showToast('API 연결 실패', true);
  }
  btn.disabled = false;
}

function parseUnitInfo(name, price) {
  const qtyMatch = name.match(/(\d+)(개|box|박스|팩|봉|입|ea|세트|set)/i);
  const weightMatch = name.match(/(\d+\.?\d*)(kg|g|ml|l|리터|킬로|mg)/i);
  let qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
  let unit = qtyMatch ? qtyMatch[2] : '개';
  if (weightMatch) {
    let val = parseFloat(weightMatch[1]);
    let u = weightMatch[2].toLowerCase();
    if (u.includes('k') || u === '킬로') { val *= 1000; u = 'g'; }
    if (u === 'l' || u === '리터') { val *= 1000; u = 'ml'; }
    const totalVal = val * qty;
    const unitPrice = price / totalVal;
    return { qty, unit: u, unitPrice, totalVal, isWeight: true };
  }
  return { qty, unit, unitPrice: price / qty, isWeight: false };
}

function renderSourcingCards(items, minP, avgP, maxP) {
  const containers = {
    min: document.getElementById('mp-product-cards-min'),
    avg: document.getElementById('mp-product-cards-avg'),
    max: document.getElementById('mp-product-cards-max')
  };
  if (!containers.min || !containers.avg || !containers.max) return;

  containers.min.innerHTML = '';
  containers.avg.innerHTML = '';
  containers.max.innerHTML = '';
  document.getElementById('mp-products-section').style.display = 'block';

  // 가격대별 분류 및 렌더링 (최대 35개)
  items.slice(0, 35).forEach(item => {
    const p = item.price || 0;
    const unitInfo = parseUnitInfo(item.name, p);
    const cardHtml = `
      <div class="mp-product-card" style="padding:4px; border:1px solid var(--border); border-radius:8px; background:var(--surface2); font-size:10px; cursor:pointer" onclick="window.open('${item.link}','_blank')">
        <img src="${item.image || ''}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; margin-bottom:4px" onerror="this.src='https://placehold.co/80?text=No+Img'">
        <div style="font-weight:700; color:var(--text); margin-bottom:2px">${fmt(p)}원</div>
        <div style="font-size:9px; color:var(--accent); margin-bottom:2px">
          ${unitInfo.qty > 1 || unitInfo.isWeight ? `개당 ${fmt(Math.round(unitInfo.unitPrice))}${unitInfo.isWeight ? 'g' : '원'}` : '단품'}
        </div>
        <div style="color:var(--text-muted); font-size:9px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${item.name}">${item.name}</div>
        <div style="font-size:8px; color:var(--text-muted); margin-top:2px">${item.mall || '네이버'}</div>
      </div>
    `;

    if (p <= minP * 1.5) containers.min.insertAdjacentHTML('beforeend', cardHtml);
    else if (p > avgP * 1.2) containers.max.insertAdjacentHTML('beforeend', cardHtml);
    else containers.avg.insertAdjacentHTML('beforeend', cardHtml);
  });

  // 인기 상품 렌더링 (리뷰순)
  const popularSection = document.getElementById('mp-popular-section');
  const popularList = document.getElementById('mp-popular-list');
  if (popularSection && popularList) {
    const popularItems = items.filter(it => it.review_count > 0).sort((a, b) => b.review_count - a.review_count).slice(0, 5);
    if (popularItems.length > 0) {
      popularSection.style.display = 'block';
      popularList.innerHTML = popularItems.map((it, i) => {
        const img = (it.image || '').replace(/^http:/, 'https:');
        return `
          <a href="${it.link}" target="_blank" rel="noopener" style="display:flex;gap:12px;align-items:center;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;text-decoration:none">
            <div style="font-size:18px;font-weight:900;color:var(--accent);width:24px;text-align:center">${i + 1}</div>
            <img src="${img}" style="width:50px;height:50px;object-fit:cover;border-radius:8px" onerror="this.src='https://placehold.co/50?text=No+Img'">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:var(--text);font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${it.name}</div>
              <div style="font-size:14px;font-weight:700;color:var(--accent2)">${fmt(it.price)}원 <span style="font-size:11px;color:var(--text-muted);font-weight:400">(리뷰 ${fmt(it.review_count)})</span></div>
              <div style="font-size:11px;color:var(--text-muted)">${it.mall || '네이버'}</div>
            </div>
          </a>
        `;
      }).join('');
    } else {
      popularSection.style.display = 'none';
    }
  }
}

var relatedKeywordsTimer = null;
function scheduleRelatedKeywords() {
  clearTimeout(relatedKeywordsTimer);
  relatedKeywordsTimer = setTimeout(fetchRelatedKeywords, 500);
}
async function fetchRelatedKeywords() {
  var name = document.getElementById('productName').value.trim();
  var el = document.getElementById('related-keywords');
  if (!el) return;
  if (!name || name.length < 2) { el.innerHTML = ''; return; }
  var base = getBackendUrl();
  if (!base) { el.innerHTML = ''; return; }
  try {
    var res = await fetch(base + '/related?query=' + encodeURIComponent(name), { headers: getApiHeaders() });
    var data = await res.json();
    if (!data.success || !(data.keywords && data.keywords.length)) { el.innerHTML = ''; return; }
    el.innerHTML = data.keywords.map(function(kw) {
      return `<span class="related-keyword-chip" role="button" tabindex="0" data-keyword="${escapeHtml(kw)}" onclick="selectKeyword(this.getAttribute('data-keyword'))">${escapeHtml(kw)}</span>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '';
  }
}
function selectKeyword(kw) {
  var inputEl = document.getElementById('productName');
  var currentVal = inputEl.value.trim();
  if (currentVal) {
    var words = currentVal.split(/\s+/);
    if (words.indexOf(kw) === -1) {
      inputEl.value = currentVal + ' ' + kw;
    }
  } else {
    inputEl.value = kw;
  }
  var el = document.getElementById('related-keywords');
  if (el) el.innerHTML = '';
  // fetchMarketPrice(); // 누적 입력이 목적이므로 즉시 검색은 방해될 수 있어 일단 해제하거나, 혹은 유지할 수 있습니다.
  // 사용자가 버튼을 명시적으로 여러 번 클릭하며 검색어를 조립한 뒤 마지막에 "시중가 조회"를 누르도록 동작 변경
}
var _currentWholesaleSite = 'naver_store';
var _currentSearchKeyword = '';
var _wholesaleItems = [];
function selectWholesaleSite(site, btn) {
  _currentWholesaleSite = site;
  document.querySelectorAll('.ws-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  fetchWholesaleProducts(_currentSearchKeyword, site);
}
async function fetchWholesaleProducts(keyword, site) {
  if (!keyword) return;
  var cardsEl = document.getElementById('wholesale-cards');
  if (!cardsEl) return;

  showLoading(true, '도매 상품 검색 중...');
  try {
    var data = await fetchWholesaleApi(keyword, site);
    if (!data.success || !(data.items && data.items.length)) {
      cardsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px 0">검색 결과가 없습니다</div>';
      _wholesaleItems = [];
      return;
    }
    _wholesaleItems = data.items;
    renderWholesaleCards(_wholesaleItems, cardsEl);
  } catch (e) {
    cardsEl.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:20px 0">도매 검색 오류</div>';
    _wholesaleItems = [];
    showToast('도매 검색 중 오류가 발생했습니다.', true);
  } finally {
    showLoading(false);
  }
}

function renderWholesaleCards(items, cardsEl) {
  cardsEl.innerHTML = items.map(function(it, i) {
    var link = (it.link || '').replace(/^http:/, 'https:');
    var img = (it.image || '').replace(/^http:/, 'https:');
    var price = it.price || 0;
    var minQty = it.min_qty || 1;
    var title = (it.name || it.title || '').slice(0, 16);
    var shipText = '';
    if (it.shipping_fee != null) {
      shipText = (it.shipping_fee === 0 || it.shipping_fee === '무료' || it.shipping_fee === '0')
        ? `<div style="color:#00c73c;font-size:11px;margin-top:2px">무료배송</div>`
        : `<div style="color:var(--text-muted);font-size:11px;margin-top:2px">배송 ${typeof it.shipping_fee === 'number' ? fmt(it.shipping_fee) + '원' : escapeHtml(it.shipping_fee)}</div>`;
    }
    return `<div class="wholesale-card" id="ws-card-${i}" onclick="selectWholesaleProduct(${i})">
      <img src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="ws-price">${fmt(price)}원</div>
      <div class="ws-name">${escapeHtml(title)}</div>
      <div class="ws-min-qty">최소 ${minQty}개${shipText}</div>
      <button type="button" class="ws-select-btn" onclick="event.stopPropagation();selectWholesaleProduct(${i})">원가 적용</button>
    </div>`;
  }).join('');
}
function selectWholesaleProduct(idx) {
  var it = _wholesaleItems[idx];
  if (!it) return;
  var price = it.price || 0;
  var link = (it.link || '').replace(/^http:/, 'https:');
  document.querySelectorAll('.wholesale-card').forEach(function(c) { c.classList.remove('selected'); });
  var card = document.getElementById('ws-card-' + idx);
  if (card) card.classList.add('selected');
  var costEl = document.getElementById('costPrice');
  if (costEl) costEl.value = price;
  var linkEl = document.getElementById('sourcing-link-input');
  if (linkEl && link) linkEl.value = link;
  showToast('원가 ' + fmt(price) + '원 자동 입력됨');
  recalcMargin();
  var resultsEl = document.getElementById('results-area');
  if (resultsEl) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setSourcingMode(mode, btn) {
  document.querySelectorAll('.sourcing-mode-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var directEl = document.getElementById('direct-sourcing-section');
  if (mode === 'direct') {
    if (directEl) directEl.style.display = 'block';
    renderVendorSelect();
    renderDirectNotes();
  } else {
    if (directEl) directEl.style.display = 'none';
  }
  try { localStorage.setItem('sourcing-mode', mode); } catch (e) {}
}
function previewDirectPhoto(input, customPreviewId) {
  var previewId = customPreviewId || 'direct-photo-preview';
  var preview = document.getElementById(previewId);
  if (!input || !input.files || !input.files.length) return;
  var file = input.files[0];
  var url = URL.createObjectURL(file);
  preview.style.display = 'block';
  preview.innerHTML = '<img src="' + url + '" style="width:100%;height:80px;object-fit:cover;border-radius:10px" alt="">';
  var reader = new FileReader();
  reader.onload = function(e) { preview.dataset.base64 = e.target.result; };
  reader.readAsDataURL(file);
}
var DIRECT_NOTES_KEY = 'direct-sourcing-notes';

var VENDORS_KEY = 'v5_direct_vendors';

window.saveDirectSourcingNote = function(type) {
    let notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
    let vendorSelect = document.getElementById('direct-vendor-select');
    let vendorManual = document.getElementById('field-vendor-manual');
    let vendorName = vendorSelect ? vendorSelect.value : '';
    if (vendorName === 'manual' && vendorManual) vendorName = vendorManual.value;

    let cost = document.getElementById('v5-field-cost') ? document.getElementById('v5-field-cost').value : '';
    let moq = document.getElementById('v5-field-moq') ? document.getElementById('v5-field-moq').value : '';
    let memo = document.getElementById('v5-field-memo') ? document.getElementById('v5-field-memo').value : '';

    if (!vendorName && type === 'field') {
        if(typeof showToast === 'function') showToast('공급업체를 선택하거나 입력해주세요.', true);
        return;
    }

    let data = {
        id: 'NOTE_' + Date.now(),
        type: type,
        vendor: vendorName,
        cost: cost,
        moq: moq,
        memo: memo,
        date: new Date().toLocaleString()
    };

    notes.unshift(data);
    localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes));
    if (window.renderDirectNotes) renderDirectNotes();

    if(typeof showToast === 'function') showToast('사입 기록이 임시 저장되었습니다.');

    if(document.getElementById('v5-field-cost')) document.getElementById('v5-field-cost').value = '';
    if(document.getElementById('v5-field-moq')) document.getElementById('v5-field-moq').value = '';
    if(document.getElementById('v5-field-memo')) document.getElementById('v5-field-memo').value = '';
    if(vendorSelect) vendorSelect.value = '';
    if(vendorManual) vendorManual.style.display = 'none';
};

window.renderDirectNotes = function() {
    let notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
    let container = document.getElementById('direct-notes-cards');
    let listArea = document.getElementById('direct-notes-list');
    if (!container || !listArea) return;

    if (notes.length === 0) {
        listArea.style.display = 'none';
        return;
    }
    listArea.style.display = 'block';

    container.innerHTML = notes.map(n => `
        <div style="background:var(--surface2); padding:12px; border-radius:8px; border:1px solid var(--border); position:relative;">
            <div style="font-weight:bold; font-size:14px; margin-bottom:4px; color:var(--accent);">${n.vendor}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">매입가: ${Number(n.cost).toLocaleString()}원 | MOQ: ${n.moq || '-'}</div>
            <div style="font-size:12px; background:var(--bg); padding:6px; border-radius:4px;">${n.memo || '메모 없음'}</div>
            <div style="font-size:10px; color:var(--text-muted); text-align:right; margin-top:6px;">${n.date}</div>
            <button onclick="deleteDirectNote('${n.id}')" style="position:absolute; top:10px; right:10px; background:transparent; border:none; color:var(--danger); cursor:pointer;">❌</button>
        </div>
    `).join('');
};

window.deleteDirectNote = function(id) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    let notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
    notes = notes.filter(n => n.id !== id);
    localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes));
    renderDirectNotes();
};

window.populateVendorDropdowns = function() {
    let vendors = JSON.parse(localStorage.getItem(VENDORS_KEY) || '[]');
    const select = document.getElementById('direct-vendor-select');
    if (!select) return;

    let html = '<option value="">▼ 업체 선택 (목록에서 선택)</option>';
    vendors.forEach(v => {
        html += `<option value="${v.name}">${v.name} (${v.grade}급 - ${v.repName || '대표명 미상'})</option>`;
    });
    html += '<option value="manual">+ 직접 텍스트로 입력</option>';
    select.innerHTML = html;
};

window.onVendorSelect = function(sel, manualInputId) {
    let manual = document.getElementById(manualInputId);
    if (!manual) return;
    if (sel.value === 'manual') {
        manual.style.display = 'block';
        manual.focus();
    } else {
        manual.style.display = 'none';
        manual.value = '';
    }
};

window.showVendorForm = function(id) {
    let vendors = JSON.parse(localStorage.getItem(VENDORS_KEY) || '[]');
    let modal = document.getElementById('vendor-modal');
    if(!modal) return;

    if (id) {
        let v = vendors.find(x => x.id === id);
        if(v) {
            if(document.getElementById('vendor-id')) document.getElementById('vendor-id').value = v.id;
            if(document.getElementById('vendor-name')) document.getElementById('vendor-name').value = v.name || '';
            if(document.getElementById('vendor-rep')) document.getElementById('vendor-rep').value = v.repName || '';
            if(document.getElementById('vendor-phone')) document.getElementById('vendor-phone').value = v.phone || '';
            if(document.getElementById('vendor-address')) document.getElementById('vendor-address').value = v.address || '';
            if(document.getElementById('vendor-grade')) document.getElementById('vendor-grade').value = v.grade || 'B';
            if(document.getElementById('vendor-memo')) document.getElementById('vendor-memo').value = v.memo || '';
        }
    } else {
        if(document.getElementById('vendor-id')) document.getElementById('vendor-id').value = '';
        if(document.getElementById('vendor-name')) document.getElementById('vendor-name').value = '';
        if(document.getElementById('vendor-rep')) document.getElementById('vendor-rep').value = '';
        if(document.getElementById('vendor-phone')) document.getElementById('vendor-phone').value = '';
        if(document.getElementById('vendor-address')) document.getElementById('vendor-address').value = '';
        if(document.getElementById('vendor-grade')) document.getElementById('vendor-grade').value = 'B';
        if(document.getElementById('vendor-memo')) document.getElementById('vendor-memo').value = '';
    }
    modal.style.display = 'flex';
};

window.closeVendorForm = function() {
    let modal = document.getElementById('vendor-modal');
    if(modal) modal.style.display = 'none';
};

window.saveVendor = function() {
    let nameElem = document.getElementById('vendor-name');
    if(!nameElem) return;
    let name = nameElem.value.trim();
    if (!name) { if(typeof showToast === 'function') showToast('상호명을 입력해주세요.', true); return; }

    let vendors = JSON.parse(localStorage.getItem(VENDORS_KEY) || '[]');
    let id = document.getElementById('vendor-id') ? document.getElementById('vendor-id').value : '';

    let vData = {
        name: name,
        repName: document.getElementById('vendor-rep') ? document.getElementById('vendor-rep').value.trim() : '',
        phone: document.getElementById('vendor-phone') ? document.getElementById('vendor-phone').value.trim() : '',
        address: document.getElementById('vendor-address') ? document.getElementById('vendor-address').value.trim() : '',
        grade: document.getElementById('vendor-grade') ? document.getElementById('vendor-grade').value : 'B',
        memo: document.getElementById('vendor-memo') ? document.getElementById('vendor-memo').value.trim() : '',
        updatedAt: new Date().toLocaleString()
    };

    if (id) {
        let idx = vendors.findIndex(x => x.id === id);
        if (idx !== -1) {
            vendors[idx] = { ...vendors[idx], ...vData };
            if(typeof showToast === 'function') showToast('공급업체 정보가 수정되었습니다.');
        }
    } else {
        vData.id = 'VND_' + Date.now();
        vData.createdAt = new Date().toLocaleString();
        vendors.unshift(vData);
        if(typeof showToast === 'function') showToast('신규 공급업체가 등록되었습니다.');
    }

    localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
    populateVendorDropdowns();
    closeVendorForm();
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        populateVendorDropdowns();
        renderDirectNotes();
    }, 500);
});

function onVendorSelect(sel, nameId, ptId, contactId) {
  if (!sel || !sel.value || !window._vendors) return;
  var v = window._vendors.find(function(x) { return x.id === sel.value; });
  if (!v) return;
  var pt = document.getElementById(ptId || 'direct-payment-terms'); if (pt) pt.value = v.paymentTerms || '';
  var contact = document.getElementById(contactId || 'direct-contact'); if (contact) contact.value = v.contactPhone || '';
  var nameInput = document.getElementById(nameId || 'direct-vendor'); if (nameInput) nameInput.value = v.name || '';
}
function registerAsConsignment(noteId) {
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]'); } catch (e) {}
  var note = notes.find(function(x) { return x.id === noteId; });
  if (!note) { showToast('해당 메모를 찾을 수 없습니다', true); return; }
  var calcResult = null;
  var inp = getInputs && getInputs();
  if (inp && inp.cost === note.price && inp.name === note.name) {
    var mid = inp.selectedMarketId;
    if (mid && typeof calcForMarket === 'function') {
      var r = calcForMarket(inp.cost, inp.supShip || 0, inp.mktShip || 0, inp.fees[mid], inp.target);
      calcResult = { marketId: mid, salePrice: r.salePrice, marginRate: r.marginRate };
    }
  }
  showConsignmentModal(note, calcResult);
}
function showConsignmentModal(note, calcResult) {
  window._consignmentNote = note;
  var modal = document.getElementById('consignment-modal');
  if (!modal) return;
  document.getElementById('cm-product-name').textContent = note.name || '미입력';
  document.getElementById('cm-product-cost').textContent = '원가 ' + fmt(note.price || 0) + '원' + (note.minQty ? ' × 최소 ' + note.minQty + '개' : '');
  var photoEl = document.getElementById('cm-photo-link');
  if (note.photoUrl) photoEl.innerHTML = '<a href="' + escapeHtml(note.photoUrl) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent)">📷 사진 보기</a>'; else photoEl.innerHTML = '';
  var btns = document.getElementById('cm-market-btns');
  var firstThree = MARKET_IDS.slice(0, 3);
  btns.innerHTML = firstThree.map(function(mid) {
    var m = MARKET_FEES[mid];
    return `<button type="button" class="cm-mkt" data-market="${escapeHtml(mid)}" onclick="selectCMMarket('${mid}', this)" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-size:13px">${m ? m.name : mid}</button>`;
  }).join('');
  var saleInput = document.getElementById('cm-sale-price');
  saleInput.value = '';
  if (calcResult && calcResult.salePrice) { saleInput.value = Math.round(calcResult.salePrice); saleInput.dataset.recommend = '1'; }
  window._cmSelectedMarket = firstThree[0] || 'smartstore';
  var firstBtn = btns.querySelector('.cm-mkt');
  if (firstBtn) { firstBtn.classList.add('active'); firstBtn.style.background = 'var(--accent)'; firstBtn.style.color = '#0d0f14'; }
  updateCMMargin();
  modal.style.display = 'flex';
}
function selectCMMarket(marketId, btn) {
  window._cmSelectedMarket = marketId;
  document.querySelectorAll('.cm-mkt').forEach(function(b) { b.classList.remove('active'); b.style.background = ''; b.style.color = ''; });
  if (btn) { btn.classList.add('active'); btn.style.background = 'var(--accent)'; btn.style.color = '#0d0f14'; }
  updateCMMargin();
}
function updateCMMargin() {
  var note = window._consignmentNote;
  if (!note) return;
  var salePrice = parseFloat(document.getElementById('cm-sale-price').value) || 0;
  var mid = window._cmSelectedMarket || 'smartstore';
  var feeRate = (MARKET_FEES[mid] && MARKET_FEES[mid].fee) || 6.6;
  var cost = note.price || 0;
  var mktShip = 3000;
  var feeAmt = Math.round(salePrice * feeRate / 100);
  var vatAmt = salePrice * 1.5 / 100;
  var profit = salePrice - feeAmt - vatAmt - mktShip - cost;
  var marginRate = salePrice > 0 ? parseFloat((profit / salePrice * 100).toFixed(1)) : 0;
  document.getElementById('cm-margin-preview').textContent = salePrice ? '수수료 ' + fmt(feeAmt) + '원 · 순이익 ' + fmt(profit) + '원 · 마진 ' + marginRate + '%' : '판매가를 입력하세요';
}
function closeConsignmentModal() {
  var modal = document.getElementById('consignment-modal');
  if (modal) modal.style.display = 'none';
  window._consignmentNote = null;
}
function submitConsignment() {
  var note = window._consignmentNote;
  if (!note || !SCRIPT_URL) { showToast('오류', true); return; }
  var salePrice = parseFloat(document.getElementById('cm-sale-price').value) || 0;
  if (!salePrice) { showToast('판매가를 입력하세요', true); return; }
  var mid = window._cmSelectedMarket || 'smartstore';
  var m = MARKET_FEES[mid];
  var feeRate = (m && m.fee) || 6.6;
  var cost = note.price || 0;
  var mktShip = 3000;
  var feeAmt = Math.round(salePrice * feeRate / 100);
  var vatAmt = salePrice * 1.5 / 100;
  var profit = salePrice - feeAmt - vatAmt - mktShip - cost;
  var marginRate = salePrice > 0 ? parseFloat((profit / salePrice * 100).toFixed(1)) : 0;
  var now = new Date();
  var dateStr = now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  var productId = Date.now() + Math.random();
  var toSave = [{
    id: productId, name: note.name || '미입력', cost: cost, supShip: 0, mktShip: mktShip,
    market: (m && m.name) || mid, marketClass: mid, fee: feeRate, salePrice: salePrice, feeAmt: feeAmt,
    profit: Math.round(profit), margin: marginRate, savedAt: dateStr, savedBy: currentUser || '남편',
    category: '', competitionLevel: '', minMarketPrice: '', avgMarketPrice: '', maxMarketPrice: '',
    sourcingLink: '', targetGender: '', targetAge: '', trendSeason: '', collectedAt: '', mainTarget: '',
    sellDecision: 'Y', sellStartDate: now.toISOString().slice(0, 10),
    photoUrl: note.photoUrl || '', docUrl: '', sourcingType: '사입', leadTime: note.leadTime || '', paymentTerms: note.paymentTerms || '', consignAvail: note.consignAvail || '', contact: note.contact || ''
  }];
  showLoading(true);
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'saveProduct', products: toSave }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.success) { showToast('상품 저장 실패: ' + (data.error || ''), true); showLoading(false); return; }
      if (!note.rowNum) { closeConsignmentModal(); showTab('ledger'); renderDirectNotes(); showToast('위탁 등록 완료'); showLoading(false); return; }
      return fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'updateDirectRecord', rowNum: note.rowNum, market: (m && m.name) || mid, salePrice: salePrice, marginRate: marginRate, productListId: productId, registeredAt: dateStr, sourcingResult: '진행' }) });
    })
    .then(function(r) { return r ? r.json() : null; })
    .then(function(data) {
      closeConsignmentModal();
      showTab('ledger');
      renderDirectNotes();
      showToast('위탁 등록 완료');
      showLoading(false);
    })
    .catch(function() { showToast('요청 실패', true); showLoading(false); });
}

function loadDirectNote(id) {
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]'); } catch (e) {}
  var n = notes.find(function(x) { return x.id === id; });
  if (!n) return;
  document.getElementById('productName').value = n.name || '';
  var costEl = document.getElementById('costPrice'); if (costEl) costEl.value = n.price || '';
  var v = document.getElementById('direct-vendor'); if (v) v.value = n.vendor || '';
  var u = document.getElementById('direct-unit-price'); if (u) u.value = n.price || '';
  var mq = document.getElementById('direct-min-qty'); if (mq) mq.value = n.minQty || 1;
  var lt = document.getElementById('direct-lead-time'); if (lt) lt.value = n.leadTime || '';
  var pt = document.getElementById('direct-payment-terms'); if (pt) pt.value = n.paymentTerms || '';
  var contact = document.getElementById('direct-contact'); if (contact) contact.value = n.contact || '';
  var memo = document.getElementById('direct-memo'); if (memo) memo.value = n.memo || '';
  var radios = document.querySelectorAll('input[name="direct-consign"]');
  if (radios.length && n.consignAvail) { radios.forEach(function(r) { r.checked = (r.value === n.consignAvail); }); }
  var vendorSel = document.getElementById('direct-vendor-select'); if (vendorSel && n.vendorId) { renderVendorSelect(); vendorSel.value = n.vendorId; }
  recalcMargin();
  showToast(n.name + ' 원가 입력됨');
  setSourcingMode('direct', document.getElementById('mode-direct'));
}
function deleteDirectNote(id) {
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]'); } catch (e) {}
  notes = notes.filter(function(n) { return n.id !== id; });
  localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes));
  renderDirectNotes();
}
function loadVendors() {
  if (!SCRIPT_URL) return;
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'getVendors' }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      window._vendors = (data.success && data.vendors) ? data.vendors : [];
      renderVendorSelect();
    })
    .catch(function() { window._vendors = []; });
}
function saveApiUrl() {
  const el = document.getElementById('api-backendUrl');
  const url = (el && el.value.trim() || '').replace(/\/$/, '');
  API_URL = url;
  localStorage.setItem('api-url', url);
  localStorage.setItem(API_KEYS.backendUrl, url);
  showToast('API URL 저장 완료');
}

function saveApiKey(type) {
  if (type === 'backendUrl') {
    const input = document.getElementById('api-backendUrl');
    const url = (input && input.value.trim() || '').replace(/\/$/, '');
    localStorage.setItem(API_KEYS.backendUrl, url);
    localStorage.setItem('api-url', url);
    API_URL = url;
    showToast('✅ 저장됨');
    return;
  }
  // 관리자 권한 체크
  if (!isApiAdmin()) { showToast('🚫 API 키 수정은 관리자(ohnayu@gmail.com)만 가능합니다.', true); return; }
  const input = document.getElementById('api-' + type);
  const key = API_KEYS[type];
  if (!input || !key) return;
  // 잠금 상태에서는 저장 차단
  if (input.readOnly) { showToast('🔒 잠금 상태입니다. 먼저 잠금을 해제하세요.', true); return; }
  const val = input.value.trim();
  if (!val) { showToast('값을 입력해주세요', true); return; }
  localStorage.setItem(key, val);
  lockApiKeyField(type);
  showToast('🔒 저장 및 잠금 완료');
}

/** 네이버 검색광고 API 키를 Apps Script ScriptProperties에 동기화 */
async function syncNaverAdKeysToServer() {
  try {
    const apiKey     = localStorage.getItem('naver-ad-api-key') || '';
    const secretKey  = localStorage.getItem('naver-ad-secret-key') || '';
    const customerId = localStorage.getItem('naver-ad-customer-id') || '';
    if (!apiKey || !secretKey || !customerId) {
      showToast('⚠️ 네이버 검색광고 API 키 3개를 모두 먼저 저장하세요.', true);
      return;
    }
    const res = await fetchGas('setNaverAdKeys', { apiKey, secretKey, customerId });
    if (res && res.success) {
      showToast('✅ 네이버 검색광고 키 서버 동기화 완료!');
      if (typeof SystemLogger !== 'undefined') SystemLogger.log('네이버 검색광고 API 키 GAS 동기화 성공', 'success');
    } else {
      showToast('❌ 동기화 실패: ' + (res?.error || '알 수 없는 오류'), true);
    }
  } catch (e) {
    showToast('❌ 동기화 통신 오류: ' + e.message, true);
  }
}

/** API 키 필드를 잠금 처리 (readonly + 마스킹 + 버튼 전환) */
function lockApiKeyField(type) {
  const input = document.getElementById('api-' + type);
  if (!input) return;
  const key = API_KEYS[type] || type;
  const val = localStorage.getItem(key) || '';
  input.value = val ? '••••••••••••' : '';
  input.dataset.masked = 'true';
  input.type = 'password';
  input.readOnly = true;
  input.style.background = 'var(--bg-secondary, #f0f0f0)';
  input.style.cursor = 'not-allowed';
  // 저장 버튼 → 잠금해제 버튼으로 전환
  const saveBtn = input.parentElement?.querySelector('[onclick*="saveApiKey"]');
  if (saveBtn) { saveBtn.textContent = '🔓'; saveBtn.title = '잠금 해제'; saveBtn.setAttribute('onclick', `unlockApiKey('${type}')`); }
  // 눈 버튼 비활성화
  const eyeBtn = input.parentElement?.querySelector('[onclick*="toggleApiKeyMask"]');
  if (eyeBtn) { eyeBtn.style.opacity = '0.4'; eyeBtn.style.pointerEvents = 'none'; }
}


/** PIN 인증 후 API 키 잠금 해제 — 인라인 PIN 입력 UI */
function unlockApiKey(type) {
  // 관리자 권한 체크
  if (!isApiAdmin()) { showToast('🚫 API 키 수정은 관리자만 가능합니다.', true); return; }
  // 이미 열려있는 PIN 입력 UI 제거
  const existing = document.getElementById('pin-unlock-' + type);
  if (existing) { existing.remove(); return; }
  // 다른 열린 PIN UI 닫기
  document.querySelectorAll('[id^="pin-unlock-"]').forEach(el => el.remove());

  const input = document.getElementById('api-' + type);
  if (!input) return;
  const wrapper = input.closest('.form-group') || input.parentElement;

  const pinBox = document.createElement('div');
  pinBox.id = 'pin-unlock-' + type;
  pinBox.style.cssText = 'margin-top:8px; padding:10px 14px; background:var(--surface, #fff); border:2px solid var(--accent, #4a90d9); border-radius:10px; display:flex; align-items:center; gap:8px; box-shadow:0 4px 16px rgba(0,0,0,0.12); animation: fadeIn 0.2s ease;';
  pinBox.innerHTML = `
    <span style="font-size:18px;">🔐</span>
    <span style="font-size:12px; font-weight:600; white-space:nowrap;">PIN 입력:</span>
    <input type="password" maxlength="4" placeholder="****" style="width:70px; text-align:center; font-size:16px; letter-spacing:6px; border:2px solid var(--accent,#4a90d9); border-radius:6px; padding:6px;" autofocus>
    <button style="background:var(--accent,#4a90d9); color:#fff; border:none; border-radius:6px; padding:6px 14px; font-weight:600; cursor:pointer; font-size:13px;" onclick="confirmUnlockApiKey('${type}')">확인</button>
    <button style="background:var(--danger,#e74c3c); color:#fff; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:13px;" onclick="this.closest('[id^=pin-unlock]').remove()">✕</button>
  `;
  wrapper.appendChild(pinBox);

  // 포커스 + Enter 키로 확인
  const pinInput = pinBox.querySelector('input');
  pinInput.focus();
  pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmUnlockApiKey(type); });
}

/** 인라인 PIN 입력 확인 핸들러 */
function confirmUnlockApiKey(type) {
  const pinBox = document.getElementById('pin-unlock-' + type);
  if (!pinBox) return;
  const pinInput = pinBox.querySelector('input');
  const pin = pinInput ? pinInput.value : '';
  const savedPin = localStorage.getItem('master-pin-config') || '0000';

  if (pin !== savedPin) {
    pinInput.style.borderColor = 'var(--danger, #e74c3c)';
    pinInput.value = '';
    pinInput.placeholder = '틀림!';
    pinInput.focus();
    showToast('❌ PIN이 일치하지 않습니다.', true);
    return;
  }

  pinBox.remove();

  const input = document.getElementById('api-' + type);
  if (!input) return;
  const key = API_KEYS[type] || type;
  const val = localStorage.getItem(key) || '';
  input.value = val;
  input.dataset.masked = 'false';
  input.type = 'text';
  input.readOnly = false;
  input.style.background = '';
  input.style.cursor = '';
  // 잠금해제 → 저장 버튼 복원
  const saveBtn = input.parentElement?.querySelector('[onclick*="unlockApiKey"]');
  if (saveBtn) { saveBtn.textContent = '💾'; saveBtn.title = '저장'; saveBtn.setAttribute('onclick', `saveApiKey('${type}')`); }
  // 눈 버튼 활성화
  const eyeBtn = input.parentElement?.querySelector('[onclick*="toggleApiKeyMask"]');
  if (eyeBtn) { eyeBtn.style.opacity = '1'; eyeBtn.style.pointerEvents = 'auto'; }
  showToast('🔓 잠금 해제됨 — 수정 후 저장하세요');
}

function loadApiKeys() {
  const url = getBackendUrl();
  const be = document.getElementById('api-backendUrl'); if (be) be.value = url;
  ['domeggook', 'domemae', 'onchannel', 'kakao', 'kakao-token', 'smartstore-client-id', 'smartstore-client-secret', 'coupang-access-key', 'coupang-secret-key', '11st-api-key', 'naver-license', 'naver-secret', 'koreaexim', 'google-vision', 'google-gemini', 'naver-ad-api-key', 'naver-ad-secret-key', 'naver-ad-customer-id'].forEach(type => {
    const input = document.getElementById('api-' + type);
    if (!input) return;
    const key = API_KEYS[type] || type;
    const val = localStorage.getItem(key) || '';
    if (val) {
      // 저장된 값이 있으면 잠금 상태로 표시
      lockApiKeyField(type);
    } else {
      // 값이 없으면 편집 가능 상태
      input.value = '';
      input.dataset.masked = 'false';
      input.type = 'text';
      input.readOnly = false;
      input.style.background = '';
      input.style.cursor = '';
    }
  });

  // 🛡️ [V5.5] 비-API 키 설정 필드 localStorage 복원 (새로고침 시 값 유지)
  const settingsMap = {
    'script-url-input': ['proxyApiUrl', 'script-url'],
    'api-backendUrl': ['seller-api-url', 'api-url'],
    'margin-filter-slider': ['minMarginFilter'],
  };
  Object.entries(settingsMap).forEach(([inputId, keys]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val) { el.value = val; break; }
    }
  });

  // Gemini/Vision API 키 (input id가 다른 패턴)
  const extraKeys = {
    'google-gemini-api-key': 'google-gemini-api-key',
    'google-vision-api-key': 'google-vision-api-key',
  };
  Object.entries(extraKeys).forEach(([inputId, lsKey]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    const val = localStorage.getItem(lsKey) || '';
    if (val && !el.value) el.value = val;
  });

  console.log('🛡️ loadApiKeys: 시스템 설정 복원 완료');
}

function toggleApiKeyMask(type) {
  const input = document.getElementById('api-' + type);
  if (!input) return;
  // 잠금 중이면 차단
  if (input.readOnly) { showToast('🔒 잠금 상태입니다. 먼저 잠금을 해제하세요.', true); return; }
  const key = API_KEYS[type];
  const stored = localStorage.getItem(key) || '';
  if (input.dataset.masked === 'true') {
    input.value = stored;
    input.dataset.masked = 'false';
    input.type = 'text';
  } else {
    input.value = stored ? '••••••••••••' : '';
    input.dataset.masked = 'true';
    input.type = 'password';
  }
}

async function testBackendUrl() {
  const url = (document.getElementById('api-backendUrl') && document.getElementById('api-backendUrl').value.trim()) || getBackendUrl();
  if (!url) { showToast('❌ URL을 입력해주세요', true); return; }
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/');
    const data = await res.json();
    if (data.status === 'ok') showToast('✅ 서버 연결 성공!');
    else showToast('❌ 서버 응답 이상', true);
  } catch (e) {
    showToast('❌ 서버 연결 실패. URL을 확인해주세요.', true);
  }
}

async function sendKakaoAlert(message) {
  const token = localStorage.getItem('api-kakao-token') || localStorage.getItem('kakao-api-key') || localStorage.getItem('api-kakao');
  if (!token) return false;
  try {
    return await sendKakaoApi(token, message);
  } catch (e) {
    console.error('카카오 알림 발송 실패:', e);
    return false;
  }
}

async function testKakaoAlert() {
  const token = localStorage.getItem('api-kakao-token') || localStorage.getItem('kakao-api-key') || localStorage.getItem('api-kakao');
  const el = document.getElementById('kakao-test-result');
  if (el) el.textContent = '';

  if (!token || token.trim() === '') {
    if (el) el.innerHTML = '✅ <strong>현재 Mock 모드입니다.</strong> 브라우저 토스트 알림을 확인하세요.';
    showToast('🚨 (Mock) 테스트 메시지입니다.', true);
    return;
  }

  showLoading(true);
  try {
    const ok = await sendKakaoApi(token, '테스트 메시지입니다.');
    if (el) el.innerHTML = ok ? '<span style="color:var(--good)">✅ 카카오톡 테스트 발송 성공!</span>' : '<span style="color:var(--danger)">❌ 카카오톡 발송 실패. 토큰을 확인하세요.</span>';
    showToast(ok ? '✅ 카카오톡 발송 완료!' : '❌ 카카오 발송 실패', !ok);
  } catch (e) {
    if (el) el.innerHTML = '<span style="color:var(--danger)">❌ 카카오 인증/통신 오류</span>';
    showToast('❌ 카카오톡 통신 오류', true);
  }
  showLoading(false);
}

function marketClass(id) { return id === '11st' ? 'market-11st' : id; }

function recalcMargin() {
  // 🚨 [Safe Guard] T2/T3 화면이 렌더링되지 않은 상태에서 백그라운드 계산 시 시스템 붕괴 방지
  if (!document.getElementById('costPrice')) return;
  const inp = getInputs();
  const compareWrap = document.getElementById('compare-all-wrap');
  if (compareWrap) compareWrap.style.display = 'none';
  const activeMarkets = [inp.selectedMarketId];
  const k = activeMarkets[0];
    const m = MARKET_INFO[k];

  if (!inp.cost) {
    const invGrid = document.getElementById('inverse-grid');
    if (invGrid) invGrid.innerHTML = '<div class="inv-item" style="grid-column:1/-1;color:var(--text-muted);font-size:13px">원가를 입력하면 권장 판매가·마진이 자동으로 계산됩니다.</div>';
    const invResult = document.getElementById('inverse-result');
    if (invResult) invResult.classList.remove('show');
    const resCards = document.getElementById('result-cards');
    if (resCards) resCards.innerHTML = '<div class="result-card" style="color:var(--text-muted);font-size:13px">원가 입력 시 실시간 반영됩니다.</div>';
    window._lastResult = null;
    calcInverse();
    calcBreakEven();
    return;
  }

    const r = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[k], inp.target);
  const salePrice = roundTo10(r.salePrice);
  const feeAmt = Math.round(salePrice * inp.fees[k] / 100);
  const vatAmt = salePrice * 1.5 / 100;
  const profit = salePrice - feeAmt - vatAmt - inp.mktShip - r.totalCost;
  const marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  const invHTML = `<div class="inv-item ${marketClass(k)}">
      <div class="inv-label">${m.name}</div>
    <div class="inv-price">${fmt(salePrice)}원</div>
      <div class="inv-sub">수수료 ${fmtPct(inp.fees[k])}</div>
    </div>`;
  const invGridEl = document.getElementById('inverse-grid');
  if (invGridEl) invGridEl.innerHTML = invHTML;
  const invResultEl = document.getElementById('inverse-result');
  if (invResultEl) invResultEl.classList.toggle('show', inp.target > 0);

  const bc = marginRate >= 20 ? 'badge-good' : marginRate >= 10 ? 'badge-warn' : 'badge-bad';
  const cardsHTML = `<div class="result-card ${marketClass(k)} active">
      <div class="rc-market">${m.name} · ${fmtPct(inp.fees[k])}</div>
      <div class="rc-row"><span class="rc-label">총 원가</span><span class="rc-val">${fmt(r.totalCost + inp.mktShip)}원</span></div>
    <div class="rc-row"><span class="rc-label">수수료</span><span class="rc-val">${fmt(feeAmt)}원</span></div>
      <div class="rc-main">
      <div class="rc-price">${fmt(salePrice)}원</div>
        <div class="rc-row">
          <span class="rc-label">순이익</span>
        <span class="rc-val" style="color:${profit>=0?'var(--accent)':'var(--danger)'}">${fmt(profit)}원</span>
        </div>
        <div class="rc-row">
          <span class="rc-label">마진율</span>
        <span class="margin-badge ${bc}">${fmtPct(marginRate)}</span>
        </div>
      </div>
    </div>`;
  const resCardsEl = document.getElementById('result-cards');
  if (resCardsEl) resCardsEl.innerHTML = cardsHTML;
  window._lastResult = { inp, activeMarkets, salePrice, feeAmt, profit, marginRate };
  calcInverse();
  calcBreakEven();
}

function calculate() {
  // 🛡️ [Null Guard] T2 마진 계산기 DOM이 없으면 조용히 종료 (T1 상태에서의 연쇄 즉사 방지)
  if (!document.getElementById('costPrice') || !document.getElementById('result-cards')) return;
  recalcMargin();
}

function calcInverse() {
  // 🛡️ [Null Guard] T2 역산 패널 DOM이 없으면 조용히 종료
  if (!document.getElementById('inverse-sale-input') || !document.getElementById('inverse-margin')) return;
  const saleInput = document.getElementById('inverse-sale-input');
  const sale = parseFloat(saleInput && saleInput.value) || 0;
  const inp = getInputs();
  const feeRate = inp.fees[inp.selectedMarketId] || 6.6;
  const invMargin = document.getElementById('inverse-margin');
  const invProfit = document.getElementById('inverse-profit');
  const invMaxCost = document.getElementById('inverse-max-cost');
  if (invMargin) invMargin.textContent = '—';
  if (invProfit) invProfit.textContent = '—';
  if (invMaxCost) invMaxCost.textContent = '—';
  if (sale <= 0) return;
  const totalShip = inp.supShip + inp.mktShip;
  const feeAmt = sale * feeRate / 100;
  const vatAmt = sale * 1.5 / 100;
  const profit = sale - feeAmt - vatAmt - inp.mktShip - inp.cost - inp.supShip;
  const marginRate = sale > 0 ? (profit / sale) * 100 : 0;
  const maxCost = sale - feeAmt - vatAmt - inp.mktShip - inp.supShip;
  if (invMargin) invMargin.textContent = fmtPct(marginRate);
  if (invProfit) invProfit.textContent = fmt(profit) + '원';
  if (invMaxCost) invMaxCost.textContent = (maxCost > 0 ? fmt(Math.round(maxCost)) + '원' : '—');
}

function calcBreakEven() {
  // 🛡️ [Null Guard] T2 손익분기 패널 DOM이 없으면 조용히 종료
  if (!document.getElementById('monthly-target') || !document.getElementById('be-qty')) return;
  const targetInput = document.getElementById('monthly-target');
  const monthlyTarget = parseFloat(targetInput && targetInput.value) || 0;
  const beQty = document.getElementById('be-qty');
  const beSales = document.getElementById('be-sales');
  const beCost = document.getElementById('be-cost');
  const beDaily = document.getElementById('be-daily');
  if (beQty) beQty.textContent = '—';
  if (beSales) beSales.textContent = '—';
  if (beCost) beCost.textContent = '—';
  if (beDaily) beDaily.textContent = '—';
  if (monthlyTarget <= 0 || !window._lastResult) return;
  const lr = window._lastResult;
  const profitPerItem = lr.profit != null ? lr.profit : 0;
  if (profitPerItem <= 0) return;
  const needQty = Math.ceil(monthlyTarget / profitPerItem);
  const salePrice = lr.salePrice || 0;
  const inp = lr.inp;
  const totalCostPerItem = inp.cost + inp.supShip + inp.mktShip;
  document.getElementById('be-qty').textContent = fmt(needQty) + '개';
  document.getElementById('be-sales').textContent = fmt(needQty * salePrice) + '원';
  document.getElementById('be-cost').textContent = fmt(needQty * totalCostPerItem) + '원';
  document.getElementById('be-daily').textContent = (needQty / 30).toFixed(1) + '개/일';
}

// ==================== 위탁↔사입 전환 시뮬레이션 ====================
function compareConsignmentVsDirect() {
  const lr = window._lastResult;
  if (!lr || !lr.inp) { showToast('먼저 위탁 시뮬레이션을 실행하세요.', 'error'); return; }

  const { cost, supShip, mktShip, fee } = lr.inp;
  const salePrice = lr.salePrice || 0;
  if (salePrice <= 0 || cost <= 0) { showToast('판매가와 원가를 입력하세요.', 'error'); return; }

  const moq = parseInt(document.getElementById('cvd-moq')?.value) || 10;
  const discountPct = parseFloat(document.getElementById('cvd-discount')?.value) || 15;

  // === 위탁 모델 (단건) ===
  const consignCost = cost + supShip + mktShip;
  const consignFee = Math.round(salePrice * (fee / 100));
  const consignProfit = salePrice - consignCost - consignFee;
  const consignMargin = ((consignProfit / salePrice) * 100).toFixed(1);

  // === 사입 모델 (MOQ 매입 + 할인) ===
  const directCost = Math.round(cost * (1 - discountPct / 100)); // 할인된 원가
  const directTotalInvest = directCost * moq; // 초기 투자금
  const directProfit = salePrice - directCost - mktShip - consignFee; // 수수료는 동일
  const directMargin = ((directProfit / salePrice) * 100).toFixed(1);

  // === 결과 표시 ===
  const resultDiv = document.getElementById('cvd-result');
  if (resultDiv) resultDiv.style.display = 'block';

  const consignProfitEl = document.getElementById('cvd-consign-profit');
  const directProfitEl = document.getElementById('cvd-direct-profit');
  const consignDetailEl = document.getElementById('cvd-consign-detail');
  const directDetailEl = document.getElementById('cvd-direct-detail');
  const verdictEl = document.getElementById('cvd-verdict');

  if (consignProfitEl) consignProfitEl.textContent = fmt(consignProfit) + '원';
  if (directProfitEl) directProfitEl.textContent = fmt(directProfit) + '원';
  if (consignDetailEl) consignDetailEl.innerHTML = `마진 ${consignMargin}% · 원가 ${fmt(cost)}원 · 수수료 ${fmt(consignFee)}원`;
  if (directDetailEl) directDetailEl.innerHTML = `마진 ${directMargin}% · 할인원가 ${fmt(directCost)}원 · 초기투자 ${fmt(directTotalInvest)}원`;

  // === 판정 ===
  const profitDiff = directProfit - consignProfit;
  const monthlyExtra = profitDiff * 30; // 하루 1개 기준
  const breakEvenQty = profitDiff > 0 ? Math.ceil(directTotalInvest / profitDiff) : Infinity;

  if (verdictEl) {
    if (profitDiff > 0) {
      verdictEl.innerHTML = `
        <strong style="color:var(--green);">📦 사입이 단건당 ${fmt(profitDiff)}원 더 유리!</strong><br>
        <span style="color:var(--text-muted);">
          MOQ ${moq}개 매입 시 초기 투자금 ${fmt(directTotalInvest)}원 필요<br>
          <strong>${breakEvenQty}개</strong> 판매 시 투자금 회수 · 월 30개 판매 시 <strong style="color:var(--green);">+${fmt(monthlyExtra)}원</strong> 추가 수익<br>
          <em>💡 전환 추천: 월 ${breakEvenQty}개 이상 꾸준히 판매 가능하다면 사입 전환을 고려하세요.</em>
        </span>
      `;
    } else {
      verdictEl.innerHTML = `
        <strong style="color:var(--accent);">🏷️ 위탁이 단건당 ${fmt(Math.abs(profitDiff))}원 더 유리!</strong><br>
        <span style="color:var(--text-muted);">
          사입은 MOQ 매입 부담(${fmt(directTotalInvest)}원) + 재고 리스크가 존재합니다.<br>
          <em>💡 위탁을 유지하세요. 판매 실적이 쌓이면 사입 전환을 재검토할 수 있습니다.</em>
        </span>
      `;
    }
  }
}
var SEARCH_HISTORY_KEY = 'search-history';
var SEARCH_HISTORY_MAX = 10;

function saveToHistory(name, result) {
  try {
    var raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    var entry = { name: name, min: result.min_price, avg: result.avg_price, max: result.max_price, at: Date.now() };
    arr = arr.filter(function (e) { return e.name !== name; });
    arr.unshift(entry);
    arr = arr.slice(0, SEARCH_HISTORY_MAX);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(arr));
    renderHistory();
  } catch (e) {}
}

function renderHistory() {
  var el = document.getElementById('search-history-chips');
  if (!el) return;
  try {
    var raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    if (!arr.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `<span style="font-size:11px;color:var(--text-muted);margin-right:4px">🕐 최근 조회</span>` + arr.map(function (item, i) {
      return `<button type="button" class="preset-btn" onclick="loadFromHistory(${i})">${escapeHtml((item.name || '').slice(0, 12))}${item.name && item.name.length > 12 ? '…' : ''}</button>`;
    }).join('');
  } catch (e) { el.innerHTML = ''; }
}

function loadFromHistory(index) {
  try {
    var raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    var item = arr[index];
    if (!item) return;
    document.getElementById('productName').value = item.name || '';
    var ref = document.getElementById('ref-price');
    if (ref) ref.value = item.avg || '';
    showToast('최근 조회 복원');
    recalcMargin();
  } catch (e) {}
}

async function onSourcingLinkPaste(e) {
  var url = (e && e.clipboardData && e.clipboardData.getData('text')) || '';
  var input = document.getElementById('sourcing-link-input');
  if (!url && input) url = input.value;
  if (!url || url.indexOf('domeggook.com') === -1) return;
  if (e && e.preventDefault && e.clipboardData) e.preventDefault();
  if (input) input.value = url;
  var base = getBackendUrl();
  if (!base) { showToast('설정에서 백엔드 API URL을 입력해주세요', true); return; }
  try {
    var res = await fetch(base + '/parse-url?url=' + encodeURIComponent(url), { headers: getApiHeaders() });
    var data = await res.json();
    if (data.success && data.name) document.getElementById('productName').value = data.name;
    if (data.success && data.price != null) document.getElementById('costPrice').value = data.price;
    if (data.success) showToast('원가·상품명 자동 입력됨');
    else showToast(data.message || data.error || 'URL 파싱 실패', true);
  } catch (err) {
    showToast('URL 파싱 요청 실패', true);
  }
  recalcMargin();
}

let _lastWholesaleItems = [];

async function runUnifiedSearch(silent = false) {
  const q = document.getElementById('unified-wholesale-input').value.trim();
  if (!q) { if(!silent) showToast('검색어를 입력하세요', true); return; }

  const grid = document.getElementById('unified-wholesale-grid');
  const area = document.getElementById('unified-wholesale-results-area');
  const badgeContainer = document.getElementById('market-badge-tabs');
  if (!grid || !area) return;

  area.style.display = 'block';
  grid.innerHTML = '<div style="grid-column:1/-1;padding:40px 0;text-align:center;"><div class="loading-spinner" style="margin:0 auto 12px"></div><div>도매처 통합 검색 중...</div></div>';

  try {
    const promises = [
      window.fetchGas('domeggookProxy', { type: 'search', keyword: q, market: 'dome', size: 10 }).then(r => r && r.success ? { mall: '도매꾹', data: r } : null).catch(()=>null),
      window.fetchGas('domeggookProxy', { type: 'search', keyword: q, market: 'domeme', size: 10 }).then(r => r && r.success ? { mall: '도매매', data: r } : null).catch(()=>null)
    ];
    const responses = await Promise.all(promises);
    _lastWholesaleItems = [];

    responses.forEach(res => {
      if (res && res.data) {
        let items = res.data.data || res.data.items || [];
        // 포맷 맞추기: price, name, link, image, mall
        items.forEach(it => {
          _lastWholesaleItems.push({
            mall: res.mall,
            name: it.title || it.name || '',
            price: parseInt(it.price || it.unitPrice || it.salePrice || 0),
            image: it.image || it.imageUrl || it.thumb || '',
            link: it.link || it.url || ''
          });
        });
      }
    });

    // 중복 제거 및 정렬
    const seen = new Set();
    _lastWholesaleItems = _lastWholesaleItems.filter(it => {
      const k = it.link || it.name; if (seen.has(k)) return false; seen.add(k); return true;
    }).sort((a,b) => (a.price || 0) - (b.price || 0));

    renderWholesaleBadges(_lastWholesaleItems);
    filterWholesaleByMarket('ALL');

    if (!silent) showToast(`${_lastWholesaleItems.length}개의 도매 상품을 찾았습니다.`);
  } catch (e) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:12px">🔍</div><div style="font-size:14px;font-weight:600">검색 결과가 없습니다</div><div style="font-size:12px;margin-top:4px">다른 키워드로 검색하거나 API 연결 상태를 확인하세요</div></div>';
    if (!silent) SystemLogger.log('도매 검색 실패: ' + e.message, 'warning');
  }
}

function renderWholesaleBadges(items) {
  const container = document.getElementById('market-badge-tabs');
  if (!container) return;
  const counts = { ALL: items.length };
  items.forEach(it => { const m = it.mall || '기타'; counts[m] = (counts[m] || 0) + 1; });

  const badges = Object.entries(counts).map(([m, c]) => `
    <div class="market-badge" onclick="filterWholesaleByMarket('${m}')" style="background:var(--surface2); border:1px solid var(--border); border-radius:12px; padding:2px 8px; font-size:10px; cursor:pointer; font-weight:700">
      ${m} <span style="color:var(--accent)">${c}</span>
    </div>
  `).join('');
  container.innerHTML = badges;
}

function filterWholesaleByMarket(market) {
  const grid = document.getElementById('unified-wholesale-grid');
  const filtered = market === 'ALL' ? _lastWholesaleItems : _lastWholesaleItems.filter(it => it.mall === market);

  grid.innerHTML = filtered.map(item => `
    <div class="mp-product-card" onclick='applyWholesaleItem(${JSON.stringify(item).replace(/'/g, "&apos;")})' style="cursor:pointer; padding:6px; border:1px solid var(--border); border-radius:8px; background:var(--surface)">
      <img src="${item.image || ''}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; margin-bottom:4px" onerror="this.src='https://placehold.co/80?text=No+Img'">
      <div style="font-size:11px; font-weight:700; color:var(--accent); margin-bottom:1px">${fmt(item.price)}원</div>
      <div style="font-size:9px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px">${item.mall || '도매'}</div>
      <div style="font-size:10px; line-height:1.2; height:2.4em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical" title="${item.name}">${item.name}</div>
      <button class="inline-btn" style="width:100%; font-size:9px; padding:2px; margin-top:4px">적용</button>
    </div>
  `).join('');
  document.getElementById('wholesale-results-summary').textContent = `${market} 필터 적용: ${filtered.length}건`;
}

function applyWholesaleItem(item) {
  if (!item) return;
  showCalcSubTab('direct');
  setSourcingMode('online', document.getElementById('mode-online'));
  const linkInput = document.getElementById('sourcing-link-input');
  if (linkInput) {
    linkInput.value = item.link || '';
    if (item.link.includes('domeggook.com')) setTimeout(() => onSourcingLinkPaste({ target: linkInput }), 100);
  }
  const costInput = document.getElementById('costPrice');
  if (costInput) costInput.value = item.price || 0;
  const nameInput = document.getElementById('productName');
  if (nameInput && !nameInput.value.trim()) nameInput.value = item.name || '';
  recalcMargin();
  showToast('도매 상품 정보가 계산기에 반영되었습니다.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function runWholesaleSearch() { await searchUnifiedWholesale(); }



function showCompareAll() {
  const inp = getInputs();
  if (!inp.cost) { showToast('원가를 입력해주세요', true); return; }

  document.getElementById('results-area').style.display = 'block';
  document.getElementById('inverse-result').style.display = 'none';
  document.getElementById('result-cards').innerHTML = '';
  const wrap = document.getElementById('compare-all-wrap');
  const tbody = document.getElementById('compare-all-tbody');
  const bestMsg = document.getElementById('compare-best-msg');

  const rows = MARKET_IDS.map(mid => {
    const r = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[mid], inp.target);
    const salePrice = roundTo10(r.salePrice);
    const feeAmt = Math.round(salePrice * inp.fees[mid] / 100);
    const vatAmt = salePrice * 1.5 / 100;
    const profit = salePrice - feeAmt - vatAmt - inp.mktShip - (inp.cost + inp.supShip);
    const marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    return { id: mid, name: MARKET_FEES[mid].name, fee: inp.fees[mid], salePrice, profit, marginRate };
  });
  const best = rows.slice().sort((a, b) => (b.marginRate - a.marginRate))[0];

  tbody.innerHTML = rows.map(row => {
    const isBest = row.id === best.id;
    return `<tr class="${isBest ? 'compare-best' : ''}">
      <td>${isBest ? '<span class="compare-trophy">🏆</span> ' : ''}${row.name}</td>
      <td>${fmtPct(row.fee)}</td>
      <td>${fmt(row.salePrice)}원</td>
      <td>${fmt(row.profit)}원</td>
      <td>${fmtPct(row.marginRate)}</td>
    </tr>`;
  }).join('');
  bestMsg.textContent = '🏆 최고 마진: ' + best.name + ' (' + fmtPct(best.r.marginRate) + ')';
  wrap.style.display = 'block';
  window._lastResult = { inp, activeMarkets: [inp.selectedMarketId] };
}

// ==================== SAVE ====================
async function saveProduct() {
  if (!SCRIPT_URL) { showToast('설정 탭에서 URL을 먼저 입력하세요', true); showTab('setup'); return; }
  if (!window._lastResult) { calculate(); }
  const { inp, activeMarkets } = window._lastResult;
  if (!inp.cost) { showToast('원가를 먼저 입력하세요', true); return; }

  // Phase 4: Use GASAdapter to maintain 26-column legacy compatibility & future N*M support
  const targetMarket = activeMarkets[0] || 'smartstore';
  const priceData = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[targetMarket], inp.target);
  const sourcingLinkInput = document.getElementById('sourcing-link-input');

  const stdItem = new StandardProductInfo({
      id: Date.now() + Math.random().toString(),
      name: inp.name,
      wholesale_price: inp.cost,
      selling_price: roundTo10(priceData.salePrice),
      source_url: (sourcingLinkInput && sourcingLinkInput.value.trim()) || ''
  });

  const customFields = {
      cost: inp.cost,
      supShip: inp.supShip,
      mktShip: inp.mktShip,
      fee: inp.fees[targetMarket],
      market: MARKET_INFO[targetMarket]?.name || ''
  };

  showLoading(true);
  try {
    // Adapter intercept for N*M structure safely mapping 26 columns
    const res = await window.GASAdapter.saveProductToGAS(stdItem, customFields);

    // Legacy mapping explicitly preserved under the hood in GASAdapter.
    // For now we still perform actual DB fetch for existing spreadsheet users.
    const lastSearch = window._lastSearch || {};
    const catSel = document.getElementById('mp-category-select');
    const toSave = activeMarkets.map(k => {
      const m = MARKET_INFO[k];
      const r = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[k], inp.target);
      const salePrice = roundTo10(r.salePrice);
      const feeAmt = Math.round(salePrice * inp.fees[k] / 100);
      const vatAmt = salePrice * 1.5 / 100;
      const profit = salePrice - feeAmt - vatAmt - inp.mktShip - (inp.cost + inp.supShip);
      const margin = salePrice > 0 ? parseFloat((profit / salePrice * 100).toFixed(1)) : 0;
      return {
        id: stdItem.id, name: stdItem.name, cost: inp.cost,
        supShip: inp.supShip, mktShip: inp.mktShip, market: m.name, marketClass: m.class,
        fee: inp.fees[k], salePrice: salePrice, feeAmt: feeAmt, profit: Math.round(profit),
        margin: margin,
        savedAt: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'}),
        savedBy: currentUser || '남편',
        category: (catSel && catSel.value) || lastSearch.category || '',
        competitionLevel: (window._v5CurrentCandidate && window._v5CurrentCandidate.competitionLevel) || lastSearch.competitionLevel || '',
        minMarketPrice: (window._v5CurrentCandidate && window._v5CurrentCandidate.minPrice) || lastSearch.min_price || '',
        avgMarketPrice: (window._v5CurrentCandidate && window._v5CurrentCandidate.avgPrice) || lastSearch.avg_price || '',
        maxMarketPrice: (window._v5CurrentCandidate && window._v5CurrentCandidate.maxPrice) || lastSearch.max_price || '', sourcingLink: stdItem.source_url,
        targetGender: '', targetAge: '', trendSeason: '', collectedAt: new Date().toISOString().slice(0, 10),
        mainTarget: '', sellDecision: 'N',

        // --- Phase 10/12 Extension (27~29) ---
        sourcingType: '온라인', marketingPoint: '', aiData: '',

        // --- Rest ---
        sellStartDate: '', aiScore: (window._v5CurrentCandidate && window._v5CurrentCandidate.aiScore) || lastSearch.aiScore || '',
        recommendWholesale: 'N', estimatedBulkCost: '', photoUrl: (window._v5CurrentCandidate && window._v5CurrentCandidate.photoUrl) || lastSearch.photoUrl || lastSearch.thumbnailUrl || '', docUrl: '',
        leadTime: '', paymentTerms: '', consignAvail: '', contact: ''
      };
    });

    // Real call
    const data = await fetchSheetApi(SCRIPT_URL, 'saveProduct', { products: toSave });
    if (data.success || res.success) {
      showToast(`✅ ${inp.name} 저장 및 DB 매핑 완료!`);
      if (typeof clearCalcData === 'function') clearCalcData(true);
      await loadProducts();

      // Phase 4: Save & Move to Ledger (T3 State B) Trigger
      if(typeof showTab === 'function') showTab('ledger');
      if(window.t3State) window.t3State.setState('B');
    } else {
      showToast('저장 실패: ' + (data.error || res.error), true);
    }
  } catch (e) {
    showToast('저장 중 오류가 발생했습니다', true);
  }
  showLoading(false);
}

// ==================== 엑셀 드래그 앤 드랍 초기화 ====================
function initExcelDrop() {
  const zone = document.getElementById('excel-drop-zone');
  if (!zone) return;
  const input = document.getElementById('wholesale-excel-file');
  zone.onclick = () => input.click();
  zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent2)'; };
  zone.ondragleave = () => { zone.style.borderColor = 'var(--border)'; };
  zone.ondrop = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--border)'; handleExcelFile(e.dataTransfer.files[0]); };
  input.onchange = (e) => handleExcelFile(e.target.files[0]);
}

function handleExcelFile(file) {
  if (!file) return;
  const info = document.getElementById('excel-file-info');
  info.textContent = `선택된 파일: ${file.name} (${fmt(file.size)} bytes)`;
  info.style.display = 'block';
  window._selectedExcelFile = file;
  showToast('파일이 준비되었습니다.');
}

async function processWholesaleExcel() {
  const file = window._selectedExcelFile;
  if (!file) { showToast('파일을 선택해주세요.', true); return; }

  const reader = new FileReader();
  reader.onload = async function(ev) {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb = (typeof XLSX !== 'undefined' ? XLSX : window.XLSX).read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) { showToast('데이터가 없습니다.', true); return; }

      const cols = Object.keys(rows[0]);
      const nameCol = cols.find(c => c.includes('상품명') || c.includes('name'));
      const costCol = cols.find(c => c.includes('원가') || c.includes('가격') || c.includes('price')) || cols.find(c => c.includes('금액'));

      if (!nameCol || !costCol) { showToast('상품명 또는 원가 컬럼을 찾을 수 없습니다.', true); return; }

      showToast(`${rows.length}건의 데이터를 분석합니다...`);
      showLoading(true);

      _excelRows = rows;
      // 기존 startExcelAnalyze 호출용 가상 매핑
      document.getElementById('excel-col-name').innerHTML = `<option value="${nameCol}">${nameCol}</option>`;
      document.getElementById('excel-col-cost').innerHTML = `<option value="${costCol}">${costCol}</option>`;
      document.getElementById('excel-col-name').value = nameCol;
      document.getElementById('excel-col-cost').value = costCol;

      await startExcelAnalyze();
      showExcelResults(); // 분석 결과 그리드 표시
    } catch (err) {
      console.error(err);
      showToast('엑셀 처리 중 오류 발생', true);
    } finally {
      showLoading(false);
    }
  };
  reader.readAsArrayBuffer(file);
}
setTimeout(initExcelDrop, 1000);

async function startExcelAnalyze() {
  const nameCol = document.getElementById('excel-col-name').value;
  const costCol = document.getElementById('excel-col-cost').value;
  if (!nameCol || !costCol || !_excelRows.length) {
    showToast('컬럼 매핑을 선택하고 파일을 업로드하세요', true);
    return;
  }
  const base = getBackendUrl();
  if (!base) { showToast('설정에서 백엔드 URL을 입력하세요', true); return; }
  const btn = document.getElementById('excel-analyze-btn');
  btn.disabled = true;
  _excelResults = [];
  for (let i = 0; i < _excelRows.length; i++) {
    const row = _excelRows[i];
    const name = (row[nameCol] || '').toString().trim();
    const cost = parseFloat(row[costCol]) || 0;
    const supShip = parseFloat((costCol ? row[document.getElementById('excel-col-ship').value] : null) || 0) || 0;
    if (!name) continue;
    try {
      const url = new URL(base + '/compare');
      url.searchParams.set('query', name);
      url.searchParams.set('cost', cost);
      url.searchParams.set('sup_ship', supShip);
      url.searchParams.set('mkt_ship', 3000);
      const res = await fetch(url, { headers: getApiHeaders() });
      const data = await res.json();
      _excelResults.push({ row, name, cost, supShip, analysis: data });
    } catch (e) {
      _excelResults.push({ row, name, cost, supShip, analysis: { success: false } });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  const bestKey = 'best_market';
  _excelResults.sort((a, b) => {
    const ma = (a.analysis && a.analysis.margins && a.analysis.margins[a.analysis[bestKey]]) ? a.analysis.margins[a.analysis[bestKey]].margin : -999;
    const mb = (b.analysis && b.analysis.margins && b.analysis.margins[b.analysis[bestKey]]) ? b.analysis.margins[b.analysis[bestKey]].margin : -999;
    return mb - ma;
  });
  let high = 0, mid = 0, low = 0;
  _excelResults.forEach(r => {
    const m = r.analysis && r.analysis.margins && r.analysis.best_market ? (r.analysis.margins[r.analysis.best_market] || {}).margin : 0;
    if (m >= 20) high++; else if (m >= 10) mid++; else low++;
  });
  document.getElementById('excel-total-count').textContent = _excelResults.length;
  document.getElementById('excel-high-count').textContent = high;
  document.getElementById('excel-mid-count').textContent = mid;
  document.getElementById('excel-low-count').textContent = low;
  document.getElementById('excel-summary').style.display = 'block';
  btn.disabled = false;
  showToast('일괄 분석 완료');
}

function showExcelResults() {
  const container = document.getElementById('excel-results-cards');
  container.style.display = 'block';
  const highOnly = _excelResults.filter(r => {
    const m = r.analysis && r.analysis.margins && r.analysis.best_market ? (r.analysis.margins[r.analysis.best_market] || {}).margin : 0;
    return m >= 20;
  });
  container.innerHTML = highOnly.map((r, idx) => {
    const a = r.analysis;
    const best = (a && a.best_market) || '스마트스토어';
    const marginObj = (a && a.margins && a.margins[best]) || {};
    const margin = marginObj.margin || 0;
    const avg = (a && a.market_prices && a.market_prices.avg) || 0;
    const trend = (a && a.trend && a.trend.season_icon) ? a.trend.season_icon + ' ' + (a.trend.season || '') : '—';
    const origIdx = _excelResults.indexOf(r);
    return `<div class="product-card" style="margin-bottom:10px">
      <div class="pc-header">
        <div><div class="pc-name">${escapeHtml(r.name)}</div><div class="pc-by">도매원가: ${fmt(r.cost)}원 · 시중평균: ${fmt(avg)}원</div></div>
        <span class="margin-badge badge-good">🏆 ${fmtPct(margin)}</span>
      </div>
      <div class="pc-grid">
        <div class="pc-item"><div class="pc-item-label">최적마켓</div><div class="pc-item-val">${escapeHtml(best)}</div></div>
        <div class="pc-item"><div class="pc-item-label">트렌드</div><div class="pc-item-val">${escapeHtml(trend)}</div></div>
      </div>
      <div class="pc-footer" style="margin-top:8px">
        <button type="button" class="action-btn" onclick="addExcelRowByIndex(${origIdx})">소싱목록 추가</button>
      </div>
    </div>`;
  }).join('');
}
function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function addExcelRowByIndex(origIdx) {
  const r = _excelResults[origIdx];
  if (!r) return;
  const a = r.analysis;
  const best = (a && a.best_market) || '스마트스토어';
  const marginObj = (a && a.margins && a.margins[best]) || {};
  const margin = marginObj.margin || 0;
  const avg = (a && a.market_prices && a.market_prices.avg) || 0;
  addExcelRowToSheet(r.name, r.cost, r.supShip || 0, avg, best, margin);
}

async function runAutoSourcing() {
  const apiKey = localStorage.getItem('domeggook-api-key');
  if (!apiKey) { showToast('도매꾹 API 키를 설정 탭에서 입력해주세요.', true); return; }
  const category = document.getElementById('auto-sourcing-category').value || '생활용품';
  const minMargin = parseFloat(document.getElementById('auto-sourcing-margin').value) || 20;
  const maxCost = parseFloat(document.getElementById('auto-sourcing-max-cost').value) || 999999999;
  showLoading(true);
  const resultsEl = document.getElementById('auto-sourcing-results');
  try {
    const searchRes = await fetch(getBackendUrl() + '/domeggook/search?query=' + encodeURIComponent(category), { headers: getApiHeaders() });
    const searchData = await searchRes.json();
    if (!searchData.success || !searchData.items || !searchData.items.length) {
      resultsEl.style.display = 'block';
      resultsEl.innerHTML = '<div style="color:var(--text-muted)">검색 결과가 없습니다.</div>';
      showLoading(false);
      return;
    }
    const analyzed = [];
    for (const item of searchData.items.slice(0, 10)) {
      if (item.price > maxCost) continue;
      const compareRes = await fetch(getBackendUrl() + '/compare?query=' + encodeURIComponent(item.name || '') + '&cost=' + (item.price || 0), { headers: getApiHeaders() });
      const compare = await compareRes.json();
      if (!compare.success) continue;
      const margins = compare.margins || {};
      const bestMargin = Math.max(0, ...Object.values(margins).map(m => m.margin || 0));
      if (bestMargin >= minMargin) {
        analyzed.push({
          ...item,
          marketPrices: compare.market_prices,
          margins: compare.margins,
          bestMargin: bestMargin,
          bestMarket: compare.best_market || '스마트스토어',
          trend: compare.trend,
        });
      }
      await new Promise(r => setTimeout(r, 400));
    }
    analyzed.sort((a, b) => (b.bestMargin || 0) - (a.bestMargin || 0));
    resultsEl.style.display = 'block';
    if (analyzed.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-muted)">조건에 맞는 상품이 없습니다.</div>';
    } else {
      resultsEl.innerHTML = analyzed.map(a => {
        const nameSafe = String(a.name).replace(/'/g, "\\'");
        const bestMarketSafe = a.bestMarket || '스마트스토어';
        const marketAvg = (a.marketPrices && a.marketPrices.avg) ? a.marketPrices.avg : 0;
        return `<div class="product-card" style="margin-bottom:10px">
          <div class="pc-header">
            <div class="pc-name">${escapeHtml(a.name)}</div>
            <div class="pc-date">도매가 ${fmt(a.price)}원</div>
          </div>
          <div class="pc-grid">
            <div class="pc-item"><div class="pc-item-label">최고 마진</div><div class="pc-item-val">${fmtPct(a.bestMargin)}</div></div>
            <div class="pc-item"><div class="pc-item-label">추천 마켓</div><div class="pc-item-val">${escapeHtml(a.bestMarket)}</div></div>
          </div>
          <div class="pc-footer">
            <button type="button" class="action-btn" onclick="addExcelRowToSheet('${nameSafe}', ${a.price}, 0, ${marketAvg}, '${bestMarketSafe}', ${a.bestMargin})">소싱목록 추가</button>
          </div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div style="color:var(--danger)">연결 실패</div>';
  }
  showLoading(false);
}

function addExcelRowToSheet(name, cost, supShip, avgPrice, bestMarket, margin) {
  if (!SCRIPT_URL) { showToast('설정에서 스크립트 URL을 입력하세요', true); return; }
  const fee = (MARKET_FEES[Object.keys(MARKET_FEES).find(k => MARKET_FEES[k].name === bestMarket)] || MARKET_FEES.smartstore).fee;
  const r = calcForMarket(cost, supShip || 0, 3000, fee, 0);
  const salePrice = r.salePrice || avgPrice;
  const feeAmt = Math.round(salePrice * fee / 100);
  const profit = salePrice - feeAmt - 3000 - cost - (supShip || 0);
  const toSave = [{
    id: Date.now() + Math.random(),
    name, cost, supShip: supShip || 0, mktShip: 3000,
    market: bestMarket,
    marketClass: bestMarket === '스마트스토어' ? 'smart' : bestMarket === '쿠팡' ? 'coupang' : 'open',
    fee, salePrice, feeAmt, profit: Math.round(profit), margin,
    savedAt: new Date().toLocaleDateString('ko-KR'), savedBy: currentUser || '남편',
    category: '', competitionLevel: '', minMarketPrice: '', avgMarketPrice: avgPrice, sellDecision: 'N', sellStartDate: ''
  }];
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'saveProduct', products: toSave }) })
    .then(res => res.json())
    .then(data => { if (data.success) { showToast('저장됨'); loadProducts(); } else showToast(data.error || '저장 실패', true); })
    .catch(() => showToast('저장 실패', true));
}

async function saveExcelResultsToSheet() {
  if (!SCRIPT_URL) { showToast('설정에서 스크립트 URL을 입력하세요', true); return; }
  const highOnly = _excelResults.filter(r => {
    const m = r.analysis && r.analysis.margins && r.analysis.best_market ? (r.analysis.margins[r.analysis.best_market] || {}).margin : 0;
    return m >= 20;
  });
  const toSave = highOnly.map(r => {
    const a = r.analysis;
    const best = (a && a.best_market) || '스마트스토어';
    const marginObj = (a && a.margins && a.margins[best]) || {};
    const margin = marginObj.margin || 0;
    const avg = (a && a.market_prices && a.market_prices.avg) || 0;
    const fee = (MARKET_FEES[Object.keys(MARKET_FEES).find(k => MARKET_FEES[k].name === best)] || MARKET_FEES.smartstore).fee;
    const salePrice = marginObj.sale || avg;
    const feeAmt = Math.round((salePrice * fee) / 100);
    const profit = salePrice - feeAmt - 3000 - r.cost - (r.supShip || 0);
    return {
      id: Date.now() + Math.random(),
      name: r.name, cost: r.cost, supShip: r.supShip || 0, mktShip: 3000,
      market: best, marketClass: best === '스마트스토어' ? 'smart' : best === '쿠팡' ? 'coupang' : 'open',
      fee, salePrice, feeAmt, profit: Math.round(profit), margin,
      savedAt: new Date().toLocaleDateString('ko-KR'), savedBy: currentUser || '남편',
      category: '', competitionLevel: '', minMarketPrice: '', avgMarketPrice: avg, sellDecision: 'N', sellStartDate: ''
    };
  });
  showLoading(true);
  try {
    const data = await fetchSheetApi(SCRIPT_URL, 'saveProduct', { products: toSave });
    if (data.success) { showToast('구글 시트에 ' + toSave.length + '건 저장됨'); loadProducts(); }
    else showToast(data.error || '저장 실패', true);
  } catch (e) { showToast('저장 실패', true); }
  showLoading(false);
}

// ==================== 지능형 위험 감지 엔진 ====================
async function runRiskEngine() {
  const kakaoToken = localStorage.getItem('api-kakao-token') || localStorage.getItem('api-kakao') || '';
  let hasActions = false;
  if (!appState || !appState.products) return;

  const start = performance.now();
  console.log('[RiskEngine] 지능형 감지 엔진 구동 시작...');

  for (let i = 0; i < appState.products.length; i++) {
    const p = appState.products[i];

    // 이미 중단된 상품 패스
    if (p.sellDecision === 'N' && (p.lastActionReason || '').includes('[자동중단]')) {
      continue;
    }

    const input = {
      productId: p.id,
      vendor: 'domeggook',
      currentStock: p.currentStock !== undefined ? p.currentStock : 100,
      stockStatus: p.stockStatus || 'IN_STOCK',
      wholesalePrice: p.cost || 0,
      salePrice: p.salePrice || 0,
      marketFeeRate: p.fee || 10
    };

    const risk = detectBusinessRisks(input);
    if (risk.riskLevel !== 'SAFE') {
      const acted = await executeAutoResponse(p, risk, SCRIPT_URL, kakaoToken);
      if (acted) hasActions = true;
    }
  }

  const end = performance.now();
  console.log(`[RiskEngine] 엔진 수행 완료 (${(end - start).toFixed(2)}ms), 조치 발생: ${hasActions}`);
}

// ==================== LOAD ====================
async function loadProducts() {
  // if (!SCRIPT_URL) return; // 전역 설정 없이 fetchGas 프록시 서버 URL 고정 이용
  setSyncStatus('syncing', '동기화 중...');
  try {
    const data = await (window.fetchGas ? window.fetchGas('getProducts', {}) : fetchSheetApi(SCRIPT_URL, 'getProducts'));
    if (data.success || data.products) {
      appState.products = data.products || data || [];

      // mock-tester-001 삭제됨 (V5.5 — 실 데이터 전용)

      await runRiskEngine(); // 데이터 로딩 후 감지 엔진 선행 구동

      products = appState.products;
      renderList();
      renderStats();
      const n = products.length;
      const el = document.getElementById('list-count'); if (el) { el.textContent = n; el.style.display = n > 0 ? 'inline' : 'none'; }
      const elM = document.getElementById('list-count-mobile'); if (elM) { elM.textContent = n; elM.style.display = n > 0 ? 'inline' : 'none'; }
      setSyncStatus('synced', '동기화 완료');
    } else {
      setSyncStatus('error', '오류');
    }
  } catch (e) {
    setSyncStatus('error', '연결 실패');
  }
}

// ==================== RENDER LIST (소싱목록) ====================
function renderList() {
  const searchEl = document.getElementById('search-input');
  const search = (searchEl && searchEl.value) ? searchEl.value.toLowerCase() : '';
  const mFilterEl = document.getElementById('margin-filter');
  const mFilter = parseFloat(mFilterEl && mFilterEl.value) || 0;
  const mkFilterEl = document.getElementById('market-filter');
  const mkFilter = mkFilterEl ? mkFilterEl.value : '';
  const catFilterEl = document.getElementById('category-filter');
  const catFilter = catFilterEl ? catFilterEl.value : '';
  const compFilterEl = document.getElementById('competition-filter');
  const compFilter = compFilterEl ? compFilterEl.value : '';
  const sortListEl = document.getElementById('sort-list');
  const sortVal = (sortListEl && sortListEl.value) || 'margin-desc';
  const margin20El = document.getElementById('filter-margin20');
  const onlyMargin20 = margin20El && margin20El.checked;

  let filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search)) return false;
    if (mkFilter && p.market !== mkFilter) return false;
    if (!isNaN(mFilter) && mFilter > 0 && p.margin < mFilter) return false;
    if (catFilter && (p.category || '') !== catFilter) return false;
    if (compFilter && (p.competitionLevel || '') !== compFilter) return false;
    if (onlyMargin20 && (parseFloat(p.margin) || 0) < 20) return false;
    return true;
  });
  if (sortVal === 'margin-desc') filtered.sort((a, b) => (parseFloat(b.margin) || 0) - (parseFloat(a.margin) || 0));
  else if (sortVal === 'margin-asc') filtered.sort((a, b) => (parseFloat(a.margin) || 0) - (parseFloat(b.margin) || 0));
  else if (sortVal === 'date-desc') filtered.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  const empty = document.getElementById('empty-state');
  const cards = document.getElementById('product-cards');

  // [V6 호환성] 구버전 DOM이 없을 경우 신버전 T2 모듈에 데이터 위임 및 에러 회피
  if (!empty || !cards) {
    if (typeof T2 !== 'undefined' && typeof t2RenderProducts === 'function' && typeof t2RenderDashboard === 'function') {
      T2.products = filtered;
      t2RenderProducts();
      t2RenderDashboard();
    }
    return;
  }

  if (filtered.length === 0) {
    empty.style.display = 'block';
    cards.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  cards.style.display = 'grid';

  const isSell = (p) => String(p.sellDecision || 'N').toUpperCase() === 'Y' || p.sellDecision === true;
  const marketToBarClass = (name) => name === '스마트스토어' ? 'smart' : name === '쿠팡' ? 'coupang' : 'open';
  function formatCollectDate(savedAt, collectedAt) {
    const raw = collectedAt || savedAt || '';
    const d = raw.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/) || raw.match(/(\d{4})(\d{2})(\d{2})/);
    if (!d) return { text: raw || '—', daysAgo: 999, warn: '' };
    const date = new Date(parseInt(d[1]), parseInt(d[2], 10) - 1, parseInt(d[3], 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((today - date) / 86400000);
    const dayLabel = daysAgo === 0 ? '오늘' : daysAgo === 1 ? '어제' : daysAgo + '일 전';
    let warn = '';
    if (daysAgo >= 30) warn = 'list-collect-danger';
    else if (daysAgo >= 7) warn = 'list-collect-warn';
    const short = (raw.slice(0, 10).match(/(\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})/) || [])[0] || raw.slice(0, 10);
    return { text: short + ' (' + dayLabel + ')', daysAgo, warn };
  }
  cards.innerHTML = filtered.map(p => {
    const bc = p.margin >= 20 ? 'badge-good' : p.margin >= 10 ? 'badge-warn' : 'badge-bad';
    const mcClass = marketToBarClass(p.market);
    const collect = formatCollectDate(p.savedAt, p.collectedAt);
    const sourceLabel = (p.sourcingLink || '').indexOf('domeggook') >= 0 ? '도매꾹' : (p.sourcingLink ? '직접입력' : '—');
    const naverLink = (p.name) ? 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(p.name) : '';
    const linkRow = [];
    if (p.sourcingLink) linkRow.push('<a href="' + escapeHtml(p.sourcingLink) + '" target="_blank" rel="noopener">🔗 도매 링크</a>');
    if (naverLink) linkRow.push('<a href="' + naverLink + '" target="_blank" rel="noopener">🔗 네이버 최저가</a>');

    // V5 New Badges
    const aiScore = p.aiScore || 0;
    const aiScoreBadge = aiScore ? `<span class="ai-score-badge" style="border:1px solid ${aiScore>=80?'var(--accent)':'var(--warn)'}; color:${aiScore>=80?'var(--accent)':'var(--warn)'}; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px">AI ${aiScore}</span>` : '';
    const wholesaleBadge = p.recommendWholesale === 'Y' ? `<span class="wholesale-rec-badge" style="background:var(--accent); color:#000; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px">🚀 사입추천</span>` : '';

    const isQuarantined = (p.lastActionReason || '').includes('[자동중단]');
    const isWarned = (p.lastActionReason || '').includes('[주의경고]');
    const borderStyle = isQuarantined ? 'border: 2px solid var(--danger); opacity: 0.8;' : (isWarned ? 'border: 2px solid var(--accent);' : '');
    const quarantineBadge = isQuarantined
      ? '<div style="background:var(--danger);color:white;padding:4px 8px;font-size:11px;border-radius:4px;font-weight:bold;margin-top:8px;display:inline-block">🚨 시스템 자동 격리됨</div>'
      : (isWarned ? '<div style="background:var(--accent);color:white;padding:4px 8px;font-size:11px;border-radius:4px;font-weight:bold;margin-top:8px;display:inline-block">⚠️ 위험 경고 발생</div>' : '');
    const reasonText = (isQuarantined || isWarned) ? '<div style="font-size:11px;color:var(--danger);margin-top:4px">' + escapeHtml(p.lastActionReason) + '</div>' : '';

    const startBtn = isQuarantined
      ? '<span style="font-size:11px;color:var(--danger);font-weight:bold;">판매 격리됨</span>'
      : (isSell(p) ? '<span style="font-size:11px;color:var(--accent)">✓ 판매중</span>' : `<button class="start-sell-btn" onclick="startSell('${p.id}')">판매 시작</button>`);
    const warnMsg = collect.daysAgo >= 30 ? '🔴 재확인 필요' : collect.daysAgo >= 7 ? '⚠️ 가격 변동 가능성 있음' : '';
    const targetSeason = [p.mainTarget ? '👥 ' + p.mainTarget : '', p.trendSeason ? '📈 ' + p.trendSeason : '', (p.category || '') ? '🏷️ ' + p.category : ''].filter(Boolean).join('  ');
    const photoUrl = (p.photoUrl || '').replace(/^http:/, 'https:');
    const docUrl = (p.docUrl || '').replace(/^http:/, 'https:');
    const isDirect = !!(p.docUrl || photoUrl);
    const photoSection = '<div class="pc-photo-section" style="margin-bottom:10px">' +
      (photoUrl ? '<img src="' + escapeHtml(photoUrl) + '" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block" onerror="this.style.display=\'none\'">' : '<div style="width:120px;height:120px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px">📦</div>') +
      '<span style="font-size:11px;margin-top:4px;display:inline-block">' + (isDirect ? '🏪 사입' : '🛒 온라인') + '</span>' +
      (docUrl ? ' <a href="' + escapeHtml(docUrl) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">📄 문서</a>' : '') +
      '</div>';
    return `<div class="product-card" style="${borderStyle}">
      ${photoSection}
      <div class="pc-header">
        <div style="flex:1">
          <div class="pc-name" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px">
            ${escapeHtml(p.name)}
            ${aiScoreBadge}
            ${wholesaleBadge}
          </div>
          <div class="pc-date">수집: ${collect.text}  출처: ${sourceLabel}</div>
          ${linkRow.length ? '<div class="list-card-links">' + linkRow.join(' | ') + '</div>' : ''}
          ${warnMsg ? '<div class="' + collect.warn + '">' + warnMsg + '</div>' : ''}
          ${quarantineBadge}
          ${reasonText}
        </div>
        <span class="margin-badge ${bc}">${fmtPct(p.margin)}</span>
      </div>
      <div class="pc-grid">
        <div class="pc-item"><div class="pc-item-label">도매가</div><div class="pc-item-val">${fmt(p.cost)}원</div></div>
        <div class="pc-item"><div class="pc-item-label">시중최저</div><div class="pc-item-val">${p.minMarketPrice ? fmt(p.minMarketPrice) + '원' : '—'}</div></div>
        <div class="pc-item"><div class="pc-item-label">시중평균</div><div class="pc-item-val">${p.avgMarketPrice ? fmt(p.avgMarketPrice) + '원' : '—'}</div></div>
        <div class="pc-item"><div class="pc-item-label">마진</div><div class="pc-item-val">${fmtPct(p.margin)}</div></div>
        </div>
      ${targetSeason ? '<div class="pc-by" style="margin-top:6px;font-size:12px">' + escapeHtml(targetSeason) + '</div>' : ''}
      <div class="pc-footer" style="flex-wrap:wrap">
        <span class="margin-badge" style="background:color-mix(in srgb,var(--${mcClass}) 15%,transparent);color:var(--${mcClass})">${escapeHtml(p.market)}</span>
        <label class="filter-toggle-label" style="margin:0;font-size:12px"><input type="checkbox" ${(p.priceTrack || '') === 'Y' ? 'checked' : ''} onchange="togglePriceTrack(${JSON.stringify(p.id)}, this.checked)"> 🔔 가격 추적</label>
        <div style="display:flex;align-items:center;gap:8px">${startBtn}<button class="del-btn" onclick="deleteProduct('${p.id}')">삭제</button></div>
        </div>
    </div>`;
  }).join('');
}

async function togglePriceTrack(id, on) {
  if (!SCRIPT_URL) { showToast('설정에서 Apps Script URL을 입력하세요', true); return; }
  try {
    const data = await fetchSheetApi(SCRIPT_URL, 'updateProduct', { id: id, priceTrack: on ? 'Y' : 'N' });
    if (data.success) {
      showToast(on ? '가격 추적 ON' : '가격 추적 OFF');
      await loadProducts();
    } else showToast('저장 실패', true);
  } catch (e) { showToast('오류 발생', true); }
}

async function startSell(id) {
  if (!SCRIPT_URL) { showToast('설정에서 Apps Script URL을 입력하세요', true); return; }
  const today = new Date().toISOString().slice(0, 10);
  showLoading(true);
  try {
    const data = await fetchSheetApi(SCRIPT_URL, 'updateProduct', { id: id, sellDecision: 'Y', sellStartDate: today });
    if (data.success) {
      showToast('판매 시작 처리되었습니다');
      await loadProducts();
      renderList();
    } else showToast('업데이트 실패', true);
  } catch (e) { showToast('오류 발생', true); }
  showLoading(false);
}

// ==================== C-3: 판매관리 ====================
async function loadSalesPage() {
  const selling = products.filter(p => String(p.sellDecision || 'N').toUpperCase() === 'Y' || p.sellDecision === true);
  const monthRev = document.getElementById('sales-month-revenue');
  const monthProfit = document.getElementById('sales-month-profit');
  const countEl = document.getElementById('sales-selling-count');
  if (countEl) countEl.textContent = selling.length;

  salesRecords = appState.sales || []; // Ensure sync from appState

  const thisMonth = getCurrentMonth();
  let monthRevenue = 0, monthProfitSum = 0;
  salesRecords.forEach(r => {
    const d = (r.date || '').toString().slice(0, 7);
    if (d === thisMonth) {
      monthRevenue += Number(r.revenue) || 0;
      monthProfitSum += Number(r.profit) || 0;
    }
  });
  if (monthRev) monthRev.textContent = fmt(monthRevenue) + '원';
  if (monthProfit) monthProfit.textContent = fmt(monthProfitSum) + '원';

  const empty = document.getElementById('sales-empty');
  const cards = document.getElementById('sales-cards');
  if (selling.length === 0) {
    empty.style.display = 'block';
    cards.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  cards.style.display = 'grid';

  renderSalesTable(selling, salesRecords, cards);
}

function renderSalesTable(selling, salesData, cardsEl) {
  const byProduct = {};
  salesData.forEach(r => {
    const key = String(r.productId || r.productName || '');
    if (!byProduct[key]) byProduct[key] = { qty: 0, revenue: 0, profit: 0 };
    byProduct[key].qty += Number(r.quantity) || 0;
    byProduct[key].revenue += Number(r.revenue) || 0;
    byProduct[key].profit += Number(r.profit) || 0;
  });

  const marketToBarClass = (name) => name === '스마트스토어' ? 'smart' : name === '쿠팡' ? 'coupang' : 'open';

  cardsEl.innerHTML = selling.map(p => {
    const key = String(p.id || p.name);
    const sum = byProduct[key] || { qty: 0, revenue: 0, profit: 0 };
    const mcClass = marketToBarClass(p.market);
    const photoUrl = (p.photoUrl || '').replace(/^http:/, 'https:');
    const docUrl = (p.docUrl || '').replace(/^http:/, 'https:');
    const isDirect = !!(p.docUrl || photoUrl);
    const leadTimeStr = (p.leadTime && String(p.leadTime).trim()) ? ` · 납기 ${escapeHtml(String(p.leadTime).trim())}` : '';

    const photoSection = `<div class="pc-photo-section" style="margin-bottom:10px">
      ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" style="width:100px;height:100px;object-fit:cover;border-radius:8px;display:block" onerror="this.style.display='none'">` : `<div style="width:100px;height:100px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px">📦</div>`}
      <span style="font-size:11px;margin-top:4px;display:inline-block">${isDirect ? '🏪 사입' : '🛒 온라인'}</span>
      ${docUrl ? ` <a href="${escapeHtml(docUrl)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">📄 문서</a>` : ''}
    </div>`;

    const aiScore = p.aiScore || 0;
    const aiScoreBadge = aiScore ? `<span class="ai-score-badge" style="border:1px solid ${aiScore>=80?'var(--accent)':'var(--warn)'}; color:${aiScore>=80?'var(--accent)':'var(--warn)'}; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; margin-left:4px">AI ${aiScore}</span>` : '';
    const priceGap = p.avgMarketPrice ? (p.avgMarketPrice - p.salePrice) : 0;
    const gapColor = priceGap > 0 ? 'var(--accent)' : 'var(--danger)';

    return `<div class="product-card">
      ${photoSection}
      <div class="pc-header">
        <div style="flex:1">
          <div class="pc-name" style="display:flex; align-items:center; gap:4px">${escapeHtml(p.name)} ${aiScoreBadge}</div>
          <div class="pc-by">${p.market} · 등록가 ${fmt(p.salePrice)}원${leadTimeStr}</div>
          <div style="font-size:11px; margin-top:2px; color:${gapColor}">시중가 대비: ${priceGap > 0 ? '+' : ''}${fmt(priceGap)}원</div>
        </div>
        <span class="margin-badge" style="background:color-mix(in srgb,var(--${mcClass}) 15%,transparent);color:var(--${mcClass})">${p.market}</span>
      </div>
      <div class="pc-grid">
        <div class="pc-item"><div class="pc-item-label">누적 판매량</div><div class="pc-item-val">${sum.qty}개</div></div>
        <div class="pc-item"><div class="pc-item-label">누적 매출</div><div class="pc-item-val" style="color:var(--accent)">${fmt(sum.revenue)}원</div></div>
        <div class="pc-item"><div class="pc-item-label">누적 순이익</div><div class="pc-item-val" style="color:${sum.profit>=0?'var(--accent)':'var(--danger)'}">${fmt(sum.profit)}원</div></div>
      </div>
      <div class="pc-footer">
        <button class="start-sell-btn" onclick="openSalesRecordModalById('${p.id}')">판매 기록 추가</button>
      </div>
    </div>`;
  }).join('');
}
function openSalesRecordModalById(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  if (product) openSalesRecordModal(product);
}

// ==================== FIFO 재고 단가 엔진 ====================
function renderFIFOAnalysis() {
  const prods = JSON.parse(localStorage.getItem('v5-products') || '[]');
  const sales = (window.appState?.sales || []);

  // 상품별 FIFO 큐 구성
  const fifoMap = {}; // { productName: { queue: [{qty, cost, date}], sold: num } }

  prods.forEach(p => {
    const name = p.name || p.productName || '(미지정)';
    if (!fifoMap[name]) fifoMap[name] = { queue: [], totalSold: 0, market: p.market || '' };
    // 매입 기록 = 상품 저장 시 원가 × 수량(기본 1)
    const qty = parseInt(p.quantity) || 1;
    const cost = parseFloat(p.cost || p.costPrice) || 0;
    fifoMap[name].queue.push({ qty, cost, date: p.date || p.savedAt || '' });
  });

  // 판매 기록으로 FIFO 출고 처리
  sales.forEach(s => {
    const name = s.productName || s.name || '';
    if (fifoMap[name]) {
      let remaining = parseInt(s.quantity) || 1;
      fifoMap[name].totalSold += remaining;
      // FIFO: 가장 먼저 들어온 것부터 차감
      while (remaining > 0 && fifoMap[name].queue.length > 0) {
        const lot = fifoMap[name].queue[0];
        if (lot.qty <= remaining) {
          remaining -= lot.qty;
          fifoMap[name].queue.shift();
        } else {
          lot.qty -= remaining;
          remaining = 0;
        }
      }
    }
  });

  // 집계
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

  const avgUnit = totalQty > 0 ? Math.round(totalValue / totalQty) : 0;

  // DOM 업데이트
  const qtyEl = document.getElementById('fifo-total-qty');
  const avgEl = document.getElementById('fifo-avg-cost');
  const valEl = document.getElementById('fifo-total-value');
  const listEl = document.getElementById('fifo-detail-list');

  if (qtyEl) qtyEl.textContent = fmt(totalQty) + '개';
  if (avgEl) avgEl.textContent = fmt(avgUnit) + '원';
  if (valEl) valEl.textContent = fmt(totalValue) + '원';

  if (listEl) {
    if (rows.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:12px;">재고 데이터가 없습니다.</div>';
    } else {
      listEl.innerHTML = `<table class="compare-table" style="width:100%;font-size:11px;">
        <thead><tr><th>상품명</th><th>잔여</th><th>FIFO 단가</th><th>자산 가치</th><th>누적 판매</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td style="font-weight:600;">${r.name}</td>
          <td>${r.remainQty}개</td>
          <td>${fmt(r.avgCost)}원</td>
          <td style="color:var(--accent);">${fmt(r.remainValue)}원</td>
          <td>${r.sold}개</td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
  }
}

// ==================== OCR 증빙 자동 입력 ====================
async function ocrReceiptAutoFill() {
  const fileInput = document.getElementById('receipt-file');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('먼저 영수증 이미지를 첨부하세요.', 'error');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function(e) {
    const base64 = e.target.result.split(',')[1];
    const visionKey = localStorage.getItem('api-key-vision') || '';

    if (!visionKey) {
      showToast('T7 설정에서 Vision API 키를 먼저 입력하세요.', 'error');
      return;
    }

    showToast('🔍 OCR 분석 중...', 'info');

    try {
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      });

      const data = await res.json();
      const text = data.responses?.[0]?.textAnnotations?.[0]?.description || '';

      if (!text) {
        showToast('텍스트를 인식하지 못했습니다.', 'error');
        return;
      }

      // 날짜 추출 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
      const dateMatch = text.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
      if (dateMatch) {
        const dateEl = document.getElementById('receipt-date');
        if (dateEl) dateEl.value = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }

      // 금액 추출 (가장 큰 숫자)
      const amounts = text.match(/[\d,]{3,}/g);
      if (amounts) {
        const nums = amounts.map(a => parseInt(a.replace(/,/g, '')));
        const maxAmt = Math.max(...nums);
        if (maxAmt > 0) {
          const amtEl = document.getElementById('receipt-amount');
          if (amtEl) amtEl.value = maxAmt;
        }
      }

      // 상호명 추출 (첫 번째 줄 or 특정 패턴)
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const vendorEl = document.getElementById('receipt-vendor');
        // 보통 첫째 줄이 상호명
        if (vendorEl && !vendorEl.value) vendorEl.value = lines[0].substring(0, 20);
      }

      if (typeof updateReceiptSaveButton === 'function') updateReceiptSaveButton();
      showToast('✅ OCR 자동 입력 완료! 내용을 확인해주세요.', 'success');

    } catch(e) {
      console.error('[OCR] Error:', e);
      showToast('OCR 분석 실패: ' + e.message, 'error');
    }
  };

  reader.readAsDataURL(file);
}
function openSalesRecordModal(product) {
  _salesRecordProduct = product;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('sr-date').value = today;
  document.getElementById('sr-quantity').value = '1';
  document.getElementById('sr-price').value = product ? (product.salePrice || '') : '';
  const manualFields = document.getElementById('sr-manual-fields');
  const nameP = document.getElementById('sr-product-name');
  if (product) {
    manualFields.style.display = 'none';
    nameP.style.display = 'block';
    nameP.textContent = product.name + ' · ' + product.market;
  } else {
    manualFields.style.display = 'block';
    nameP.style.display = 'none';
    document.getElementById('sr-product-name-input').value = '';
    document.getElementById('sr-cost').value = '';
  }
  document.getElementById('modal-sales-record').classList.add('visible');
}
function closeSalesRecordModal() {
  document.getElementById('modal-sales-record').classList.remove('visible');
  _salesRecordProduct = null;
}
async function submitSalesRecord() {
  if (!SCRIPT_URL) return;
  const date = document.getElementById('sr-date').value;
  const quantity = parseInt(document.getElementById('sr-quantity').value, 10) || 1;
  const salePrice = parseInt(document.getElementById('sr-price').value, 10) || 0;
  if (!date || salePrice <= 0) { showToast('날짜와 판매가를 입력하세요', true); return; }
  const revenue = salePrice * quantity;
  let productId = '', productName = '', market = '', costSum = 0, feeAmt = 0;

  if (_salesRecordProduct) {
    const p = _salesRecordProduct;
    productId = p.id;
    productName = p.name;
    market = p.market;
    costSum = (p.cost || 0) * quantity;
    feeAmt = Math.round(revenue * (parseFloat(p.fee) || 0) / 100);
  } else {
    productName = document.getElementById('sr-product-name-input').value.trim() || '수동입력';
    market = document.getElementById('sr-market').value || '스마트스토어';
    const costPer = parseFloat(document.getElementById('sr-cost').value) || 0;
    costSum = costPer * quantity;
    const feeRate = (MARKET_FEES[Object.keys(MARKET_FEES).find(k => MARKET_FEES[k].name === market)] || MARKET_FEES.smartstore).fee;
    feeAmt = Math.round(revenue * feeRate / 100);
  }

  showLoading(true);
  try {
    const payload = {
      record: { date, productId, productName, market, quantity, salePrice, costSum, feeAmt, savedBy: currentUser || '남편' }
    };

    // API 계층(api.js) 호출하여 구글 시트 저장 실행
    const data = await fetchSheetApi(SCRIPT_URL, 'saveSalesRecord', payload);

    if (data && data.success) {
      showToast('판매 기록 저장 완료');
      closeSalesRecordModal();
      loadSalesPage();
    } else {
      showToast('저장 실패: ' + (data && data.error ? data.error : '알 수 없는 오류'), true);
    }
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류', true);
  } finally {
    showLoading(false);
  }
}

// ==================== C-4: 회계 ====================

function saveAccBusinessType() {
  const sel = document.getElementById('acc-business-type');
  if (sel) localStorage.setItem('acc-business-type', sel.value);
}
function getAccBusinessType() {
  return localStorage.getItem('acc-business-type') || '소매업';
}
function getCurrentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
async function loadAccountingPage() {
  const bt = document.getElementById('acc-business-type');
  if (bt) bt.value = getAccBusinessType();
  const monthOpt = document.getElementById('acc-month-filter');
  if (monthOpt.options.length <= 1) {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const o = document.createElement('option');
      o.value = v;
      const parts = v.split('-');
      o.textContent = (parts[0] || '') + '년 ' + parseInt(parts[1] || '0', 10) + '월';
      if (i === 0) o.selected = true;
      monthOpt.appendChild(o);
    }
  }
  if (!document.getElementById('acc-date').value) document.getElementById('acc-date').value = new Date().toISOString().slice(0, 10);
  const rd = document.getElementById('receipt-date');
  if (rd && !rd.value) rd.value = new Date().toISOString().slice(0, 10);
  const rmo = document.getElementById('receipt-month-filter');
  if (rmo && rmo.options.length <= 1) {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const o = document.createElement('option');
      o.value = v;
      const rParts = v.split('-');
      o.textContent = (rParts[0] || '') + '년 ' + parseInt(rParts[1] || '0', 10) + '월';
      if (i === 0) o.selected = true;
      rmo.appendChild(o);
    }
  }
  await loadAccountingList();
  loadReceiptList();
}
async function loadAccountingList() {
  if (!SCRIPT_URL) return;
  const month = document.getElementById('acc-month-filter').value;
  const typeFilter = document.getElementById('acc-type-filter').value;
  const thisMonth = getCurrentMonth();
  const profitMonth = month || thisMonth;
  try {
    const listUrl = SCRIPT_URL + '?action=getAccountingRecords' + (month ? '&month=' + encodeURIComponent(month) : '') + (typeFilter ? '&type=' + encodeURIComponent(typeFilter) : '');
    const summaryUrl = SCRIPT_URL + '?action=getAccountingRecords&month=' + encodeURIComponent(thisMonth);
    const allUrl = SCRIPT_URL + '?action=getAccountingRecords';
    const accMonthUrl = SCRIPT_URL + '?action=getAccountingRecords&month=' + encodeURIComponent(profitMonth);
    const salesMonthUrl = SCRIPT_URL + '?action=getSalesRecords&month=' + encodeURIComponent(profitMonth);
    const [listRes, summaryRes, allRes, accMonthRes, salesMonthRes] = await Promise.all([fetch(listUrl), fetch(summaryUrl), fetch(allUrl), fetch(accMonthUrl), fetch(salesMonthUrl)]);
    const listData = await listRes.json();
    const summaryData = await summaryRes.json();
    const allData = allRes.ok ? await allRes.json() : { success: false };
    const accMonthData = accMonthRes.ok ? await accMonthRes.json() : { success: false };
    const salesMonthData = salesMonthRes.ok ? await salesMonthRes.json() : { success: false };
    accountingRecords = listData.success ? listData.records : [];
    const thisMonthRecords = summaryData.success ? summaryData.records : [];
    var accMonthRecords = accMonthData.success ? accMonthData.records : [];
    var salesMonthRecords = salesMonthData.success ? salesMonthData.records : [];
    let sm = 0, pm = 0;
    thisMonthRecords.forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === '매출') sm += amt;
      else if (r.type === '매입') pm += amt;
    });
    document.getElementById('acc-sales').textContent = fmt(sm) + '원';
    document.getElementById('acc-purchase').textContent = fmt(pm) + '원';
    document.getElementById('acc-profit').textContent = fmt(sm - pm) + '원';
    const thisYear = new Date().getFullYear().toString();
    let annualSales = 0, annualCost = 0;
    if (allData.success && allData.records) {
      allData.records.forEach(r => {
        const y = String(r.date || '').slice(0, 4);
        if (y !== thisYear) return;
        const amt = Number(r.amount) || 0;
        if (r.type === '매출') annualSales += amt;
        else if (r.type === '매입') annualCost += amt;
      });
    }
    const annualSalesEst = annualSales > 0 ? annualSales : sm * 12;
    const vatEst = calcSimplifiedVAT(annualSalesEst, getAccBusinessType());
    document.getElementById('acc-vat').textContent = fmt(vatEst) + '원 (연추정)';
    const limit = THRESHOLDS.limit;
    const remaining = Math.max(0, limit - annualSales);
    const progressPct = Math.min(100, (annualSales / limit) * 100);
    const elRem = document.getElementById('acc-remaining');
    const elProg = document.getElementById('acc-progress-pct');
    const elBar = document.getElementById('acc-progress-bar');
    const elStatus = document.getElementById('acc-status-msg');
    const elCompare = document.getElementById('acc-vat-compare');
    if (document.getElementById('acc-annual-sales')) document.getElementById('acc-annual-sales').textContent = fmt(annualSales) + '원';
    if (elRem) elRem.textContent = fmt(remaining) + '원 남음';
    if (elProg) elProg.textContent = progressPct.toFixed(1) + '%';
    if (elBar) { elBar.style.width = progressPct + '%'; }
    const status = checkVatStatus(annualSales);
    if (elStatus) { elStatus.textContent = status.message; if (status.action) elStatus.innerHTML += '<br><span style="font-size:11px;color:var(--warn)">' + status.action + '</span>'; }
    const compare = compareVatBenefit(annualSales, annualCost);
    if (elCompare) { elCompare.style.display = 'block'; elCompare.innerHTML = '💡 ' + compare.reason; }
    var totalSalesFromAcc = 0, totalPurchaseFromAcc = 0;
    accMonthRecords.forEach(function(r) {
      var amt = Number(r.amount) || 0;
      if (r.type === '매출') totalSalesFromAcc += amt; else if (r.type === '매입') totalPurchaseFromAcc += amt;
    });
    var totalSalesFromSales = salesMonthRecords.reduce(function(s, r) { return s + (Number(r.revenue) || 0); }, 0);
    var totalSales = totalSalesFromAcc + totalSalesFromSales;
    var totalPurchase = totalPurchaseFromAcc;
    var feeTotal = salesMonthRecords.reduce(function(s, r) { return s + (Number(r.feeAmt) || 0); }, 0);
    var shipTotal = 0;
    var opProfit = totalSales - totalPurchase - feeTotal - shipTotal;
    var vatAnnual = annualSalesEst > 0 ? calcSimplifiedVAT(annualSalesEst, getAccBusinessType()) : 0;
    var vatMonth = Math.round(vatAnnual / 12);
    var netProfit = opProfit - vatMonth;
    var profitPct = totalSales > 0 ? (netProfit / totalSales * 100) : 0;
    var elPs = document.getElementById('acc-profit-sales');
    var elPp = document.getElementById('acc-profit-purchase');
    var elPf = document.getElementById('acc-profit-fee');
    var elPsh = document.getElementById('acc-profit-ship');
    var elPo = document.getElementById('acc-profit-op');
    var elPv = document.getElementById('acc-profit-vat');
    var elPn = document.getElementById('acc-profit-net');
    var elPpct = document.getElementById('acc-profit-pct');
    if (elPs) elPs.textContent = '+ ' + fmt(totalSales) + '원';
    if (elPp) elPp.textContent = '- ' + fmt(totalPurchase) + '원';
    if (elPf) elPf.textContent = '- ' + fmt(feeTotal) + '원';
    if (elPsh) elPsh.textContent = '- ' + fmt(shipTotal) + '원';
    if (elPo) elPo.textContent = fmt(opProfit) + '원';
    if (elPv) elPv.textContent = '- ' + fmt(vatMonth) + '원';
    if (elPn) elPn.textContent = '= ' + fmt(netProfit) + '원 🏆';
    if (elPpct) elPpct.textContent = profitPct.toFixed(1) + '%';
  } catch (e) { accountingRecords = []; }
  const empty = document.getElementById('acc-empty');
  const rows = document.getElementById('acc-rows');
  if (accountingRecords.length === 0) {
    empty.style.display = 'block';
    rows.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  rows.style.display = 'block';
  rows.innerHTML = accountingRecords.map(r => {
    const amt = Number(r.amount) || 0;
    const isSale = r.type === '매출';
    return `<div class="mp-row" style="padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;color:var(--text-muted)">${String(r.date).slice(0,10)}</span>
      <span style="font-weight:600">${r.type}</span>
      <span>${r.partner || ''} ${r.item || ''}</span>
      <span style="color:${isSale?'var(--accent)':'var(--warn)'};font-family:'DM Mono',monospace">${isSale ? '+' : '-'}${fmt(amt)}원</span>
    </div>`;
  }).join('');
}
async function saveAccountingEntry() {
  if (!SCRIPT_URL) { showToast('설정에서 Apps Script URL을 입력하세요', true); return; }
  const date = document.getElementById('acc-date').value;
  const type = document.getElementById('acc-type').value;
  const amount = parseFloat(document.getElementById('acc-amount').value) || 0;
  if (!date || amount <= 0) { showToast('날짜와 금액을 입력하세요', true); return; }
  showLoading(true);
  try {
    const data = await fetchSheetApi(SCRIPT_URL, 'saveAccountingRecord', { record: {
          date: date, type: type, partner: document.getElementById('acc-partner').value.trim(),
          item: document.getElementById('acc-item').value.trim(), amount: amount, tax: 0,
          evidenceType: document.getElementById('acc-evidence').value, memo: document.getElementById('acc-memo').value.trim()
        } });
    if (data.success) {
      showToast('거래 저장 완료');
      document.getElementById('acc-amount').value = '';
      document.getElementById('acc-partner').value = '';
      document.getElementById('acc-item').value = '';
      document.getElementById('acc-memo').value = '';
      loadAccountingList();
    } else showToast('저장 실패', true);
  } catch (e) { showToast('저장 중 오류', true); }
  showLoading(false);
}
function exportAccountingCSV() {
  if (accountingRecords.length === 0) { showToast('내보낼 거래가 없습니다', true); return; }
  const headers = ['날짜','구분','거래처','품목','공급가액','세액','합계','증빙유형','메모'];
  const rows = accountingRecords.map(r => [r.date, r.type, r.partner || '', r.item || '', r.amount || 0, r.tax || 0, r.total || r.amount || 0, r.evidenceType || '', r.memo || '']);
  const csv = [headers, ...rows].map(arr => arr.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '매입매출_' + (document.getElementById('acc-month-filter').value || getCurrentMonth()) + '.csv';
  a.click();
  showToast('CSV 다운로드 완료');
}

// ==================== 증빙서류 ====================
const TYPE_FOLDER = { '카드영수증': '카드영수증', '현금영수증': '현금영수증', '세금계산서': '세금계산서', '간이영수증': '간이영수증', '거래명세서': '거래명세서', '기타': '기타증빙' };
const RECEIPT_TYPE_ICON = { '카드영수증': '💳', '현금영수증': '🧾', '세금계산서': '📄', '간이영수증': '📋', '거래명세서': '📑', '기타': '📂' };
let _receiptFile = null;
let _receiptType = '';

function updateReceiptSaveButton() {
  const date = (document.getElementById('receipt-date') && document.getElementById('receipt-date').value) || '';
  const amount = (document.getElementById('receipt-amount') && document.getElementById('receipt-amount').value) || '';
  const vendor = (document.getElementById('receipt-vendor') && document.getElementById('receipt-vendor').value) || '';
  const btn = document.getElementById('receipt-save-btn');
  if (btn) btn.disabled = !_receiptType || !_receiptFile || !date || !amount.trim() || !vendor.trim();
}
function setReceiptType(type, btn) {
  if (_receiptType === type) {
    _receiptType = '';
    document.querySelectorAll('.receipt-type-btn').forEach(b => b.classList.remove('active'));
  } else {
    _receiptType = type;
    document.querySelectorAll('.receipt-type-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  updateReceiptSaveButton();
}
function onReceiptFileChange(input) {
  const file = input && input.files && input.files[0];
  _receiptFile = file || null;
  const preview = document.getElementById('receipt-preview');
  preview.innerHTML = '';
  if (file) {
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = '미리보기';
      preview.appendChild(img);
    } else {
      preview.textContent = '📄 ' + file.name;
    }
  }
  updateReceiptSaveButton();
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const s = reader.result; resolve(s && s.indexOf(',') >= 0 ? s.split(',')[1] : s); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function saveReceiptUpload() {
  if (!SCRIPT_URL) { showToast('설정에서 Apps Script URL을 입력하세요', true); return; }
  if (!_receiptFile || !_receiptType) { showToast('서류 종류와 파일을 선택하세요', true); return; }
  const dateEl = document.getElementById('receipt-date');
  const amountEl = document.getElementById('receipt-amount');
  const vendorEl = document.getElementById('receipt-vendor');
  const date = (dateEl && dateEl.value) || new Date().toISOString().slice(0, 10);
  const amount = parseInt(amountEl && amountEl.value, 10) || 0;
  const vendor = (vendorEl && vendorEl.value) || '미입력';
  if (!amount) { showToast('금액을 입력하세요', true); return; }
  const ext = _receiptFile.name.split('.').pop() || 'jpg';
  const fileName = date.replace(/-/g, '') + '__' + vendor + '__' + (TYPE_FOLDER[_receiptType] || _receiptType) + '__' + amount + '원.' + ext;
  const year = date.substring(0, 4);
  const month = date.substring(5, 7);
  const folderPath = '셀러마진/' + year + '년/' + month + '월/' + (TYPE_FOLDER[_receiptType] || '기타증빙');
  var msgEl = document.getElementById('loading-message');
  if (msgEl) msgEl.textContent = '드라이브에 저장 중…';
  showLoading(true);
  try {
    const base64File = await fileToBase64(_receiptFile);
    const data = await fetchSheetApi(SCRIPT_URL, 'saveReceipt', { fileName: fileName,
        folderPath: folderPath,
        mimeType: _receiptFile.type,
        fileData: base64File,
        sheetData: {
          date: date,
          type: _receiptType,
          vendor: vendor,
          amount: amount,
          taxType: (document.getElementById('receipt-tax-type') && document.getElementById('receipt-tax-type').value) || '매입',
          item: (document.getElementById('receipt-item') && document.getElementById('receipt-item').value) || '',
          memo: (document.getElementById('receipt-memo') && document.getElementById('receipt-memo').value) || ''
        } });
    if (result.success) {
      showToast('✅ 저장 완료! 드라이브에 업로드됐습니다.');
      _receiptFile = null;
      _receiptType = '';
      document.getElementById('receipt-file').value = '';
      document.getElementById('receipt-preview').innerHTML = '';
      document.querySelectorAll('.receipt-type-btn').forEach(b => b.classList.remove('active'));
      if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
      if (amountEl) amountEl.value = '';
      if (vendorEl) vendorEl.value = '';
      var rt = document.getElementById('receipt-tax-type');
      var ri = document.getElementById('receipt-item');
      var rm = document.getElementById('receipt-memo');
      if (rt) rt.value = '매입';
      if (ri) ri.value = '';
      if (rm) rm.value = '';
      updateReceiptSaveButton();
      loadReceiptList();
    } else showToast(result.error || '저장 실패', true);
  } catch (e) {
    showToast('업로드 실패: ' + (e.message || ''), true);
  }
  if (msgEl) msgEl.textContent = '';
  showLoading(false);
}
let _receiptList = [];
async function loadReceiptList() {
  if (!SCRIPT_URL) return;
  const month = (document.getElementById('receipt-month-filter') && document.getElementById('receipt-month-filter').value) || getCurrentMonth();
  const typeFilter = document.getElementById('receipt-type-filter') && document.getElementById('receipt-type-filter').value;
  try {
    let url = SCRIPT_URL + '?action=getReceipts&month=' + encodeURIComponent(month);
    if (typeFilter) url += '&type=' + encodeURIComponent(typeFilter);
    const res = await fetch(url);
    const data = await res.json();
    _receiptList = (data.success && data.receipts) ? data.receipts : [];
  } catch (e) { _receiptList = []; }
  const tbody = document.getElementById('receipt-tbody');
  const empty = document.getElementById('receipt-empty');
  const summary = document.getElementById('receipt-summary');
  if (!tbody) return;
  if (_receiptList.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (summary) summary.textContent = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  const icon = (t) => RECEIPT_TYPE_ICON[t] || '📂';
  tbody.innerHTML = _receiptList.map(r => {
    const link = r.driveLink ? '<a href="' + escapeHtml(r.driveLink) + '" target="_blank" rel="noopener">🔗 보기</a>' : '—';
    const d = String(r.date || '').slice(0, 10);
    const shortDate = d.length >= 10 ? d.slice(5, 7) + '/' + d.slice(8, 10) : d;
    return '<tr><td>' + shortDate + '</td><td>' + icon(r.type) + (r.type || '') + '</td><td>' + escapeHtml(r.vendor || '') + '</td><td>' + fmt(r.amount || 0) + '원</td><td>' + link + '</td></tr>';
  }).join('');
  const sumBuy = _receiptList.filter(r => (r.taxType || '매입') === '매입').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const sumSell = _receiptList.filter(r => (r.taxType || '') === '매출').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  if (summary) summary.textContent = '합계: 매입 ' + fmt(sumBuy) + '원' + (sumSell > 0 ? ' / 매출 ' + fmt(sumSell) + '원' : '');
}
function exportReceiptsCSV() {
  if (_receiptList.length === 0) { showToast('내보낼 증빙이 없습니다', true); return; }
  const headers = ['날짜', '증빙종류', '거래처', '품목', '금액', '매입/매출', '메모', '파일링크', '등록일시'];
  const rows = _receiptList.map(r => [r.date, r.type, r.vendor || '', r.item || '', r.amount || 0, r.taxType || '매입', r.memo || '', r.driveLink || '', r.registeredAt || '']);
  const csv = [headers, ...rows].map(arr => arr.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '증빙서류_' + (document.getElementById('receipt-month-filter').value || getCurrentMonth()) + '.csv';
  a.click();
  showToast('CSV 다운로드 완료');
}
window.addEventListener('beforeunload', function(e) {
  if (_receiptFile && _receiptType) e.preventDefault();
});

// ==================== DELETE ====================
async function deleteProduct(id) {
  if (!confirm('이 상품을 삭제할까요?')) return;
  showLoading(true);
  try {
    const data = await fetchSheetApi(SCRIPT_URL, 'deleteProduct', { id });
    if (data.success) {
      showToast('삭제 완료');
      await loadProducts();
    }
  } catch(e) { showToast('삭제 실패', true); }
  showLoading(false);
}

async function clearAll() {
  if (!confirm('저장된 상품을 모두 삭제할까요?')) return;
  showLoading(true);
  try {
    const data = await fetchSheetApi(SCRIPT_URL, 'clearAll', {});
    if (data.success) {
      showToast('전체 삭제 완료');
      await loadProducts();
    }
  } catch(e) { showToast('오류 발생', true); }
  showLoading(false);
}

// ==================== STATS ====================
let _statsCharts = { monthly: null, doughnut: null, bar: null };
async function renderStats() {
  const n = products.length;
  const sellingCount = products.filter(p => String(p.sellDecision || 'N').toUpperCase() === 'Y' || p.sellDecision === true).length;
  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = n;
  const convEl = document.getElementById('stat-conversion');
  if (convEl) convEl.textContent = n > 0 ? (sellingCount / n * 100).toFixed(1) + '%' : '—';

  var perfMonthSel = document.getElementById('stats-perf-month');
  if (perfMonthSel && perfMonthSel.options.length <= 1) {
    var now = new Date();
    for (var mi = 1; mi <= 12; mi++) {
      var o = document.createElement('option');
      o.value = now.getFullYear() + '-' + String(mi).padStart(2, '0');
      o.textContent = now.getFullYear() + '년 ' + mi + '월';
      if (mi === now.getMonth() + 1) o.selected = true;
      perfMonthSel.appendChild(o);
    }
  }
  var perfMonth = (perfMonthSel && perfMonthSel.value) || (function(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); })();
  var perfSort = (document.getElementById('stats-perf-sort') && document.getElementById('stats-perf-sort').value) || 'profit-desc';
  var convDetail = document.getElementById('stats-conversion-detail');
  if (convDetail) {
    var soldProductIds = {};
    (salesRecords || []).forEach(function(r){ soldProductIds[String(r.productId || r.productName || '')] = true; });
    var soldCount = Object.keys(soldProductIds).length;
    var sourcingConv = n > 0 ? (sellingCount / n * 100).toFixed(1) : '0';
    var sellConv = sellingCount > 0 ? (soldCount / sellingCount * 100).toFixed(1) : '0';
    convDetail.innerHTML = `소싱목록 등록: <strong>${n}개</strong><br>판매 결정: <strong>${sellingCount}개</strong><br>실제 판매 발생: <strong>${soldCount}개</strong><br><br>소싱 전환율: <strong>${sourcingConv}%</strong><br>판매 전환율: <strong>${sellConv}%</strong>`;
  }

  if (n === 0) {
    ['stat-avg','stat-best-profit'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '—'; });
    const top5El = document.getElementById('top5-list'); if (top5El) top5El.innerHTML = '<div style="color:var(--text-muted);font-size:13px">저장된 상품이 없습니다</div>';
    const mktStatsEl = document.getElementById('market-stats'); if (mktStatsEl) mktStatsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">저장된 상품이 없습니다</div>';
    const be3 = document.getElementById('stat-best3'); if (be3) be3.innerHTML = '<div style="color:var(--text-muted);font-size:13px">판매 기록이 없습니다</div>';
    [_statsCharts.monthly, _statsCharts.doughnut, _statsCharts.bar].forEach(c => { if (c) c.destroy(); });
    _statsCharts = { monthly: null, doughnut: null, bar: null };
    return;
  }
  const avg = products.reduce((s,p) => s + parseFloat(p.margin), 0) / n;
  const bestP = Math.max(...products.map(p => parseInt(p.profit) || 0), 0);
  const avgEl = document.getElementById('stat-avg');
  if (avgEl) avgEl.textContent = fmtPct(avg);
  const bestEl = document.getElementById('stat-best-profit');
  if (bestEl) bestEl.textContent = fmt(bestP) + '원';
  salesRecords = appState.sales || []; // Ensure sync from appState
  let records = salesRecords;

  const monthMap = {};
  const marketRev = {};
  const marketProfit = {};
  const productProfit = {};
  const productRevenue = {};
  const productQty = {};
  records.forEach(r => {
    const ym = String(r.date || '').slice(0, 7);
    if (!monthMap[ym]) monthMap[ym] = { revenue: 0, profit: 0 };
    monthMap[ym].revenue += Number(r.revenue) || 0;
    monthMap[ym].profit += Number(r.profit) || 0;
    const rev = Number(r.revenue) || 0;
    const prof = Number(r.profit) || 0;
    const mk = r.market || '';
    marketRev[mk] = (marketRev[mk] || 0) + rev;
    marketProfit[mk] = (marketProfit[mk] || 0) + prof;
    const key = r.productName || r.productId || '';
    productProfit[key] = (productProfit[key] || 0) + prof;
    productRevenue[key] = (productRevenue[key] || 0) + rev;
    productQty[key] = (productQty[key] || 0) + (Number(r.quantity) || 0);
  });
  var catMargin = {};
  products.forEach(function(p){ var c = p.category || '기타'; if (!catMargin[c]) catMargin[c] = { sum: 0, cnt: 0 }; catMargin[c].sum += parseFloat(p.margin) || 0; catMargin[c].cnt++; });
  var monthRecords = records.filter(function(r){ return String(r.date || '').slice(0, 7) === perfMonth; });
  var monthProductProfit = {};
  var monthProductRevenue = {};
  var monthProductQty = {};
  monthRecords.forEach(function(r){
    var key = r.productName || r.productId || '';
    monthProductProfit[key] = (monthProductProfit[key] || 0) + (Number(r.profit) || 0);
    monthProductRevenue[key] = (monthProductRevenue[key] || 0) + (Number(r.revenue) || 0);
    monthProductQty[key] = (monthProductQty[key] || 0) + (Number(r.quantity) || 0);
  });
  var topProductsList = Object.entries(monthProductProfit).map(function(entry){
    var name = entry[0];
    var profit = entry[1];
    var rev = monthProductRevenue[name] || 0;
    var qty = monthProductQty[name] || 0;
    var margin = rev > 0 ? (profit / rev * 100) : 0;
    var p = products.find(function(x){ return String(x.id) === name || String(x.name) === name; });
    return { name: name, profit: profit, revenue: rev, qty: qty, margin: margin, market: p ? p.market : '', category: p ? p.category : '' };
  });
  if (perfSort === 'profit-desc') topProductsList.sort(function(a,b){ return b.profit - a.profit; });
  else if (perfSort === 'margin-desc') topProductsList.sort(function(a,b){ return b.margin - a.margin; });
  else if (perfSort === 'revenue-desc') topProductsList.sort(function(a,b){ return b.revenue - a.revenue; });
  var topProductsEl = document.getElementById('stats-top-products');
  if (topProductsEl) {
    if (topProductsList.length === 0) topProductsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">해당 월 판매 기록 없음</div>';
    else topProductsEl.innerHTML = `<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">🏆 TOP 상품</div>` + topProductsList.slice(0, 10).map(function(p, i){
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:600">${i+1}위 ${escapeHtml(p.name)}  순이익 ${fmt(p.profit)}원</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">판매 ${p.qty}개 / 마진율 ${p.margin.toFixed(1)}%</div>
        ${p.market || p.category ? `<div style="font-size:11px;color:var(--text-muted)">마켓: ${escapeHtml(p.market)} / 카테고리: ${escapeHtml(p.category)}</div>` : ''}
      </div>`;
    }).join('');
  }
  var weakList = products.filter(function(p){ return parseFloat(p.margin) < 5 && parseFloat(p.margin) >= 0; });
  var weakEl = document.getElementById('stats-weak-products');
  if (weakEl) {
    if (weakList.length === 0) weakEl.innerHTML = '';
    else weakEl.innerHTML = `<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">📉 부진 상품 (마진율 5% 미만)</div>` + weakList.slice(0, 5).map(function(p){
      return `<div style="font-size:13px;padding:6px 0">• ${escapeHtml(p.name)} (마진율 ${fmtPct(p.margin)}) → 재검토 필요</div>`;
    }).join('');
  }
  var marketMarginEl = document.getElementById('stats-market-margin');
  if (marketMarginEl) {
    var marketEntries = Object.keys(marketRev).map(function(mk){
      var rev = marketRev[mk] || 0;
      var prof = marketProfit[mk] || 0;
      var margin = rev > 0 ? (prof / rev * 100) : 0;
      return { market: mk, margin: margin };
    }).sort(function(a,b){ return b.margin - a.margin; });
    if (marketEntries.length === 0) marketMarginEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">데이터 없음</div>';
    else marketMarginEl.innerHTML = marketEntries.map(function(m){
      var w = Math.min(100, Math.max(0, m.margin));
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>${escapeHtml(m.market)}</span>
          <span>${m.margin.toFixed(1)}% 평균</span>
        </div>
        <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${w}%;background:var(--accent);border-radius:4px"></div>
        </div>
      </div>`;
    }).join('');
  }
  var catMarginEl = document.getElementById('stats-category-margin');
  if (catMarginEl) {
    var catEntries = Object.keys(catMargin).map(function(c){ return { cat: c, avg: catMargin[c].sum / catMargin[c].cnt }; }).sort(function(a,b){ return b.avg - a.avg; });
    if (catEntries.length === 0) catMarginEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">데이터 없음</div>';
    else catMarginEl.innerHTML = catEntries.map(function(c){
      var w = Math.min(100, Math.max(0, c.avg));
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <span>${escapeHtml(c.cat)}</span>
          <span>${c.avg.toFixed(1)}%</span>
        </div>
        <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${w}%;background:var(--accent);border-radius:3px"></div>
        </div>
      </div>`;
    }).join('');
  }

  const sortedMonths = Object.keys(monthMap).sort();
  if (typeof Chart !== 'undefined') {
    const grid = { color: '#2a2d35' };
    const text = '#94a3b8';
    if (_statsCharts.monthly) _statsCharts.monthly.destroy();
    const ctxMonthly = document.getElementById('chart-monthly');
    if (ctxMonthly) {
      _statsCharts.monthly = new Chart(ctxMonthly, {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [
            { label: '매출', data: sortedMonths.map(m => monthMap[m].revenue), borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', fill: true, tension: 0.3 },
            { label: '순이익', data: sortedMonths.map(m => monthMap[m].profit), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.3 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: text } } }, scales: { x: { ticks: { color: text }, grid }, y: { ticks: { color: text }, grid } } }
      });
    }
    if (_statsCharts.doughnut) _statsCharts.doughnut.destroy();
    const ctxDoughnut = document.getElementById('chart-market-doughnut');
    if (ctxDoughnut && Object.keys(marketRev).length) {
      const colors = ['#03c75a','#ff6900','#ff0000','#ff6600','#8b0085','#ff4500','#fee500','#a78bfa'];
      _statsCharts.doughnut = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: { labels: Object.keys(marketRev), datasets: [{ data: Object.values(marketRev), backgroundColor: colors.slice(0, Object.keys(marketRev).length) }] },
        options: { responsive: true, plugins: { legend: { labels: { color: text } } } }
      });
    }
    if (_statsCharts.bar) _statsCharts.bar.destroy();
    const ctxBar = document.getElementById('chart-category-bar');
    const catLabels = Object.keys(catMargin);
    if (ctxBar && catLabels.length) {
      const avgMargins = catLabels.map(c => (catMargin[c].sum / catMargin[c].cnt).toFixed(1));
      _statsCharts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: catLabels, datasets: [{ label: '평균 마진율(%)', data: avgMargins, backgroundColor: 'rgba(74,222,128,0.6)' }] },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: text }, grid }, y: { ticks: { color: text }, grid } } }
      });
    }
  }

  const best3 = Object.entries(productProfit).sort((a,b) => b[1] - a[1]).slice(0, 3);
  const be3 = document.getElementById('stat-best3');
  if (be3) be3.innerHTML = best3.length ? best3.map(([name, profit], i) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${i+1}.</span> ${escapeHtml(name)} <strong style="color:var(--accent)">${fmt(profit)}원</strong></div>`).join('') : '<div style="color:var(--text-muted);font-size:13px">판매 기록이 없습니다</div>';

  const top5 = [...products].sort((a,b) => parseFloat(b.margin) - parseFloat(a.margin)).slice(0,5);
  document.getElementById('top5-list').innerHTML = top5.map((p,i) => {
    const bc = parseFloat(p.margin) >= 20 ? 'badge-good' : 'badge-warn';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text-muted)">${i+1}</span>
        <div><div style="font-weight:600;font-size:13px">${escapeHtml(p.name)}</div><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(p.market)}</div></div>
      </div>
      <span class="margin-badge ${bc}">${fmtPct(p.margin)}</span>
    </div>`;
  }).join('');

  // T4 Finance 연동 (재배치된 차트들)
  const ctxFinanceTrend = document.getElementById('chart-sales-trend');
  if (ctxFinanceTrend && sortedMonths.length) {
      if (_statsCharts.financeTrend) _statsCharts.financeTrend.destroy();
      _statsCharts.financeTrend = new Chart(ctxFinanceTrend, {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [
            { label: '매출', data: sortedMonths.map(m => monthMap[m].revenue), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 },
            { label: '순이익', data: sortedMonths.map(m => monthMap[m].profit), borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', fill: true, tension: 0.3 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }
      });
  }

  // T1 소싱 성과 UI 바인딩 (이관된 데이터)
  const sourcingPerfEl = document.getElementById('stats-top-products');
  if (sourcingPerfEl) {
      sourcingPerfEl.innerHTML = topProductsList.slice(0, 5).map(p => `
          <div style="font-size:11px; margin-bottom:4px;">
              <span style="color:var(--accent)">${p.margin.toFixed(1)}%</span> - ${p.name.slice(0,10)}
          </div>
      `).join('');
  }
}

// ==================== T7: 동적 플랫폼 및 보안 설정 로직 ====================
function showAddPlatformModal() { document.getElementById('add-platform-modal').style.display = 'flex'; }
function hideAddPlatformModal() { document.getElementById('add-platform-modal').style.display = 'none'; }

function addPlatform() {
    const name = document.getElementById('new-plat-name').value;
    const type = document.getElementById('new-plat-type').value;
    const url = document.getElementById('new-plat-url').value;
    if(!name) return showToast('이름을 입력하세요', true);

    let platforms = JSON.parse(localStorage.getItem('v5_dynamic_platforms') || '[]');
    platforms.push({ id: 'PLAT_'+Date.now(), name, type, url });
    localStorage.setItem('v5_dynamic_platforms', JSON.stringify(platforms));
    renderPlatforms();
    hideAddPlatformModal();
    showToast('새 플랫폼이 추가되었습니다.');
}

function renderPlatforms() {
    const container = document.getElementById('platform-dynamic-list');
    if(!container) return;
    const platforms = JSON.parse(localStorage.getItem('v5_dynamic_platforms') || '[]');
    container.innerHTML = platforms.map(p => `
        <div class="market-toggle active" style="border-color:var(--accent2); color:var(--accent2);">
            <div class="market-dot" style="background:var(--accent2)"></div>
            <span>${p.name} (${p.type})</span>
            <button onclick="deletePlatform('${p.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:10px; margin-left:8px;">✕</button>
        </div>
    `).join('');
}

function deletePlatform(id) {
    let platforms = JSON.parse(localStorage.getItem('v5_dynamic_platforms') || '[]');
    platforms = platforms.filter(p => p.id !== id);
    localStorage.setItem('v5_dynamic_platforms', JSON.stringify(platforms));
    renderPlatforms();
}

function saveSecuritySettings() {
    const emails = document.getElementById('allowed-emails-config').value;
    const pin = document.getElementById('master-pin-config').value;
    localStorage.setItem('allowed-emails-config', emails);
    localStorage.setItem('master-pin-config', pin || '0000');
    showToast('보안 설정이 저장되었습니다.');
}

// ==================== T1: Landed Cost & AI Logs ====================
function calculateLandedCost(wholesalePrice, shipFee = 3000, tariff = 0, vat = 0) {
    // Landed Cost = 도매가 + 배송비 + 관세 + 부가세(매입)
    return Math.floor(wholesalePrice + shipFee + (wholesalePrice * (tariff/100)) + (wholesalePrice * (vat/100)));
}

function renderV6SourcingLogs(candidate) {
    const container = document.getElementById('stats-conversion-detail'); // AI 로그 표시 영역으로 활용
    if(!container) return;
    container.innerHTML = `
        <div style="background:var(--surface3); padding:10px; border-radius:8px; border-left:3px solid var(--accent);">
            <div style="font-weight:700; color:var(--accent); font-size:12px; margin-bottom:5px;">🧩 AI Sourcing Insights</div>
            <div style="font-size:11px; color:var(--text);">분석 키워드: ${candidate.keyword}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                • Landed Cost 기반 마진율 15% 이상 검증됨<br>
                • 도매처 대조: 도매꾹, 온채널 데이터 동기화 완료<br>
                • 예상 순이익: 15% (Landed Cost 대비)
            </div>
        </div>
    `;
}

// ==================== 시즌 캘린더 ====================
async function loadSeasonPage() {
  const sel = document.getElementById('season-year-month');
  if (sel && sel.options.length <= 1) {
    const y = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = y + '년 ' + m + '월';
      if (m === new Date().getMonth() + 1) o.selected = true;
      sel.appendChild(o);
    }
  }
  const month = (sel && sel.value) ? parseInt(sel.value, 10) : (new Date().getMonth() + 1);
  const label = document.getElementById('season-month-label');
  if (label) label.textContent = '이번달 (' + month + '월) 추천 카테고리';

  const base = getBackendUrl();
  const container = document.getElementById('season-keywords-container');
  const barsEl = document.getElementById('season-calendar-bars');
  if (!container) return;

  const seasonData = {
    1: [{ keyword: "설날 선물세트", season: "성수기" }, { keyword: "겨울방학 간식", season: "성수기" }, { keyword: "방한용품", season: "보통" }],
    2: [{ keyword: "발렌타인데이 초콜릿", season: "성수기" }, { keyword: "졸업식 꽃다발", season: "성수기" }, { keyword: "입학 선물", season: "보통" }],
    3: [{ keyword: "신학기 준비물", season: "성수기" }, { keyword: "화이트데이 사탕", season: "성수기" }, { keyword: "봄옷 가디건", season: "보통" }],
    4: [{ keyword: "봄나들이 돗자리", season: "성수기" }, { keyword: "결혼식 원피스", season: "성수기" }, { keyword: "이사청소 용품", season: "보통" }],
    5: [{ keyword: "어버이날 카네이션", season: "성수기" }, { keyword: "어린이날 장난감", season: "성수기" }, { keyword: "스승의날 선물", season: "보통" }],
    6: [{ keyword: "여름옷 반팔티", season: "성수기" }, { keyword: "장마철 제습기", season: "보통" }, { keyword: "호국보훈 태극기", season: "비수기" }],
    7: [{ keyword: "바캉스 수영복", season: "성수기" }, { keyword: "여름휴가 캠핑용품", season: "성수기" }, { keyword: "초복 삼계탕", season: "보통" }],
    8: [{ keyword: "추석/명절 준비", season: "성수기" }, { keyword: "여름휴가 마무리", season: "보통" }, { keyword: "광복절 태극기", season: "비수기" }],
    9: [{ keyword: "가을옷 트렌치코트", season: "성수기" }, { keyword: "추석 선물세트", season: "성수기" }, { keyword: "벌초/성묘 용품", season: "보통" }],
    10: [{ keyword: "할로윈 코스튬", season: "성수기" }, { keyword: "가을단풍 등산복", season: "성수기" }, { keyword: "개천절 태극기", season: "비수기" }],
    11: [{ keyword: "빼빼로데이 기획", season: "성수기" }, { keyword: "블랙프라이데이", season: "성수기" }, { keyword: "김장 매트", season: "보통" }],
    12: [{ keyword: "크리스마스 트리", season: "성수기" }, { keyword: "연말 파티용품", season: "성수기" }, { keyword: "겨울 방한복", season: "성수기" }]
  };

  const keywords = seasonData[month] || [];
  const bySeason = { '성수기': [], '보통': [], '비수기': [] };
  keywords.forEach(k => {
    const s = k.season || '보통';
    if (bySeason[s]) bySeason[s].push(k);
  });

  let html = '';
  ['성수기', '보통', '비수기'].forEach(season => {
    const items = bySeason[season];
    if (!items || !items.length) return;
    const icon = season === '성수기' ? '🟢' : season === '보통' ? '🟡' : '🔴';
    html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">' + icon + ' ' + season + '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">';
    items.forEach(k => {
      html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:background 0.2s" onclick="document.getElementById('productName').value='${escapeHtml(k.keyword)}'; document.getElementById('btn-market-search').click();" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='var(--surface2)'">`;
      html += '<div style="font-size:13px;font-weight:600;color:var(--text)">' + escapeHtml(k.keyword) + '</div>';
      html += '<div style="font-size:11px;color:var(--accent);margin-top:4px">🔍 시중가 검색</div>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  container.innerHTML = html || '<div style="color:var(--text-muted)">키워드 없음</div>';

  if (barsEl) {
    const samples = ['핫팩', '선풍기', '우산'];
    barsEl.innerHTML = '<div style="margin-bottom:6px">1 2 3 4 5 6 7 8 9 10 11 12 (월)</div>' + samples.map(name => {
      let bar = '';
      for (let m = 1; m <= 12; m++) bar += m >= 10 && m <= 12 && name === '핫팩' ? '▓' : (m >= 6 && m <= 8 && name === '선풍기') ? '▓' : (m >= 5 && m <= 7 && name === '우산') ? '▓' : '░';
      return '<div style="margin-bottom:4px"><span style="display:inline-block;width:50px">' + name + '</span> ' + bar + '</div>';
    }).join('');
  }
}

// ==================== SETUP ====================
function saveScriptUrl() {
  const url = document.getElementById('script-url-input').value.trim();
  if (!url.includes('script.google.com')) { showToast('올바른 URL을 입력하세요', true); return; }
  SCRIPT_URL = url;
  localStorage.setItem('script-url', url);
  const badge = document.getElementById('sheet-status-badge');
  const sheetEl = document.getElementById('display-sheet-id');
  showToast('URL 저장 완료! 연결 테스트 중...');

  // ★ loadProducts 결과에 따라 패널 + 상단 동기화
  loadProducts().then(() => {
    // loadProducts 내부에서 setSyncStatus('synced'/'error')가 호출됨
    // 패널 뱃지도 상단과 동기화
    const syncLabel = document.getElementById('sync-label');
    const isOk = syncLabel && syncLabel.textContent.includes('완료');
    if (badge) {
      badge.textContent = isOk ? '연결됨' : '연결 실패';
      badge.style.background = isOk ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)';
    }
    if (sheetEl && isOk) sheetEl.textContent = typeof SHEET_ID !== 'undefined' ? SHEET_ID : '';
  }).catch(() => {
    if (badge) { badge.textContent = '연결 실패'; badge.style.background = 'var(--danger, #ef4444)'; }
  });
}

function runFullInit() {
  if (!SCRIPT_URL) { showToast('Step 3에서 Apps Script URL을 먼저 저장하세요', true); return; }
  var resultEl = document.getElementById('full-init-result');
  if (resultEl) { resultEl.style.display = 'none'; resultEl.textContent = ''; }
  showLoading(true);
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'runFullInit' }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showLoading(false);
      if (data.success) {
        var msg = '✅ 전체 초기화 완료\n\n📊 구글 시트 탭: ' + (data.sheets && data.sheets.length ? data.sheets.join(', ') + ' 생성' : '기존 유지') + '\n📁 구글 드라이브: ' + (data.drive && data.drive.path ? data.drive.path : '셀러마진 폴더 구조 확인');
        showToast('전체 초기화 완료');
        if (resultEl) { resultEl.textContent = msg; resultEl.style.display = 'block'; }
      } else {
        showToast(data.error || '초기화 실패', true);
        if (resultEl) { resultEl.textContent = '❌ ' + (data.error || '실패'); resultEl.style.display = 'block'; }
      }
    })
    .catch(function() {
      showLoading(false);
      showToast('요청 실패', true);
      if (resultEl) { resultEl.textContent = '❌ 요청 실패'; resultEl.style.display = 'block'; }
    });
}

function copyScript() {
  let code = '';

  // ★ 1순위: 외부 apps-script-code.gs 파일 (항상 최신)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'apps-script-code.gs', false);
    xhr.send();
    if (xhr.status === 200 && xhr.responseText.trim()) code = xhr.responseText.trim();
  } catch(e) { /* 파일 없음 무시 — 폴백으로 */ }

  // 2순위: HTML 내장 스크립트 (폴백)
  if (!code) {
    const embedded = document.getElementById('embedded-apps-script');
    if (embedded) code = embedded.textContent.trim();
  }

  if (!code) {
    showToast('❌ 복사할 Apps Script 코드가 없습니다. apps-script-code.gs 파일을 확인하세요.', true);
    return;
  }

  navigator.clipboard.writeText(code)
    .then(() => showToast('✅ Apps Script 코드 복사 완료! 구글 Apps Script 에디터에 붙여넣기하세요.'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✅ Apps Script 코드 복사 완료! (폴백 방식)');
    });
}

/** 개인 PIN 저장 (이메일별) */
function savePersonalPin() {
  const pin = document.getElementById('master-pin-config-T7').value.trim();
  if (!pin || pin.length !== 4) { showToast('4자리 PIN을 입력하세요', true); return; }
  const email = (window._userEmail || '').toLowerCase().trim();
  if (!email) { showToast('로그인 후 설정 가능합니다', true); return; }
  localStorage.setItem('pin-' + email, pin);
  // 기존 공용 PIN도 함께 업데이트 (호환성)
  localStorage.setItem('master-pin-config', pin);
  document.getElementById('master-pin-config-T7').value = '';
  showToast('🔑 ' + (window.currentUser || email) + '의 개인 PIN이 저장되었습니다.');
}

function saveEmails() {
  const e1 = document.getElementById('email-1-input').value.trim().toLowerCase();
  const e2 = document.getElementById('email-2-input').value.trim().toLowerCase();
  if (!e1 || !e2) { showToast('이메일 두 개를 모두 입력해주세요', true); return; }
  if (!e1.includes('@') || !e2.includes('@')) { showToast('올바른 이메일 형식을 입력해주세요', true); return; }
  localStorage.setItem('allowed-email-1', e1);
  localStorage.setItem('allowed-email-2', e2);
  // V6.0 Access Control 동기화
  const existing = (localStorage.getItem('allowed-emails-config') || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!existing.includes(e1)) existing.push(e1);
  if (!existing.includes(e2)) existing.push(e2);
  localStorage.setItem('allowed-emails-config', existing.join(', '));
  showToast('✅ 이메일 저장 완료! 다음 로그인부터 적용됩니다');
}

// ==================== EXPORT ====================
function exportCSV() {
  if (products.length === 0) { showToast('저장된 상품이 없습니다', true); return; }
  const headers = ['상품명','원가','도매배송비','마켓배송비','마켓','수수료(%)','판매가','수수료금액','순이익','마진율(%)','저장일시','저장자'];
  const rows = products.map(p => [p.name,p.cost,p.supShip,p.mktShip,p.market,p.fee,p.salePrice,p.feeAmt,p.profit,p.margin,p.savedAt,p.savedBy]);
  const csv = [headers,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `마진계산_${new Date().toLocaleDateString('ko-KR').replace(/\./g,'')}.csv`;
  a.click();
  showToast('📥 CSV 다운로드 완료');
}

// ==================== UI HELPERS ====================
function showLoading(show) { document.getElementById('loading').classList.toggle('show', show); }

let toastTimer;
// showToast: ui-helpers.js의 동적 DOM 방식이 이미 로드되면 덮어쓰지 않음
if (typeof window.showToast !== 'function') {
  window.showToast = function showToast(msg, err) {
    const t = document.getElementById('toast');
    if (!t) { console.warn('[Toast] #toast element not found'); return; }
    t.textContent = msg;
    t.style.borderColor = err ? 'var(--danger)' : 'var(--accent)';
    t.style.color = err ? 'var(--danger)' : 'var(--accent)';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
  };
}


document.addEventListener('keydown', e => { if(e.key==='Enter'&&e.target.tagName==='INPUT') calculate(); });

// ===== Phase 3: Pipeline Data and UI Integration (T1 -> T2) ===== //

let _keywordTimer = null;

/**
 * 2. 연관 검색어 익스팬더 (Debounce 적용)
 * 상품명 입력 시 0.5초 대기 후 연관 키워드를 하단에 뿌려줍니다.
 */
window.scheduleRelatedKeywords = function() {
    clearTimeout(_keywordTimer);
    _keywordTimer = setTimeout(() => {
        const query = document.getElementById('productName')?.value.trim();
        const container = document.getElementById('related-keywords');
        if (!query || !container) {
            if (container) container.innerHTML = '';
            return;
        }

        container.innerHTML = '<span style="font-size:11px; color:var(--text-muted)">연관 키워드 추출 중...</span>';

        // T1: 연관 검색어 표시 (Mock)
        let keywords = [`${query} 추천`, `${query} 가성비`, `대용량 ${query}`, `${query} 세트`];
        container.innerHTML = keywords.slice(0, 8).map(kw =>
            `<button class="inline-btn" style="background:var(--surface); border:1px solid var(--border); border-radius:12px; font-size:11px; padding:4px 8px; color:var(--text-muted); font-weight:normal;" onclick="document.getElementById('productName').value='${kw}'; scheduleRelatedKeywords();">${kw}</button>`
        ).join('');
    }, 500);
}

/**
 * 1. 30구역 시장 시세 그리드 연동 시스템
 */
window.fetchMarketPrice = function() {
    const query = document.getElementById('productName')?.value.trim();
    if (!query) {
        if(typeof showToast === 'function') showToast('상품명을 먼저 입력하세요.', true);
        return;
    }

    const priceBox = document.getElementById('market-price-box');
    const productsSection = document.getElementById('mp-products-section');

    document.getElementById('mp-min').textContent = '조회 중...';
    document.getElementById('mp-avg').textContent = '조회 중...';
    document.getElementById('mp-max').textContent = '조회 중...';

    const grids = ['grid-lowest', 'grid-average', 'grid-highest'];
    grids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0;"><div class="spinner" style="margin:0 auto 8px; width:16px; height:16px;"></div>불러오는 중...</div>';
    });

    if(priceBox) priceBox.style.display = 'block';
    if(productsSection) productsSection.style.display = 'block';

    // 시장 가격 분석 — API 연동 전 placeholder
    setTimeout(() => {
        document.getElementById('mp-min').innerHTML = '<span style="color:var(--text-muted);font-size:11px">검색 후 표시</span>';
        document.getElementById('mp-avg').innerHTML = '<span style="color:var(--text-muted);font-size:11px">검색 후 표시</span>';
        document.getElementById('mp-max').innerHTML = '<span style="color:var(--text-muted);font-size:11px">검색 후 표시</span>';

        document.getElementById('mp-sellers').textContent = '-';
        document.getElementById('mp-competition').innerHTML = '<span style="color:var(--text-muted)">-</span>';
        document.getElementById('mp-ai-score').innerHTML = '<span style="color:var(--text-muted)">-</span>';

        const grids2 = ['grid-lowest', 'grid-average', 'grid-highest'];
        grids2.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0;">네이버 쇼핑 API 연동 후 표시됩니다</div>';
        });
    }, 800);
}

function _renderGridColumn(elementId, items, color) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (items.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0;">데이터 없음</div>';
        return;
    }
    el.innerHTML = items.map(item => `
        <div class="mp-product-card" style="padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--surface); cursor:pointer; transition:all 0.2s;" onclick="_selectMarketItem(this, '${item.title.replace(/'/g, "\\'")}', ${item.price})">
            <div style="font-size:11px; font-weight:800; color:${color}; margin-bottom:4px;">${fmt(item.price)}원</div>
            <div style="font-size:10px; font-weight:500; color:var(--text); line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${item.title.replace(/<[^>]*>?/gm, '')}</div>
            <div style="font-size:9px; color:var(--text-muted); margin-top:4px;">${item.mallName || '네이버쇼핑'}</div>
        </div>
    `).join('');
}

window._selectedMarketItem = null;
window._selectMarketItem = function(cardEl, title, price) {
    window._selectedMarketItem = { title, price };
    if(typeof showToast === 'function') showToast(`'${title}' (${fmt(price)}원) 이(가) 선택되었습니다. [사입 전환] 버튼을 눌러 T2로 전송하세요.`);
    document.querySelectorAll('.mp-product-card').forEach(c => c.style.borderColor = 'var(--border)');
    cardEl.style.borderColor = 'var(--accent2)';
}

/**
 * 3. T1 -> T2 데이터 전송 브릿지
 */
window.sendToInventory = function() {
    const query = document.getElementById('productName')?.value.trim();
    if (!query) {
        if(typeof showToast === 'function') showToast('먼저 상품을 검색해 주세요.', true);
        return;
    }

    let targetPrice = document.getElementById('mp-avg')?.textContent.replace(/[^0-9]/g, '');
    let targetName = query;

    if (window._selectedMarketItem) {
        targetPrice = window._selectedMarketItem.price;
        targetName = window._selectedMarketItem.title;
    }

    let standardData = typeof ProductAdapter !== 'undefined'
        ? ProductAdapter.fromManualInput({ name: targetName, price: Number(targetPrice || 0), isGlobal: false })
        : { name: targetName, selling_price: Number(targetPrice || 0) };

    if (typeof showTab === 'function') showTab('inventory');

    setTimeout(() => {
        const titleInput = document.getElementById('inventory-item-name');
        if (titleInput) titleInput.value = standardData.name;

        const priceInput = document.getElementById('direct-unit-price');
        if (priceInput) priceInput.value = standardData.selling_price;

        if(typeof showToast === 'function') showToast('✨ T1 소싱 데이터가 사입 장부(T2)로 안전하게 복사되었습니다.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
}

// _generateMockMarketData 삭제됨 (V5.5 — 실 API 전용)


/**
 * Phase 4: 글로벌 소싱 계산기 엔진
 */
window.updateGlobalLandingCost = function() {
    const cny = Number(document.getElementById('global-cny-price')?.value) || 0;
    const rate = Number(document.getElementById('global-exchange-rate')?.value) || 195;
    const tariff = Number(document.getElementById('global-tariff')?.value) || 0;
    const shipping = Number(document.getElementById('global-shipping')?.value) || 0;

    // 공식: (원본가 * 환율) * (1 + 관세율) + 해외배송비
    const landed = Math.floor((cny * rate) * (1 + tariff / 100) + shipping);

    const el = document.getElementById('global-landing-cost');
    if (el) el.textContent = (landed > 0 ? fmt(landed) : '0') + ' 원';

    window._lastCalculatedGlobalCost = landed;
};

window.applyGlobalCost = function() {
    if (!window._lastCalculatedGlobalCost) {
        if(typeof showToast === 'function') showToast('계산된 원가가 없습니다.', true);
        return;
    }
    const priceInput = document.getElementById('direct-unit-price');
    if (priceInput) {
        priceInput.value = window._lastCalculatedGlobalCost;
        if(typeof showToast === 'function') showToast('랜딩 원가가 상품 단가에 적용되었습니다.');
    }
};

/**
 * Phase 4: 사입 데이터 저장 (LWW 지원)
 */


/**
 * Phase 5: 재무 인사이트 대시보드 (T4) 로직
 */
// ==================== C-5: 재무 인사이트 (Finance) ====================
let _financeCharts = { trend: null, market: null };

function initFinanceCharts() {
  const ctxTrend = document.getElementById('chart-sales-trend');
  const ctxMarket = document.getElementById('chart-market-share');

  if (ctxTrend && !_financeCharts.trend) {
    _financeCharts.trend = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: '매출', data: [], borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', fill: true, tension: 0.4 },
          { label: '순이익', data: [], borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true, color: '#94a3b8' } } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  if (ctxMarket && !_financeCharts.market) {
    _financeCharts.market = new Chart(ctxMarket, {
      type: 'doughnut',
      data: {
        labels: ['스마트스토어', '쿠팡', '기타'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: ['#00c73c', '#ff6b6b', '#38bdf8'],
          borderWidth: 2,
          borderColor: '#161920'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 25, color: '#94a3b8', usePointStyle: true } }
        }
      }
    });
  }
}

async function updateFinanceDashboard() {
  if (!_financeCharts.trend) initFinanceCharts();

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const salesData = appState.sales || [];

  // 1. 트렌드 데이터 업데이트
  const trendData = months.map(m => {
    let rev = 0, prof = 0;
    salesData.forEach(s => {
      if (String(s.date).startsWith(m)) {
        rev += Number(s.revenue) || 0;
        prof += Number(s.profit) || 0;
      }
    });
    return { rev, prof };
  });

  if (_financeCharts.trend) {
    _financeCharts.trend.data.labels = months.map(m => parseInt(m.split('-')[1]) + '월');
    _financeCharts.trend.data.datasets[0].data = trendData.map(d => d.rev);
    _financeCharts.trend.data.datasets[1].data = trendData.map(d => d.prof);
    _financeCharts.trend.update();
  }

  // 2. 마켓 비중 업데이트
  const marketStats = { '스마트스토어': 0, '쿠팡': 0, '기타': 0 };
  salesData.forEach(s => {
    const m = s.market || '스마트스토어';
    const rev = Number(s.revenue) || 0;
    if (m === '스마트스토어') marketStats['스마트스토어'] += rev;
    else if (m === '쿠팡') marketStats['쿠팡'] += rev;
    else marketStats['기타'] += rev;
  });

  if (_financeCharts.market) {
    _financeCharts.market.data.datasets[0].data = [marketStats['스마트스토어'], marketStats['쿠팡'], marketStats['기타']];
    _financeCharts.market.update();
  }

  // 3. 요약 지표 업데이트
  const currMonth = months[5];
  let mRev = 0, mProf = 0, mCost = 0;
  salesData.forEach(s => {
    if (String(s.date).startsWith(currMonth)) {
      mRev += Number(s.revenue) || 0;
      mProf += Number(s.profit) || 0;
      mCost += (Number(s.cost) || 0) * (Number(s.quantity) || 0);
    }
  });

  const roi = mCost > 0 ? (mProf / mCost * 100).toFixed(1) : '0';
  const cashflow = mRev * 0.85; // 정산 주기 고려 추정치

  const roiEl = document.getElementById('finance-roi');
  const cfEl = document.getElementById('finance-cashflow');
  const roasEl = document.getElementById('finance-roas');

  if (roiEl) roiEl.textContent = roi + '%';
  if (cfEl) cfEl.textContent = fmt(Math.round(cashflow)) + '원';

  // ROI 전월 비교
  const prevMonth = months[4];
  let prevCost = 0, prevProf = 0;
  salesData.forEach(s => {
    if (String(s.date).startsWith(prevMonth)) {
      prevProf += Number(s.profit) || 0;
      prevCost += (Number(s.cost) || 0) * (Number(s.quantity) || 0);
    }
  });
  const prevRoi = prevCost > 0 ? (prevProf / prevCost * 100) : 0;
  const roiDelta = document.getElementById('finance-roi-delta');
  if (roiDelta) {
    const diff = parseFloat(roi) - prevRoi;
    if (mCost === 0 && prevCost === 0) {
      roiDelta.textContent = '데이터 수집 중…';
      roiDelta.style.color = 'var(--text-muted)';
    } else {
      roiDelta.textContent = `전월 대비 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% ${diff >= 0 ? '▲' : '▼'}`;
      roiDelta.style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
    }
  }

  // ROAS 계산
  let adSpend = 0;
  (accountingRecords || []).forEach(r => {
    if (String(r.date).startsWith(currMonth) && (r.item || '').includes('광고')) {
      adSpend += Number(r.amount) || 0;
    }
  });
  const roas = adSpend > 0 ? (mRev / adSpend * 100).toFixed(0) : '0';
  if (roasEl) roasEl.textContent = roas + '%';
  // ROAS 상태 텍스트 동적 업데이트
  const roasSt = document.getElementById('finance-roas-status');
  if (roasSt) {
    if (adSpend === 0) { roasSt.textContent = '광고 데이터 없음'; roasSt.style.color = 'var(--text-muted)'; }
    else if (parseInt(roas) >= 300) { roasSt.textContent = '효율 우수 🌟'; roasSt.style.color = 'var(--green)'; }
    else if (parseInt(roas) >= 100) { roasSt.textContent = '정상 범위 ✅'; roasSt.style.color = 'var(--green)'; }
    else { roasSt.textContent = '최적화 필요 ⚠️'; roasSt.style.color = 'var(--red)'; }
  }

  // Tax Pivot + Miller-Orr 업데이트
  if (typeof renderTaxPivot === 'function') renderTaxPivot();
  if (typeof calcMillerOrr === 'function') calcMillerOrr();
}


// ==================== V5 SPECIFIC ADDITIONS (REFINED) ====================

// 1. [Opportunity Radar] T1 핵심 로직 연동
async function updateOpportunityRadar() {
    const loading = document.getElementById('v5-radar-loading');
    const container = document.getElementById('v5-radar-list');
    if (!loading || !container) return;

    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        // AI 추천 상품 (Opportunity Tags) - 임시 Fallback (Vercel API 제거됨)
        const res = {
            success: true,
            items: [
                { category: '시즌아이템', keyword: '보온병', score: 88, reason: '시즌 급상승' },
                { category: '의류', keyword: '여성용 가디건', score: 82, reason: '꾸준한 수요' },
                { category: '생활잡화', keyword: '사무용 방석', score: 79, reason: '낮은 경쟁도' },
                { category: '스포츠/레저', keyword: '요가매트', score: 75, reason: '스테디셀러' },
                { category: '자동차용품', keyword: '차량용 거치대', score: 72, reason: '마진율 우수' }
            ]
        };
        if (res.success && res.items) {
            res.items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'opportunity-card';
                card.onclick = () => {
                   window.triggerUnifiedSearch(item.keyword);
                };
                const categoryName = item.category || '데이터 분석 중...';
                card.innerHTML = `
                    <div class="opp-header">
                        <span class="opp-badge">${categoryName}</span>
                        <span class="opp-score">Score: ${item.score}</span>
                    </div>
                    <div class="opp-keyword">${item.keyword}</div>
                    <div class="opp-reason">${item.reason}</div>
                `;
                container.appendChild(card);
            });
        }
    } catch (err) {
        console.warn('Radar update failed:', err);
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">데이터를 불러올 수 없습니다. 네트워크를 확인하세요.</div>';
    } finally {
        loading.style.display = 'none';
    }
}

// 2. [Integrated Search] Step 1 분석 엔진
// 2. [Integrated Search] Step 1 분석 엔진
async function runIntegratedV5Search() {
    const input = document.getElementById('v5-search-input');
    const keyword = input ? input.value.trim() : '';
    if (!keyword) { showToast('키워드를 입력하세요', true); return; }

    const resultArea = document.getElementById('v5-analysis-result');
    if (resultArea) resultArea.style.display = 'block';

    showToast(`${keyword} 분석을 시작합니다...`);
    SystemLogger.log(`🔍 "${keyword}" 분석 시작 — 네이버/도매꾹 API 병렬 수집 중...`, 'info');

    // [Phase 2] 검색 시작 시 스켈레톤 UI (State B 빈 껍데기) 전개
    if(window.t1State && typeof window.t1State.setState === 'function') {
        window.t1State.setState('B');
    }

    try {
        // [V5.5] 로딩 중 스켈레톤 UI
        const gridContainer = document.getElementById('v5-market-grid');
        if (gridContainer) gridContainer.innerHTML = Array(10).fill('<div class="skeleton-card"></div>').join('');
        const screenerBody = document.getElementById('ag-screener-body');
        if (screenerBody) screenerBody.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:12px;"><div class="spinner" style="margin:0 auto 8px;width:20px;height:20px;"></div>B2C + B2B 데이터 동시 수집 중...</div>';
        const screenerSection = document.getElementById('ag-screener-section');
        if (screenerSection) screenerSection.style.display = 'block';


        // fetchGas는 전역 window.fetchGas로 이전됨 (L84 부근)

        // ★ [V6] Phase 1: B2C(네이버) + B2B 사입(도매꾹) + B2B 위탁(도매매) 3방향 동시 타격
        const SHIPPING = 3000;
        const BULK_SHIPPING = 500;  // 사입은 박스 단위(MOQ)이므로 개당 부담 감소
        const DROP_SHIPPING = 3000; // 위탁은 낱개 발송이므로 건당 온전히 부과
        const FEE_RATE = parseFloat(localStorage.getItem('marketFeeRate')) || 0.08;

        // 검색 시점 타임스탬프 → 캐시 강제 우회
        const cacheBuster = Date.now();

        const results = await Promise.allSettled([
            // 1. 네이버 쇼핑 (B2C 판매가 기준점)
            window.fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 50, _ts: cacheBuster }),
            // 2. 도매꾹 (B2B 사입/벌크 원가) - market: 'dome'
            window.fetchGas('domeggookProxy', { type: 'search', keyword: keyword, market: 'dome', size: 50, _ts: cacheBuster }),
            // 3. 도매매 (B2B 위탁/낱개 원가) - market: 'domeme'
            window.fetchGas('domeggookProxy', { type: 'search', keyword: keyword, market: 'domeme', size: 50, _ts: cacheBuster })
        ]);

        // ★ [V6.1] B2B 파이프라인 에러 추적기
        try {
            const bulkRes = results[1] && results[1].value ? results[1].value : null;
            const dropRes = results[2] && results[2].value ? results[2].value : null;
            if (!bulkRes || !bulkRes.success) console.error('🚨 도매꾹(사입) 통신 에러:', bulkRes && bulkRes.error ? bulkRes.error : bulkRes);
            if (!dropRes || !dropRes.success) console.error('🚨 도매매(위탁) 통신 에러:', dropRes && dropRes.error ? dropRes.error : dropRes);
            console.log('🔥 [DEBUG] 사입(Domeggook) Raw Data:', bulkRes && bulkRes.data ? bulkRes.data : bulkRes);
            console.log('🔥 [DEBUG] 위탁(Domeme) Raw Data:', dropRes && dropRes.data ? dropRes.data : dropRes);
        } catch(e) { console.warn('로깅 예외 발생', e); }

        // 데이터 안전망 추출 — ★ 네이버 응답: { success, data: { items: [...] } }
        const naverRaw = (results[0].status === 'fulfilled' && results[0].value && results[0].value.success)
            ? results[0].value : {};
        const naverData = naverRaw.items                       // value.items (직접)
            || (naverRaw.data && naverRaw.data.items)          // value.data.items (중첩)
            || (Array.isArray(naverRaw.data) ? naverRaw.data : [])  // value.data가 배열인 경우
            || [];
        const bulkRaw = (results[1].status === 'fulfilled' && results[1].value && results[1].value.success)
            ? results[1].value : {};
        const bulkData = bulkRaw.items || (bulkRaw.data && Array.isArray(bulkRaw.data) ? bulkRaw.data : []) || [];
        const dropRaw = (results[2].status === 'fulfilled' && results[2].value && results[2].value.success)
            ? results[2].value : {};
        const dropData = dropRaw.items || (dropRaw.data && Array.isArray(dropRaw.data) ? dropRaw.data : []) || [];

        let naverShopRes = (results[0].status === 'fulfilled' && results[0].value) ? results[0].value : { success: false, items: [], total: 5000 };
        // ★ total도 중첩 구조 대응
        if (!naverShopRes.total && naverShopRes.data && naverShopRes.data.total) naverShopRes.total = naverShopRes.data.total;

        let baseItems = Array.isArray(naverData) ? naverData : [];
        let b2bItems = [...(Array.isArray(bulkData) ? bulkData : []), ...(Array.isArray(dropData) ? dropData : [])];

        // 📊 [X-Ray Step 1] 3방향 수신 직후
        console.log('📊 [Step 1] 네이버:', baseItems.length, '건 | 사입(도매꾹):', bulkData.length, '건 | 위탁(도매매):', dropData.length, '건');

        // ★ [V6.1] 텍스트 유사도 분석 함수 (B2C-B2B 1:1 정밀 매칭)
        function calculateSimilarity(str1, str2) {
            if (!str1 || !str2) return 0;
            const cleanStr1 = str1.toLowerCase().replace(/[^a-z0-9\uAC00-\uD7A3\s]/g, '').replace(/<[^>]*>?/gm, '');
            const cleanStr2 = str2.toLowerCase().replace(/[^a-z0-9\uAC00-\uD7A3\s]/g, '').replace(/<[^>]*>?/gm, '');
            const set1 = new Set(cleanStr1.split(/\s+/).filter(w => w.length > 1));
            const set2 = new Set(cleanStr2.split(/\s+/).filter(w => w.length > 1));
            if (set1.size === 0 || set2.size === 0) return 0;
            const intersection = new Set([...set1].filter(x => set2.has(x)));
            return intersection.size / set1.size;
        }

        const SIMILARITY_THRESHOLD = 0.15; // ★ [V7] 매칭률 향상: 15%로 완화 (기존 30%)

        // B2C 상품명과 가장 유사하면서 저렴한 B2B 원가 탐색
        const findBestMatch = (b2cName, b2bArray) => {
            if (!b2bArray || !Array.isArray(b2bArray) || b2bArray.length === 0) return null;
            let minPrice = Infinity;
            b2bArray.forEach(b2b => {
                const b2bName = b2b.title || b2b.name || b2b.goodsName || '';
                const b2bPrice = parseInt(String(b2b.price || b2b.goodsPrice || 0).replace(/,/g, ''), 10);
                if (!isNaN(b2bPrice) && b2bPrice > 0) {
                    const similarity = calculateSimilarity(b2cName, b2bName);
                    if (similarity >= SIMILARITY_THRESHOLD && b2bPrice < minPrice) {
                        minPrice = b2bPrice;
                    }
                }
            });
            return minPrice !== Infinity ? minPrice : null;
        };

        const hasB2BData = (bulkData.length > 0 || dropData.length > 0);

        // 📊 로그
        console.log('📊 [V6.1] B2B 데이터 존재:', hasB2BData, '| 위탁', dropData.length, '건 | 사입', bulkData.length, '건 | 유사도 임계치:', SIMILARITY_THRESHOLD);

        // 2. 2단 Data Cleansing 전략
        const stopWords = (typeof AppConfig !== 'undefined' && AppConfig.BRAND_STOPWORDS) ? AppConfig.BRAND_STOPWORDS : [];

        // 2-1) 지재권 클렌징
        baseItems = baseItems.filter(item => {
            const plainTitle = (item.title || item.name || '').replace(/<[^>]*>?/gm, '');
            return !stopWords.some(word => plainTitle.includes(word));
        });

        // 📊 [X-Ray Step 2] 금지어 필터 통과 직후
        console.log('📊 [Step 2] 금지어 통과 건수:', baseItems.length, '| stopWords 개수:', stopWords.length);

        // 2-2) 도배성 중복 클렌징
        const uniqueImages = new Set();
        const cleansedB2cItems = [];
        for (const item of baseItems) {
            if (!uniqueImages.has(item.image)) {
                uniqueImages.add(item.image);
                cleansedB2cItems.push(item);
            }
        }

        // 📊 [X-Ray Step 3] 썸네일 중복 제거 통과 직후
        console.log('📊 [Step 3] 중복 제거 통과 건수:', cleansedB2cItems.length);

        let avgRetailPrice = 15000;
        let productCount = naverShopRes.total || cleansedB2cItems.length || 5000;

        if (cleansedB2cItems.length > 0) {
            avgRetailPrice = Math.round(cleansedB2cItems.reduce((acc, it) => acc + parseInt(it.lprice||0), 10) / cleansedB2cItems.length);

            // 3. 가격대 자동 그룹핑 (Price Tiering)
            const prices = cleansedB2cItems.map(i => parseInt(i.lprice||0, 10)).sort((a,b) => a - b);
            const p30 = prices[Math.floor(prices.length * 0.3)];
            const p70 = prices[Math.floor(prices.length * 0.7)];

            cleansedB2cItems.forEach(item => {
                const price = parseInt(item.lprice||0, 10);
                if (price <= p30) item.priceTierBadge = '🟢 저가 방어형';
                else if (price >= p70) item.priceTierBadge = '🔴 고가 프리미엄';
                else item.priceTierBadge = '🟡 중가 표준형';
            });
        }

        // ★ [V6.1] 글로벌 요약용 도매 최저가 (리본 표시용)
        let wholesaleMin = 0;
        if (b2bItems.length > 0) {
            const allPrices = b2bItems.map(it => parseInt(String(it.price || it.lprice || '99999').replace(/,/g, ''), 10)).filter(p => !isNaN(p) && p > 0);
            wholesaleMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        } else {
            console.warn('[V6.1] 위탁+사입 모두 0건 — 도매가 미확인, 빈집 보호 적용');
        }

        // 지표 산출
        const platformFee = Math.round(avgRetailPrice * FEE_RATE);
        const netProfit = avgRetailPrice - wholesaleMin - SHIPPING - platformFee;
        const marginRate = avgRetailPrice > 0 ? Math.round((netProfit / avgRetailPrice) * 1000) / 10 : 0;
        const monopolyIndex = Math.min(productCount / ((naverShopRes.search_volume || 10000) * 2), 0.9) || 0.3;

        const aiScore = OpportunityEngine.calculateAIScore({
            searchVolume: (naverShopRes.search_volume || 5000),
            productCount: productCount,
            reviewVelocity: 5,
            socialBuzz: 20,
            estimatedMargin: marginRate > 0 ? marginRate : 25,
            monopolyIndex: monopolyIndex
        });

        // ─────────────────────────────────────────────
        // UI 리본 조작부
        const ribbonEl = document.getElementById('ag-stats-ribbon');
        if (ribbonEl) ribbonEl.style.display = 'flex';

        const elText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        elText('ag-ribbon-score', aiScore);
        elText('ag-ribbon-market', naverShopRes.search_volume ? fmt(naverShopRes.search_volume) : '--');
        elText('ag-ribbon-growth', aiScore > 70 ? 'HIGH' : 'MID');
        elText('ag-ribbon-wholesale', fmt(wholesaleMin) + '원');

        const rMargin = document.getElementById('ag-ribbon-margin');
        if(rMargin) {
            rMargin.textContent = marginRate + '%';
            rMargin.style.color = marginRate >= 15 ? '#10b981' : marginRate >= 5 ? '#f59e0b' : '#ef4444';
        }

        const rec = OpportunityEngine.getRecommendation(aiScore);
        const rRec = document.getElementById('ag-ribbon-rec');
        if (rRec) { rRec.textContent = rec.action; rRec.style.color = rec.color; }

        elText('v5-result-score', aiScore);
        const cmtEl = document.getElementById('v5-result-comment');
        if (cmtEl) { cmtEl.textContent = rec.comment; cmtEl.style.color = rec.color; }

        SystemLogger.log(`📦 B2C 데이터 ${cleansedB2cItems.length}건 정제 완료 | 평균가 ${fmt(avgRetailPrice)}원`, cleansedB2cItems.length > 0 ? 'success' : 'warning');
        if (cleansedB2cItems.length === 0) SystemLogger.log('📦 API 결과 없음 — 스크리너 비움', 'warning');

        // ★ Track A 2단 필터: 마진 필터 (빈집 보호 추가)
        const MIN_MARGIN = parseFloat(localStorage.getItem('minMarginFilter') ?? '0') || 0;
        let marginDropped = 0;

        const filtered = cleansedB2cItems.filter(it => {
            const retailP = parseInt(it.lprice || it.price || avgRetailPrice, 10);
            const fee = Math.round(retailP * FEE_RATE);
            const b2cName = (it.title || it.name || '').replace(/<[^>]*>?/gm, '');

            // ★ [V6.1] 1:1 텍스트 유사도 매칭 (배열 일괄 최저가 영구 파기)
            const matchedDropPrice = findBestMatch(b2cName, dropData);
            const matchedBulkPrice = findBestMatch(b2cName, bulkData);

            let dropOptions = null;
            if (matchedDropPrice && retailP > 0) {
                const profit = retailP - matchedDropPrice - DROP_SHIPPING - fee;
                dropOptions = { price: matchedDropPrice, margin: Math.round((profit / retailP) * 1000) / 10 };
            }
            let bulkOptions = null;
            if (matchedBulkPrice && retailP > 0) {
                const profit = retailP - matchedBulkPrice - BULK_SHIPPING - fee;
                bulkOptions = { price: matchedBulkPrice, margin: Math.round((profit / retailP) * 1000) / 10 };
            }
            it.sourcing = { bulk: bulkOptions, drop: dropOptions };

            // 최선 마진 선택 (위탁/사입 중 높은 쪽)
            const bestMargin = Math.max(dropOptions ? dropOptions.margin : -999, bulkOptions ? bulkOptions.margin : -999);
            it._margin = bestMargin > -999 ? bestMargin : 0;
            it._profit = retailP > 0 ? Math.round(retailP * it._margin / 100) : 0;
            it._hasB2B = hasB2BData;

            // 🚨 [빈집 보호 로직]
            if (!hasB2BData) return true;

            if (it._margin < MIN_MARGIN) {
                marginDropped++;
                return false;
            }
            return true;
        });

        if (marginDropped > 0) SystemLogger.log(`💰 마진 필터: ${marginDropped}건 제외 (기준 ${MIN_MARGIN}%)`, 'info');

        // 📊 [X-Ray Step 4] 마진/빈집 필터 통과 직후 (렌더링 직전)
        console.log('📊 [Step 4] 최종 렌더링 대기 건수:', filtered.length, '| 필터 제외:', marginDropped, '| hasB2BData:', hasB2BData, '| MIN_MARGIN:', MIN_MARGIN);

        // ★ [V7] 원본 데이터 스냅샷 (프라이싱 재계산용 — 1회 깊은 복사)
        window.v7OriginalFetchedData = JSON.parse(JSON.stringify(filtered));

        // 스크리너 렌더링 파이프라인
        if (filtered.length > 0) {
            renderHybridScreener(filtered.slice(0, 30), keyword, wholesaleMin, SHIPPING, FEE_RATE, aiScore);
            SystemLogger.log(`✅ 우량 상품 ${Math.min(filtered.length, 30)}건 스크리너 렌더링 완료!`, 'success');

            const displayItems = filtered.slice(0, 30);
            const margins = displayItems.map(it => it._margin || 0);
            const profits = displayItems.map(it => it._profit || 0);
            const avgMargin = margins.length ? Math.round(margins.reduce((s,v)=>s+v,0)/margins.length*10)/10 : 0;
            const maxProfit = profits.length ? Math.max(...profits) : 0;
            const dropshipCount = displayItems.filter(it => (it._margin||0) >= 20).length;
            const importCount = displayItems.filter(it => (it._margin||0) >= 10 && (it._margin||0) < 20).length;
            const holdCount = displayItems.filter(it => (it._margin||0) < 10).length;

            if (rMargin) { rMargin.textContent = avgMargin + '%'; rMargin.style.color = avgMargin >= 15 ? '#10b981' : avgMargin >= 5 ? '#f59e0b' : '#ef4444'; }
            elText('ag-total-count', displayItems.length);
            elText('ag-dropship-count', dropshipCount);
            elText('ag-import-count', importCount);
            elText('ag-hold-count', holdCount);
            SystemLogger.log(`📊 위탁${dropshipCount} 사입${importCount} 보류${holdCount}`, 'info');
        } else {
            SystemLogger.log(`❌ 필터 통과 상품 0건 — 검색어 변경 또는 필터 기준 조정 필요`, 'error');
            const body = document.getElementById('ag-screener-body');
            if(body) body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">조건에 맞는 상품이 없습니다.</div>';
        }

        renderV5KeywordChips(keyword);

        const competitionLevel = (productCount / (naverShopRes.search_volume || 10000)) > 5 ? '높음' : '보통';
        window._v5CurrentCandidate = {
            name: keyword, keyword: keyword,
            marketPrice: avgRetailPrice, wholesalePrice: wholesaleMin, marginRate: marginRate,
            shippingCost: SHIPPING, platformFee: platformFee, netProfit: netProfit,
            aiScore: aiScore, category: '', competitionLevel: competitionLevel,
            items: cleansedB2cItems, photoUrl: cleansedB2cItems[0]?.image || ''
        };
        showToast(`분석 완료! 시중 ${fmt(avgRetailPrice)}원 / 도매 ${fmt(wholesaleMin)}원 → 마진 ${marginRate}%`);
    } catch (err) {
        console.error('V5 Search Error:', err);
        showToast('검색 중 오류가 발생했습니다.', true);
    }
}

// 2-1. Market Grid Renderer (V6.0: Landed Cost Highlight & AI Logs)
function renderV5MarketGrid(items) {
    const container = document.getElementById('v5-market-grid');
    if (!container) return;
    container.innerHTML = '';

    items.forEach((item, index) => {
        const wholesalePrice = item.lprice || item.price;
        // [V6.0] Landed Cost 계산 (기본 배송비 3000원, 관세 0%, 부가세 10% 가정)
        const landedCost = typeof calculateLandedCost === 'function' ? calculateLandedCost(wholesalePrice, 3000, 0, 10) : wholesalePrice;

        // [V6.0] 15% 마진 확보 가능 여부 체크 (평균 시중가 대비)
        const avgPrice = window._v5CurrentCandidate ? window._v5CurrentCandidate.avgPrice : (wholesalePrice * 1.5);
        const marginPct = ((avgPrice - landedCost) / avgPrice) * 100;
        const isOpportunity = marginPct >= 15;

        const card = document.createElement('div');
        card.className = 'mp-product-card';
        if (isOpportunity) card.classList.add('opp-highlight'); // Gold border highlight

        card.innerHTML = `
            <div style="position:relative;">
                ${isOpportunity ? '<div class="opp-badge-label" style="position:absolute; top:-5px; left:-5px; background:var(--accent2); color:#fff; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:800; z-index:10; border:1px solid rgba(255,255,255,0.2);">💎 마진 15%+</div>' : ''}
                <a href="${item.link}" target="_blank" style="display:block; margin-bottom: 8px;">
                    <img src="${item.image || 'https://placehold.co/150'}" alt="" style="width:100%; height:140px; object-fit:cover; border-radius:8px; border:1px solid var(--border);">
                </a>
            </div>
            <div class="mp-pc-price" style="margin-top:8px; font-weight:800; font-size:14px; color:var(--text);">${fmt(wholesalePrice)}원</div>
            <div style="font-size:10px; color:var(--text-muted); margin-bottom:8px; display:flex; justify-content:space-between;">
                <span>Landed: ${fmt(landedCost)}원</span>
                <span style="color:${isOpportunity ? 'var(--accent)' : 'inherit'}; font-weight:700;">${marginPct.toFixed(1)}%</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn" style="flex:1; background:var(--surface3); font-size:10px; padding:4px; border:1px solid var(--border);" onclick="renderV6SourcingLogs(${JSON.stringify({keyword: item.title, price: wholesalePrice}).replace(/"/g, '&quot;')})">📊 AI 로그</button>
                <button class="btn btn-primary" style="flex:1.5; background:var(--accent); font-size:10px; padding:4px;" onclick="confirmSalesAndTransfer(this, '${encodeURIComponent(JSON.stringify(item))}')">판매 확정</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ★ V5.5 HTS형 고밀도 하이브리드 스크리너
// ★ Sprint #2: 마진 필터 슬라이더 컨트롤
function updateMarginFilter(val) {
    localStorage.setItem('minMarginFilter', val);
    const label = document.getElementById('margin-slider-value');
    if (label) label.textContent = val + '%';
    SystemLogger.log(`🎯 마진 필터 기준 변경: ${val}%`, 'info');
}
// 페이지 로드 시 슬라이더 초기값 복원
document.addEventListener('DOMContentLoaded', function() {
    const saved = localStorage.getItem('minMarginFilter') || '15';
    const slider = document.getElementById('margin-slider');
    const label = document.getElementById('margin-slider-value');
    if (slider) slider.value = saved;
    if (label) label.textContent = saved + '%';
});

// ★ [V7] 소싱 링크용 핵심 키워드 추출기
// 상품명 전체 대신 도매 사이트에서 적중률 높은 핵심 단어 2~3개만 추출
function extractCoreKeywords(fullTitle, originalKeyword) {
    // 불용어: 색상, 소재, 수량 표현, 사이즈, 브랜드 수식어 등
    const stopWords = new Set([
        // 색상
        '블랙','화이트','네이비','그레이','베이지','카키','브라운','레드','블루','그린','핑크','옐로우','아이보리',
        '검정','흰색','진회색','연회색','감색','밤색','노랑','자주','보라','하늘','오렌지','살구색','와인',
        // 사이즈/수량
        'S','M','L','XL','XXL','2XL','3XL','4XL','FREE','프리','프리사이즈',
        '1개','2개','3개','5개','10개','1+1','2+1','세트','set','팩','묶음','대용량','소형','중형','대형',
        // 소재/패턴
        '면','폴리','나일론','울','실크','가죽','합성','코튼','린넨','데님','스판','메쉬','쉬폰','니트',
        '체크','스트라이프','무지','도트','플라워','카모','패턴',
        // 수식어/마케팅
        '신상','인기','추천','베스트','특가','할인','초특가','무료배송','국내','해외','정품','오리지널',
        '고급','프리미엄','럭셔리','연예인','셀럽','후기','리뷰','사은품','최저가','당일발송',
        '남성','여성','남자','여자','남녀','공용','유니섹스','아동','키즈','주니어','시니어',
        '봄','여름','가을','겨울','사계절','간절기','데일리','캐주얼','클래식','모던','빈티지','레트로',
        '오버핏','슬림핏','레귤러핏','루즈핏','와이드','스키니','일자','배기',
        // 기타 공통 불용어
        '및','또','더','등','용','형','식','개','대','소','외','내','전','후',
        '신사','정장','단벌','총재','흑재','캐주얼','멘','강정','방발','재킷','자켓'
    ]);

    // HTML 태그 제거 + 특수문자 정리
    let clean = fullTitle.replace(/<[^>]*>/g, '').replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, ' ').trim();

    // 단어 분리 + 불용어 제거 + 1글자 제거
    let words = clean.split(/\s+/)
        .filter(w => w.length >= 2)
        .filter(w => !stopWords.has(w))
        .filter(w => !/^\d+$/.test(w))  // 순수 숫자 제거
        .filter(w => !/^[a-zA-Z]{1,2}$/.test(w));  // 2글자 이하 영문 제거

    // 원래 검색 키워드에 포함된 단어는 우선순위 높임
    const kwWords = (originalKeyword || '').split(/\s+/).filter(w => w.length >= 2);

    // 핵심어 선별: 원래 키워드와 겹치는 단어 우선 + 나머지에서 상위 2개
    const priorityWords = words.filter(w => kwWords.some(k => w.includes(k) || k.includes(w)));
    const otherWords = words.filter(w => !priorityWords.includes(w));

    // 최종 키워드: 원래 검색어 + 상품명에서 추출한 보조 키워드 1~2개
    let result = [];
    if (originalKeyword && originalKeyword.trim()) {
        result.push(originalKeyword.trim());
    }
    // 상품명에서 원래 키워드와 다른 핵심 명사 추가 (최대 2개)
    const additionalWords = otherWords.slice(0, 2);
    result = [...result, ...additionalWords];

    // 너무 김 방지 (최대 4단어)
    return result.slice(0, 4).join(' ') || originalKeyword || fullTitle.slice(0, 20);
}

function renderHybridScreener(items, keyword, wholesaleBaseMin, shipping, feeRate, aiScore) {
    const body = document.getElementById('ag-screener-body');
    const section = document.getElementById('ag-screener-section');
    if (!body || !section) return;
    section.style.display = 'block';
    body.innerHTML = '';
    let dropship = 0, importRec = 0, hold = 0;

    // ★ [V7] 전역 상태 동기화 + ID 부여
    items.forEach((it, i) => { it._idx = it.productId || i; });
    window.currentRenderedItems = items;

    items.forEach((item, idx) => {
        const retailPrice = item.lprice || item.price || 15000;
        const img = item.image || 'https://placehold.co/40';
        const title = (item.title || item.name || keyword).replace(/<[^>]*>/g, '');

        // ★ [V6] 듀얼 소싱 방어 변수 파싱
        const srcDrop = (item.sourcing && item.sourcing.drop) ? item.sourcing.drop : null;
        const srcBulk = (item.sourcing && item.sourcing.bulk) ? item.sourcing.bulk : null;

        // 레거시 호환 방어 매핑 (AI Score, Badge 등이 margin/wsPrice 변수를 요구하는 경우 대비)
        const wsPrice = srcBulk ? srcBulk.price : (srcDrop ? srcDrop.price : 0);
        const margin = srcBulk ? srcBulk.margin : (srcDrop ? srcDrop.margin : 0);
        const bestMargin = item._margin || margin || 0;

        // AI 판별
        let badge = '', badgeClass = '';
        if (bestMargin >= 20) { badge = '🟢 위탁추천'; badgeClass = 'badge-green'; dropship++; }
        else if (bestMargin >= 10) { badge = '🔥 사입추천'; badgeClass = 'badge-yellow'; importRec++; }
        else { badge = '❌ 보류'; badgeClass = 'badge-red'; hold++; }

        const marginClass = bestMargin >= 20 ? 'margin-green' : bestMargin >= 10 ? 'margin-yellow' : 'margin-red';

        // AI 4축 스코어 (상품별)
        const itemAI = {
            market: Math.min(100, Math.round(50 + (item._margin || 0) * 0.8)),
            growth: Math.min(100, Math.round(30 + bestMargin * 1.5)),
            compete: Math.min(100, Math.round(70 - bestMargin * 0.5)),
            season: Math.min(100, Math.round(60)),
        };
        itemAI.total = Math.round((itemAI.market + itemAI.growth + (100 - itemAI.compete) + itemAI.season) / 4);

        const row = document.createElement('div');
        row.className = 'ag-screener-row';
        row.style.cssText = 'display:grid; grid-template-columns:30px 50px 2fr 1fr 1fr 60px 1fr 80px; padding:8px 14px; align-items:center; border-bottom:1px solid rgba(0,0,0,0.03); transition:all 0.2s; cursor:pointer;';
        const isChecked = window.sourcingCart.has(String(item._idx)) ? 'checked' : '';
        const cleanTitle = title;
        row.innerHTML = `
            <div style="text-align:center;"><input type="checkbox" class="cart-checkbox" style="width:16px;height:16px;cursor:pointer;accent-color:#3b82f6;" ${isChecked} onchange="window.toggleCartItem('${item._idx}')"></div>
            <img src="${img}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--border);" onerror="this.src='https://placehold.co/40'">
            <div style="display:flex;flex-direction:column;gap:2px;padding:0 8px;min-width:0;">
                <a href="${item.link || '#'}" target="_blank" onclick="event.stopPropagation()" style="font-weight:600;color:var(--text,#f1f5f9);font-size:0.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none;display:block;" onmouseover="this.style.color='#4ade80';this.style.textDecoration='underline'" onmouseout="this.style.color='var(--text,#f1f5f9)';this.style.textDecoration='none'">${title}</a>
                ${item.mallName ? `<span style="font-size:0.65rem;color:#cbd5e1;">${item.mallName}</span>` : ''}
                <div style="display:flex;gap:4px;margin-top:3px;">
                    <a href="https://domeggook.com/main/item/itemList.php?sw=${encodeURIComponent(extractCoreKeywords(cleanTitle, keyword))}" target="_blank" style="font-size:0.55rem;color:#60a5fa;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);padding:1px 5px;border-radius:4px;text-decoration:none;">🔍 도매꾹</a>
                    <a href="https://domemedb.domeggook.com/index/item/supplyList.php?sf=subject&enc=utf8&sw=${encodeURIComponent(extractCoreKeywords(cleanTitle, keyword))}" target="_blank" style="font-size:0.55rem;color:#4ade80;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);padding:1px 5px;border-radius:4px;text-decoration:none;">🔍 도매매</a>
                    <a href="https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(extractCoreKeywords(cleanTitle, keyword))}" target="_blank" style="font-size:0.55rem;color:#fbbf24;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);padding:1px 5px;border-radius:4px;text-decoration:none;">🔍 1688</a>
                    <a href="https://www.coupang.com/np/search?component=&q=${encodeURIComponent(extractCoreKeywords(cleanTitle, keyword))}" target="_blank" style="font-size:0.55rem;color:#ff6b35;background:rgba(255,107,53,0.1);border:1px solid rgba(255,107,53,0.2);padding:1px 5px;border-radius:4px;text-decoration:none;">🔍 쿠팡</a>
                </div>
            </div>
            <div style="font-weight:600;text-align:center;color:var(--text,#e2e8f0);font-size:0.8rem;">₩${fmt(retailPrice)}</div>
            <div style="text-align:center;display:flex;flex-direction:column;gap:3px;">
                ${item.sourcing && item.sourcing.drop ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:rgba(30,40,60,0.6);border-radius:6px;border:1px solid rgba(74,222,128,0.2);">
                        <span style="color:#4ade80;font-weight:700;font-size:0.6rem;">🟢위탁</span>
                        <span style="color:#cbd5e1;font-size:0.6rem;margin:0 4px;">₩${fmt(item.sourcing.drop.price)}</span>
                        <span style="color:${item.sourcing.drop.margin >= 15 ? '#4ade80' : '#fbbf24'};font-weight:700;font-size:0.7rem;">${item.sourcing.drop.margin}%</span>
                    </div>
                ` : '<div style="color:#94a3b8;font-size:0.55rem;text-align:center;padding:2px;background:rgba(30,40,60,0.4);border-radius:4px;white-space:nowrap;">❌위탁 없음</div>'}
                ${item.sourcing && item.sourcing.bulk ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:rgba(30,40,60,0.6);border-radius:6px;border:1px solid rgba(147,197,253,0.2);">
                        <span style="color:#93c5fd;font-weight:700;font-size:0.6rem;">📦사입</span>
                        <span style="color:#cbd5e1;font-size:0.6rem;margin:0 4px;">₩${fmt(item.sourcing.bulk.price)}</span>
                        <span style="color:${item.sourcing.bulk.margin >= 30 ? '#93c5fd' : '#fbbf24'};font-weight:700;font-size:0.7rem;">${item.sourcing.bulk.margin}%</span>
                    </div>
                ` : '<div style="color:#94a3b8;font-size:0.55rem;text-align:center;padding:2px;background:rgba(30,40,60,0.4);border-radius:4px;margin-top:2px;white-space:nowrap;">❌사입 없음</div>'}
            </div>
            <div style="text-align:center;position:relative;">
                <span class="ai-score-badge" style="background:linear-gradient(135deg,${itemAI.total>=60?'#10b981,#059669':'#f59e0b,#d97706'});color:#fff;font-weight:800;font-size:0.7rem;padding:3px 8px;border-radius:12px;cursor:pointer;display:inline-block;" onclick="event.stopPropagation();toggleScoreBreakdown(this,${idx})">${itemAI.total}</span>
                <div class="score-breakdown" id="score-bd-${idx}" style="display:none;position:absolute;top:28px;left:50%;transform:translateX(-50%);z-index:100;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border-radius:12px;padding:12px;width:180px;box-shadow:0 8px 32px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:#fff;font-weight:700;font-size:0.7rem;margin-bottom:8px;text-align:center;">AI 분석 브레이크다운</div>
                    <div style="display:flex;flex-direction:column;gap:5px;">
                        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#94a3b8;font-size:0.65rem;width:50px;">시장강도</span><div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${itemAI.market}%;background:#3b82f6;border-radius:3px;"></div></div><span style="color:#fff;font-size:0.65rem;font-weight:700;width:28px;text-align:right;">${itemAI.market}</span></div>
                        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#94a3b8;font-size:0.65rem;width:50px;">성장성</span><div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${itemAI.growth}%;background:#10b981;border-radius:3px;"></div></div><span style="color:#fff;font-size:0.65rem;font-weight:700;width:28px;text-align:right;">${itemAI.growth}</span></div>
                        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#94a3b8;font-size:0.65rem;width:50px;">진입용이</span><div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${100-itemAI.compete}%;background:#f59e0b;border-radius:3px;"></div></div><span style="color:#fff;font-size:0.65rem;font-weight:700;width:28px;text-align:right;">${100-itemAI.compete}</span></div>
                        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#94a3b8;font-size:0.65rem;width:50px;">계절성</span><div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${itemAI.season}%;background:#8b5cf6;border-radius:3px;"></div></div><span style="color:#fff;font-size:0.65rem;font-weight:700;width:28px;text-align:right;">${itemAI.season}</span></div>
                    </div>
                </div>
            </div>
            <div style="text-align:center;"><span class="ag-badge ${badgeClass}" style="padding:3px 8px;border-radius:6px;font-size:0.65rem;font-weight:700;">${badge}</span></div>
            <div style="text-align:center;display:flex;flex-direction:column;gap:4px;align-items:center;">
                <button onclick="hybridTransfer(${idx})" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;padding:5px 10px;border-radius:8px;font-size:0.7rem;font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(59,130,246,0.3);transition:all 0.15s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🚀 T2</button>
                <button id="opp-btn-${idx}" onclick="event.stopPropagation();analyzeOpportunityInline(${idx})" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;border:none;padding:4px 8px;border-radius:8px;font-size:0.6rem;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(245,158,11,0.3);transition:all 0.15s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🎯 분석</button>
            </div>
        `;
        // 호버 효과 강화
        row.onmouseenter = function() { this.style.background = 'rgba(16,185,129,0.04)'; this.style.transform = 'translateX(2px)'; };
        row.onmouseleave = function() { this.style.background = ''; this.style.transform = ''; };
        body.appendChild(row);

        // 행 데이터 저장 (★ V6 듀얼 소싱 바인딩)
        if (!window._screenerRows) window._screenerRows = [];
        window._screenerRows[idx] = { title, retailPrice, wsPrice, margin, img, keyword, sourcing: item.sourcing, aiScores: itemAI };
    });

    // 서머리 바 업데이트
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('ag-total-count', items.length);
    el('ag-dropship-count', dropship);
    el('ag-import-count', importRec);
    el('ag-hold-count', hold);
}

// ★ AI SCORE 브레이크다운 토글
window.toggleScoreBreakdown = function(badge, idx) {
    const bd = document.getElementById('score-bd-' + idx);
    if (!bd) return;
    // 다른 열린 팝오버 모두 닫기
    document.querySelectorAll('.score-breakdown').forEach(el => { if (el.id !== 'score-bd-' + idx) el.style.display = 'none'; });
    bd.style.display = bd.style.display === 'none' ? 'block' : 'none';
};
// 외부 클릭 시 팝오버 닫기
document.addEventListener('click', function(e) {
    if (!e.target.closest('.ai-score-badge') && !e.target.closest('.score-breakdown')) {
        document.querySelectorAll('.score-breakdown').forEach(el => el.style.display = 'none');
    }
});

// ★ Phase 3: HTS 스크리너 → T2 전송 (확장 페이로드)
window.hybridTransfer = function(idx) {
    const row = (window._screenerRows || [])[idx];
    if (!row) { showToast('데이터를 찾을 수 없습니다.', true); return; }

    const payload = new StandardProductInfo({
        name: row.title,
        wholesale_price: row.wsPrice,
        sale_price: row.retailPrice,
        source_type: 'domeggook',
        thumbnail_url: row.img
    });
    payload.marketPrice = row.retailPrice;
    payload.wholesalePrice = row.wsPrice;
    payload.marginRate = row.margin;
    payload.thumbnailImage = row.img;
    payload.platformFee = row.fee;
    payload.shippingCost = row.shipping;
    payload.netProfit = row.profit;

    showTab('inventory');
    if (typeof showT2SubTab === 'function') showT2SubTab('field');
    AppEventBus.emit('PRODUCT_SOURCED', payload);
    showToast(`✅ "${row.title}" T2 전송 완료 (마진 ${row.margin}%)`);
};

// [Phase 3] 기존 판매 확정 전송 (향후 호환용 유지)
window.confirmSalesAndTransfer = function(btn, encodedItem) {
    btn.textContent = '전송완료';
    btn.style.background = 'var(--text-muted)';
    btn.disabled = true;
    try {
        const rawItem = JSON.parse(decodeURIComponent(encodedItem));
        const cand = window._v5CurrentCandidate || {};
        if(typeof StandardProductInfo !== 'undefined' && window.AppEventBus) {
            const stdItem = new StandardProductInfo(rawItem);
            stdItem.marketPrice = cand.marketPrice || rawItem.price || 0;
            stdItem.wholesalePrice = cand.wholesalePrice || 0;
            stdItem.marginRate = cand.marginRate || 0;
            stdItem.thumbnailImage = rawItem.image || '';
            showTab('inventory');
            if (typeof showT2SubTab === 'function') showT2SubTab('field');
            window.AppEventBus.emit('PRODUCT_SOURCED', stdItem);
            showToast('T2로 데이터가 전송되었습니다.');
        }
    } catch(e) { console.error('Data transfer error:', e); }
};

// ★ 시즌 패널 아코디언 토글
window.toggleSeasonPanel = function() {
    const body = document.getElementById('season-panel-body');
    const arrow = document.getElementById('season-toggle-arrow');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶ 펼치기' : '▼ 접기';
}

// 2-2. Keyword Chips Renderer — [V7] 연관 키워드 확장 분석 (네이버 검색광고 API)
async function renderV5KeywordChips(keyword) {
    const wrapper = document.getElementById('v5-keyword-expansion');
    const container = document.getElementById('v5-keyword-chips');
    if (!wrapper || !container) return;

    wrapper.style.display = 'flex';
    container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;padding:8px 0;">연관 키워드 분석 중...</span>';

    try {
        const res = await fetchGas('naverSearchAd', { keyword: keyword });
        if (!res || !res.success || !res.keywords || res.keywords.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;padding:8px 0;">연관 키워드 데이터가 없습니다</span>';
            return;
        }

        const related = res.keywords
            .filter(k => k.keyword !== keyword && k.totalSearch > 0)
            .sort((a, b) => b.totalSearch - a.totalSearch)
            .slice(0, 12);

        if (related.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;padding:8px 0;">연관 키워드가 없습니다</span>';
            return;
        }

        container.innerHTML = related.map(k => {
            const vol = k.totalSearch >= 10000 ? (k.totalSearch / 10000).toFixed(1) + '만' : k.totalSearch.toLocaleString();
            const compColor = k.competitionLevel === 'HIGH' ? '#ef4444' : k.competitionLevel === 'MID' ? '#fbbf24' : '#4ade80';
            const compText = k.competitionLevel === 'HIGH' ? '경쟁↑' : k.competitionLevel === 'MID' ? '보통' : '경쟁↓';
            return '<span onclick="window.triggerTickerSearch(\'' + k.keyword.replace(/'/g, "\\\\'") + '\')" ' +
                'style="cursor:pointer;font-size:0.7rem;color:#e2e8f0;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:5px 10px;border-radius:16px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;transition:all 0.2s;" ' +
                'onmouseover="this.style.background=\'rgba(16,185,129,0.25)\'" onmouseout="this.style.background=\'rgba(16,185,129,0.1)\'">' +
                k.keyword +
                '<span style="font-size:0.55rem;color:#94a3b8;">' + vol + '</span>' +
                '<span style="font-size:0.5rem;color:' + compColor + ';font-weight:700;">' + compText + '</span>' +
                '</span>';
        }).join('');

    } catch(e) {
        console.error('[KeywordChips] 연관 키워드 실패:', e);
        container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;padding:8px 0;">연관 키워드 로딩 실패</span>';
    }
}

// 3. [Bridge] Step 1 -> Step 2 이동
function sendToSimulator() {
    if (!window._v5CurrentCandidate) {
        showToast('먼저 상품을 분석해주세요.', true);
        return;
    }

    showTab('simulator');

    const cand = window._v5CurrentCandidate;

    // 기본 정보
    const nameEl = document.getElementById('productName');
    if (nameEl) nameEl.value = cand.name;

    // 시장 인텔리전스 정보 전달
    const minEl = document.getElementById('v5-market-min');
    const avgEl = document.getElementById('v5-market-avg');
    const scoreEl = document.getElementById('v5-score-badge');

    if (minEl) minEl.value = (typeof fmt === 'function' ? fmt(cand.minPrice) : cand.minPrice) + '원';
    if (avgEl) avgEl.value = (typeof fmt === 'function' ? fmt(cand.avgPrice) : cand.avgPrice) + '원';
    if (scoreEl) {
        scoreEl.textContent = cand.aiScore;
        const color = cand.aiScore >= 80 ? 'var(--accent)' : (cand.aiScore >= 50 ? 'var(--warn)' : 'var(--danger)');
        scoreEl.style.borderColor = color;
        scoreEl.style.color = color;
    }

    const wsInput = document.getElementById('unified-wholesale-input');
    if (wsInput) {
        wsInput.value = cand.keyword;
        runUnifiedSearch();
    }

    recalcMargin();
    showToast('시뮬레이터로 분석 데이터를 전송했습니다.');
}

// 4. [Finance] Step 4 대시보드 시각화
// Redundant initFinanceDashboard removed in favor of updateFinanceDashboard

// ==================== TAX PIVOT TABLE ====================
// VAT_RATES는 상단에 이미 선언됨 (line ~495)

function renderTaxPivot() {
  const records = accountingRecords || [];
  const year = new Date().getFullYear();
  const bizType = document.getElementById('acc-business-type')?.value || '소매업';
  const vatRate = VAT_RATES[bizType] || 0.15;

  // 월별 집계
  const monthly = {};
  for (let m = 1; m <= 12; m++) monthly[m] = { sales: 0, purchase: 0, tax: 0, card: 0, cash: 0 };

  records.forEach(r => {
    const d = new Date(r.date);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    const amt = Math.abs(Number(r.amount)) || 0;
    if (r.type === '매출') monthly[m].sales += amt;
    else monthly[m].purchase += amt;
    // 증빙유형 분류
    const ev = (r.evidence || '기타').toLowerCase();
    if (ev.includes('세금계산서')) monthly[m].tax += amt;
    else if (ev.includes('카드')) monthly[m].card += amt;
    else if (ev.includes('현금')) monthly[m].cash += amt;
  });

  // 판매 데이터도 포함
  (appState.sales || []).forEach(s => {
    const d = new Date(s.date);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    monthly[m].sales += Number(s.revenue) || 0;
  });

  // 피벗 테이블 렌더링
  const tbody = document.getElementById('tax-pivot-body');
  const tfoot = document.getElementById('tax-pivot-foot');
  if (!tbody) return;

  let totSales = 0, totPurch = 0, totTax = 0, totCard = 0, totCash = 0, totVat = 0;
  let half1Vat = 0, half2Vat = 0;
  let html = '';

  for (let m = 1; m <= 12; m++) {
    const d = monthly[m];
    if (d.sales === 0 && d.purchase === 0) continue;
    // 간이과세 부가세 = 매출 × 업종별 부가가치율 × 10%
    const vat = Math.round(d.sales * vatRate * 0.1);
    totSales += d.sales; totPurch += d.purchase; totTax += d.tax; totCard += d.card; totCash += d.cash; totVat += vat;
    if (m <= 6) half1Vat += vat; else half2Vat += vat;

    html += `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:6px 8px; font-weight:600;">${m}월</td>
      <td style="padding:6px 8px; text-align:right; color:#22c55e;">${fmt(d.sales)}</td>
      <td style="padding:6px 8px; text-align:right; color:#ef4444;">${fmt(d.purchase)}</td>
      <td style="padding:6px 8px; text-align:right;">${fmt(d.tax)}</td>
      <td style="padding:6px 8px; text-align:right;">${fmt(d.card)}</td>
      <td style="padding:6px 8px; text-align:right;">${fmt(d.cash)}</td>
      <td style="padding:6px 8px; text-align:right; color:var(--accent); font-weight:600;">${fmt(vat)}</td>
    </tr>`;
  }

  if (!html) html = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">올해 거래 데이터 없음</td></tr>';
  tbody.innerHTML = html;

  tfoot.innerHTML = `<tr>
    <td style="padding:8px; font-weight:800;">합계</td>
    <td style="padding:8px; text-align:right; color:#22c55e; font-weight:800;">${fmt(totSales)}</td>
    <td style="padding:8px; text-align:right; color:#ef4444; font-weight:800;">${fmt(totPurch)}</td>
    <td style="padding:8px; text-align:right;">${fmt(totTax)}</td>
    <td style="padding:8px; text-align:right;">${fmt(totCard)}</td>
    <td style="padding:8px; text-align:right;">${fmt(totCash)}</td>
    <td style="padding:8px; text-align:right; color:var(--accent); font-weight:800;">${fmt(totVat)}</td>
  </tr>`;

  // 반기 요약
  const h1El = document.getElementById('tax-half1');
  const h2El = document.getElementById('tax-half2');
  if (h1El) h1El.textContent = fmt(half1Vat) + '원';
  if (h2El) h2El.textContent = fmt(half2Vat) + '원';

  // 일반과세 비교
  const generalVat = Math.round((totSales - totPurch) * 0.1);
  const compareEl = document.getElementById('tax-compare');
  if (compareEl) {
    if (totSales === 0 && totPurch === 0) {
      compareEl.innerHTML = '<div style="color:var(--text-muted); text-align:center;">거래 데이터가 입력되면 간이과세 vs 일반과세 비교가 표시됩니다.</div>';
    } else {
      const diff = totVat - generalVat;
      const better = diff < 0 ? '간이과세' : '일반과세';
      compareEl.innerHTML = `
        <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
          <div><strong>간이과세</strong> 부가세: <span style="color:var(--accent); font-weight:700;">${fmt(totVat)}원</span></div>
          <div><strong>일반과세</strong> 부가세: <span style="color:var(--accent2, #f59e0b); font-weight:700;">${fmt(generalVat)}원</span></div>
          <div style="margin-left:auto; font-weight:700; color:${diff < 0 ? 'var(--green)' : 'var(--red)'};">
            ${better}가 ${fmt(Math.abs(diff))}원 유리 ${diff < 0 ? '✅' : '⚠️'}
          </div>
        </div>
      `;
    }
  }
}

// ==================== MILLER-ORR 현금 관리 ====================
let _moChart = null;

function calcMillerOrr() {
  const F = Number(document.getElementById('mo-fixed-cost')?.value) || 3000;
  const rAnnual = (Number(document.getElementById('mo-rate')?.value) || 3.5) / 100;
  const L = Number(document.getElementById('mo-lower')?.value) || 100000;
  const r = rAnnual / 365; // 일일 이자율

  // 일일 현금흐름 분산 계산 (salesData 기반)
  const salesData = appState.sales || [];
  const dailyCF = {};
  salesData.forEach(s => {
    const date = String(s.date).substring(0, 10);
    if (!dailyCF[date]) dailyCF[date] = 0;
    dailyCF[date] += (Number(s.revenue) || 0) - ((Number(s.cost) || 0) * (Number(s.quantity) || 1));
  });

  const cfValues = Object.values(dailyCF);
  let sigma2;
  if (cfValues.length >= 2) {
    const mean = cfValues.reduce((a, b) => a + b, 0) / cfValues.length;
    sigma2 = cfValues.reduce((a, v) => a + (v - mean) ** 2, 0) / (cfValues.length - 1);
  } else {
    sigma2 = 250000 ** 2; // 기본값: 일일 25만원 변동
  }

  // Miller-Orr 핵심 공식: Z = L + ∛(3Fσ²/4r)
  const spread = Math.cbrt((3 * F * sigma2) / (4 * r));
  const Z = Math.round(L + spread);
  const H = Math.round(3 * Z - 2 * L);

  // 결과 표시
  const elL = document.getElementById('mo-result-L');
  const elZ = document.getElementById('mo-result-Z');
  const elH = document.getElementById('mo-result-H');
  if (elL) elL.textContent = fmt(L) + '원';
  if (elZ) elZ.textContent = fmt(Z) + '원';
  if (elH) elH.textContent = fmt(H) + '원';

  // 조언
  const adviceEl = document.getElementById('mo-advice');
  if (adviceEl) {
    adviceEl.innerHTML = `
      <strong>💡 해석:</strong> 사업 통장 잔고를 <span style="color:var(--accent); font-weight:700;">${fmt(Z)}원</span> 수준으로 유지하세요.<br>
      잔고가 <span style="color:#ef4444">${fmt(L)}원</span> 아래로 떨어지면 자금 투입,
      <span style="color:#22c55e">${fmt(H)}원</span> 위로 올라가면 여유분을 투자(적금/CMA 등)로 이동하세요.
      ${cfValues.length < 5 ? '<br><em style="color:var(--text-muted);">(판매 데이터가 적어 기본 변동성을 사용했습니다. 데이터가 쌓이면 정확도가 올라갑니다.)</em>' : ''}
    `;
  }

  // 시뮬레이션 차트
  renderMillerOrrChart(L, Z, H, sigma2);

  // V5.5: Cash-in 예정표 자동 갱신
  if (typeof renderCashInTimeline === 'function') renderCashInTimeline();
  // V5.5: 교차 비교 + 환율 차트 자동 갱신
  setTimeout(() => {
    if (typeof renderCashOutComparison === 'function') renderCashOutComparison();
    if (typeof renderExchangeRateChart === 'function') renderExchangeRateChart();
  }, 300);
}

// ==================== V5.5 정산 딜레이 Cash-in 예정표 ====================
/**
 * 마켓별 정산 주기를 반영하여 향후 30일 Cash-in 타임라인 렌더링
 */
function renderCashInTimeline() {
  const SETTLE_DAYS = {
    '네이버': Number(document.getElementById('settle-naver')?.value) || 3,
    '쿠팡': Number(document.getElementById('settle-coupang')?.value) || 60,
    '11번가': Number(document.getElementById('settle-11st')?.value) || 14,
    '위메프': Number(document.getElementById('settle-wemakeprice')?.value) || 30,
  };

  const salesData = (appState && appState.sales) ? appState.sales : [];
  const today = new Date();
  const cashInEntries = [];

  // 판매 데이터에서 Cash-in 예정 계산
  if (salesData.length > 0) {
    salesData.forEach(s => {
      const saleDate = new Date(s.date);
      const market = s.market || '네이버'; // 기본 마켓
      const delay = SETTLE_DAYS[market] || SETTLE_DAYS['네이버'];
      const cashInDate = new Date(saleDate);
      cashInDate.setDate(cashInDate.getDate() + delay);

      const revenue = Number(s.revenue) || (Number(s.price) * (Number(s.quantity) || 1));
      if (revenue > 0 && cashInDate >= today) {
        const daysUntil = Math.ceil((cashInDate - today) / (1000*60*60*24));
        if (daysUntil <= 90) {
          cashInEntries.push({
            date: cashInDate, daysUntil, market, revenue,
            saleDate: saleDate.toISOString().substring(0,10),
            product: s.product || s.name || '상품'
          });
        }
      }
    });
  }

  // Mock 판매 예정표 삭제됨 (V5.5 — 실 데이터 전용)
  // 판매 기록이 없으면 빈 UI 표시


  // 날짜순 정렬
  cashInEntries.sort((a,b) => a.date - b.date);

  // 타임라인 렌더링
  const container = document.getElementById('cashin-timeline');
  if (!container) return;

  if (cashInEntries.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px; font-size:12px;">향후 30일 내 입금 예정이 없습니다.</div>';
    return;
  }

  const marketColors = { '네이버': '#1EC800', '쿠팡': '#E31837', '11번가': '#FF5722', '위메프': '#FF6B6B' };
  let sum7 = 0, sum30 = 0;

  container.innerHTML = cashInEntries.map(e => {
    if (e.daysUntil <= 7) sum7 += e.revenue;
    if (e.daysUntil <= 30) sum30 += e.revenue;
    const dateStr = e.date.toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
    const isUrgent = e.daysUntil <= 3;
    const mColor = marketColors[e.market] || 'var(--accent)';
    const mockTag = e.isMock ? ' <span style="font-size:9px;color:var(--text-muted);">[MOCK]</span>' : '';

    return `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); ${isUrgent ? 'background:rgba(239,68,68,0.05); border-radius:8px; padding:8px;' : ''}">
      <div style="min-width:50px; text-align:center;">
        <div style="font-size:13px; font-weight:800; ${isUrgent ? 'color:#ef4444;' : 'color:var(--text);'}">${dateStr}</div>
        <div style="font-size:9px; color:var(--text-muted);">${e.daysUntil === 0 ? '오늘' : `D+${e.daysUntil}`}</div>
      </div>
      <div style="width:4px; height:32px; border-radius:2px; background:${mColor};"></div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:12px; font-weight:600; color:var(--text);">${e.product}${mockTag}</div>
        <div style="font-size:10px; color:var(--text-muted);">판매일 ${e.saleDate} → <span style="color:${mColor}; font-weight:700;">${e.market}</span> D+${SETTLE_DAYS[e.market] || '?'}</div>
      </div>
      <div style="font-weight:800; font-size:13px; color:#22c55e; white-space:nowrap;">₩${e.revenue.toLocaleString()}</div>
    </div>`;
  }).join('');

  // 요약 카드
  const el = (id) => document.getElementById(id);
  if (el('cashin-7d')) el('cashin-7d').textContent = '₩' + sum7.toLocaleString();
  if (el('cashin-30d')) el('cashin-30d').textContent = '₩' + sum30.toLocaleString();

  // Miller-Orr 하한과 비교하여 경고
  const moLower = Number(document.getElementById('mo-lower')?.value) || 100000;
  const alertEl = el('cashin-alert');
  if (alertEl) {
    if (sum7 < moLower * 0.5) {
      alertEl.textContent = '⚠️ 위험';
      alertEl.style.color = '#ef4444';
    } else if (sum7 < moLower) {
      alertEl.textContent = '⚡ 주의';
      alertEl.style.color = '#f59e0b';
    } else {
      alertEl.textContent = '✅ 안전';
      alertEl.style.color = '#22c55e';
    }
  }
}

// ==================== V5.5 T4 사입 대금 vs Cash-in 교차 비교 ====================
// [MODULARIZED] T4~T7 탭별 로직은 외부 JS 파일로 분리됨
// js/t4/finance.js, js/t5/studio.js, js/t6/oms.js, js/t7/settings.js