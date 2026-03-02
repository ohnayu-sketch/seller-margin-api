const API_KEYS = {
  backendUrl: 'seller-api-url',
  domeggook: 'domeggook-api-key',
  domemae: 'domemae-api-key',
  onchannel: 'onchannel-api-key',
  kakao: 'kakao-api-key',
  'smartstore-client-id': 'smartstore-client-id',
  'smartstore-client-secret': 'smartstore-client-secret',
  'coupang-access-key': 'coupang-access-key',
  'coupang-secret-key': 'coupang-secret-key',
  '11st-api-key': '11st-api-key',
};
function getBackendUrl() {
  const u = (localStorage.getItem(API_KEYS.backendUrl) || localStorage.getItem('api-url') || 'https://seller-margin-api-georgia-5lro.onrender.com').trim().replace(/\/$/, '');
  return u || 'https://seller-margin-api-georgia-5lro.onrender.com';
}
function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Domeggook-Key': localStorage.getItem(API_KEYS.domeggook) || '',
    'X-Domemae-Key': localStorage.getItem(API_KEYS.domemae) || '',
    'X-Onchannel-Key': localStorage.getItem(API_KEYS.onchannel) || '',
  };
}
async function callApi(endpoint, params = {}) {
  const url = new URL(getBackendUrl() + endpoint);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });
  const res = await fetch(url, { headers: getApiHeaders() });
  return res.json();
}

let API_URL = getBackendUrl();
const SHEET_ID = '1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg';

// ==================== STATE ====================
let products = [];
let salesRecords = [];
let accountingRecords = [];
let currentUser = localStorage.getItem('seller-user') || '';
let markets = { smart: true, coupang: true, open: true };
window._lastSearch = null;
let _salesRecordProduct = null;

const MARKET_FEES = {
  smartstore:   { name: '?ㅻ쭏?몄뒪?좎뼱', fee: 6.6, color: '#03c75a' },
  coupang:      { name: '荑좏뙜',        fee: 8.0, color: '#ff6900' },
  '11st':       { name: '11踰덇?',      fee: 8.0, color: '#ff0000' },
  gmarket:      { name: 'G留덉폆',       fee: 9.0, color: '#ff6600' },
  auction:      { name: '?μ뀡',        fee: 9.0, color: '#ff0000' },
  wemakeprice:  { name: '?꾨찓??,      fee: 6.0, color: '#8b0085' },
  tmon:         { name: '?곕が',        fee: 6.0, color: '#ff4500' },
  kakaoshopping:{ name: '移댁뭅?ㅼ눥??,  fee: 5.5, color: '#fee500' },
};
const MARKET_IDS = Object.keys(MARKET_FEES);
const MARKET_INFO = Object.fromEntries(MARKET_IDS.map(k => [k, { name: MARKET_FEES[k].name, class: k, color: MARKET_FEES[k].color }]));
// ?섏쐞 ?명솚
markets = Object.fromEntries(MARKET_IDS.map(k => [k, true]));

// ==================== GOOGLE AUTH CONFIG ====================
const CLIENT_ID = '985307778387-1v16a641sg34lsmsdbliamfcettauto6.apps.googleusercontent.com';
// ?좑툘 ?덉슜??援ш? ?대찓??二쇱냼 2媛쒕? ?꾨옒???낅젰?섏꽭??const ALLOWED_EMAILS = [
  localStorage.getItem('allowed-email-1') || '',
  localStorage.getItem('allowed-email-2') || '',
].filter(Boolean);

let googleUser = null;

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  var search = window.location.search || '';
  if (search.indexOf('skip_auth=1') !== -1) {
    onAuthSuccess('bypass@local', '?고쉶');
    return;
  }
  var hash = (window.location.hash || '').replace(/^#/, '');
  if (hash.indexOf('id_token=') !== -1 || hash.indexOf('error=') !== -1) {
    if (typeof processGoogleUserFromHash === 'function') processGoogleUserFromHash();
    return;
  }
  var savedEmail = sessionStorage.getItem('auth-email') || localStorage.getItem('auth-email');
  var savedName = sessionStorage.getItem('auth-name') || localStorage.getItem('auth-name');
  if (savedEmail && savedName) {
    onAuthSuccess(savedEmail, savedName);
  } else {
    showLoginScreen();
    if (search.indexOf('oauth_debug=1') !== -1 && typeof _oauthDebug === 'function') {
      var redirectUri = window.location.origin + window.location.pathname + (search || '');
      _oauthDebug('由щ뵒?됱뀡 URI (援ш? 肄섏넄????二쇱냼 異붽?):', { redirect_uri: redirectUri });
      var hint = document.getElementById('login-redirect-uri-hint');
          if (hint) { hint.style.display = 'block'; hint.innerHTML = '?꾨옒瑜?洹몃?濡?援ш? 肄섏넄 ???뱀씤??由щ뵒?됱뀡 URI??異붽??섏꽭??<br><code style="font-size:11px">' + redirectUri + '</code>'; }
    }
  }
});

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-wrapper').style.display = 'none';
  var resetArea = document.getElementById('login-reset-pw-area');
  if (resetArea) resetArea.style.display = (window.location.search || '').indexOf('reset_pw=1') !== -1 ? 'block' : 'none';
}

// 鍮꾨?踰덊샇 ?딆뿀???? 二쇱냼???reset_pw=1 遺숈뿬???대㈃ ?쒖떆?섎뒗 踰꾪듉?쇰줈 0000 蹂듦뎄
function resetAppPasswordToDefault() {
  localStorage.removeItem('app-login-password');
  var pwEl = document.getElementById('login-password');
  if (pwEl) pwEl.value = '';
  if (typeof showToast === 'function') showToast('鍮꾨?踰덊샇媛 0000?쇰줈 珥덇린?붾릺?덉뒿?덈떎. ?ㅼ떆 濡쒓렇?명븯?몄슂.');
}

// ??鍮꾨?踰덊샇 議고쉶 (誘몄꽕????湲곕낯 0000)
function getAppPassword() {
  return localStorage.getItem('app-login-password') || '0000';
}

// 鍮꾨?踰덊샇留?濡쒓렇??(0000? ??긽 ?덉슜). ?몄뀡 ??????덈줈怨좎묠?섎㈃ ??吏꾩엯.
function doSimpleLogin() {
  var pwEl = document.getElementById('login-password');
  var btn = document.getElementById('login-submit-btn');
  if (!pwEl) return;
  var password = (pwEl.value || '').trim();
  if (!password) {
    try { if (typeof showToast === 'function') showToast('鍮꾨?踰덊샇瑜??낅젰?섏꽭??', true); } catch(e) {}
    return;
  }
  var stored = getAppPassword();
  if (password !== '0000' && password !== stored) {
    try { if (typeof showToast === 'function') showToast('鍮꾨?踰덊샇媛 留욎? ?딆뒿?덈떎.', true); } catch(e) {}
    return;
  }
  if (btn) btn.disabled = true;
  try {
    sessionStorage.setItem('auth-email', 'user@local');
    sessionStorage.setItem('auth-name', '?ъ슜??);
    localStorage.setItem('auth-email', 'user@local');
    localStorage.setItem('auth-name', '?ъ슜??);
  } catch(e) {}
  var ls = document.getElementById('login-screen');
  var aw = document.getElementById('app-wrapper');
  if (ls) ls.classList.add('hidden');
  if (aw) aw.style.display = 'block';
  try { if (typeof onAuthSuccess === 'function') onAuthSuccess('user@local', '?ъ슜??); } catch(err) {}
}

// ?ㅼ젙 ??뿉????鍮꾨?踰덊샇 蹂寃?function changeAppPassword() {
  var currentEl = document.getElementById('change-pw-current');
  var newEl = document.getElementById('change-pw-new');
  var confirmEl = document.getElementById('change-pw-confirm');
  if (!currentEl || !newEl || !confirmEl) return;
  var current = (currentEl.value || '').trim();
  var newPw = (newEl.value || '').trim();
  var confirm = (confirmEl.value || '').trim();
  if (current !== getAppPassword()) {
    if (typeof showToast === 'function') showToast('?꾩옱 鍮꾨?踰덊샇媛 留욎? ?딆뒿?덈떎.', true);
    return;
  }
  if (!newPw) {
    if (typeof showToast === 'function') showToast('??鍮꾨?踰덊샇瑜??낅젰?섏꽭??', true);
    return;
  }
  if (newPw !== confirm) {
    if (typeof showToast === 'function') showToast('??鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.', true);
    return;
  }
  localStorage.setItem('app-login-password', newPw);
  currentEl.value = '';
  newEl.value = '';
  confirmEl.value = '';
  if (typeof showToast === 'function') showToast('鍮꾨?踰덊샇媛 蹂寃쎈릺?덉뒿?덈떎.');
}

// ---------- 援ш? OAuth (由щ뵒?됲듃 諛⑹떇 + ?붾쾭洹?濡쒓렇) ----------
function startGoogleOAuth() {
  var nonce = Math.random().toString(36).slice(2) + Date.now();
  try { sessionStorage.setItem('oauth-nonce', nonce); } catch(e) {}
  var base = window.location.origin + window.location.pathname;
  var search = (window.location.search || '').indexOf('oauth_debug=1') !== -1 ? window.location.search : '';
  var redirectUri = base + search;
  var params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token token',
    scope: 'openid email profile',
    nonce: nonce
  });
  var url = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  if (typeof _oauthDebug === 'function') _oauthDebug('由щ뵒?됲듃 ?쒕룄', { redirect_uri: redirectUri });
  window.location.assign(url);
}

function processGoogleUserFromHash() {
  var hash = (window.location.hash || '').replace(/^#/, '');
  if (typeof _oauthDebug === 'function') _oauthDebug('蹂듦? hash', { hash: hash.substring(0, 80) + (hash.length > 80 ? '...' : '') });
  var params = new URLSearchParams(hash);
  var error = params.get('error');
  if (error) {
    if (typeof _oauthDebug === 'function') _oauthDebug('OAuth ?ㅻ쪟', { error: error, description: params.get('error_description') });
    if (typeof showToast === 'function') showToast('援ш? 濡쒓렇???ㅻ쪟: ' + (params.get('error_description') || error), true);
    window.location.hash = '';
    showLoginScreen();
    return;
  }
  var idToken = params.get('id_token');
  if (!idToken) {
    if (typeof _oauthDebug === 'function') _oauthDebug('hash??id_token ?놁쓬');
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
    if (typeof _oauthDebug === 'function') _oauthDebug('JWT ?뚯떛 ?ㅽ뙣', { err: String(e) });
    showLoginScreen();
    return;
  }
  if (payload.nonce && storedNonce && payload.nonce !== storedNonce) {
    if (typeof _oauthDebug === 'function') _oauthDebug('nonce 遺덉씪移?);
    showLoginScreen();
    return;
  }
  var email = (payload.email || '').trim();
  var name = (payload.name || payload.email || '?ъ슜??).trim();
  try { sessionStorage.removeItem('oauth-nonce'); } catch(e) {}
  window.location.hash = '';
  if (typeof _oauthDebug === 'function') _oauthDebug('濡쒓렇??泥섎━', { email: email, name: name });
  processGoogleUser(email, name);
}

function processGoogleUser(email, name) {
  if (!isAllowed(email)) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').style.display = 'none';
    var denied = document.getElementById('access-denied');
    var deniedEmail = document.getElementById('denied-email');
    if (denied) denied.classList.add('show');
    if (deniedEmail) deniedEmail.textContent = email;
    if (typeof _oauthDebug === 'function') _oauthDebug('?묎렐 嫄곕? (?덉슜 紐⑸줉???놁쓬)', { email: email });
    return;
  }
  try {
    sessionStorage.setItem('auth-email', email);
    sessionStorage.setItem('auth-name', name);
    localStorage.setItem('auth-email', email);
    localStorage.setItem('auth-name', name);
  } catch(e) {}
  onAuthSuccess(email, name);
}

function isAllowed(email) {
  if (email === 'bypass@local') return true; // 援ш? ?몄쬆 ?고쉶(媛쒕컻/?뚯뒪?몄슜)
  if (ALLOWED_EMAILS.length === 0) return true; // ?대찓??誘몄꽕?????쇰떒 ?덉슜
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

function onAuthSuccess(email, name) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('access-denied').classList.remove('show');
  document.getElementById('app-wrapper').style.display = 'block';

  // ?⑦렪/?꾨궡 ?먮룞 ?먮떒
  const email1 = localStorage.getItem('allowed-email-1') || '';
  currentUser = email.toLowerCase() === email1.toLowerCase() ? '?⑦렪' : '?꾨궡';
  localStorage.setItem('seller-user', currentUser);

  document.getElementById('user-badge').textContent = currentUser === '?⑦렪' ? '?뫅 ' + currentUser : '?뫆 ' + currentUser;
  document.getElementById('current-user-display').textContent = `${currentUser} (${email})`;

  const savedUrl = localStorage.getItem('script-url');
  if (savedUrl) {
    document.getElementById('script-url-input').value = savedUrl;
    loadProducts();
  } else {
    setSyncStatus('error', 'URL 誘몄꽕??);
  }
  const savedApiUrl = getBackendUrl();
  const be = document.getElementById('api-backendUrl');
  if (be && savedApiUrl) be.value = savedApiUrl;
  renderHistory();
  recalcMargin();
  if (typeof loadVendors === 'function') loadVendors();
}

function signOut() {
  sessionStorage.removeItem('auth-email');
  sessionStorage.removeItem('auth-name');
  localStorage.removeItem('auth-email');
  localStorage.removeItem('auth-name');
  if (window.google) google.accounts.id.disableAutoSelect();
  location.reload();
}

// ==================== USER ====================
function showUserModal() { /* 援ш? 濡쒓렇?몄쑝濡??泥대맖 */ }
function setUser(name) { /* 援ш? 濡쒓렇?몄쑝濡??泥대맖 */ }

// ==================== SYNC STATUS ====================
function setSyncStatus(state, label) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  dot.className = 'sync-dot ' + state;
  lbl.textContent = label;
}

// ==================== TABS ====================
const TAB_IDS = ['calc','list','sales','accounting','stats','season','setup'];
let currentTabIndex = () => TAB_IDS.findIndex(id => document.getElementById('page-' + id)?.classList.contains('active'));
function nextTab() { const i = currentTabIndex(); if (i < TAB_IDS.length - 1) showTab(TAB_IDS[i + 1]); }
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

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', TAB_IDS[i] === name);
  });
  document.querySelectorAll('.tab-bar-item').forEach((t, i) => {
    t.classList.toggle('active', TAB_IDS[i] === name);
  });
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.style.opacity = ''; });
  const page = document.getElementById('page-' + name);
  if (page) {
    page.classList.add('active');
    page.style.opacity = '0';
    requestAnimationFrame(() => { requestAnimationFrame(() => { page.style.opacity = '1'; }); });
  }
  if (name === 'calc') { renderHistory(); recalcMargin(); }
  if (name === 'list') renderList();
  if (name === 'sales') loadSalesPage();
  if (name === 'accounting') loadAccountingPage();
  if (name === 'stats') renderStats();
  if (name === 'season') loadSeasonPage();
  if (name === 'setup') {
    const e1 = localStorage.getItem('allowed-email-1') || '';
    const e2 = localStorage.getItem('allowed-email-2') || '';
    const email1El = document.getElementById('email-1-input');
    const email2El = document.getElementById('email-2-input');
    if (email1El) email1El.value = e1;
    if (email2El) email2El.value = e2;
    if (typeof loadApiKeys === 'function') loadApiKeys();
  }
}

// ==================== CALCULATE ====================
function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
function fmtPct(n) { return parseFloat(n).toFixed(1) + '%'; }

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
    if (msg) msg.textContent = key ? '?꾨ℓ袁?API ?ㅺ? ?ㅼ젙?섏뼱 ?덉뒿?덈떎. 寃?됱뼱瑜??낅젰 ??寃?됲븯?몄슂.' : '?ㅼ젙 ??뿉???꾨ℓ袁?API ?ㅻ? ?낅젰?섎㈃ 寃?됲븷 ???덉뒿?덈떎.';
  } else {
    if (direct) direct.style.display = 'block';
    if (search) search.style.display = 'none';
    if (btnDirect) btnDirect.classList.add('active');
    if (btnSearch) btnSearch.classList.remove('active');
  }
}

function calcForMarket(cost, supShip, mktShip, feeRate, targetMargin) {
  const totalCost = cost + supShip;
  let salePrice, feeAmt, profit, marginRate;
  if (targetMargin > 0) {
    const denom = 1 - feeRate / 100 - targetMargin / 100;
    salePrice = denom <= 0 ? 0 : Math.ceil((totalCost + mktShip) / denom);
    feeAmt = salePrice * feeRate / 100;
    profit = salePrice - feeAmt - mktShip - totalCost;
    marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  } else {
    salePrice = 0; feeAmt = 0;
    profit = -(totalCost + mktShip);
    marginRate = 0;
  }
  return { salePrice, feeAmt, profit, marginRate, totalCost };
}

function getInputs() {
  const sel = document.getElementById('calc-market-select');
  const marketId = (sel && sel.value) || 'smartstore';
  const feeVal = parseFloat(document.getElementById('fee-single').value) || MARKET_FEES[marketId].fee;
  const fees = {};
  MARKET_IDS.forEach(k => { fees[k] = k === marketId ? feeVal : MARKET_FEES[k].fee; });
  return {
    name: document.getElementById('productName').value.trim() || '誘몄엯???곹뭹',
    cost: parseFloat(document.getElementById('costPrice').value) || 0,
    supShip: parseFloat(document.getElementById('supplyShipping').value) || 0,
    mktShip: parseFloat(document.getElementById('marketShipping').value) || 0,
    target: parseFloat(document.getElementById('targetMargin').value) || 0,
    selectedMarketId: marketId,
    fees
  };
}

// ==================== C-1: ?쒖쨷媛 議고쉶 ====================
function competitionLabel(score) {
  if (score <= 33) return { text: '?윟 ??쓬', cls: 'competition-low' };
  if (score <= 66) return { text: '?윞 蹂댄넻', cls: 'competition-mid' };
  return { text: '?뵶 ?믪쓬', cls: 'competition-high' };
}
async function fetchMarketPrice() {
  const name = document.getElementById('productName').value.trim();
  if (!name) { showToast('?곹뭹紐낆쓣 ?낅젰?섏꽭??, true); return; }
  const base = getBackendUrl();
  if (!base) { showToast('?ㅼ젙?먯꽌 諛깆뿏??API URL???낅젰?섏꽭??, true); showTab('setup'); return; }
  const btn = document.getElementById('btn-market-search');
  btn.disabled = true;
  const box = document.getElementById('market-price-box');
  try {
    const searchUrl = base + '/search?query=' + encodeURIComponent(name) + '&display=30&include_trend=true';
    const [searchRes, categoryRes, statsRes] = await Promise.all([
      fetch(searchUrl, { headers: getApiHeaders() }),
      fetch(base + '/category?query=' + encodeURIComponent(name), { headers: getApiHeaders() }),
      fetch(base + '/product-stats?query=' + encodeURIComponent(name), { headers: getApiHeaders() })
    ]);
    const search = await searchRes.json();
    const category = await categoryRes.json();
    const stats = await statsRes.json();
    if (!search.success) { showToast(search.error || '?쒖쨷媛 議고쉶 ?ㅽ뙣', true); return; }
    const minP = search.min_price || 0;
    const avgP = search.avg_price || 0;
    const maxP = search.max_price || 0;
    document.getElementById('mp-min').textContent = fmt(minP) + '??;
    document.getElementById('mp-avg').textContent = fmt(avgP) + '??;
    document.getElementById('mp-max').textContent = fmt(maxP) + '??;
    const sellerCount = search.seller_count != null ? search.seller_count : (stats.seller_count != null ? stats.seller_count : null);
    document.getElementById('mp-sellers').textContent = sellerCount != null ? fmt(sellerCount) + '媛? : '??;
    const score = (stats.success && stats.competition_score != null) ? stats.competition_score : 50;
    const comp = competitionLabel(score);
    const compEl = document.getElementById('mp-competition');
    compEl.textContent = comp.text;
    compEl.className = 'competition-badge ' + comp.cls;
    const catVal = (category.success && category.category) ? category.category : '';
    const catAuto = document.getElementById('mp-category-auto');
    catAuto.textContent = catVal ? '?먮룞: ' + catVal : '??;
    const catSelect = document.getElementById('mp-category-select');
    if (catSelect) { catSelect.value = catVal || ''; }
    const refPrice = document.getElementById('ref-price');
    if (refPrice) refPrice.value = avgP > 0 ? avgP : '';
    const trendSection = document.getElementById('mp-trend-section');
    if (search.trend && search.trend.success) {
      const t = search.trend;
      trendSection.style.display = 'block';
      document.getElementById('mp-trend-text').textContent = (t.season_desc || '??);
      document.getElementById('mp-season').textContent = (t.season_icon || '') + ' ' + (t.season || '??);
      const miniChart = document.getElementById('mp-mini-chart');
      if (miniChart && t.monthly_data && t.monthly_data.length) {
        const maxR = Math.max(...t.monthly_data);
        const h = 36;
        miniChart.innerHTML = t.monthly_data.map(r => '<span style="height:' + (maxR > 0 ? Math.max(2, (r / maxR * h)) : 0) + 'px" title="' + r + '"></span>').join('');
      } else {
        const mc = document.getElementById('mp-mini-chart'); if (mc) mc.innerHTML = '';
      }
    } else {
      trendSection.style.display = 'none';
    }
    const targetRes = await fetch(base + '/target?query=' + encodeURIComponent(name) + '&category=' + encodeURIComponent(catVal || ''), { headers: getApiHeaders() }).then(r => r.json()).catch(function(err) { console.error('?寃잛링 議고쉶 ?ㅽ뙣', err); return {}; });
    const targetSection = document.getElementById('mp-target-section');
    if (targetSection) {
      targetSection.style.display = 'block';
      const g = targetRes.gender;
      const a = targetRes.age_groups;
      const main = targetRes.main_target;
      const isFail = !g && !a && (main === '議고쉶 遺덇?' || !main);
      if (isFail) {
        targetSection.classList.add('mp-target-fail');
        document.getElementById('mp-gender').textContent = '';
        document.getElementById('mp-age').textContent = '';
        document.getElementById('mp-main-target').textContent = '?뫁 ?寃잛링: ?곗씠??以鍮?以?;
      } else {
        targetSection.classList.remove('mp-target-fail');
        document.getElementById('mp-gender').textContent = g ? ('?ъ꽦 ' + (g.female || 0) + '% / ?⑥꽦 ' + (g.male || 0) + '%') : '??;
        document.getElementById('mp-age').textContent = a ? Object.entries(a).map(([k, v]) => k + ' ' + v + '%').join(' 쨌 ') : '??;
        document.getElementById('mp-main-target').textContent = main || '??;
      }
    }
    const productsSection = document.getElementById('mp-products-section');
    const topItems = search.top_items || [];
    if (productsSection && topItems.length) {
      productsSection.style.display = 'block';
      var minP2 = minP || 0, avgP2 = avgP || 0;
      var maxP2 = maxP || 0;
      var byMin = topItems.slice().sort(function(a, b) { return Math.abs((a.price || 0) - minP2) - Math.abs((b.price || 0) - minP2); });
      var byAvg = topItems.slice().sort(function(a, b) { return Math.abs((a.price || 0) - avgP2) - Math.abs((b.price || 0) - avgP2); });
      var byMax = topItems.slice().sort(function(a, b) { return Math.abs((a.price || 0) - maxP2) - Math.abs((b.price || 0) - maxP2); });
      function cardHtml(it) {
        var link = (it.link || '').replace(/^http:/, 'https:');
        var img = (it.image || '').replace(/^http:/, 'https:');
        return '<div class="mp-product-card"><a href="' + escapeHtml(link) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(img || '') + '" alt="" onerror="this.style.background=\'var(--surface2)\';this.onerror=null"><div class="mp-pc-price">' + fmt(it.price || 0) + '??/div><div class="mp-pc-mall">' + escapeHtml(it.mall || '') + '</div><span class="mp-pc-link">?뵕 蹂닿린</span></a></div>';
      }
      var minLabel = document.getElementById('mp-products-min-label');
      var avgLabel = document.getElementById('mp-products-avg-label');
      var maxLabel = document.getElementById('mp-products-max-label');
      if (minLabel) minLabel.textContent = minP2 ? '?썚截??쒖쨷 理쒖?媛 ' + fmt(minP2) + '??洹쇱쿂 ?곹뭹:' : '?썚截??쒖쨷 理쒖?媛 洹쇱쿂 ?곹뭹';
      if (avgLabel) avgLabel.textContent = avgP2 ? '?썚截??쒖쨷 ?됯퇏媛 ' + fmt(avgP2) + '??洹쇱쿂 ?곹뭹:' : '?썚截??쒖쨷 ?됯퇏媛 洹쇱쿂 ?곹뭹';
      if (maxLabel) maxLabel.textContent = maxP2 ? '?썚截??쒖쨷 理쒓퀬媛 ' + fmt(maxP2) + '??洹쇱쿂 ?곹뭹:' : '?썚截??쒖쨷 理쒓퀬媛 洹쇱쿂 ?곹뭹';
      document.getElementById('mp-product-cards-min').innerHTML = byMin.slice(0, 5).map(cardHtml).join('');
      document.getElementById('mp-product-cards-avg').innerHTML = byAvg.slice(0, 5).map(cardHtml).join('');
      document.getElementById('mp-product-cards-max').innerHTML = byMax.slice(0, 5).map(cardHtml).join('');
      var byPopular = topItems.slice().sort(function(a, b) { return (b.review_count || 0) - (a.review_count || 0); });
      var popularSection = document.getElementById('mp-popular-section');
      var popularList = document.getElementById('mp-popular-list');
      if (popularSection && popularList && byPopular.length) {
        popularSection.style.display = 'block';
        popularList.innerHTML = byPopular.slice(0, 5).map(function(it, i) {
          var link = (it.link || '').replace(/^http:/, 'https:');
          var img = (it.image || '').replace(/^http:/, 'https:');
          var title = (it.title || '').slice(0, 24);
          return '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;text-decoration:none"><div style="font-size:16px;font-weight:900;color:var(--accent);width:24px;text-align:center">' + (i + 1) + '</div><img src="' + escapeHtml(img) + '" style="width:44px;height:44px;object-fit:cover;border-radius:6px" alt=""><div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + escapeHtml(title) + '</div><div style="font-size:13px;font-weight:700;color:var(--accent)">' + fmt(it.price || 0) + '??/div><div style="font-size:11px;color:var(--text-muted)">' + escapeHtml(it.mall || '') + '</div></div></a>';
        }).join('');
      } else {
        if (popularSection) popularSection.style.display = 'none';
      }
    } else {
      if (productsSection) productsSection.style.display = 'none';
    }
    _currentSearchKeyword = name;
    var wsSection = document.getElementById('wholesale-section');
    if (wsSection) {
      wsSection.style.display = 'block';
      fetchWholesaleProducts(name, _currentWholesaleSite);
    }
    box.classList.add('show');
    saveToHistory(name, { min_price: minP, avg_price: avgP, max_price: maxP });
    var topItems = search.top_items || [];
    var thumbUrl = (topItems[0] && topItems[0].image) ? (topItems[0].image || '').replace(/^http:/, 'https:') : '';
    window._lastSearch = {
      min_price: minP, avg_price: avgP, max_price: maxP,
      category: catVal || (catSelect && catSelect.value) || '',
      competitionLevel: score <= 33 ? '??쓬' : score <= 66 ? '蹂댄넻' : '?믪쓬',
      competitionScore: score,
      seller_count: sellerCount,
      targetGender: targetRes.gender,
      targetAge: targetRes.age_groups,
      mainTarget: targetRes.main_target,
      trendSeason: (search.trend && search.trend.season) ? search.trend.season : '',
      thumbnailUrl: thumbUrl,
      photoUrl: thumbUrl
    };
    showToast('?쒖쨷媛 議고쉶 ?꾨즺');
  } catch (e) {
    showToast('API ?곌껐 ?ㅽ뙣', true);
  }
  btn.disabled = false;
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
      return '<span class="related-keyword-chip" role="button" tabindex="0" data-keyword="' + escapeHtml(kw) + '" onclick="selectKeyword(this.getAttribute(\'data-keyword\'))">' + escapeHtml(kw) + '</span>';
    }).join('');
  } catch (e) {
    el.innerHTML = '';
  }
}
function selectKeyword(kw) {
  document.getElementById('productName').value = kw;
  var el = document.getElementById('related-keywords');
  if (el) el.innerHTML = '';
  fetchMarketPrice();
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
  var base = getBackendUrl();
  if (!base) return;
  var cardsEl = document.getElementById('wholesale-cards');
  if (!cardsEl) return;
  cardsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px">寃??以?..</div>';
  try {
    var res = await fetch(base + '/wholesale?query=' + encodeURIComponent(keyword) + '&site=' + encodeURIComponent(site || 'default'), { headers: getApiHeaders() });
    var data = await res.json();
    if (!data.success || !(data.items && data.items.length)) {
      cardsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px 0">寃??寃곌낵媛 ?놁뒿?덈떎</div>';
      _wholesaleItems = [];
      return;
    }
    _wholesaleItems = data.items;
    var items = _wholesaleItems;
    cardsEl.innerHTML = items.map(function(it, i) {
      var link = (it.link || '').replace(/^http:/, 'https:');
      var img = (it.image || '').replace(/^http:/, 'https:');
      var price = it.price || 0;
      var minQty = it.min_qty || 1;
      var title = (it.name || it.title || '').slice(0, 16);
      return '<div class="wholesale-card" id="ws-card-' + i + '" onclick="selectWholesaleProduct(' + i + ')"><img src="' + escapeHtml(img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"><div class="ws-price">' + fmt(price) + '??/div><div class="ws-name">' + escapeHtml(title) + '</div><div class="ws-min-qty">理쒖냼 ' + minQty + '媛?/div><button type="button" class="ws-select-btn" onclick="event.stopPropagation();selectWholesaleProduct(' + i + ')">?먭? ?곸슜</button></div>';
    }).join('');
  } catch (e) {
    cardsEl.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:20px 0">?꾨ℓ 寃???ㅻ쪟</div>';
    _wholesaleItems = [];
  }
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
  showToast('?먭? ' + fmt(price) + '???먮룞 ?낅젰??);
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
function previewDirectPhoto(input) {
  var preview = document.getElementById('direct-photo-preview');
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
function saveDirectSourcingNote() {
  var name = document.getElementById('productName').value.trim();
  var vendorSelect = document.getElementById('direct-vendor-select');
  var vendorInput = document.getElementById('direct-vendor');
  var vendorId = (vendorSelect && vendorSelect.value) || '';
  var vendorName = (vendorInput && vendorInput.value.trim()) || '';
  if (vendorId && window._vendors) {
    var v = window._vendors.find(function(x) { return x.id === vendorId; });
    if (v) vendorName = v.name || vendorName;
  }
  var price = parseFloat((document.getElementById('direct-unit-price') && document.getElementById('direct-unit-price').value) || 0) || 0;
  var minQty = parseInt((document.getElementById('direct-min-qty') && document.getElementById('direct-min-qty').value) || 1, 10) || 1;
  var leadTime = (document.getElementById('direct-lead-time') && document.getElementById('direct-lead-time').value.trim()) || '';
  var paymentTerms = (document.getElementById('direct-payment-terms') && document.getElementById('direct-payment-terms').value) || '';
  var consignRadios = document.querySelectorAll('input[name="direct-consign"]');
  var consignAvail = '誘명솗??;
  if (consignRadios.length) { for (var i = 0; i < consignRadios.length; i++) { if (consignRadios[i].checked) { consignAvail = consignRadios[i].value; break; } } }
  var contact = (document.getElementById('direct-contact') && document.getElementById('direct-contact').value.trim()) || '';
  var memo = (document.getElementById('direct-memo') && document.getElementById('direct-memo').value.trim()) || '';
  var preview = document.getElementById('direct-photo-preview');
  var photo = (preview && preview.dataset && preview.dataset.base64) ? preview.dataset.base64 : '';
  if (!name && !price) { showToast('?곹뭹紐??먮뒗 ?④?瑜??낅젰?섏꽭??, true); return; }
  var noteId = Date.now();
  var savedAt = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]'); } catch (e) {}
  notes.unshift({ id: noteId, name: name || '誘몄엯??, vendor: vendorName, vendorId: vendorId, price: price, minQty: minQty, leadTime: leadTime, paymentTerms: paymentTerms, consignAvail: consignAvail, contact: contact, memo: memo, photo: photo, at: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), photoUrl: '', rowNum: null });
  notes = notes.slice(0, 20);
  localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes));
  showToast('?ъ엯 硫붾え ??λ맖');
  var clearIds = ['direct-vendor', 'direct-unit-price', 'direct-min-qty', 'direct-lead-time', 'direct-contact', 'direct-memo'];
  clearIds.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  if (document.getElementById('direct-payment-terms')) document.getElementById('direct-payment-terms').value = '';
  if (vendorSelect) vendorSelect.value = '';
  if (SCRIPT_URL && (photo || name)) {
    var payload = { action: 'saveDirectRecord', productName: name || '誘몄엯??, vendorId: vendorId, vendorName: vendorName, unitPrice: price, minQty: minQty, photoBase64: photo || '', savedAt: savedAt, leadTime: leadTime, paymentTerms: paymentTerms, consignAvail: consignAvail, memo: memo, savedBy: currentUser || '?⑦렪' };
    fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
          var n = notes.find(function(x) { return x.id === noteId; });
          if (n) { n.photoUrl = data.photoUrl || ''; n.vendorId = data.vendorId || ''; n.rowNum = data.rowNum || null; localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes)); }
          renderDirectNotes();
          showToast('?ъ엯湲곕줉 ?쒗듃????λ맖');
        }
      })
      .catch(function() {});
  }
  renderDirectNotes();
}
function renderDirectNotes() {
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]'); } catch (e) {}
  var listEl = document.getElementById('direct-notes-list');
  var cardsEl = document.getElementById('direct-notes-cards');
  if (!listEl || !cardsEl) return;
  var today = new Date().toLocaleDateString('ko-KR');
  var todayNotes = notes.filter(function(n) { return new Date(n.id).toLocaleDateString('ko-KR') === today; });
  if (!todayNotes.length) { listEl.style.display = 'none'; return; }
  listEl.style.display = 'block';
  cardsEl.innerHTML = todayNotes.map(function(n) {
    var photoHtml = n.photo ? '<img src="' + n.photo + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0" alt="">' : '<div style="width:56px;height:56px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">?벀</div>';
    var photoLink = n.photoUrl ? '<a href="' + escapeHtml(n.photoUrl) + '" target="_blank" rel="noopener" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block">?벜 ?ъ쭊</a>' : '';
    var leadStr = (n.leadTime ? ' ?⑷린 ' + escapeHtml(n.leadTime) : '') + (n.consignAvail ? ' 쨌 ?꾪긽 ' + escapeHtml(n.consignAvail) : '');
    var consignBtn = (n.consignAvail === '媛??) ? '<button type="button" onclick="registerAsConsignment(' + n.id + ')" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#0d0f14;cursor:pointer;font-family:inherit">?뤇截??꾪긽?깅줉</button>' : '';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">' + photoHtml + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">' + escapeHtml(n.name) + '</div><div style="font-size:12px;color:var(--accent);font-weight:700">' + fmt(n.price) + '??횞 理쒖냼' + n.minQty + '媛?/div>' + (n.vendor ? '<div style="font-size:11px;color:var(--text-muted)">' + escapeHtml(n.vendor) + '</div>' : '') + (leadStr ? '<div style="font-size:11px;color:var(--text-muted)">' + leadStr + '</div>' : '') + (n.memo ? '<div style="font-size:11px;color:var(--text-muted)">' + escapeHtml(n.memo) + '</div>' : '') + '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">' + escapeHtml(n.at) + '</div></div><div style="display:flex;flex-direction:column;gap:4px">' + photoLink + '<button type="button" onclick="loadDirectNote(' + n.id + ')" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-family:inherit">?뱤 怨꾩궛</button>' + consignBtn + '<button type="button" onclick="deleteDirectNote(' + n.id + ')" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:inherit">?뿊截???젣</button></div></div>';
  }).join('');
}
function renderVendorSelect() {
  var sel = document.getElementById('direct-vendor-select');
  if (!sel) return;
  var vendors = window._vendors || [];
  var cur = sel.value;
  sel.innerHTML = '<option value="">???좏깮 ??/option>' + vendors.map(function(v) { return '<option value="' + escapeHtml(v.id) + '">' + escapeHtml(v.name) + '</option>'; }).join('');
  if (cur) sel.value = cur;
}
function onVendorSelect(sel) {
  if (!sel || !sel.value || !window._vendors) return;
  var v = window._vendors.find(function(x) { return x.id === sel.value; });
  if (!v) return;
  var pt = document.getElementById('direct-payment-terms'); if (pt) pt.value = v.paymentTerms || '';
  var contact = document.getElementById('direct-contact'); if (contact) contact.value = v.contactPhone || '';
  var nameInput = document.getElementById('direct-vendor'); if (nameInput) nameInput.value = v.name || '';
}
function registerAsConsignment(noteId) {
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]'); } catch (e) {}
  var note = notes.find(function(x) { return x.id === noteId; });
  if (!note) { showToast('?대떦 硫붾え瑜?李얠쓣 ???놁뒿?덈떎', true); return; }
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
  document.getElementById('cm-product-name').textContent = note.name || '誘몄엯??;
  document.getElementById('cm-product-cost').textContent = '?먭? ' + fmt(note.price || 0) + '?? + (note.minQty ? ' 횞 理쒖냼 ' + note.minQty + '媛? : '');
  var photoEl = document.getElementById('cm-photo-link');
  if (note.photoUrl) photoEl.innerHTML = '<a href="' + escapeHtml(note.photoUrl) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent)">?벜 ?ъ쭊 蹂닿린</a>'; else photoEl.innerHTML = '';
  var btns = document.getElementById('cm-market-btns');
  var firstThree = MARKET_IDS.slice(0, 3);
  btns.innerHTML = firstThree.map(function(mid) {
    var m = MARKET_FEES[mid];
    return '<button type="button" class="cm-mkt" data-market="' + escapeHtml(mid) + '" onclick="selectCMMarket(\'' + mid + '\', this)" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-size:13px">' + (m ? m.name : mid) + '</button>';
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
  var profit = salePrice - feeAmt - mktShip - cost;
  var marginRate = salePrice > 0 ? parseFloat((profit / salePrice * 100).toFixed(1)) : 0;
  document.getElementById('cm-margin-preview').textContent = salePrice ? '?섏닔猷?' + fmt(feeAmt) + '??쨌 ?쒖씠??' + fmt(profit) + '??쨌 留덉쭊 ' + marginRate + '%' : '?먮ℓ媛瑜??낅젰?섏꽭??;
}
function closeConsignmentModal() {
  var modal = document.getElementById('consignment-modal');
  if (modal) modal.style.display = 'none';
  window._consignmentNote = null;
}
function submitConsignment() {
  var note = window._consignmentNote;
  if (!note || !SCRIPT_URL) { showToast('?ㅻ쪟', true); return; }
  var salePrice = parseFloat(document.getElementById('cm-sale-price').value) || 0;
  if (!salePrice) { showToast('?먮ℓ媛瑜??낅젰?섏꽭??, true); return; }
  var mid = window._cmSelectedMarket || 'smartstore';
  var m = MARKET_FEES[mid];
  var feeRate = (m && m.fee) || 6.6;
  var cost = note.price || 0;
  var mktShip = 3000;
  var feeAmt = Math.round(salePrice * feeRate / 100);
  var profit = salePrice - feeAmt - mktShip - cost;
  var marginRate = salePrice > 0 ? parseFloat((profit / salePrice * 100).toFixed(1)) : 0;
  var now = new Date();
  var dateStr = now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  var productId = Date.now() + Math.random();
  var toSave = [{
    id: productId, name: note.name || '誘몄엯??, cost: cost, supShip: 0, mktShip: mktShip,
    market: (m && m.name) || mid, marketClass: mid, fee: feeRate, salePrice: salePrice, feeAmt: feeAmt,
    profit: Math.round(profit), margin: marginRate, savedAt: dateStr, savedBy: currentUser || '?⑦렪',
    category: '', competitionLevel: '', minMarketPrice: '', avgMarketPrice: '', maxMarketPrice: '',
    sourcingLink: '', targetGender: '', targetAge: '', trendSeason: '', collectedAt: '', mainTarget: '',
    sellDecision: 'Y', sellStartDate: now.toISOString().slice(0, 10),
    photoUrl: note.photoUrl || '', docUrl: '', sourcingType: '?ъ엯', leadTime: note.leadTime || '', paymentTerms: note.paymentTerms || '', consignAvail: note.consignAvail || '', contact: note.contact || ''
  }];
  showLoading(true);
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveProduct', products: toSave }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.success) { showToast('?곹뭹 ????ㅽ뙣: ' + (data.error || ''), true); showLoading(false); return; }
      if (!note.rowNum) { closeConsignmentModal(); showTab('sales'); renderDirectNotes(); showToast('?꾪긽 ?깅줉 ?꾨즺'); showLoading(false); return; }
      return fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateDirectRecord', rowNum: note.rowNum, market: (m && m.name) || mid, salePrice: salePrice, marginRate: marginRate, productListId: productId, registeredAt: dateStr, sourcingResult: '吏꾪뻾' }) });
    })
    .then(function(r) { return r ? r.json() : null; })
    .then(function(data) {
      closeConsignmentModal();
      showTab('sales');
      renderDirectNotes();
      showToast('?꾪긽 ?깅줉 ?꾨즺');
      showLoading(false);
    })
    .catch(function() { showToast('?붿껌 ?ㅽ뙣', true); showLoading(false); });
}
function showVendorForm(vendorId) {
  window._editingVendorId = vendorId || null;
  document.getElementById('vm-id').value = vendorId || '';
  var fields = ['name','repName','bizNo','industry','address','phone','contactName','contactPhone','email','categories','minOrder','paymentTerms','memo'];
  fields.forEach(function(f) { var el = document.getElementById('vm-' + (f === 'minOrder' ? 'minOrder' : f)); if (el) el.value = ''; });
  var pt = document.getElementById('vm-paymentTerms'); if (pt) pt.value = '';
  if (vendorId && window._vendors) {
    var v = window._vendors.find(function(x) { return x.id === vendorId; });
    if (v) {
      document.getElementById('vm-id').value = v.id;
      document.getElementById('vm-name').value = v.name || '';
      document.getElementById('vm-repName').value = v.repName || '';
      document.getElementById('vm-bizNo').value = v.bizNo || '';
      document.getElementById('vm-industry').value = v.industry || '';
      document.getElementById('vm-address').value = v.address || '';
      document.getElementById('vm-phone').value = v.phone || '';
      document.getElementById('vm-contactName').value = v.contactName || '';
      document.getElementById('vm-contactPhone').value = v.contactPhone || '';
      document.getElementById('vm-email').value = v.email || '';
      document.getElementById('vm-categories').value = v.categories || '';
      document.getElementById('vm-minOrder').value = v.minOrder != null ? v.minOrder : '';
      document.getElementById('vm-paymentTerms').value = v.paymentTerms || '';
      document.getElementById('vm-memo').value = v.memo || '';
    }
  }
  document.getElementById('vendor-modal').style.display = 'flex';
}
function closeVendorModal() {
  document.getElementById('vendor-modal').style.display = 'none';
  window._editingVendorId = null;
}
function submitVendor() {
  var id = document.getElementById('vm-id').value.trim();
  var v = {
    id: id || undefined,
    name: document.getElementById('vm-name').value.trim(),
    repName: document.getElementById('vm-repName').value.trim(),
    bizNo: document.getElementById('vm-bizNo').value.trim(),
    industry: document.getElementById('vm-industry').value.trim(),
    address: document.getElementById('vm-address').value.trim(),
    phone: document.getElementById('vm-phone').value.trim(),
    contactName: document.getElementById('vm-contactName').value.trim(),
    contactPhone: document.getElementById('vm-contactPhone').value.trim(),
    email: document.getElementById('vm-email').value.trim(),
    categories: document.getElementById('vm-categories').value.trim(),
    minOrder: document.getElementById('vm-minOrder').value ? parseFloat(document.getElementById('vm-minOrder').value) : '',
    paymentTerms: document.getElementById('vm-paymentTerms').value || '',
    startDate: '', memo: document.getElementById('vm-memo').value.trim(), lastVisit: ''
  };
  if (!v.name) { showToast('?낆껜紐낆쓣 ?낅젰?섏꽭??, true); return; }
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 URL???낅젰?섏꽭??, true); return; }
  showLoading(true);
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveVendor', vendor: v }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showLoading(false);
      if (!data.success) { showToast(data.error || '????ㅽ뙣', true); return; }
      closeVendorModal();
      loadVendors();
      var newId = data.vendorId || v.id;
      if (newId) {
        setTimeout(function() {
          var sel = document.getElementById('direct-vendor-select');
          if (sel) { renderVendorSelect(); sel.value = newId; onVendorSelect(sel); }
        }, 300);
      }
      showToast('怨듦툒?낆껜 ????꾨즺');
    })
    .catch(function() { showToast('?붿껌 ?ㅽ뙣', true); showLoading(false); });
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
  showToast(n.name + ' ?먭? ?낅젰??);
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
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getVendors' }) })
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
  showToast('API URL ????꾨즺');
}

function saveApiKey(type) {
  if (type === 'backendUrl') {
    const input = document.getElementById('api-backendUrl');
    const url = (input && input.value.trim() || '').replace(/\/$/, '');
    localStorage.setItem(API_KEYS.backendUrl, url);
    localStorage.setItem('api-url', url);
    API_URL = url;
    showToast('????λ맖');
    return;
  }
  const input = document.getElementById('api-' + type);
  const key = API_KEYS[type];
  if (!input || !key) return;
  const val = input.value.trim();
  localStorage.setItem(key, val);
  if (input.dataset.masked === 'true') input.value = val ? '?™™™™™™™™™™™? : '';
  showToast('????λ맖');
}

function loadApiKeys() {
  const url = getBackendUrl();
  const be = document.getElementById('api-backendUrl'); if (be) be.value = url;
  ['domeggook', 'domemae', 'onchannel', 'kakao', 'smartstore-client-id', 'smartstore-client-secret', 'coupang-access-key', 'coupang-secret-key', '11st-api-key'].forEach(type => {
    const input = document.getElementById('api-' + type);
    if (!input) return;
    const key = API_KEYS[type] || type;
    const val = localStorage.getItem(key) || '';
    input.value = val ? '?™™™™™™™™™™™? : '';
    input.dataset.masked = 'true';
    input.type = 'password';
  });
}

function toggleApiKeyMask(type) {
  const input = document.getElementById('api-' + type);
  if (!input) return;
  const key = API_KEYS[type];
  const stored = localStorage.getItem(key) || '';
  if (input.dataset.masked === 'true') {
    input.value = stored;
    input.dataset.masked = 'false';
    input.type = 'text';
  } else {
    input.value = stored ? '?™™™™™™™™™™™? : '';
    input.dataset.masked = 'true';
    input.type = 'password';
  }
}

async function testBackendUrl() {
  const url = (document.getElementById('api-backendUrl') && document.getElementById('api-backendUrl').value.trim()) || getBackendUrl();
  if (!url) { showToast('??URL???낅젰?댁＜?몄슂', true); return; }
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/');
    const data = await res.json();
    if (data.status === 'ok') showToast('???쒕쾭 ?곌껐 ?깃났!');
    else showToast('???쒕쾭 ?묐떟 ?댁긽', true);
  } catch (e) {
    showToast('???쒕쾭 ?곌껐 ?ㅽ뙣. URL???뺤씤?댁＜?몄슂.', true);
  }
}

async function sendKakaoAlert(message) {
  const token = localStorage.getItem('kakao-api-key');
  if (!token) return;
  const base = getBackendUrl();
  try {
    const res = await fetch(base + '/kakao/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kakao-Token': token },
      body: JSON.stringify({ message: message })
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) { return false; }
}

async function testKakaoAlert() {
  const token = localStorage.getItem('kakao-api-key');
  const el = document.getElementById('kakao-test-result');
  if (el) el.textContent = '';
  if (!token) {
    if (el) el.innerHTML = '??API ?ㅻ? ?ㅼ젙??????ν빐二쇱꽭??';
    showToast('移댁뭅??API ?ㅻ? ?낅젰?댁＜?몄슂', true);
    return;
  }
  showLoading(true);
  try {
    const ok = await sendKakaoAlert('????щ쭏吏??뚮┝ ?곌껐 ?꾨즺!');
    if (el) el.textContent = ok ? '??移댁뭅?ㅽ넚 ?곌껐?? : '??API ?ㅻ? ?뺤씤?섏꽭??;
    showToast(ok ? '??移댁뭅?ㅽ넚 ?곌껐?? : '??API ?ㅻ? ?뺤씤?섏꽭??, !ok);
  } catch (e) {
    if (el) el.textContent = '??API ?ㅻ? ?뺤씤?섏꽭??;
    showToast('??API ?ㅻ? ?뺤씤?섏꽭??, true);
  }
  showLoading(false);
}

function marketClass(id) { return id === '11st' ? 'market-11st' : id; }

function recalcMargin() {
  const inp = getInputs();
  document.getElementById('compare-all-wrap').style.display = 'none';
  const activeMarkets = [inp.selectedMarketId];
  const k = activeMarkets[0];
    const m = MARKET_INFO[k];

  if (!inp.cost) {
    document.getElementById('inverse-grid').innerHTML = '<div class="inv-item" style="grid-column:1/-1;color:var(--text-muted);font-size:13px">?먭?瑜??낅젰?섎㈃ 沅뚯옣 ?먮ℓ媛쨌留덉쭊???먮룞?쇰줈 怨꾩궛?⑸땲??</div>';
    document.getElementById('inverse-result').classList.remove('show');
    document.getElementById('result-cards').innerHTML = '<div class="result-card" style="color:var(--text-muted);font-size:13px">?먭? ?낅젰 ???ㅼ떆媛?諛섏쁺?⑸땲??</div>';
    window._lastResult = null;
    calcInverse();
    calcBreakEven();
    return;
  }

    const r = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[k], inp.target);
  const salePrice = roundTo10(r.salePrice);
  const feeAmt = Math.round(salePrice * inp.fees[k] / 100);
  const profit = salePrice - feeAmt - inp.mktShip - r.totalCost;
  const marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  const invHTML = `<div class="inv-item ${marketClass(k)}">
      <div class="inv-label">${m.name}</div>
    <div class="inv-price">${fmt(salePrice)}??/div>
      <div class="inv-sub">?섏닔猷?${fmtPct(inp.fees[k])}</div>
    </div>`;
  document.getElementById('inverse-grid').innerHTML = invHTML;
  document.getElementById('inverse-result').classList.toggle('show', inp.target > 0);

  const bc = marginRate >= 20 ? 'badge-good' : marginRate >= 10 ? 'badge-warn' : 'badge-bad';
  const cardsHTML = `<div class="result-card ${marketClass(k)} active">
      <div class="rc-market">${m.name} 쨌 ${fmtPct(inp.fees[k])}</div>
      <div class="rc-row"><span class="rc-label">珥??먭?</span><span class="rc-val">${fmt(r.totalCost + inp.mktShip)}??/span></div>
    <div class="rc-row"><span class="rc-label">?섏닔猷?/span><span class="rc-val">${fmt(feeAmt)}??/span></div>
      <div class="rc-main">
      <div class="rc-price">${fmt(salePrice)}??/div>
        <div class="rc-row">
          <span class="rc-label">?쒖씠??/span>
        <span class="rc-val" style="color:${profit>=0?'var(--accent)':'var(--danger)'}">${fmt(profit)}??/span>
        </div>
        <div class="rc-row">
          <span class="rc-label">留덉쭊??/span>
        <span class="margin-badge ${bc}">${fmtPct(marginRate)}</span>
        </div>
      </div>
    </div>`;
  document.getElementById('result-cards').innerHTML = cardsHTML;
  window._lastResult = { inp, activeMarkets, salePrice, feeAmt, profit, marginRate };
  calcInverse();
  calcBreakEven();
}

function calculate() {
  recalcMargin();
}

function calcInverse() {
  const saleInput = document.getElementById('inverse-sale-input');
  const sale = parseFloat(saleInput && saleInput.value) || 0;
  const inp = getInputs();
  const feeRate = inp.fees[inp.selectedMarketId] || 6.6;
  document.getElementById('inverse-margin').textContent = '??;
  document.getElementById('inverse-profit').textContent = '??;
  document.getElementById('inverse-max-cost').textContent = '??;
  if (sale <= 0) return;
  const totalShip = inp.supShip + inp.mktShip;
  const feeAmt = sale * feeRate / 100;
  const profit = sale - feeAmt - inp.mktShip - inp.cost - inp.supShip;
  const marginRate = sale > 0 ? (profit / sale) * 100 : 0;
  const maxCost = sale - feeAmt - inp.mktShip - inp.supShip;
  document.getElementById('inverse-margin').textContent = fmtPct(marginRate);
  document.getElementById('inverse-profit').textContent = fmt(profit) + '??;
  document.getElementById('inverse-max-cost').textContent = (maxCost > 0 ? fmt(Math.round(maxCost)) + '?? : '??);
}

function calcBreakEven() {
  const targetInput = document.getElementById('monthly-target');
  const monthlyTarget = parseFloat(targetInput && targetInput.value) || 0;
  document.getElementById('be-qty').textContent = '??;
  document.getElementById('be-sales').textContent = '??;
  document.getElementById('be-cost').textContent = '??;
  document.getElementById('be-daily').textContent = '??;
  if (monthlyTarget <= 0 || !window._lastResult) return;
  const lr = window._lastResult;
  const profitPerItem = lr.profit != null ? lr.profit : 0;
  if (profitPerItem <= 0) return;
  const needQty = Math.ceil(monthlyTarget / profitPerItem);
  const salePrice = lr.salePrice || 0;
  const inp = lr.inp;
  const totalCostPerItem = inp.cost + inp.supShip + inp.mktShip;
  document.getElementById('be-qty').textContent = fmt(needQty) + '媛?;
  document.getElementById('be-sales').textContent = fmt(needQty * salePrice) + '??;
  document.getElementById('be-cost').textContent = fmt(needQty * totalCostPerItem) + '??;
  document.getElementById('be-daily').textContent = (needQty / 30).toFixed(1) + '媛???;
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
    el.innerHTML = '<span style="font-size:11px;color:var(--text-muted);margin-right:4px">?븧 理쒓렐 議고쉶</span>' + arr.map(function (item, i) {
      return '<button type="button" class="preset-btn" onclick="loadFromHistory(' + i + ')">' + escapeHtml((item.name || '').slice(0, 12)) + (item.name && item.name.length > 12 ? '?? : '') + '</button>';
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
    showToast('理쒓렐 議고쉶 蹂듭썝');
    recalcMargin();
  } catch (e) {}
}

async function onSourcingLinkPaste(e) {
  var url = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (!url || url.indexOf('domeggook.com') === -1) return;
  e.preventDefault();
  var input = document.getElementById('sourcing-link-input');
  if (input) input.value = url;
  var base = getBackendUrl();
  if (!base) { showToast('?ㅼ젙?먯꽌 諛깆뿏??API URL???낅젰?댁＜?몄슂', true); return; }
  try {
    var res = await fetch(base + '/parse-url?url=' + encodeURIComponent(url), { headers: getApiHeaders() });
    var data = await res.json();
    if (data.success && data.name) document.getElementById('productName').value = data.name;
    if (data.success && data.price != null) document.getElementById('costPrice').value = data.price;
    if (data.success) showToast('?먭?쨌?곹뭹紐??먮룞 ?낅젰??);
    else showToast(data.message || data.error || 'URL ?뚯떛 ?ㅽ뙣', true);
  } catch (err) {
    showToast('URL ?뚯떛 ?붿껌 ?ㅽ뙣', true);
  }
  recalcMargin();
}

async function runWholesaleSearch() {
  var q = document.getElementById('wholesale-search-input').value.trim();
  if (!q) { showToast('寃?됱뼱瑜??낅젰?섏꽭??, true); return; }
  var base = getBackendUrl();
  if (!base) { showToast('?ㅼ젙?먯꽌 諛깆뿏??API URL???낅젰?섏꽭??, true); return; }
  var btn = document.getElementById('btn-wholesale-search');
  btn.disabled = true;
  try {
    var res = await fetch(base + '/domeggook/search?query=' + encodeURIComponent(q) + '&pageSize=5', { headers: getApiHeaders() });
    var data = await res.json();
    var wrap = document.getElementById('wholesale-search-results');
    var cards = document.getElementById('wholesale-result-cards');
    if (!data.success || !data.items || !data.items.length) {
      wrap.style.display = 'none';
      showToast(data.error || '寃??寃곌낵 ?놁쓬', true);
      return;
    }
    wrap.style.display = 'block';
    function cardHtml(it) {
      var link = (it.link || '').replace(/^http:/, 'https:');
      var img = (it.image || '').replace(/^http:/, 'https:');
      return '<div class="mp-product-card" data-wholesale-name="' + escapeHtml(it.name || '') + '" data-wholesale-price="' + (it.price || 0) + '" data-wholesale-link="' + escapeHtml(link) + '" onclick="applyWholesaleItem(this)" style="cursor:pointer">' +
        '<img src="' + escapeHtml(img || '') + '" alt="" onerror="this.style.background=\'var(--surface2)\';this.onerror=null">' +
        '<div class="mp-pc-price">' + fmt(it.price || 0) + '??/div><div class="mp-pc-mall">' + (it.name || '').slice(0, 20) + '</div></div>';
    }
    cards.innerHTML = data.items.slice(0, 5).map(cardHtml).join('');
  } catch (e) {
    showToast('寃???ㅽ뙣', true);
  }
  btn.disabled = false;
}

function applyWholesaleItem(el) {
  var name = el.getAttribute('data-wholesale-name');
  var price = el.getAttribute('data-wholesale-price');
  var link = el.getAttribute('data-wholesale-link');
  if (name) document.getElementById('productName').value = name;
  if (price) document.getElementById('costPrice').value = price;
  if (link) document.getElementById('sourcing-link-input').value = link;
  showCalcSubTab('direct');
  recalcMargin();
  showToast('吏곸젒 ?낅젰 ??뿉 諛섏쁺?덉뒿?덈떎');
}

function showCompareAll() {
  const inp = getInputs();
  if (!inp.cost) { showToast('?먭?瑜??낅젰?댁＜?몄슂', true); return; }

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
    const profit = salePrice - feeAmt - inp.mktShip - (inp.cost + inp.supShip);
    const marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    return { id: mid, name: MARKET_FEES[mid].name, fee: inp.fees[mid], salePrice, profit, marginRate };
  });
  const best = rows.slice().sort((a, b) => (b.marginRate - a.marginRate))[0];

  tbody.innerHTML = rows.map(row => {
    const isBest = row.id === best.id;
    return `<tr class="${isBest ? 'compare-best' : ''}">
      <td>${isBest ? '<span class="compare-trophy">?룇</span> ' : ''}${row.name}</td>
      <td>${fmtPct(row.fee)}</td>
      <td>${fmt(row.salePrice)}??/td>
      <td>${fmt(row.profit)}??/td>
      <td>${fmtPct(row.marginRate)}</td>
    </tr>`;
  }).join('');
  bestMsg.textContent = '?룇 理쒓퀬 留덉쭊: ' + best.name + ' (' + fmtPct(best.r.marginRate) + ')';
  wrap.style.display = 'block';
  window._lastResult = { inp, activeMarkets: [inp.selectedMarketId] };
}

// ==================== SAVE ====================
async function saveProduct() {
  if (!SCRIPT_URL) { showToast('?ㅼ젙 ??뿉??URL??癒쇱? ?낅젰?섏꽭??, true); showTab('setup'); return; }
  if (!window._lastResult) { calculate(); }
  const { inp, activeMarkets } = window._lastResult;
  if (!inp.cost) { showToast('?먭?瑜?癒쇱? ?낅젰?섏꽭??, true); return; }

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});

  const lastSearch = window._lastSearch || {};
  const catSel = document.getElementById('mp-category-select');
  const savedCategory = (catSel && catSel.value) || lastSearch.category || '';
  const sourcingLinkInput = document.getElementById('sourcing-link-input');
  const sourcingLink = (sourcingLinkInput && sourcingLinkInput.value.trim()) || '';
  const collectedAt = new Date().toISOString().slice(0, 10);
  const targetGenderStr = lastSearch.targetGender ? ('?ъ꽦 ' + (lastSearch.targetGender.female || 0) + '%/?⑥꽦 ' + (lastSearch.targetGender.male || 0) + '%') : '';
  const targetAgeStr = lastSearch.targetAge ? Object.entries(lastSearch.targetAge || {}).map(([k, v]) => k + ' ' + v + '%').join(', ') : '';
  const toSave = activeMarkets.map(k => {
    const m = MARKET_INFO[k];
    const r = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[k], inp.target);
    const salePrice = roundTo10(r.salePrice);
    const feeAmt = Math.round(salePrice * inp.fees[k] / 100);
    const profit = salePrice - feeAmt - inp.mktShip - (inp.cost + inp.supShip);
    const margin = salePrice > 0 ? parseFloat((profit / salePrice * 100).toFixed(1)) : 0;
    return {
      id: Date.now() + Math.random(),
      name: inp.name,
      cost: inp.cost,
      supShip: inp.supShip,
      mktShip: inp.mktShip,
      market: m.name,
      marketClass: m.class,
      fee: inp.fees[k],
      salePrice: salePrice,
      feeAmt: feeAmt,
      profit: Math.round(profit),
      margin: margin,
      savedAt: dateStr,
      savedBy: currentUser || '?⑦렪',
      category: savedCategory,
      competitionLevel: lastSearch.competitionLevel || '',
      minMarketPrice: lastSearch.min_price || '',
      avgMarketPrice: lastSearch.avg_price || '',
      maxMarketPrice: lastSearch.max_price || '',
      sourcingLink: sourcingLink,
      targetGender: targetGenderStr,
      targetAge: targetAgeStr,
      trendSeason: lastSearch.trendSeason || '',
      collectedAt: collectedAt,
      mainTarget: lastSearch.mainTarget || '',
      sellDecision: 'N',
      sellStartDate: '',
      photoUrl: lastSearch.photoUrl || lastSearch.thumbnailUrl || '',
      docUrl: lastSearch.docUrl || '',
      sourcingType: lastSearch.sourcingType || '?⑤씪??,
      leadTime: lastSearch.leadTime || '',
      paymentTerms: lastSearch.paymentTerms || '',
      consignAvail: lastSearch.consignAvail || '',
      contact: lastSearch.contact || ''
    };
  });

  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveProduct', products: toSave }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`??${inp.name} ????꾨즺!`);
      await loadProducts();
    } else {
      showToast('????ㅽ뙣: ' + data.error, true);
    }
  } catch (e) {
    showToast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎', true);
  }
  showLoading(false);
}

// ==================== ?묒? ?쇨큵 遺꾩꽍 ====================
let _excelRows = [];
let _excelResults = [];

document.getElementById('excel-file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const nameCol = document.getElementById('excel-col-name');
  const costCol = document.getElementById('excel-col-cost');
  const shipCol = document.getElementById('excel-col-ship');
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb = (typeof XLSX !== 'undefined' ? XLSX : window.XLSX).read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      _excelRows = rows;
      const cols = Object.keys(rows[0] || {});
      [nameCol, costCol, shipCol].forEach((sel, i) => {
        sel.innerHTML = '<option value="">??/option>' + cols.map(c => '<option value="' + c + '">' + c + '</option>').join('');
        const hint = ['?곹뭹紐?, '?먭?', '諛곗넚鍮?][i];
        const match = cols.find(c => c.includes(hint) || c.includes('name') || c.includes('媛寃?) || c.includes('?먭?') || c.includes('諛곗넚'));
        if (match) sel.value = match;
      });
      document.getElementById('excel-analyze-btn').disabled = false;
      document.getElementById('excel-summary').style.display = 'none';
      document.getElementById('excel-results-cards').style.display = 'none';
    } catch (err) {
      showToast('?묒? ?뚯떛 ?ㅽ뙣', true);
    }
  };
  reader.readAsArrayBuffer(file);
});

async function startExcelAnalyze() {
  const nameCol = document.getElementById('excel-col-name').value;
  const costCol = document.getElementById('excel-col-cost').value;
  if (!nameCol || !costCol || !_excelRows.length) {
    showToast('而щ읆 留ㅽ븨???좏깮?섍퀬 ?뚯씪???낅줈?쒗븯?몄슂', true);
    return;
  }
  const base = getBackendUrl();
  if (!base) { showToast('?ㅼ젙?먯꽌 諛깆뿏??URL???낅젰?섏꽭??, true); return; }
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
  showToast('?쇨큵 遺꾩꽍 ?꾨즺');
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
    const best = (a && a.best_market) || '?ㅻ쭏?몄뒪?좎뼱';
    const marginObj = (a && a.margins && a.margins[best]) || {};
    const margin = marginObj.margin || 0;
    const avg = (a && a.market_prices && a.market_prices.avg) || 0;
    const trend = (a && a.trend && a.trend.season_icon) ? a.trend.season_icon + ' ' + (a.trend.season || '') : '??;
    const origIdx = _excelResults.indexOf(r);
    return `<div class="product-card" style="margin-bottom:10px">
      <div class="pc-header">
        <div><div class="pc-name">${escapeHtml(r.name)}</div><div class="pc-by">?꾨ℓ?먭?: ${fmt(r.cost)}??쨌 ?쒖쨷?됯퇏: ${fmt(avg)}??/div></div>
        <span class="margin-badge badge-good">?룇 ${fmtPct(margin)}</span>
      </div>
      <div class="pc-grid">
        <div class="pc-item"><div class="pc-item-label">理쒖쟻留덉폆</div><div class="pc-item-val">${escapeHtml(best)}</div></div>
        <div class="pc-item"><div class="pc-item-label">?몃젋??/div><div class="pc-item-val">${escapeHtml(trend)}</div></div>
      </div>
      <div class="pc-footer" style="margin-top:8px">
        <button type="button" class="action-btn" onclick="addExcelRowByIndex(${origIdx})">?뚯떛紐⑸줉 異붽?</button>
      </div>
    </div>`;
  }).join('');
}
function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function addExcelRowByIndex(origIdx) {
  const r = _excelResults[origIdx];
  if (!r) return;
  const a = r.analysis;
  const best = (a && a.best_market) || '?ㅻ쭏?몄뒪?좎뼱';
  const marginObj = (a && a.margins && a.margins[best]) || {};
  const margin = marginObj.margin || 0;
  const avg = (a && a.market_prices && a.market_prices.avg) || 0;
  addExcelRowToSheet(r.name, r.cost, r.supShip || 0, avg, best, margin);
}

async function runAutoSourcing() {
  const apiKey = localStorage.getItem('domeggook-api-key');
  if (!apiKey) { showToast('?꾨ℓ袁?API ?ㅻ? ?ㅼ젙 ??뿉???낅젰?댁＜?몄슂.', true); return; }
  const category = document.getElementById('auto-sourcing-category').value || '?앺솢?⑺뭹';
  const minMargin = parseFloat(document.getElementById('auto-sourcing-margin').value) || 20;
  const maxCost = parseFloat(document.getElementById('auto-sourcing-max-cost').value) || 999999999;
  showLoading(true);
  const resultsEl = document.getElementById('auto-sourcing-results');
  try {
    const searchRes = await fetch(getBackendUrl() + '/domeggook/search?query=' + encodeURIComponent(category), { headers: getApiHeaders() });
    const searchData = await searchRes.json();
    if (!searchData.success || !searchData.items || !searchData.items.length) {
      resultsEl.style.display = 'block';
      resultsEl.innerHTML = '<div style="color:var(--text-muted)">寃??寃곌낵媛 ?놁뒿?덈떎.</div>';
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
          bestMarket: compare.best_market || '?ㅻ쭏?몄뒪?좎뼱',
          trend: compare.trend,
        });
      }
      await new Promise(r => setTimeout(r, 400));
    }
    analyzed.sort((a, b) => (b.bestMargin || 0) - (a.bestMargin || 0));
    resultsEl.style.display = 'block';
    if (analyzed.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-muted)">議곌굔??留욌뒗 ?곹뭹???놁뒿?덈떎.</div>';
    } else {
      resultsEl.innerHTML = analyzed.map(a => {
        const bc = a.bestMargin >= 20 ? 'badge-good' : a.bestMargin >= 10 ? 'badge-warn' : 'badge-bad';
        return '<div class="product-card" style="margin-bottom:10px"><div class="pc-header"><div class="pc-name">' + escapeHtml(a.name) + '</div><div class="pc-date">?꾨ℓ媛 ' + fmt(a.price) + '??/div></div><div class="pc-grid"><div class="pc-item"><div class="pc-item-label">理쒓퀬 留덉쭊</div><div class="pc-item-val">' + fmtPct(a.bestMargin) + '</div></div><div class="pc-item"><div class="pc-item-label">異붿쿇 留덉폆</div><div class="pc-item-val">' + escapeHtml(a.bestMarket) + '</div></div></div><div class="pc-footer"><button type="button" class="action-btn" onclick="addExcelRowToSheet(\'' + String(a.name).replace(/'/g, "\\'") + '\',' + a.price + ',0,' + (a.marketPrices && a.marketPrices.avg ? a.marketPrices.avg : 0) + ',\'' + (a.bestMarket || '?ㅻ쭏?몄뒪?좎뼱') + '\',' + a.bestMargin + ')">?뚯떛紐⑸줉 異붽?</button></div></div>';
      }).join('');
    }
  } catch (e) {
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div style="color:var(--danger)">?곌껐 ?ㅽ뙣</div>';
  }
  showLoading(false);
}

function addExcelRowToSheet(name, cost, supShip, avgPrice, bestMarket, margin) {
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 ?ㅽ겕由쏀듃 URL???낅젰?섏꽭??, true); return; }
  const fee = (MARKET_FEES[Object.keys(MARKET_FEES).find(k => MARKET_FEES[k].name === bestMarket)] || MARKET_FEES.smartstore).fee;
  const r = calcForMarket(cost, supShip || 0, 3000, fee, 0);
  const salePrice = r.salePrice || avgPrice;
  const feeAmt = Math.round(salePrice * fee / 100);
  const profit = salePrice - feeAmt - 3000 - cost - (supShip || 0);
  const toSave = [{
    id: Date.now() + Math.random(),
    name, cost, supShip: supShip || 0, mktShip: 3000,
    market: bestMarket,
    marketClass: bestMarket === '?ㅻ쭏?몄뒪?좎뼱' ? 'smart' : bestMarket === '荑좏뙜' ? 'coupang' : 'open',
    fee, salePrice, feeAmt, profit: Math.round(profit), margin,
    savedAt: new Date().toLocaleDateString('ko-KR'), savedBy: currentUser || '?⑦렪',
    category: '', competitionLevel: '', minMarketPrice: '', avgMarketPrice: avgPrice, sellDecision: 'N', sellStartDate: ''
  }];
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveProduct', products: toSave }) })
    .then(res => res.json())
    .then(data => { if (data.success) { showToast('??λ맖'); loadProducts(); } else showToast(data.error || '????ㅽ뙣', true); })
    .catch(() => showToast('????ㅽ뙣', true));
}

async function saveExcelResultsToSheet() {
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 ?ㅽ겕由쏀듃 URL???낅젰?섏꽭??, true); return; }
  const highOnly = _excelResults.filter(r => {
    const m = r.analysis && r.analysis.margins && r.analysis.best_market ? (r.analysis.margins[r.analysis.best_market] || {}).margin : 0;
    return m >= 20;
  });
  const toSave = highOnly.map(r => {
    const a = r.analysis;
    const best = (a && a.best_market) || '?ㅻ쭏?몄뒪?좎뼱';
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
      market: best, marketClass: best === '?ㅻ쭏?몄뒪?좎뼱' ? 'smart' : best === '荑좏뙜' ? 'coupang' : 'open',
      fee, salePrice, feeAmt, profit: Math.round(profit), margin,
      savedAt: new Date().toLocaleDateString('ko-KR'), savedBy: currentUser || '?⑦렪',
      category: '', competitionLevel: '', minMarketPrice: '', avgMarketPrice: avg, sellDecision: 'N', sellStartDate: ''
    };
  });
  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveProduct', products: toSave }) });
    const data = await res.json();
    if (data.success) { showToast('援ш? ?쒗듃??' + toSave.length + '嫄???λ맖'); loadProducts(); }
    else showToast(data.error || '????ㅽ뙣', true);
  } catch (e) { showToast('????ㅽ뙣', true); }
  showLoading(false);
}

// ==================== LOAD ====================
async function loadProducts() {
  if (!SCRIPT_URL) return;
  setSyncStatus('syncing', '?숆린??以?..');
  try {
    const res = await fetch(SCRIPT_URL + '?action=getProducts');
    const data = await res.json();
    if (data.success) {
      products = data.products;
      renderList();
      renderStats();
      const n = products.length;
      const el = document.getElementById('list-count'); if (el) { el.textContent = n; el.style.display = n > 0 ? 'inline' : 'none'; }
      const elM = document.getElementById('list-count-mobile'); if (elM) { elM.textContent = n; elM.style.display = n > 0 ? 'inline' : 'none'; }
      setSyncStatus('synced', '?숆린???꾨즺');
    } else {
      setSyncStatus('error', '?ㅻ쪟');
    }
  } catch (e) {
    setSyncStatus('error', '?곌껐 ?ㅽ뙣');
  }
}

// ==================== RENDER LIST (?뚯떛紐⑸줉) ====================
function renderList() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const mFilter = parseFloat(document.getElementById('margin-filter').value);
  const mkFilter = document.getElementById('market-filter').value;
  const catFilter = document.getElementById('category-filter').value;
  const compFilter = document.getElementById('competition-filter').value;
  const sortVal = (document.getElementById('sort-list') && document.getElementById('sort-list').value) || 'margin-desc';
  const onlyMargin20 = document.getElementById('filter-margin20') && document.getElementById('filter-margin20').checked;

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

  if (filtered.length === 0) {
    empty.style.display = 'block';
    cards.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  cards.style.display = 'grid';

  const isSell = (p) => String(p.sellDecision || 'N').toUpperCase() === 'Y' || p.sellDecision === true;
  const marketToBarClass = (name) => name === '?ㅻ쭏?몄뒪?좎뼱' ? 'smart' : name === '荑좏뙜' ? 'coupang' : 'open';
  function formatCollectDate(savedAt, collectedAt) {
    const raw = collectedAt || savedAt || '';
    const d = raw.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/) || raw.match(/(\d{4})(\d{2})(\d{2})/);
    if (!d) return { text: raw || '??, daysAgo: 999, warn: '' };
    const date = new Date(parseInt(d[1]), parseInt(d[2], 10) - 1, parseInt(d[3], 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((today - date) / 86400000);
    const dayLabel = daysAgo === 0 ? '?ㅻ뒛' : daysAgo === 1 ? '?댁젣' : daysAgo + '????;
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
    const sourceLabel = (p.sourcingLink || '').indexOf('domeggook') >= 0 ? '?꾨ℓ袁? : (p.sourcingLink ? '吏곸젒?낅젰' : '??);
    const naverLink = (p.name) ? 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(p.name) : '';
    const linkRow = [];
    if (p.sourcingLink) linkRow.push('<a href="' + escapeHtml(p.sourcingLink) + '" target="_blank" rel="noopener">?뵕 ?꾨ℓ 留곹겕</a>');
    if (naverLink) linkRow.push('<a href="' + naverLink + '" target="_blank" rel="noopener">?뵕 ?ㅼ씠踰?理쒖?媛</a>');
    const startBtn = isSell(p) ? '<span style="font-size:11px;color:var(--accent)">???먮ℓ以?/span>' : `<button class="start-sell-btn" onclick="startSell('${p.id}')">?먮ℓ ?쒖옉</button>`;
    const warnMsg = collect.daysAgo >= 30 ? '?뵶 ?ы솗???꾩슂' : collect.daysAgo >= 7 ? '?좑툘 媛寃?蹂??媛?μ꽦 ?덉쓬' : '';
    const targetSeason = [p.mainTarget ? '?뫁 ' + p.mainTarget : '', p.trendSeason ? '?뱢 ' + p.trendSeason : '', (p.category || '') ? '?뤇截?' + p.category : ''].filter(Boolean).join('  ');
    const photoUrl = (p.photoUrl || '').replace(/^http:/, 'https:');
    const docUrl = (p.docUrl || '').replace(/^http:/, 'https:');
    const isDirect = !!(p.docUrl || photoUrl);
    const photoSection = '<div class="pc-photo-section" style="margin-bottom:10px">' +
      (photoUrl ? '<img src="' + escapeHtml(photoUrl) + '" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block" onerror="this.style.display=\'none\'">' : '<div style="width:120px;height:120px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px">?벀</div>') +
      '<span style="font-size:11px;margin-top:4px;display:inline-block">' + (isDirect ? '?룵 ?ъ엯' : '?썟 ?⑤씪??) + '</span>' +
      (docUrl ? ' <a href="' + escapeHtml(docUrl) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">?뱞 臾몄꽌</a>' : '') +
      '</div>';
    return `<div class="product-card">
      ${photoSection}
      <div class="pc-header">
        <div>
          <div class="pc-name">${escapeHtml(p.name)}</div>
          <div class="pc-date">?섏쭛: ${collect.text}  異쒖쿂: ${sourceLabel}</div>
          ${linkRow.length ? '<div class="list-card-links">' + linkRow.join(' | ') + '</div>' : ''}
          ${warnMsg ? '<div class="' + collect.warn + '">' + warnMsg + '</div>' : ''}
        </div>
        <span class="margin-badge ${bc}">${fmtPct(p.margin)}</span>
      </div>
      <div class="pc-grid">
        <div class="pc-item"><div class="pc-item-label">?꾨ℓ媛</div><div class="pc-item-val">${fmt(p.cost)}??/div></div>
        <div class="pc-item"><div class="pc-item-label">?쒖쨷理쒖?</div><div class="pc-item-val">${p.minMarketPrice ? fmt(p.minMarketPrice) + '?? : '??}</div></div>
        <div class="pc-item"><div class="pc-item-label">?쒖쨷?됯퇏</div><div class="pc-item-val">${p.avgMarketPrice ? fmt(p.avgMarketPrice) + '?? : '??}</div></div>
        <div class="pc-item"><div class="pc-item-label">留덉쭊</div><div class="pc-item-val">${fmtPct(p.margin)}</div></div>
        </div>
      ${targetSeason ? '<div class="pc-by" style="margin-top:6px;font-size:12px">' + escapeHtml(targetSeason) + '</div>' : ''}
      <div class="pc-footer" style="flex-wrap:wrap">
        <span class="margin-badge" style="background:color-mix(in srgb,var(--${mcClass}) 15%,transparent);color:var(--${mcClass})">${escapeHtml(p.market)}</span>
        <label class="filter-toggle-label" style="margin:0;font-size:12px"><input type="checkbox" ${(p.priceTrack || '') === 'Y' ? 'checked' : ''} onchange="togglePriceTrack(${JSON.stringify(p.id)}, this.checked)"> ?뵒 媛寃?異붿쟻</label>
        <div style="display:flex;align-items:center;gap:8px">${startBtn}<button class="del-btn" onclick="deleteProduct('${p.id}')">??젣</button></div>
        </div>
    </div>`;
  }).join('');
}

async function togglePriceTrack(id, on) {
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 Apps Script URL???낅젰?섏꽭??, true); return; }
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateProduct', id: id, priceTrack: on ? 'Y' : 'N' }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(on ? '媛寃?異붿쟻 ON' : '媛寃?異붿쟻 OFF');
      await loadProducts();
    } else showToast('????ㅽ뙣', true);
  } catch (e) { showToast('?ㅻ쪟 諛쒖깮', true); }
}

async function startSell(id) {
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 Apps Script URL???낅젰?섏꽭??, true); return; }
  const today = new Date().toISOString().slice(0, 10);
  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateProduct', id: id, sellDecision: 'Y', sellStartDate: today }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('?먮ℓ ?쒖옉 泥섎━?섏뿀?듬땲??);
      await loadProducts();
      renderList();
    } else showToast('?낅뜲?댄듃 ?ㅽ뙣', true);
  } catch (e) { showToast('?ㅻ쪟 諛쒖깮', true); }
  showLoading(false);
}

// ==================== C-3: ?먮ℓ愿由?====================
async function loadSalesPage() {
  const selling = products.filter(p => String(p.sellDecision || 'N').toUpperCase() === 'Y' || p.sellDecision === true);
  const monthRev = document.getElementById('sales-month-revenue');
  const monthProfit = document.getElementById('sales-month-profit');
  const countEl = document.getElementById('sales-selling-count');
  if (countEl) countEl.textContent = selling.length;

  salesRecords = [];
  if (SCRIPT_URL) try {
    const res = await fetch(SCRIPT_URL + '?action=getSalesRecords');
    const data = await res.json();
    salesRecords = data.success ? data.records : [];
  } catch (e) { salesRecords = []; }

  const thisMonth = getCurrentMonth();
  let monthRevenue = 0, monthProfitSum = 0;
  salesRecords.forEach(r => {
    const d = (r.date || '').toString().slice(0, 7);
    if (d === thisMonth) {
      monthRevenue += Number(r.revenue) || 0;
      monthProfitSum += Number(r.profit) || 0;
    }
  });
  if (monthRev) monthRev.textContent = fmt(monthRevenue) + '??;
  if (monthProfit) monthProfit.textContent = fmt(monthProfitSum) + '??;

  const empty = document.getElementById('sales-empty');
  const cards = document.getElementById('sales-cards');
  if (selling.length === 0) {
    empty.style.display = 'block';
    cards.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  cards.style.display = 'grid';
  const byProduct = {};
  salesRecords.forEach(r => {
    const key = String(r.productId || r.productName || '');
    if (!byProduct[key]) byProduct[key] = { qty: 0, revenue: 0, profit: 0 };
    byProduct[key].qty += Number(r.quantity) || 0;
    byProduct[key].revenue += Number(r.revenue) || 0;
    byProduct[key].profit += Number(r.profit) || 0;
  });
  const marketToBarClass = (name) => name === '?ㅻ쭏?몄뒪?좎뼱' ? 'smart' : name === '荑좏뙜' ? 'coupang' : 'open';
  cards.innerHTML = selling.map(p => {
    const key = String(p.id || p.name);
    const sum = byProduct[key] || { qty: 0, revenue: 0, profit: 0 };
    const mcClass = marketToBarClass(p.market);
    const photoUrl = (p.photoUrl || '').replace(/^http:/, 'https:');
    const docUrl = (p.docUrl || '').replace(/^http:/, 'https:');
    const isDirect = !!(p.docUrl || photoUrl);
    const leadTimeStr = (p.leadTime && String(p.leadTime).trim()) ? (' 쨌 ?⑷린 ' + escapeHtml(String(p.leadTime).trim())) : '';
    const photoSection = '<div class="pc-photo-section" style="margin-bottom:10px">' +
      (photoUrl ? '<img src="' + escapeHtml(photoUrl) + '" alt="" style="width:100px;height:100px;object-fit:cover;border-radius:8px;display:block" onerror="this.style.display=\'none\'">' : '<div style="width:100px;height:100px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px">?벀</div>') +
      '<span style="font-size:11px;margin-top:4px;display:inline-block">' + (isDirect ? '?룵 ?ъ엯' : '?썟 ?⑤씪??) + '</span>' +
      (docUrl ? ' <a href="' + escapeHtml(docUrl) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">?뱞 臾몄꽌</a>' : '') +
      '</div>';
    return `<div class="product-card">
      ${photoSection}
      <div class="pc-header">
        <div>
          <div class="pc-name">${escapeHtml(p.name)}</div>
          <div class="pc-by">${p.market} 쨌 ?깅줉媛 ${fmt(p.salePrice)}??{leadTimeStr}</div>
        </div>
        <span class="margin-badge" style="background:color-mix(in srgb,var(--${mcClass}) 15%,transparent);color:var(--${mcClass})">${p.market}</span>
      </div>
      <div class="pc-grid">
        <div class="pc-item"><div class="pc-item-label">?꾩쟻 ?먮ℓ??/div><div class="pc-item-val">${sum.qty}媛?/div></div>
        <div class="pc-item"><div class="pc-item-label">?꾩쟻 留ㅼ텧</div><div class="pc-item-val" style="color:var(--accent)">${fmt(sum.revenue)}??/div></div>
        <div class="pc-item"><div class="pc-item-label">?꾩쟻 ?쒖씠??/div><div class="pc-item-val" style="color:${sum.profit>=0?'var(--accent)':'var(--danger)'}">${fmt(sum.profit)}??/div></div>
      </div>
      <div class="pc-footer">
        <button class="start-sell-btn" onclick="openSalesRecordModalById('${p.id}')">?먮ℓ 湲곕줉 異붽?</button>
      </div>
    </div>`;
  }).join('');
}
function openSalesRecordModalById(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  if (product) openSalesRecordModal(product);
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
    nameP.textContent = product.name + ' 쨌 ' + product.market;
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
  if (!date || salePrice <= 0) { showToast('?좎쭨? ?먮ℓ媛瑜??낅젰?섏꽭??, true); return; }
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
    productName = document.getElementById('sr-product-name-input').value.trim() || '?섎룞?낅젰';
    market = document.getElementById('sr-market').value || '?ㅻ쭏?몄뒪?좎뼱';
    const costPer = parseFloat(document.getElementById('sr-cost').value) || 0;
    costSum = costPer * quantity;
    const feeRate = (MARKET_FEES[Object.keys(MARKET_FEES).find(k => MARKET_FEES[k].name === market)] || MARKET_FEES.smartstore).fee;
    feeAmt = Math.round(revenue * feeRate / 100);
  }
  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSalesRecord',
        record: { date: date, productId: productId, productName: productName, market: market, quantity: quantity, salePrice: salePrice, costSum: costSum, feeAmt: feeAmt, savedBy: currentUser || '?⑦렪' }
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('?먮ℓ 湲곕줉 ????꾨즺');
      closeSalesRecordModal();
      loadSalesPage();
    } else showToast('????ㅽ뙣: ' + (data.error || ''), true);
  } catch (e) { showToast('???以??ㅻ쪟', true); }
  showLoading(false);
}

// ==================== C-4: ?뚭퀎 ====================
const VAT_RATES = { '?뚮ℓ??: 0.15, '?뚯떇??: 0.40, '?쒕퉬?ㅼ뾽': 0.30 };
const THRESHOLDS = { warning: 64000000, danger: 72000000, limit: 80000000 };
function calcSimplifiedVAT(annualSales, businessType) {
  const rate = VAT_RATES[businessType || '?뚮ℓ??] || 0.15;
  return Math.round(annualSales * rate * 0.1);
}
function checkVatStatus(annualSales) {
  if (annualSales >= THRESHOLDS.limit)
    return { status: 'danger', message: '?좑툘 ??留ㅼ텧 8,000留뚯썝 珥덇낵! ?ㅼ쓬 ?대????쇰컲怨쇱꽭?먮줈 ?먮룞 ?꾪솚?⑸땲??', action: '?몃Т???곷떞 ?꾩슂' };
  if (annualSales >= THRESHOLDS.danger)
    return { status: 'warning', message: '?뵸 ??留ㅼ텧 8,000留뚯썝 珥덇낵 ?꾨컯! ?쇰컲怨쇱꽭???꾪솚??以鍮꾪븯?몄슂.', action: '?꾪솚 ???멸툑怨꾩궛??諛쒗뻾 ?섎Т, 遺媛???좉퀬 諛⑹떇 蹂寃? };
  if (annualSales >= THRESHOLDS.warning)
    return { status: 'notice', message: '?뱥 ??留ㅼ텧 6,400留뚯썝 ?뚰뙆. ?곕쭚源뚯? 異붿씠瑜??뺤씤?섏꽭??', action: null };
  return { status: 'safe', message: '???꾩옱 ?곹깭: ?덉쟾 (媛꾩씠怨쇱꽭???좎? 媛??', action: null };
}
function compareVatBenefit(annualSales, annualCost) {
  const simplifiedVat = annualSales * 0.015;
  const generalVat = (annualSales * 0.1) - (annualCost * 0.1);
  if (generalVat < simplifiedVat)
    return { recommendation: '?쇰컲怨쇱꽭?먭? ?좊━', saving: simplifiedVat - generalVat, reason: '留ㅼ엯 鍮꾩쨷???믪븘 ?쇰컲怨쇱꽭???꾪솚 ????' + fmt(simplifiedVat - generalVat) + '???덉꽭 媛?? };
  return { recommendation: '媛꾩씠怨쇱꽭???좎?', saving: generalVat - simplifiedVat, reason: '?꾩옱 援ъ“?먯꽌 媛꾩씠怨쇱꽭?먭? ??' + fmt(generalVat - simplifiedVat) + '???좊━' };
}
function saveAccBusinessType() {
  const sel = document.getElementById('acc-business-type');
  if (sel) localStorage.setItem('acc-business-type', sel.value);
}
function getAccBusinessType() {
  return localStorage.getItem('acc-business-type') || '?뚮ℓ??;
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
      o.textContent = (parts[0] || '') + '??' + parseInt(parts[1] || '0', 10) + '??;
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
      o.textContent = (rParts[0] || '') + '??' + parseInt(rParts[1] || '0', 10) + '??;
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
      if (r.type === '留ㅼ텧') sm += amt;
      else if (r.type === '留ㅼ엯') pm += amt;
    });
    document.getElementById('acc-sales').textContent = fmt(sm) + '??;
    document.getElementById('acc-purchase').textContent = fmt(pm) + '??;
    document.getElementById('acc-profit').textContent = fmt(sm - pm) + '??;
    const thisYear = new Date().getFullYear().toString();
    let annualSales = 0, annualCost = 0;
    if (allData.success && allData.records) {
      allData.records.forEach(r => {
        const y = String(r.date || '').slice(0, 4);
        if (y !== thisYear) return;
        const amt = Number(r.amount) || 0;
        if (r.type === '留ㅼ텧') annualSales += amt;
        else if (r.type === '留ㅼ엯') annualCost += amt;
      });
    }
    const annualSalesEst = annualSales > 0 ? annualSales : sm * 12;
    const vatEst = calcSimplifiedVAT(annualSalesEst, getAccBusinessType());
    document.getElementById('acc-vat').textContent = fmt(vatEst) + '??(?곗텛??';
    const limit = THRESHOLDS.limit;
    const remaining = Math.max(0, limit - annualSales);
    const progressPct = Math.min(100, (annualSales / limit) * 100);
    const elRem = document.getElementById('acc-remaining');
    const elProg = document.getElementById('acc-progress-pct');
    const elBar = document.getElementById('acc-progress-bar');
    const elStatus = document.getElementById('acc-status-msg');
    const elCompare = document.getElementById('acc-vat-compare');
    if (document.getElementById('acc-annual-sales')) document.getElementById('acc-annual-sales').textContent = fmt(annualSales) + '??;
    if (elRem) elRem.textContent = fmt(remaining) + '???⑥쓬';
    if (elProg) elProg.textContent = progressPct.toFixed(1) + '%';
    if (elBar) { elBar.style.width = progressPct + '%'; }
    const status = checkVatStatus(annualSales);
    if (elStatus) { elStatus.textContent = status.message; if (status.action) elStatus.innerHTML += '<br><span style="font-size:11px;color:var(--warn)">' + status.action + '</span>'; }
    const compare = compareVatBenefit(annualSales, annualCost);
    if (elCompare) { elCompare.style.display = 'block'; elCompare.innerHTML = '?뮕 ' + compare.reason; }
    var totalSalesFromAcc = 0, totalPurchaseFromAcc = 0;
    accMonthRecords.forEach(function(r) {
      var amt = Number(r.amount) || 0;
      if (r.type === '留ㅼ텧') totalSalesFromAcc += amt; else if (r.type === '留ㅼ엯') totalPurchaseFromAcc += amt;
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
    if (elPs) elPs.textContent = '+ ' + fmt(totalSales) + '??;
    if (elPp) elPp.textContent = '- ' + fmt(totalPurchase) + '??;
    if (elPf) elPf.textContent = '- ' + fmt(feeTotal) + '??;
    if (elPsh) elPsh.textContent = '- ' + fmt(shipTotal) + '??;
    if (elPo) elPo.textContent = fmt(opProfit) + '??;
    if (elPv) elPv.textContent = '- ' + fmt(vatMonth) + '??;
    if (elPn) elPn.textContent = '= ' + fmt(netProfit) + '???룇';
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
    const isSale = r.type === '留ㅼ텧';
    return `<div class="mp-row" style="padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;color:var(--text-muted)">${String(r.date).slice(0,10)}</span>
      <span style="font-weight:600">${r.type}</span>
      <span>${r.partner || ''} ${r.item || ''}</span>
      <span style="color:${isSale?'var(--accent)':'var(--warn)'};font-family:'DM Mono',monospace">${isSale ? '+' : '-'}${fmt(amt)}??/span>
    </div>`;
  }).join('');
}
async function saveAccountingEntry() {
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 Apps Script URL???낅젰?섏꽭??, true); return; }
  const date = document.getElementById('acc-date').value;
  const type = document.getElementById('acc-type').value;
  const amount = parseFloat(document.getElementById('acc-amount').value) || 0;
  if (!date || amount <= 0) { showToast('?좎쭨? 湲덉븸???낅젰?섏꽭??, true); return; }
  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveAccountingRecord',
        record: {
          date: date, type: type, partner: document.getElementById('acc-partner').value.trim(),
          item: document.getElementById('acc-item').value.trim(), amount: amount, tax: 0,
          evidenceType: document.getElementById('acc-evidence').value, memo: document.getElementById('acc-memo').value.trim()
        }
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('嫄곕옒 ????꾨즺');
      document.getElementById('acc-amount').value = '';
      document.getElementById('acc-partner').value = '';
      document.getElementById('acc-item').value = '';
      document.getElementById('acc-memo').value = '';
      loadAccountingList();
    } else showToast('????ㅽ뙣', true);
  } catch (e) { showToast('???以??ㅻ쪟', true); }
  showLoading(false);
}
function exportAccountingCSV() {
  if (accountingRecords.length === 0) { showToast('?대낫??嫄곕옒媛 ?놁뒿?덈떎', true); return; }
  const headers = ['?좎쭨','援щ텇','嫄곕옒泥?,'?덈ぉ','怨듦툒媛??,'?몄븸','?⑷퀎','利앸튃?좏삎','硫붾え'];
  const rows = accountingRecords.map(r => [r.date, r.type, r.partner || '', r.item || '', r.amount || 0, r.tax || 0, r.total || r.amount || 0, r.evidenceType || '', r.memo || '']);
  const csv = [headers, ...rows].map(arr => arr.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '留ㅼ엯留ㅼ텧_' + (document.getElementById('acc-month-filter').value || getCurrentMonth()) + '.csv';
  a.click();
  showToast('CSV ?ㅼ슫濡쒕뱶 ?꾨즺');
}

// ==================== 利앸튃?쒕쪟 ====================
const TYPE_FOLDER = { '移대뱶?곸닔利?: '移대뱶?곸닔利?, '?꾧툑?곸닔利?: '?꾧툑?곸닔利?, '?멸툑怨꾩궛??: '?멸툑怨꾩궛??, '媛꾩씠?곸닔利?: '媛꾩씠?곸닔利?, '嫄곕옒紐낆꽭??: '嫄곕옒紐낆꽭??, '湲고?': '湲고?利앸튃' };
const RECEIPT_TYPE_ICON = { '移대뱶?곸닔利?: '?뮩', '?꾧툑?곸닔利?: '?㎨', '?멸툑怨꾩궛??: '?뱞', '媛꾩씠?곸닔利?: '?뱥', '嫄곕옒紐낆꽭??: '?뱫', '湲고?': '?뱛' };
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
      img.alt = '誘몃━蹂닿린';
      preview.appendChild(img);
    } else {
      preview.textContent = '?뱞 ' + file.name;
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
  if (!SCRIPT_URL) { showToast('?ㅼ젙?먯꽌 Apps Script URL???낅젰?섏꽭??, true); return; }
  if (!_receiptFile || !_receiptType) { showToast('?쒕쪟 醫낅쪟? ?뚯씪???좏깮?섏꽭??, true); return; }
  const dateEl = document.getElementById('receipt-date');
  const amountEl = document.getElementById('receipt-amount');
  const vendorEl = document.getElementById('receipt-vendor');
  const date = (dateEl && dateEl.value) || new Date().toISOString().slice(0, 10);
  const amount = parseInt(amountEl && amountEl.value, 10) || 0;
  const vendor = (vendorEl && vendorEl.value) || '誘몄엯??;
  if (!amount) { showToast('湲덉븸???낅젰?섏꽭??, true); return; }
  const ext = _receiptFile.name.split('.').pop() || 'jpg';
  const fileName = date.replace(/-/g, '') + '__' + vendor + '__' + (TYPE_FOLDER[_receiptType] || _receiptType) + '__' + amount + '??' + ext;
  const year = date.substring(0, 4);
  const month = date.substring(5, 7);
  const folderPath = '??щ쭏吏?' + year + '??' + month + '??' + (TYPE_FOLDER[_receiptType] || '湲고?利앸튃');
  var msgEl = document.getElementById('loading-message');
  if (msgEl) msgEl.textContent = '?쒕씪?대툕?????以묅?;
  showLoading(true);
  try {
    const base64File = await fileToBase64(_receiptFile);
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveReceipt',
        fileName: fileName,
        folderPath: folderPath,
        mimeType: _receiptFile.type,
        fileData: base64File,
        sheetData: {
          date: date,
          type: _receiptType,
          vendor: vendor,
          amount: amount,
          taxType: (document.getElementById('receipt-tax-type') && document.getElementById('receipt-tax-type').value) || '留ㅼ엯',
          item: (document.getElementById('receipt-item') && document.getElementById('receipt-item').value) || '',
          memo: (document.getElementById('receipt-memo') && document.getElementById('receipt-memo').value) || ''
        }
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('??????꾨즺! ?쒕씪?대툕???낅줈?쒕릱?듬땲??');
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
      if (rt) rt.value = '留ㅼ엯';
      if (ri) ri.value = '';
      if (rm) rm.value = '';
      updateReceiptSaveButton();
      loadReceiptList();
    } else showToast(result.error || '????ㅽ뙣', true);
  } catch (e) {
    showToast('?낅줈???ㅽ뙣: ' + (e.message || ''), true);
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
  const icon = (t) => RECEIPT_TYPE_ICON[t] || '?뱛';
  tbody.innerHTML = _receiptList.map(r => {
    const link = r.driveLink ? '<a href="' + escapeHtml(r.driveLink) + '" target="_blank" rel="noopener">?뵕 蹂닿린</a>' : '??;
    const d = String(r.date || '').slice(0, 10);
    const shortDate = d.length >= 10 ? d.slice(5, 7) + '/' + d.slice(8, 10) : d;
    return '<tr><td>' + shortDate + '</td><td>' + icon(r.type) + (r.type || '') + '</td><td>' + escapeHtml(r.vendor || '') + '</td><td>' + fmt(r.amount || 0) + '??/td><td>' + link + '</td></tr>';
  }).join('');
  const sumBuy = _receiptList.filter(r => (r.taxType || '留ㅼ엯') === '留ㅼ엯').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const sumSell = _receiptList.filter(r => (r.taxType || '') === '留ㅼ텧').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  if (summary) summary.textContent = '?⑷퀎: 留ㅼ엯 ' + fmt(sumBuy) + '?? + (sumSell > 0 ? ' / 留ㅼ텧 ' + fmt(sumSell) + '?? : '');
}
function exportReceiptsCSV() {
  if (_receiptList.length === 0) { showToast('?대낫??利앸튃???놁뒿?덈떎', true); return; }
  const headers = ['?좎쭨', '利앸튃醫낅쪟', '嫄곕옒泥?, '?덈ぉ', '湲덉븸', '留ㅼ엯/留ㅼ텧', '硫붾え', '?뚯씪留곹겕', '?깅줉?쇱떆'];
  const rows = _receiptList.map(r => [r.date, r.type, r.vendor || '', r.item || '', r.amount || 0, r.taxType || '留ㅼ엯', r.memo || '', r.driveLink || '', r.registeredAt || '']);
  const csv = [headers, ...rows].map(arr => arr.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '利앸튃?쒕쪟_' + (document.getElementById('receipt-month-filter').value || getCurrentMonth()) + '.csv';
  a.click();
  showToast('CSV ?ㅼ슫濡쒕뱶 ?꾨즺');
}
window.addEventListener('beforeunload', function(e) {
  if (_receiptFile && _receiptType) e.preventDefault();
});

// ==================== DELETE ====================
async function deleteProduct(id) {
  if (!confirm('???곹뭹????젣?좉퉴??')) return;
  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteProduct', id }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('??젣 ?꾨즺');
      await loadProducts();
    }
  } catch(e) { showToast('??젣 ?ㅽ뙣', true); }
  showLoading(false);
}

async function clearAll() {
  if (!confirm('??λ맂 ?곹뭹??紐⑤몢 ??젣?좉퉴??')) return;
  showLoading(true);
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearAll' }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('?꾩껜 ??젣 ?꾨즺');
      await loadProducts();
    }
  } catch(e) { showToast('?ㅻ쪟 諛쒖깮', true); }
  showLoading(false);
}

// ==================== STATS ====================
let _statsCharts = { monthly: null, doughnut: null, bar: null };
async function renderStats() {
  const n = products.length;
  const sellingCount = products.filter(p => String(p.sellDecision || 'N').toUpperCase() === 'Y' || p.sellDecision === true).length;
  document.getElementById('stat-total').textContent = n;
  const convEl = document.getElementById('stat-conversion');
  if (convEl) convEl.textContent = n > 0 ? (sellingCount / n * 100).toFixed(1) + '%' : '??;

  var perfMonthSel = document.getElementById('stats-perf-month');
  if (perfMonthSel && perfMonthSel.options.length <= 1) {
    var now = new Date();
    for (var mi = 1; mi <= 12; mi++) {
      var o = document.createElement('option');
      o.value = now.getFullYear() + '-' + String(mi).padStart(2, '0');
      o.textContent = now.getFullYear() + '??' + mi + '??;
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
    convDetail.innerHTML = '?뚯떛紐⑸줉 ?깅줉: <strong>' + n + '媛?/strong><br>?먮ℓ 寃곗젙: <strong>' + sellingCount + '媛?/strong><br>?ㅼ젣 ?먮ℓ 諛쒖깮: <strong>' + soldCount + '媛?/strong><br><br>?뚯떛 ?꾪솚?? <strong>' + sourcingConv + '%</strong><br>?먮ℓ ?꾪솚?? <strong>' + sellConv + '%</strong>';
  }

  if (n === 0) {
    ['stat-avg','stat-best-profit'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '??; });
    document.getElementById('top5-list').innerHTML = '<div style="color:var(--text-muted);font-size:13px">??λ맂 ?곹뭹???놁뒿?덈떎</div>';
    document.getElementById('market-stats').innerHTML = '<div style="color:var(--text-muted);font-size:13px">??λ맂 ?곹뭹???놁뒿?덈떎</div>';
    const be3 = document.getElementById('stat-best3'); if (be3) be3.innerHTML = '<div style="color:var(--text-muted);font-size:13px">?먮ℓ 湲곕줉???놁뒿?덈떎</div>';
    [_statsCharts.monthly, _statsCharts.doughnut, _statsCharts.bar].forEach(c => { if (c) c.destroy(); });
    _statsCharts = { monthly: null, doughnut: null, bar: null };
    return;
  }
  const avg = products.reduce((s,p) => s + parseFloat(p.margin), 0) / n;
  const bestP = Math.max(...products.map(p => parseInt(p.profit) || 0), 0);
  document.getElementById('stat-avg').textContent = fmtPct(avg);
  document.getElementById('stat-best-profit').textContent = fmt(bestP) + '??;

  let records = salesRecords;
  if (SCRIPT_URL && records.length === 0) try {
    const res = await fetch(SCRIPT_URL + '?action=getSalesRecords');
    const data = await res.json();
    records = data.success ? data.records : [];
  } catch (e) { records = []; }

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
  products.forEach(function(p){ var c = p.category || '湲고?'; if (!catMargin[c]) catMargin[c] = { sum: 0, cnt: 0 }; catMargin[c].sum += parseFloat(p.margin) || 0; catMargin[c].cnt++; });
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
    if (topProductsList.length === 0) topProductsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">?대떦 ???먮ℓ 湲곕줉 ?놁쓬</div>';
    else topProductsEl.innerHTML = '<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">?룇 TOP ?곹뭹</div>' + topProductsList.slice(0, 10).map(function(p, i){
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-weight:600">' + (i+1) + '??' + escapeHtml(p.name) + '  ?쒖씠??' + fmt(p.profit) + '??/div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">?먮ℓ ' + p.qty + '媛?/ 留덉쭊??' + p.margin.toFixed(1) + '%</div>' + (p.market || p.category ? '<div style="font-size:11px;color:var(--text-muted)">留덉폆: ' + escapeHtml(p.market) + ' / 移댄뀒怨좊━: ' + escapeHtml(p.category) + '</div>' : '') + '</div>';
    }).join('');
  }
  var weakList = products.filter(function(p){ return parseFloat(p.margin) < 5 && parseFloat(p.margin) >= 0; });
  var weakEl = document.getElementById('stats-weak-products');
  if (weakEl) {
    if (weakList.length === 0) weakEl.innerHTML = '';
    else weakEl.innerHTML = '<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">?뱣 遺吏??곹뭹 (留덉쭊??5% 誘몃쭔)</div>' + weakList.slice(0, 5).map(function(p){ return '<div style="font-size:13px;padding:6px 0">??' + escapeHtml(p.name) + ' (留덉쭊??' + fmtPct(p.margin) + '%) ???ш????꾩슂</div>'; }).join('');
  }
  var marketMarginEl = document.getElementById('stats-market-margin');
  if (marketMarginEl) {
    var marketEntries = Object.keys(marketRev).map(function(mk){
      var rev = marketRev[mk] || 0;
      var prof = marketProfit[mk] || 0;
      var margin = rev > 0 ? (prof / rev * 100) : 0;
      return { market: mk, margin: margin };
    }).sort(function(a,b){ return b.margin - a.margin; });
    if (marketEntries.length === 0) marketMarginEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">?곗씠???놁쓬</div>';
    else marketMarginEl.innerHTML = marketEntries.map(function(m){
      var w = Math.min(100, Math.max(0, m.margin));
      return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>' + escapeHtml(m.market) + '</span><span>' + m.margin.toFixed(1) + '% ?됯퇏</span></div><div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + w + '%;background:var(--accent);border-radius:4px"></div></div></div>';
    }).join('');
  }
  var catMarginEl = document.getElementById('stats-category-margin');
  if (catMarginEl) {
    var catEntries = Object.keys(catMargin).map(function(c){ return { cat: c, avg: catMargin[c].sum / catMargin[c].cnt }; }).sort(function(a,b){ return b.avg - a.avg; });
    if (catEntries.length === 0) catMarginEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px">?곗씠???놁쓬</div>';
    else catMarginEl.innerHTML = catEntries.map(function(c){
      var w = Math.min(100, Math.max(0, c.avg));
      return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><span>' + escapeHtml(c.cat) + '</span><span>' + c.avg.toFixed(1) + '%</span></div><div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + w + '%;background:var(--accent);border-radius:3px"></div></div></div>';
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
            { label: '留ㅼ텧', data: sortedMonths.map(m => monthMap[m].revenue), borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', fill: true, tension: 0.3 },
            { label: '?쒖씠??, data: sortedMonths.map(m => monthMap[m].profit), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.3 }
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
        data: { labels: catLabels, datasets: [{ label: '?됯퇏 留덉쭊??%)', data: avgMargins, backgroundColor: 'rgba(74,222,128,0.6)' }] },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: text }, grid }, y: { ticks: { color: text }, grid } } }
      });
    }
  }

  const best3 = Object.entries(productProfit).sort((a,b) => b[1] - a[1]).slice(0, 3);
  const be3 = document.getElementById('stat-best3');
  if (be3) be3.innerHTML = best3.length ? best3.map(([name, profit], i) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${i+1}.</span> ${escapeHtml(name)} <strong style="color:var(--accent)">${fmt(profit)}??/strong></div>`).join('') : '<div style="color:var(--text-muted);font-size:13px">?먮ℓ 湲곕줉???놁뒿?덈떎</div>';

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

  const mkCount = {};
  products.forEach(p => { mkCount[p.market] = (mkCount[p.market] || 0) + 1; });
  const marketToBarClass = (name) => name === '?ㅻ쭏?몄뒪?좎뼱' ? 'smart' : name === '荑좏뙜' ? 'coupang' : 'open';
  document.getElementById('market-stats').innerHTML = Object.entries(mkCount).map(([mk, cnt]) => {
    const mcClass = marketToBarClass(mk);
    const pct = Math.round(cnt / n * 100);
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:13px;font-weight:600">${escapeHtml(mk)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text-muted)">${cnt}媛?쨌 ${pct}%</span>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--${mcClass});border-radius:3px;transition:width 0.5s"></div>
      </div>
    </div>`;
  }).join('');
}

// ==================== ?쒖쫵 罹섎┛??====================
async function loadSeasonPage() {
  const sel = document.getElementById('season-year-month');
  if (sel && sel.options.length <= 1) {
    const y = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = y + '??' + m + '??;
      if (m === new Date().getMonth() + 1) o.selected = true;
      sel.appendChild(o);
    }
  }
  const month = (sel && sel.value) ? parseInt(sel.value, 10) : (new Date().getMonth() + 1);
  const label = document.getElementById('season-month-label');
  if (label) label.textContent = '?대쾲??(' + month + '?? 異붿쿇 移댄뀒怨좊━';

  const base = getBackendUrl();
  const container = document.getElementById('season-keywords-container');
  const barsEl = document.getElementById('season-calendar-bars');
  if (!container) return;

  container.innerHTML = '<div style="color:var(--text-muted)">濡쒕뵫 以?..</div>';
  try {
    const res = await fetch(base + '/season?month=' + month, { headers: getApiHeaders() });
    const data = await res.json();
    if (!data.success || !data.keywords) {
      container.innerHTML = '<div style="color:var(--text-muted)">?곗씠?곕? 遺덈윭?????놁뒿?덈떎.</div>';
      return;
    }
    const keywords = data.keywords;
    const bySeason = { '?깆닔湲?: [], '蹂댄넻': [], '鍮꾩닔湲?: [] };
    keywords.forEach(k => {
      const s = k.season || '蹂댄넻';
      if (bySeason[s]) bySeason[s].push(k);
    });
    let html = '';
    ['?깆닔湲?, '蹂댄넻', '鍮꾩닔湲?].forEach(season => {
      const items = bySeason[season];
      if (!items || !items.length) return;
      const icon = season === '?깆닔湲? ? '?윟' : season === '蹂댄넻' ? '?윞' : '?뵶';
      html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">' + icon + ' ' + season + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">';
      items.forEach(k => {
        const ch = k.change_pct != null ? (k.change_pct >= 0 ? '+' : '') + k.change_pct + '%' : '';
        html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">';
        html += '<div style="font-size:13px;font-weight:600">' + escapeHtml(k.keyword) + '</div>';
        if (ch) html += '<div style="font-size:11px;color:var(--accent);margin-top:4px">寃??' + ch + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html || '<div style="color:var(--text-muted)">?ㅼ썙???놁쓬</div>';
  } catch (e) {
    container.innerHTML = '<div style="color:var(--text-muted)">?곌껐 ?ㅽ뙣</div>';
  }

  if (barsEl) {
    const samples = ['?ロ뙥', '?좏뭾湲?, '?곗궛'];
    barsEl.innerHTML = '<div style="margin-bottom:6px">1 2 3 4 5 6 7 8 9 10 11 12 (??</div>' + samples.map(name => {
      let bar = '';
      for (let m = 1; m <= 12; m++) bar += m >= 10 && m <= 12 && name === '?ロ뙥' ? '?? : (m >= 6 && m <= 8 && name === '?좏뭾湲?) ? '?? : (m >= 5 && m <= 7 && name === '?곗궛') ? '?? : '??;
      return '<div style="margin-bottom:4px"><span style="display:inline-block;width:50px">' + name + '</span> ' + bar + '</div>';
    }).join('');
  }
}

// ==================== SETUP ====================
function saveScriptUrl() {
  const url = document.getElementById('script-url-input').value.trim();
  if (!url.includes('script.google.com')) { showToast('?щ컮瑜?URL???낅젰?섏꽭??, true); return; }
  SCRIPT_URL = url;
  localStorage.setItem('script-url', url);
  document.getElementById('step3-num').textContent = '??;
  document.getElementById('step3-num').classList.add('done');
  showToast('URL ????꾨즺! ?곌껐 ?뚯뒪??以?..');
  loadProducts();
}

function runFullInit() {
  if (!SCRIPT_URL) { showToast('Step 3?먯꽌 Apps Script URL??癒쇱? ??ν븯?몄슂', true); return; }
  var resultEl = document.getElementById('full-init-result');
  if (resultEl) { resultEl.style.display = 'none'; resultEl.textContent = ''; }
  showLoading(true);
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'runFullInit' }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showLoading(false);
      if (data.success) {
        var msg = '???꾩껜 珥덇린???꾨즺\n\n?뱤 援ш? ?쒗듃 ?? ' + (data.sheets && data.sheets.length ? data.sheets.join(', ') + ' ?앹꽦' : '湲곗〈 ?좎?') + '\n?뱚 援ш? ?쒕씪?대툕: ' + (data.drive && data.drive.path ? data.drive.path : '??щ쭏吏??대뜑 援ъ“ ?뺤씤');
        showToast('?꾩껜 珥덇린???꾨즺');
        if (resultEl) { resultEl.textContent = msg; resultEl.style.display = 'block'; }
      } else {
        showToast(data.error || '珥덇린???ㅽ뙣', true);
        if (resultEl) { resultEl.textContent = '??' + (data.error || '?ㅽ뙣'); resultEl.style.display = 'block'; }
      }
    })
    .catch(function() {
      showLoading(false);
      showToast('?붿껌 ?ㅽ뙣', true);
      if (resultEl) { resultEl.textContent = '???붿껌 ?ㅽ뙣'; resultEl.style.display = 'block'; }
    });
}

function copyScript() {
  const code = document.getElementById('embedded-apps-script').textContent;
  navigator.clipboard.writeText(code).then(() => showToast('???뺤옣 ?ㅽ겕由쏀듃 蹂듭궗 ?꾨즺! (?ㅺ퀎??B-1~B-5)')).catch(() => showToast('蹂듭궗 ?ㅽ뙣 - 吏곸젒 ?좏깮?댁＜?몄슂', true));
}

function saveEmails() {
  const e1 = document.getElementById('email-1-input').value.trim().toLowerCase();
  const e2 = document.getElementById('email-2-input').value.trim().toLowerCase();
  if (!e1 || !e2) { showToast('?대찓????媛쒕? 紐⑤몢 ?낅젰?댁＜?몄슂', true); return; }
  if (!e1.includes('@') || !e2.includes('@')) { showToast('?щ컮瑜??대찓???뺤떇???낅젰?댁＜?몄슂', true); return; }
  localStorage.setItem('allowed-email-1', e1);
  localStorage.setItem('allowed-email-2', e2);
  showToast('???대찓??????꾨즺! ?ㅼ쓬 濡쒓렇?몃????곸슜?⑸땲??);
}

// ==================== EXPORT ====================
function exportCSV() {
  if (products.length === 0) { showToast('??λ맂 ?곹뭹???놁뒿?덈떎', true); return; }
  const headers = ['?곹뭹紐?,'?먭?','?꾨ℓ諛곗넚鍮?,'留덉폆諛곗넚鍮?,'留덉폆','?섏닔猷?%)','?먮ℓ媛','?섏닔猷뚭툑??,'?쒖씠??,'留덉쭊??%)','??μ씪??,'??μ옄'];
  const rows = products.map(p => [p.name,p.cost,p.supShip,p.mktShip,p.market,p.fee,p.salePrice,p.feeAmt,p.profit,p.margin,p.savedAt,p.savedBy]);
  const csv = [headers,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `留덉쭊怨꾩궛_${new Date().toLocaleDateString('ko-KR').replace(/\./g,'')}.csv`;
  a.click();
  showToast('?뱿 CSV ?ㅼ슫濡쒕뱶 ?꾨즺');
}

// ==================== UI HELPERS ====================
function showLoading(show) { document.getElementById('loading').classList.toggle('show', show); }

let toastTimer;
function showToast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = err ? 'var(--danger)' : 'var(--accent)';
  t.style.color = err ? 'var(--danger)' : 'var(--accent)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

document.addEventListener('keydown', e => { if(e.key==='Enter'&&e.target.tagName==='INPUT') calculate(); });
</script>
</div><!-- end app-wrapper -->
</body>
</html>
