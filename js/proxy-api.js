// ==================== proxy-api.js ====================
// V5.5 Proxy API Functions

// ★ 네이버 API 프록시 (CORS 우회)
function naverApiProxy(data) {
  // ★ 보안: ScriptProperties에서만 키를 읽음 (요청에서 키 수신 차단)
  const CLIENT_ID = PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_ID') || '';
  const CLIENT_SECRET = PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_SECRET') || '';
  if (!CLIENT_ID || !CLIENT_SECRET) return { success: false, error: 'NAVER API 키가 스크립트 속성에 설정되지 않았습니다.' };

  const headers = {
    'X-Naver-Client-Id': CLIENT_ID,
    'X-Naver-Client-Secret': CLIENT_SECRET,
    'Content-Type': 'application/json'
  };

  let url = '', options = {};

  if (data.type === 'shopping-trend') {
    // 네이버 데이터랩 쇼핑인사이트 — 분야별 트렌드
    url = 'https://openapi.naver.com/v1/datalab/shopping/categories';
    options = { method: 'post', headers: headers, payload: JSON.stringify(data.body), muteHttpExceptions: true };
  } else if (data.type === 'shopping-keywords') {
    // 네이버 데이터랩 쇼핑인사이트 — 키워드별 트렌드
    url = 'https://openapi.naver.com/v1/datalab/shopping/category/keywords';
    options = { method: 'post', headers: headers, payload: JSON.stringify(data.body), muteHttpExceptions: true };
  } else if (data.type === 'search-trend') {
    // 네이버 데이터랩 검색어 트렌드
    url = 'https://openapi.naver.com/v1/datalab/search';
    options = { method: 'post', headers: headers, payload: JSON.stringify(data.body), muteHttpExceptions: true };
  } else if (data.type === 'search-shop') {
    // 네이버 쇼핑 검색
    url = 'https://openapi.naver.com/v1/search/shop.json?query=' + encodeURIComponent(data.query || '') + '&display=' + (data.display || 10);
    options = { method: 'get', headers: headers, muteHttpExceptions: true };
  } else {
    return { success: false, error: 'unknown naver api type: ' + data.type };
  }

  try {
    const res = UrlFetchApp.fetch(url, options);
    return { success: true, status: res.getResponseCode(), data: JSON.parse(res.getContentText()) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ★ 한국수출입은행 환율 프록시 (CORS 우회)
function eximExchangeRate(data) {
  // ★ 보안: ScriptProperties에서만 키를 읽음
  const authKey = PropertiesService.getScriptProperties().getProperty('EXIM_KEY') || '';
  if (!authKey) return { success: false, error: '수출입은행 API 키가 스크립트 속성에 설정되지 않았습니다.' };
  const searchDate = data.searchdate || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  const url = 'https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=' + authKey + '&searchdate=' + searchDate + '&data=AP01';
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    return { success: true, data: JSON.parse(res.getContentText()) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ★ 도매꾹 API 프록시
function domeggookProxy(data) {
  // ★ 보안: ScriptProperties에서만 키를 읽음
  const apiKey = PropertiesService.getScriptProperties().getProperty('DOMEGGOOK_KEY') || '';
  if (!apiKey) return { success: false, error: '도매꾹 API 키가 스크립트 속성에 설정되지 않았습니다.' };
  const baseUrl = 'https://domeggook.com/open-api/goods';
  let url = baseUrl;
  if (data.action === 'search') {
    url += '/search?apiKey=' + apiKey + '&keyword=' + encodeURIComponent(data.keyword || '') + '&pageNo=' + (data.page || 1);
  } else if (data.action === 'detail') {
    url += '/detail?apiKey=' + apiKey + '&goodsNo=' + (data.goodsNo || '');
  } else {
    return { success: false, error: 'unknown domeggook action' };
  }
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    return { success: true, data: JSON.parse(res.getContentText()) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ★ 한국관광공사 TourAPI 4.0 + 전국문화축제 프록시 (CORS 우회)
function tourApiProxy(data) {
  const serviceKey = PropertiesService.getScriptProperties().getProperty('DATA_GO_KR_KEY')
    || PropertiesService.getScriptProperties().getProperty('TOUR_API_KEY') || '';
  if (!serviceKey) return { success: false, error: 'DATA_GO_KR_KEY가 스크립트 속성에 설정되지 않았습니다.' };

  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  let url = '';

  if (data.type === 'festival') {
    // TourAPI 4.0 — 축제/행사 목록
    const eventStartDate = data.startDate || today;
    url = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 30)
      + '&pageNo=' + (data.page || 1)
      + '&MobileOS=ETC&MobileApp=SellerDashboard'
      + '&_type=json'
      + '&eventStartDate=' + eventStartDate;
    if (data.areaCode) url += '&areaCode=' + data.areaCode;
  } else if (data.type === 'keyword') {
    // TourAPI 4.0 — 키워드 검색
    url = 'https://apis.data.go.kr/B551011/KorService2/searchKeyword2'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 20)
      + '&pageNo=1'
      + '&MobileOS=ETC&MobileApp=SellerDashboard'
      + '&_type=json'
      + '&keyword=' + encodeURIComponent(data.keyword || '축제')
      + '&contentTypeId=15';  // 15 = 축제/공연/행사
  } else if (data.type === 'detail') {
    // TourAPI 4.0 — 상세 조회
    url = 'https://apis.data.go.kr/B551011/KorService2/detailCommon2'
      + '?serviceKey=' + serviceKey
      + '&contentId=' + (data.contentId || '')
      + '&MobileOS=ETC&MobileApp=SellerDashboard'
      + '&_type=json'
      + '&defaultYN=Y&overviewYN=Y&addrinfoYN=Y';
  } else {
    return { success: false, error: 'unknown tour api type: ' + data.type };
  }

  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const parsed = JSON.parse(res.getContentText());
    // TourAPI 응답 구조: response.body.items.item
    const items = (parsed.response && parsed.response.body && parsed.response.body.items)
      ? parsed.response.body.items.item || []
      : [];
    return { success: true, totalCount: parsed.response?.body?.totalCount || 0, items: Array.isArray(items) ? items : [items] };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ★ 기상청 날씨 프록시 (중기/단기)
function weatherProxy(data) {
  const serviceKey = PropertiesService.getScriptProperties().getProperty('DATA_GO_KR_KEY') || '';
  if (!serviceKey) return { success: false, error: 'DATA_GO_KR_KEY 미설정' };
  let url = '';
  if (data.type === 'mid') {
    // 중기예보 (10일)
    const tmFc = data.tmFc || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd') + '0600';
    url = 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=10&pageNo=1&dataType=JSON'
      + '&regId=' + (data.regId || '11B00000')
      + '&tmFc=' + tmFc;
  } else {
    // 단기예보
    const baseDate = data.baseDate || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    url = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 100)
      + '&pageNo=1&dataType=JSON'
      + '&base_date=' + baseDate
      + '&base_time=' + (data.baseTime || '0500')
      + '&nx=' + (data.nx || 55)
      + '&ny=' + (data.ny || 127);
  }
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const parsed = JSON.parse(res.getContentText());
    const items = parsed.response?.body?.items?.item || [];
    return { success: true, items: Array.isArray(items) ? items : [items] };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ★ 관세청 프록시 (환율/수출입실적/세관확인)
function customsProxy(data) {
  const serviceKey = PropertiesService.getScriptProperties().getProperty('DATA_GO_KR_KEY') || '';
  if (!serviceKey) return { success: false, error: 'DATA_GO_KR_KEY 미설정' };
  let url = '';
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  if (data.type === 'exchangeRate') {
    // 관세환율정보(GW) — XML 반환
    url = 'https://apis.data.go.kr/1220000/retrieveTrifFxrtInfo/getRetrieveTrifFxrtInfo'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=10&pageNo=1'
      + '&imexTp=' + (data.imexTp || '2')
      + '&qryYymmDd=' + (data.date || today);
  } else if (data.type === 'tradeStats') {
    // 품목별 수출입실적(GW) — XML
    url = 'http://apis.data.go.kr/1220000/retrieveTrfRate/getRfpdTrfRt'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 10)
      + '&pageNo=1';
    if (data.hsCode) url += '&hsSgn=' + data.hsCode;
  } else if (data.type === 'checkItems') {
    // 세관장확인대상물품(GW) — XML
    url = 'http://apis.data.go.kr/1220000/customscheck/customscheckinfo'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 10)
      + '&pageNo=1';
    if (data.hsCode) url += '&hsSgn=' + data.hsCode;
  }
  if (!url) return { success: false, error: 'customsProxy: type=' + (data.type || 'undefined') + '. exchangeRate/tradeStats/checkItems 중 선택' };
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const text = res.getContentText();
    // JSON 먼저 시도, 실패 시 XML 파싱
    try {
      return { success: true, data: JSON.parse(text) };
    } catch(je) {
      // XML → 텍스트로 반환 (프론트에서 파싱)
      const xml = XmlService.parse(text);
      const root = xml.getRootElement();
      const ns = root.getNamespace();
      const body = root.getChild('body', ns);
      if (!body) return { success: true, raw: text, format: 'xml' };
      const items = body.getChild('items', ns);
      if (!items) return { success: true, raw: text, format: 'xml' };
      const arr = items.getChildren('item', ns).map(function(item) {
        var obj = {};
        item.getChildren().forEach(function(ch) { obj[ch.getName()] = ch.getText(); });
        return obj;
      });
      return { success: true, data: arr, totalCount: arr.length };
    }
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ★ KOTRA 프록시 (수입규제/해외시장뉴스/상품DB)
function kotraProxy(data) {
  const serviceKey = PropertiesService.getScriptProperties().getProperty('DATA_GO_KR_KEY') || '';
  if (!serviceKey) return { success: false, error: 'DATA_GO_KR_KEY 미설정' };
  let url = '';
  if (data.type === 'importReg') {
    url = 'https://apis.data.go.kr/B410001/kotra_overseasMarketNews/ovseaMrktNews'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 10)
      + '&pageNo=1';
    if (data.keyword) url += '&search=' + encodeURIComponent(data.keyword);
  } else if (data.type === 'overseasNews') {
    url = 'https://apis.data.go.kr/B410001/kotra_overseasMarketNews/ovseaMrktNews'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 10)
      + '&pageNo=1';
    if (data.keyword) url += '&search=' + encodeURIComponent(data.keyword);
  } else if (data.type === 'productDB') {
    url = 'https://apis.data.go.kr/B410001/cmmdtDb/cmmdtDb'
      + '?serviceKey=' + serviceKey
      + '&numOfRows=' + (data.rows || 10)
      + '&pageNo=1';
    if (data.keyword) url += '&search=' + encodeURIComponent(data.keyword);
  }
  if (!url) return { success: false, error: 'kotraProxy: type=' + (data.type || 'undefined') + '. importReg/overseasNews/productDB 중 선택' };
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const text = res.getContentText();
    try {
      return { success: true, data: JSON.parse(text) };
    } catch(je) {
      // XML 파싱 시도
      try {
        const xml = XmlService.parse(text);
        const root = xml.getRootElement();
        const ns = root.getNamespace();
        const body = root.getChild('body', ns);
        if (!body) return { success: true, raw: text, format: 'xml' };
        const items = body.getChild('items', ns);
        if (!items) return { success: true, raw: text, format: 'xml' };
        const arr = items.getChildren('item', ns).map(function(item) {
          var obj = {};
          item.getChildren().forEach(function(ch) { obj[ch.getName()] = ch.getText(); });
          return obj;
        });
        return { success: true, data: arr, totalCount: arr.length };
      } catch(xe) {
        return { success: false, error: 'Parse error: ' + text.substring(0, 200) };
      }
    }
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ==================== 쿠팡 API 프록시 ====================

/**
 * ★ 쿠팡 HMAC-SHA256 서명 생성 (공통 유틸)
 * @param {string} method HTTP 메서드
 * @param {string} path API 경로 (쿼리 포함)
 * @param {string} secretKey 시크릿 키
 * @param {string} accessKey 액세스 키
 * @returns {string} Authorization 헤더 값
 */
function generateCoupangHmac_(method, path, secretKey, accessKey) {
  const datetime = Utilities.formatDate(new Date(), 'UTC', "yyMMdd'T'HHmmss'Z'");
  const message = datetime + method.toUpperCase() + path;
  const signature = Utilities.computeHmacSha256Signature(message, secretKey);
  const signatureHex = signature.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return 'CEA algorithm=HmacSHA256, access-key=' + accessKey
    + ', signed-date=' + datetime
    + ', signature=' + signatureHex;
}

// ★ 쿠팡 파트너스 API 프록시 (상품 검색/시세 조회)
function coupangPartnersProxy(data) {
  const accessKey = PropertiesService.getScriptProperties().getProperty('COUPANG_PARTNERS_ACCESS_KEY') || '';
  const secretKey = PropertiesService.getScriptProperties().getProperty('COUPANG_PARTNERS_SECRET_KEY') || '';
  if (!accessKey || !secretKey) {
    return { success: false, error: '쿠팡 파트너스 API 키가 설정되지 않았습니다. T7 → 시스템 설정에서 입력해주세요.', code: 'NO_KEY' };
  }

  const baseUrl = 'https://api-gateway.coupang.com';
  let path = '', method = 'GET';

  if (data.type === 'search') {
    // 키워드 상품 검색
    const keyword = encodeURIComponent(data.keyword || '');
    const limit = data.limit || 10;
    path = '/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=' + keyword + '&limit=' + limit;
  } else if (data.type === 'bestSeller') {
    // 카테고리별 베스트셀러
    const categoryId = data.categoryId || '0';
    const limit = data.limit || 10;
    path = '/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/' + categoryId + '?limit=' + limit;
  } else if (data.type === 'goldbox') {
    // 골드박스 딜 상품
    path = '/v2/providers/affiliate_open_api/apis/openapi/products/goldbox?subId=' + (data.subId || 'seller-dashboard');
  } else {
    return { success: false, error: 'coupangPartnersProxy: type=' + (data.type || 'undefined') + '. search/bestSeller/goldbox 중 선택' };
  }

  const authorization = generateCoupangHmac_('GET', path, secretKey, accessKey);
  try {
    const res = UrlFetchApp.fetch(baseUrl + path, {
      method: 'GET',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const body = JSON.parse(res.getContentText());
    if (code >= 200 && code < 300) {
      return { success: true, data: body };
    } else {
      return { success: false, status: code, error: body.message || JSON.stringify(body) };
    }
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ★ 쿠팡 WING API 프록시 (셀러 상품/주문/정산 관리)
function coupangWingProxy(data) {
  const accessKey = PropertiesService.getScriptProperties().getProperty('COUPANG_WING_ACCESS_KEY') || '';
  const secretKey = PropertiesService.getScriptProperties().getProperty('COUPANG_WING_SECRET_KEY') || '';
  const vendorId  = PropertiesService.getScriptProperties().getProperty('COUPANG_VENDOR_ID') || '';
  if (!accessKey || !secretKey) {
    return { success: false, error: '쿠팡 WING API 키가 설정되지 않았습니다. T7 → 시스템 설정에서 입력해주세요.', code: 'NO_KEY' };
  }

  const baseUrl = 'https://api-gateway.coupang.com';
  let path = '', method = 'GET', payload = null;

  if (data.type === 'productInfo') {
    // 상품 아이템별 수량/가격/상태 조회
    const sellerProductId = data.sellerProductId || '';
    path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/' + sellerProductId;
  } else if (data.type === 'updatePrice') {
    // 상품 가격 변경
    method = 'PUT';
    path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/' + data.sellerProductId + '/items/' + data.vendorItemId + '/prices/' + data.newPrice;
  } else if (data.type === 'orderList') {
    // 발주서 목록 조회
    const vid = vendorId || data.vendorId;
    if (!vid) return { success: false, error: 'vendorId가 필요합니다.' };
    const status = data.status || 'ACCEPT';
    const createdAtFrom = data.createdAtFrom || '';
    const createdAtTo = data.createdAtTo || '';
    path = '/v2/providers/openapi/apis/api/v4/vendors/' + vid + '/ordersheets?status=' + status;
    if (createdAtFrom) path += '&createdAtFrom=' + createdAtFrom;
    if (createdAtTo) path += '&createdAtTo=' + createdAtTo;
  } else if (data.type === 'settlement') {
    // 매출내역 조회
    const vid = vendorId || data.vendorId;
    if (!vid) return { success: false, error: 'vendorId가 필요합니다.' };
    path = '/v2/providers/openapi/apis/api/v4/vendors/' + vid + '/settlementData'
      + '?recognitionDateFrom=' + (data.dateFrom || '')
      + '&recognitionDateTo=' + (data.dateTo || '');
  } else if (data.type === 'categories') {
    // 카테고리 목록 조회
    path = '/v2/providers/seller_api/apis/api/v1/marketplace/meta/categories';
  } else {
    return { success: false, error: 'coupangWingProxy: unknown type ' + data.type };
  }

  const authorization = generateCoupangHmac_(method, path, secretKey, accessKey);
  const options = {
    method: method.toLowerCase(),
    headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);

  try {
    const res = UrlFetchApp.fetch(baseUrl + path, options);
    const code = res.getResponseCode();
    const text = res.getContentText();
    try {
      const body = JSON.parse(text);
      return { success: code >= 200 && code < 300, status: code, data: body };
    } catch(pe) {
      return { success: code >= 200 && code < 300, status: code, raw: text };
    }
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
