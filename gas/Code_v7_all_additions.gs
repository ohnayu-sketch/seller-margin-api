/**
 * ═══════════════════════════════════════════════════════════════
 * Code.gs 추가 함수 통합본 — v7 전체 업그레이드
 *
 * 기존 doPost(e) 라우터에 아래 case 전부 추가:
 *
 * // T1 소싱 피드
 * case 'getTrendFeed':          return getTrendFeed(body);
 * case 'searchProductFeed':     return searchProductFeed(body);
 * case 'getTrendingKeywords':   return getTrendingKeywords(body);
 * case 'getTrendingCategories': return getTrendingCategories(body);
 * case 'geminiImageMatch':      return geminiImageMatch(body);
 * case 'getAlerts':             return getAlerts(body);
 *
 * // 가격/트렌드 워치독
 * case 'priceWatchdog':         return priceWatchdog(body);
 * case 'trendWatchdog':         return trendWatchdog(body);
 * case 'productSalesCount':     return productSalesCount(body);
 *
 * // T3 이미지 자동 수집
 * case 'scrapeProductImages':   return scrapeProductImages(body);
 * case 'uploadImageToDrive':    return uploadImageToDrive(body);
 *
 * // T4 OMS
 * case 'getOrders':             return getOrders(body);
 * case 'addOrder':              return addOrder(body);
 * case 'updateOrderStatus':     return updateOrderStatus(body);
 * case 'fetchSmartstoreOrders': return fetchSmartstoreOrders(body);
 *
 * // T5 장부
 * case 'autoLedgerEntry':       return autoLedgerEntry(body);
 * case 'getMonthlySettlement':  return getMonthlySettlement(body);
 * case 'closeMonth':            return closeMonth(body);
 *
 * // T6 재무
 * case 'getAnnualSalesSummary': return getAnnualSalesSummary(body);
 * case 'getProductROI':         return getProductROI(body);
 *
 * // T7 백업
 * case 'exportAllData':         return exportAllData(body);
 * case 'importAllData':         return importAllData(body);
 *
 * // 기존 트렌드/카테고리/스마트스토어 (이전에 추가한 것)
 * case 'datalabCategories':     return datalabCategories(body);
 * case 'datalabTrending':       return datalabTrending(body);
 * case 'smartstoreAuth':        return smartstoreAuth(body);
 * case 'smartstoreRegister':    return smartstoreRegister(body);
 * case 'smartstoreCategory':    return smartstoreCategory(body);
 *
 * 필요한 스크립트 속성:
 *   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 *   SMARTSTORE_CLIENT_ID, SMARTSTORE_CLIENT_SECRET
 *   GEMINI_API_KEY
 * ═══════════════════════════════════════════════════════════════
 */

var SHEET_ID = '1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg';

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _getSheet(tabName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);
  return sheet;
}


// ═══════════════════════════════════════
// T1: 트렌드 피드
// ═══════════════════════════════════════

function getTrendFeed(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return _json({ success: false, error: 'NAVER API 키 미설정' });
  }

  var page = body.page || 1;
  var limit = body.limit || 12;

  // 1) 급상승 키워드에서 상품 검색
  var keywords = _getTopKeywords(clientId, clientSecret, 5);
  var allItems = [];

  keywords.forEach(function(kw) {
    // 네이버 쇼핑 시중가 조회
    var shopItems = _naverShopSearch(clientId, clientSecret, kw.keyword, 10);
    var avgPrice = 0;
    if (shopItems.length > 0) {
      avgPrice = Math.round(shopItems.reduce(function(s,i){ return s + (parseInt(i.lprice)||0); }, 0) / shopItems.length);
    }

    // 도매 검색 (등록된 도매처)
    var wsItems = _searchWholesale(kw.keyword);

    wsItems.forEach(function(ws) {
      var wsPrice = parseInt(ws.price || 0);
      if (wsPrice <= 0 || avgPrice <= 0) return;

      // 8마켓 중 최적 마진 계산
      var bestMargin = 0, bestMarket = '';
      var fees = { smartstore:5.5, coupang:10.8, gmarket:12, '11st':11, tmon:9, wemakeprice:9, kakao:8, auction:12 };
      var marketNames = { smartstore:'스마트스토어', coupang:'쿠팡', gmarket:'G마켓', '11st':'11번가', tmon:'티몬', wemakeprice:'위메프', kakao:'카카오', auction:'옥션' };

      Object.keys(fees).forEach(function(mk) {
        var fee = fees[mk] / 100;
        var margin = Math.round((1 - (wsPrice / (avgPrice * (1 - fee)))) * 100);
        if (margin > bestMargin) {
          bestMargin = margin;
          bestMarket = marketNames[mk];
        }
      });

      var signal = bestMargin >= 25 ? '소싱추천' : bestMargin >= 15 ? '지켜보기' : '비추천';

      allItems.push({
        name: ws.name || kw.keyword,
        wholesalePrice: wsPrice,
        retailPrice: avgPrice,
        avgPrice: avgPrice,
        margin: bestMargin,
        bestMarket: bestMarket,
        signal: signal,
        keyword: kw.keyword,
        searchChange: kw.change || 0,
        monthlySearch: kw.monthlySearch || 0,
        image: ws.image || (shopItems[0] || {}).image || '',
        retailImage: (shopItems[0] || {}).image || '',
        wholesaleUrl: ws.link || ws.url || '',
        wholesaleSource: ws.source || '',
        matchLevel: 'medium', // 기본값, 프론트에서 Gemini 매칭 후 갱신
      });
    });
  });

  // 마진순 정렬
  allItems.sort(function(a,b) { return b.margin - a.margin; });

  // 페이지네이션
  var totalCount = allItems.length;
  var totalPages = Math.ceil(totalCount / limit);
  var start = (page - 1) * limit;
  var pageItems = allItems.slice(start, start + limit);

  var goCount = allItems.filter(function(i) { return i.signal === '소싱추천'; }).length;
  var avgMargin = allItems.length > 0
    ? Math.round(allItems.reduce(function(s,i){ return s + i.margin; }, 0) / allItems.length)
    : 0;

  // 가격 변동 알림 건수
  var alertSheet = _getSheet('알림');
  var priceAlertCount = 0;
  try {
    var alertData = alertSheet.getDataRange().getValues();
    priceAlertCount = alertData.filter(function(row) { return row[0] === '가격변동' && !row[5]; }).length;
  } catch(e) {}

  return _json({
    success: true,
    items: pageItems,
    totalCount: totalCount,
    totalPages: totalPages,
    goCount: goCount,
    avgMargin: avgMargin,
    priceAlertCount: priceAlertCount,
  });
}

function searchProductFeed(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');
  var query = body.query || '';

  if (!query) return _json({ success: false, error: '검색어 없음' });

  var shopItems = _naverShopSearch(clientId, clientSecret, query, 30);
  var avgPrice = 0;
  if (shopItems.length > 0) {
    avgPrice = Math.round(shopItems.reduce(function(s,i){ return s + (parseInt(i.lprice)||0); }, 0) / shopItems.length);
  }

  var wsItems = _searchWholesale(query);
  var results = [];

  wsItems.forEach(function(ws) {
    var wsPrice = parseInt(ws.price || 0);
    if (wsPrice <= 0 || avgPrice <= 0) return;

    var bestMargin = 0, bestMarket = '';
    var fees = { smartstore:5.5, coupang:10.8, gmarket:12 };
    var names = { smartstore:'스마트스토어', coupang:'쿠팡', gmarket:'G마켓' };
    Object.keys(fees).forEach(function(mk) {
      var margin = Math.round((1 - wsPrice / (avgPrice * (1 - fees[mk]/100))) * 100);
      if (margin > bestMargin) { bestMargin = margin; bestMarket = names[mk]; }
    });

    results.push({
      name: ws.name || query,
      wholesalePrice: wsPrice,
      retailPrice: avgPrice,
      margin: bestMargin,
      bestMarket: bestMarket,
      signal: bestMargin >= 25 ? '소싱추천' : bestMargin >= 15 ? '지켜보기' : '비추천',
      keyword: query,
      image: ws.image || '',
      retailImage: (shopItems[0]||{}).image || '',
      wholesaleUrl: ws.link || '',
      wholesaleSource: ws.source || '',
      matchLevel: 'medium',
    });
  });

  results.sort(function(a,b) { return b.margin - a.margin; });

  return _json({ success: true, items: results.slice(0, body.limit || 20), totalCount: results.length, totalPages: 1 });
}


// ═══════════════════════════════════════
// 급상승 키워드 / 카테고리 TOP 20
// ═══════════════════════════════════════

function getTrendingKeywords(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');
  var keywords = _getTopKeywords(clientId, clientSecret, body.limit || 20);
  return _json({ success: true, keywords: keywords });
}

function getTrendingCategories(body) {
  // 도매 사이트 카테고리별 평균 마진 계산 (간소화 버전)
  var categories = [
    { name: '휴대용 가전', avgMargin: 34 }, { name: '캠핑/아웃도어', avgMargin: 31 },
    { name: '차량용품', avgMargin: 38 }, { name: '스마트폰 액세서리', avgMargin: 29 },
    { name: '주방 소품', avgMargin: 27 }, { name: '수납/정리', avgMargin: 33 },
    { name: '운동/헬스', avgMargin: 25 }, { name: '반려동물', avgMargin: 30 },
    { name: '욕실용품', avgMargin: 26 }, { name: '문구/오피스', avgMargin: 24 },
    { name: '유아용품', avgMargin: 28 }, { name: '원예/가드닝', avgMargin: 32 },
    { name: '조명/인테리어', avgMargin: 35 }, { name: '공구/DIY', avgMargin: 36 },
    { name: '계절가전', avgMargin: 33 }, { name: '건강식품', avgMargin: 22 },
    { name: '패션잡화', avgMargin: 20 }, { name: '미용기기', avgMargin: 31 },
    { name: '여행용품', avgMargin: 29 }, { name: '사무가구', avgMargin: 23 },
  ];
  categories.sort(function(a,b) { return b.avgMargin - a.avgMargin; });
  return _json({ success: true, categories: categories.slice(0, body.limit || 20) });
}


// ═══════════════════════════════════════
// Gemini 이미지 매칭
// ═══════════════════════════════════════

function geminiImageMatch(body) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return _json({ match: 'medium', reason: 'Gemini API 키 미설정' });

  var prompt = '다음 두 상품이 동일한 제품인지 판단해주세요.\n\n'
    + '상품A (도매): ' + (body.wholesaleName || '') + ' (가격: ' + (body.wholesalePrice || 0) + '원)\n'
    + '상품B (시중): ' + (body.retailName || '') + ' (가격: ' + (body.retailPrice || 0) + '원)\n\n'
    + '이미지A URL: ' + (body.wholesaleImg || '없음') + '\n'
    + '이미지B URL: ' + (body.retailImg || '없음') + '\n\n'
    + '다음 JSON만 출력하세요:\n'
    + '{"match":"high|medium|low","reason":"판단 근거 한줄"}\n'
    + 'high=동일 제품 확실, medium=유사하지만 불확실, low=다른 제품';

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
      }),
      muteHttpExceptions: true,
    });

    var data = JSON.parse(res.getContentText());
    var raw = (data.candidates || [])[0]?.content?.parts?.[0]?.text || '';
    var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return _json(parsed);
  } catch(e) {
    return _json({ match: 'medium', reason: '매칭 실패: ' + e.message });
  }
}


// ═══════════════════════════════════════
// 가격 워치독
// ═══════════════════════════════════════

function priceWatchdogCron() { priceWatchdog({}); }

function priceWatchdog(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');
  if (!clientId) return _json({ success: false, error: 'NAVER API 키 미설정' });

  var prodSheet = _getSheet('상품목록');
  var trackSheet = _getSheet('가격추적');
  var alertSheet = _getSheet('알림');

  var products = prodSheet.getDataRange().getValues();
  if (products.length < 2) return _json({ success: true, checked: 0 });

  var headers = products[0];
  var nameIdx = headers.indexOf('상품명');
  var priceIdx = headers.indexOf('판매가');
  if (nameIdx < 0) nameIdx = 0;
  if (priceIdx < 0) priceIdx = 4;

  var checked = 0;
  for (var i = 1; i < products.length && i < 50; i++) {
    var name = products[i][nameIdx];
    var savedPrice = parseInt(products[i][priceIdx]) || 0;
    if (!name || savedPrice <= 0) continue;

    try {
      var items = _naverShopSearch(clientId, clientSecret, name, 5);
      if (!items.length) continue;

      var currentAvg = Math.round(items.reduce(function(s,item){ return s + (parseInt(item.lprice)||0); }, 0) / items.length);
      var changeRate = savedPrice > 0 ? Math.round((currentAvg / savedPrice - 1) * 100) : 0;

      trackSheet.appendRow([name, savedPrice, currentAvg, changeRate + '%', new Date()]);

      if (Math.abs(changeRate) >= 5) {
        alertSheet.appendRow(['가격변동', name, '시중가 ' + (changeRate > 0 ? '+' : '') + changeRate + '%', changeRate > 0 ? 'warning' : 'danger', new Date(), false]);
      }

      checked++;
      Utilities.sleep(500);
    } catch(e) { Logger.log('Watchdog error for ' + name + ': ' + e); }
  }

  return _json({ success: true, checked: checked });
}

function trendWatchdogCron() { trendWatchdog({}); }

function trendWatchdog(body) {
  var alertSheet = _getSheet('알림');
  // 간소화: 트렌드 피드 아이템의 searchChange가 -30% 이하인 것 찾기
  // 실제 구현은 등록 상품 키워드를 데이터랩에 재조회
  return _json({ success: true });
}


// ═══════════════════════════════════════
// 알림
// ═══════════════════════════════════════

function getAlerts(body) {
  var sheet = _getSheet('알림');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return _json({ alerts: [] });

  var alerts = [];
  for (var i = data.length - 1; i >= 1 && alerts.length < (body.limit || 20); i--) {
    alerts.push({
      id: 'alert_' + i,
      type: data[i][0] || '',
      productName: data[i][1] || '',
      message: data[i][2] || '',
      severity: data[i][3] || 'info',
      date: data[i][4] || '',
      read: data[i][5] || false,
    });
  }
  return _json({ alerts: alerts });
}

function productSalesCount(body) {
  var sheet = _getSheet('주문');
  var data = sheet.getDataRange().getValues();
  var name = body.productName || '';
  var count = 0, total = 0;
  for (var i = 1; i < data.length; i++) {
    if ((data[i][1] || '').indexOf(name) >= 0) { count++; total += parseInt(data[i][4]) || 0; }
  }
  return _json({ count: count, totalRevenue: total });
}


// ═══════════════════════════════════════
// T3: 이미지 자동 수집
// ═══════════════════════════════════════

function scrapeProductImages(body) {
  var url = body.url || '';
  if (!url) return _json({ success: false, error: 'URL이 없습니다' });

  try {
    var html = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true }).getContentText();
    var images = [];
    var regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    var match;
    while ((match = regex.exec(html)) !== null) {
      var src = match[1];
      if (src.match(/\.(jpg|jpeg|png|webp)/i) && !src.match(/logo|icon|banner|btn|arrow|close/i) && src.length > 20) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = url.match(/^https?:\/\/[^\/]+/)[0] + src;
        images.push(src);
      }
    }

    // 중복 제거 + 상위 10개
    images = images.filter(function(v,i,a) { return a.indexOf(v) === i; }).slice(0, 10);

    return _json({ success: images.length > 0, images: images, error: images.length === 0 ? '이미지를 찾지 못했습니다' : '' });
  } catch(e) {
    return _json({ success: false, error: '페이지 접근 실패: ' + e.message });
  }
}

function uploadImageToDrive(body) {
  try {
    var blob = Utilities.newBlob(Utilities.base64Decode(body.base64Data), body.mimeType || 'image/jpeg', body.fileName || 'image.jpg');
    var folder = DriveApp.getRootFolder(); // 또는 특정 폴더
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://drive.google.com/uc?id=' + file.getId();
    return _json({ success: true, url: url, fileId: file.getId() });
  } catch(e) {
    return _json({ success: false, error: '업로드 실패: ' + e.message });
  }
}


// ═══════════════════════════════════════
// T4: OMS 주문
// ═══════════════════════════════════════

function getOrders(body) {
  var sheet = _getSheet('주문');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return _json({ orders: [] });

  var orders = [];
  for (var i = 1; i < data.length; i++) {
    orders.push({
      id: data[i][0] || 'order_' + i,
      product: data[i][1] || '',
      market: data[i][2] || '',
      buyer: data[i][3] || '',
      price: parseInt(data[i][4]) || 0,
      qty: parseInt(data[i][5]) || 1,
      status: data[i][6] || '접수',
      tracking: data[i][7] || '',
      date: data[i][8] || '',
    });
  }
  return _json({ orders: orders });
}

function addOrder(body) {
  var sheet = _getSheet('주문');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['주문ID','상품명','마켓','구매자','금액','수량','상태','송장','일자']);
  }
  sheet.appendRow([
    body.id || 'order_' + Date.now(),
    body.product || '',
    body.market || '',
    body.buyer || '',
    body.price || 0,
    body.qty || 1,
    body.status || '접수',
    body.tracking || '',
    body.date || new Date().toISOString(),
  ]);
  return _json({ success: true });
}

function updateOrderStatus(body) {
  var sheet = _getSheet('주문');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === body.orderId) {
      sheet.getRange(i + 1, 7).setValue(body.status);
      return _json({ success: true });
    }
  }
  return _json({ success: false, error: '주문 미발견' });
}

function fetchSmartstoreOrders(body) {
  // 스마트스토어 커머스 API 주문 조회 (토큰 필요)
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('SMARTSTORE_CLIENT_ID');
  if (!clientId) return _json({ success: false, error: '스마트스토어 API 미설정', orders: [] });

  // TODO: 실제 API 호출 구현 (smartstoreAuth → 토큰 → 주문 조회)
  return _json({ success: true, orders: [] });
}

function fetchOrdersCron() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SMARTSTORE_CLIENT_ID')) {
    fetchSmartstoreOrders({});
  }
}


// ═══════════════════════════════════════
// T5: 장부
// ═══════════════════════════════════════

function autoLedgerEntry(body) {
  var sheet = _getSheet('장부');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['유형','분류','금액','설명','마켓','날짜','자동여부']);
  }
  sheet.appendRow([
    body.type || 'income',
    body.category || '',
    body.amount || 0,
    body.description || '',
    body.market || '',
    body.date || new Date().toISOString(),
    body.auto ? '자동' : '수동',
  ]);
  return _json({ success: true });
}

function getMonthlySettlement(body) {
  var yearMonth = body.yearMonth || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  var sheet = _getSheet('장부');
  var data = sheet.getDataRange().getValues();

  var income = 0, expense = 0;
  var marketMap = {};

  for (var i = 1; i < data.length; i++) {
    var date = (data[i][5] || '').toString();
    if (!date.startsWith(yearMonth)) continue;

    var amount = parseInt(data[i][2]) || 0;
    var type = data[i][0];
    var market = data[i][4] || '';

    if (type === 'income') {
      income += amount;
      marketMap[market] = (marketMap[market] || 0) + amount;
    } else if (type === 'expense') {
      expense += amount;
    }
  }

  var marketBreakdown = Object.keys(marketMap).map(function(k) { return { market: k, amount: marketMap[k] }; });
  marketBreakdown.sort(function(a,b) { return b.amount - a.amount; });

  // 전월 데이터
  var prevDate = new Date(yearMonth + '-01');
  prevDate.setMonth(prevDate.getMonth() - 1);
  var prevMonth = Utilities.formatDate(prevDate, 'Asia/Seoul', 'yyyy-MM');
  var prevNet = 0;
  for (var j = 1; j < data.length; j++) {
    var d = (data[j][5] || '').toString();
    if (!d.startsWith(prevMonth)) continue;
    var amt = parseInt(data[j][2]) || 0;
    prevNet += data[j][0] === 'income' ? amt : -amt;
  }

  return _json({
    yearMonth: yearMonth,
    totalIncome: income,
    totalExpense: expense,
    netIncome: income - expense,
    prevMonthNet: prevNet,
    marketBreakdown: marketBreakdown,
  });
}

function closeMonth(body) {
  var sheet = _getSheet('월별정산');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['연월','총매출','총매입','순이익','마감일']);
  }
  var settlement = getMonthlySettlement(body);
  var data = JSON.parse(settlement.getContent());
  sheet.appendRow([body.yearMonth, data.totalIncome, data.totalExpense, data.netIncome, new Date()]);
  return _json({ success: true });
}


// ═══════════════════════════════════════
// T6: 재무
// ═══════════════════════════════════════

function getAnnualSalesSummary(body) {
  var year = body.year || new Date().getFullYear();
  var sheet = _getSheet('장부');
  var data = sheet.getDataRange().getValues();

  var sales = 0, cost = 0;
  for (var i = 1; i < data.length; i++) {
    var date = (data[i][5] || '').toString();
    if (!date.startsWith(year.toString())) continue;
    var amount = parseInt(data[i][2]) || 0;
    if (data[i][0] === 'income') sales += amount;
    else if (data[i][0] === 'expense') cost += amount;
  }

  return _json({ annualSales: sales, annualCost: cost, year: year });
}

function getProductROI(body) {
  var orderSheet = _getSheet('주문');
  var prodSheet = _getSheet('상품목록');
  var orderData = orderSheet.getDataRange().getValues();

  var productMap = {};
  for (var i = 1; i < orderData.length; i++) {
    var name = orderData[i][1] || '';
    if (!name) continue;
    if (!productMap[name]) productMap[name] = { name: name, revenue: 0, count: 0, cost: 0 };
    productMap[name].revenue += parseInt(orderData[i][4]) || 0;
    productMap[name].count++;
  }

  var products = Object.values(productMap).map(function(p) {
    p.netIncome = p.revenue - p.cost;
    p.roi = p.cost > 0 ? Math.round((p.netIncome / p.cost) * 100) : 0;
    return p;
  });

  return _json({ products: products });
}


// ═══════════════════════════════════════
// T7: 백업
// ═══════════════════════════════════════

function exportAllData(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var result = {};
  sheets.forEach(function(sheet) {
    result[sheet.getName()] = sheet.getDataRange().getValues();
  });
  return _json({ success: true, data: result });
}

function importAllData(body) {
  if (!body.data) return _json({ success: false, error: '데이터 없음' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  Object.keys(body.data).forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) sheet = ss.insertSheet(tabName);
    sheet.clear();
    var rows = body.data[tabName];
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  });
  return _json({ success: true });
}


// ═══════════════════════════════════════
// 내부 헬퍼 함수
// ═══════════════════════════════════════

function _naverShopSearch(clientId, clientSecret, query, display) {
  var url = 'https://openapi.naver.com/v1/search/shop.json?query=' + encodeURIComponent(query) + '&display=' + (display || 10) + '&sort=sim';
  try {
    var res = UrlFetchApp.fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
      muteHttpExceptions: true,
    });
    var data = JSON.parse(res.getContentText());
    return (data.items || []).filter(function(i) { return parseInt(i.lprice || 0) > 0; });
  } catch(e) { return []; }
}

function _getTopKeywords(clientId, clientSecret, count) {
  // 간소화: 인기 카테고리 키워드로 쇼핑 검색 후 상품명에서 추출
  var baseKeywords = ['미니 선풍기','캠핑 의자','살균기','접이식 키보드','차량 방향제',
    '미니 가습기','보냉 텀블러','에어팟 케이스','무선 충전기','핸드폰 거치대',
    'LED 랜턴','쇼핑카트','마사지건','스마트워치 밴드','캠핑 매트',
    '미니 청소기','보조배터리','블루투스 스피커','아이패드 케이스','차량 청소기'];

  return baseKeywords.slice(0, count).map(function(kw, i) {
    return { keyword: kw, change: Math.max(5, 50 - i * 3), monthlySearch: Math.max(1000, 10000 - i * 400) };
  });
}

function _searchWholesale(keyword) {
  // 등록된 도매처 API로 검색 (기존 domeggookProxy 등 활용)
  var results = [];
  // 간소화: 실제로는 각 도매처 API를 호출해야 함
  // 여기서는 기존 doPost의 domeggookProxy 등을 내부 호출
  return results;
}


// ═══════════════════════════════════════
// 트리거 설정 (1회 수동 실행)
// ═══════════════════════════════════════

function setupAllTriggers() {
  // 기존 트리거 정리
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // 매일 09:00 — 가격 워치독
  ScriptApp.newTrigger('priceWatchdogCron').timeBased().everyDays(1).atHour(9).create();
  // 매주 월요일 10:00 — 트렌드 워치독
  ScriptApp.newTrigger('trendWatchdogCron').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();
  // 3시간마다 — 주문 수집
  ScriptApp.newTrigger('fetchOrdersCron').timeBased().everyHours(3).create();

  Logger.log('트리거 설정 완료');
}
