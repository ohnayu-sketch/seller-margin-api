/**
 * ═══════════════════════════════════════════════════════════════
 * 셀러 대시보드 V7 — Google Apps Script 함수 모음
 * 파일: gas/v7-gas-functions.gs
 * 
 * 사용법: Google Apps Script 에디터에 이 코드를 붙여넣고,
 *         기존 Code.gs의 doPost 라우터에 아래 case들을 추가하세요.
 * 
 * 필수 사전 설정:
 *   1. 구글시트에 아래 탭 생성: 가격추적, 알림, 주문, 마켓등록, 월별정산, 장부
 *   2. Script Properties에 API 키 등록 (T7에서 동기화)
 *   3. setupV7Triggers() 1회 실행
 * ═══════════════════════════════════════════════════════════════
 */

// ─── 공통 유틸 ───
function getSheet_(tabName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  return sheet;
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function toJSON_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
// doPost 라우터에 추가할 케이스 (기존 Code.gs에 병합)
// ═══════════════════════════════════════════════════════════════
/*
  기존 doPost의 switch(action) 안에 아래를 추가하세요:
  
  // V7 추가 함수들
  case 'fetchSmartstoreOrders':    return fetchSmartstoreOrders(body);
  case 'smartstoreUpdateTracking': return smartstoreUpdateTracking(body);
  case 'autoPlaceWholesaleOrder':  return autoPlaceWholesaleOrder(body);
  case 'priceWatchdog':            return priceWatchdog(body);
  case 'getPriceAlerts':           return getPriceAlerts(body);
  case 'trendWatchdog':            return trendWatchdog(body);
  case 'writeToLedger':            return writeToLedger(body);
  case 'registerToCoupang':        return registerToCoupang(body);
  case 'registerTo11st':           return registerTo11st(body);
  case 'registerToSmartstore':     return registerToSmartstore(body);
  case 'registerToGmarket':        return registerToGmarket(body);
  case 'productSalesCount':        return productSalesCount(body);
  case 'getMonthlySettlement':     return getMonthlySettlement(body);
  case 'exportLedger':             return exportLedger(body);
  case 'monthlyClose':             return monthlyClose(body);
*/


// ═══════════════════════════════════════════════════════════════
// 1. fetchSmartstoreOrders — 스마트스토어 주문 수집
// ═══════════════════════════════════════════════════════════════
function fetchSmartstoreOrders(body) {
  try {
    const clientId = getProp_('smartstore-client-id');
    const clientSecret = getProp_('smartstore-client-secret');
    
    if (!clientId || !clientSecret) {
      return toJSON_({ success: false, error: 'API 키 미설정. T7에서 스마트스토어 Client ID/Secret을 등록하세요.' });
    }
    
    // 1) 토큰 발급
    const tokenRes = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&type=SELF`,
      muteHttpExceptions: true,
    });
    const tokenData = JSON.parse(tokenRes.getContentText());
    if (!tokenData.access_token) {
      return toJSON_({ success: false, error: '토큰 발급 실패: ' + (tokenData.error_description || '') });
    }
    
    // 2) 주문 조회 (최근 7일)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const fromDate = Utilities.formatDate(weekAgo, 'Asia/Seoul', "yyyy-MM-dd'T'00:00:00.000+09:00");
    const toDate = Utilities.formatDate(now, 'Asia/Seoul', "yyyy-MM-dd'T'23:59:59.999+09:00");
    
    const orderRes = UrlFetchApp.fetch(
      `https://api.commerce.naver.com/external/v1/pay-order/seller/orders/last-changed-statuses?lastChangedFrom=${encodeURIComponent(fromDate)}&lastChangedTo=${encodeURIComponent(toDate)}`,
      {
        method: 'get',
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        muteHttpExceptions: true,
      }
    );
    const orderData = JSON.parse(orderRes.getContentText());
    const productOrders = orderData.data?.lastChangeStatuses || [];
    
    // 3) 구글시트 "주문" 탭에 저장
    const sheet = getSheet_('주문');
    const existingIds = sheet.getDataRange().getValues().map(r => String(r[0]));
    const newOrders = [];
    
    productOrders.forEach(o => {
      const orderId = String(o.productOrderId || o.orderId || '');
      if (orderId && !existingIds.includes(orderId)) {
        const row = [
          orderId,
          o.productName || '',
          'smartstore',
          o.buyerName || '',
          Number(o.totalPaymentAmount || 0),
          o.productOrderStatus || 'PAYED',
          '',  // 송장
          o.orderDate || new Date().toISOString(),
        ];
        sheet.appendRow(row);
        newOrders.push({
          orderId, productName: o.productName,
          salePrice: o.totalPaymentAmount, quantity: o.quantity || 1,
          market: 'smartstore', buyer: o.buyerName,
          orderDate: o.orderDate,
        });
      }
    });
    
    return toJSON_({ success: true, orders: newOrders, total: productOrders.length });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 2. smartstoreUpdateTracking — 마켓 송장 등록
// ═══════════════════════════════════════════════════════════════
function smartstoreUpdateTracking(body) {
  try {
    const clientId = getProp_('smartstore-client-id');
    const clientSecret = getProp_('smartstore-client-secret');
    if (!clientId || !clientSecret) {
      return toJSON_({ success: false, error: 'API 키 미설정' });
    }
    
    // 토큰
    const tokenRes = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&type=SELF`,
      muteHttpExceptions: true,
    });
    const token = JSON.parse(tokenRes.getContentText()).access_token;
    if (!token) return toJSON_({ success: false, error: '토큰 실패' });
    
    // 택배사 코드 매핑
    const courierCodes = {
      'CJ대한통운': 'CJGLS', '한진택배': 'HANJIN', '롯데택배': 'LOTTE',
      '우체국택배': 'EPOST', '로젠택배': 'LOGEN', '경동택배': 'KDEXP',
    };
    const deliveryCompany = courierCodes[body.trackingCompany] || 'CJGLS';
    
    // 발송 처리
    const res = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/dispatch', {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        dispatchProductOrders: [{
          productOrderId: body.orderId,
          deliveryMethod: 'DELIVERY',
          deliveryCompanyCode: deliveryCompany,
          trackingNumber: body.trackingNo,
        }]
      }),
      muteHttpExceptions: true,
    });
    
    const result = JSON.parse(res.getContentText());
    
    // 구글시트 업데이트
    const sheet = getSheet_('주문');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(body.orderId)) {
        sheet.getRange(i + 1, 7).setValue(body.trackingNo);  // 송장 컬럼
        sheet.getRange(i + 1, 6).setValue('배송중');
        break;
      }
    }
    
    return toJSON_({ success: true, result });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 3. autoPlaceWholesaleOrder — 도매처 자동발주
// ═══════════════════════════════════════════════════════════════
function autoPlaceWholesaleOrder(body) {
  try {
    // 도매꾹 API (예시 — 실제 도매처별 API 형식에 맞춰 수정)
    const apiKey = getProp_('domeggook-api-key');
    
    if (!apiKey && !body.sourceUrl) {
      return toJSON_({
        success: false,
        error: '도매 API 키 없음. 수동 발주가 필요합니다.',
        manualOrderInfo: {
          productName: body.productName,
          quantity: body.quantity,
          vendor: body.vendor || '(미지정)',
          sourceUrl: body.sourceUrl || '(URL 없음)',
        }
      });
    }
    
    // API 발주 가능한 경우
    if (apiKey) {
      // 도매처 API 호출 (도매꾹 예시)
      const orderRes = UrlFetchApp.fetch('https://domeggook.com/api/order', {
        method: 'post',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          productName: body.productName,
          quantity: body.quantity,
        }),
        muteHttpExceptions: true,
      });
      
      const result = JSON.parse(orderRes.getContentText());
      return toJSON_({
        success: true,
        wholesaleOrderId: result.orderId || 'WO-' + Date.now(),
        message: `${body.productName} ${body.quantity}개 발주 완료`,
      });
    }
    
    // API 없지만 URL이 있는 경우 — 수동 발주 가이드
    return toJSON_({
      success: true,
      wholesaleOrderId: 'MANUAL-' + Date.now(),
      message: `수동 발주 필요: ${body.sourceUrl}`,
      isManual: true,
    });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 4. priceWatchdog / getPriceAlerts — 가격 변동 감지
// ═══════════════════════════════════════════════════════════════
function priceWatchdog(body) {
  try {
    const productSheet = getSheet_('상품목록');
    const trackSheet = getSheet_('가격추적');
    const alertSheet = getSheet_('알림');
    
    const products = productSheet.getDataRange().getValues();
    if (products.length <= 1) return toJSON_({ success: true, checked: 0, alerts: [] });
    
    const alerts = [];
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    
    // 헤더 건너뛰기 (1행부터)
    for (let i = 1; i < products.length; i++) {
      const productName = String(products[i][0] || '');  // A열: 상품명
      const prevPrice = Number(products[i][3] || 0);      // D열: 시중가(기존)
      
      if (!productName || prevPrice <= 0) continue;
      
      try {
        // 네이버 쇼핑 API로 현재 시중가 조회
        const searchRes = UrlFetchApp.fetch(
          `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(productName)}&display=5&sort=sim`,
          {
            headers: {
              'X-Naver-Client-Id': getProp_('naver-client-id'),
              'X-Naver-Client-Secret': getProp_('naver-client-secret'),
            },
            muteHttpExceptions: true,
          }
        );
        
        const searchData = JSON.parse(searchRes.getContentText());
        const items = searchData.items || [];
        if (!items.length) continue;
        
        const avgPrice = Math.round(items.reduce((s, it) => s + Number(it.lprice || 0), 0) / items.length);
        const changeRate = prevPrice > 0 ? Math.round(((avgPrice - prevPrice) / prevPrice) * 100) : 0;
        
        // 가격추적 탭에 기록
        trackSheet.appendRow([productName, prevPrice, avgPrice, changeRate, today]);
        
        // ±5% 이상 변동 시 알림
        if (Math.abs(changeRate) >= 5) {
          alerts.push({ productName, prevPrice, currentPrice: avgPrice, changeRate });
          alertSheet.appendRow(['가격변동', productName, `시중가 ${changeRate > 0 ? '+' : ''}${changeRate}% 변동`, changeRate > 10 ? '높음' : '보통', today, '미확인']);
          
          // 상품목록 시중가 업데이트
          productSheet.getRange(i + 1, 4).setValue(avgPrice);
        }
        
        Utilities.sleep(200); // API 부하 방지
      } catch (innerE) {
        Logger.log('워치독 개별 오류: ' + productName + ' — ' + innerE.message);
      }
    }
    
    return toJSON_({ success: true, checked: products.length - 1, alerts });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}

function getPriceAlerts(body) {
  try {
    const sheet = getSheet_('알림');
    const data = sheet.getDataRange().getValues();
    const alerts = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === '가격변동' && data[i][5] === '미확인') {
        alerts.push({
          productName: data[i][1],
          content: data[i][2],
          severity: data[i][3],
          date: data[i][4],
          changeRate: parseInt(String(data[i][2]).match(/-?\d+/) || '0'),
        });
      }
    }
    
    return toJSON_({ success: true, alerts });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message, alerts: [] });
  }
}


// ═══════════════════════════════════════════════════════════════
// 5. trendWatchdog — 트렌드 하락 감지
// ═══════════════════════════════════════════════════════════════
function trendWatchdog(body) {
  try {
    const productSheet = getSheet_('상품목록');
    const alertSheet = getSheet_('알림');
    const products = productSheet.getDataRange().getValues();
    
    if (products.length <= 1) return toJSON_({ success: true, alerts: [] });
    
    const alerts = [];
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    
    for (let i = 1; i < products.length; i++) {
      const keyword = String(products[i][0] || ''); // 상품명/키워드
      if (!keyword) continue;
      
      try {
        // 네이버 데이터랩 검색 트렌드 API
        const endDate = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
        const startDate = Utilities.formatDate(new Date(Date.now() - 14 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
        
        const trendRes = UrlFetchApp.fetch('https://openapi.naver.com/v1/datalab/search', {
          method: 'post',
          headers: {
            'X-Naver-Client-Id': getProp_('naver-client-id'),
            'X-Naver-Client-Secret': getProp_('naver-client-secret'),
            'Content-Type': 'application/json',
          },
          payload: JSON.stringify({
            startDate, endDate,
            timeUnit: 'week',
            keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
          }),
          muteHttpExceptions: true,
        });
        
        const trendData = JSON.parse(trendRes.getContentText());
        const ratios = trendData.results?.[0]?.data || [];
        
        if (ratios.length >= 2) {
          const prev = ratios[ratios.length - 2].ratio || 0;
          const curr = ratios[ratios.length - 1].ratio || 0;
          const dropRate = prev > 0 ? Math.round(((prev - curr) / prev) * 100) : 0;
          
          if (dropRate >= 30) {
            alerts.push({ keyword, dropRate, period: '전주 대비', prevRatio: prev, currRatio: curr });
            alertSheet.appendRow(['트렌드하락', keyword, `검색량 -${dropRate}% 하락`, dropRate >= 50 ? '높음' : '보통', today, '미확인']);
          }
        }
        
        Utilities.sleep(300);
      } catch (innerE) {
        Logger.log('트렌드 워치독 개별 오류: ' + keyword + ' — ' + innerE.message);
      }
    }
    
    return toJSON_({ success: true, alerts });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message, alerts: [] });
  }
}


// ═══════════════════════════════════════════════════════════════
// 6. writeToLedger — 장부 시트 동기화
// ═══════════════════════════════════════════════════════════════
function writeToLedger(body) {
  try {
    const sheet = getSheet_('장부');
    const entries = body.entries || [];
    
    if (!entries.length) return toJSON_({ success: true, written: 0 });
    
    // 헤더 확인
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['유형', '카테고리', '금액', '설명', '날짜', '마켓', '기록일']);
    }
    
    entries.forEach(e => {
      sheet.appendRow([
        e.type || '',
        e.category || '',
        Number(e.amount || 0),
        e.desc || '',
        e.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
        e.market || '',
        new Date().toISOString(),
      ]);
    });
    
    return toJSON_({ success: true, written: entries.length });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 7. registerToCoupang — 쿠팡 상품 등록
// ═══════════════════════════════════════════════════════════════
function registerToCoupang(body) {
  try {
    const accessKey = getProp_('coupang-access-key');
    const secretKey = getProp_('coupang-secret-key');
    
    if (!accessKey || !secretKey) {
      return toJSON_({ success: false, error: '쿠팡 API 키 미설정. T7에서 등록하세요.' });
    }
    
    // HMAC-SHA256 서명 생성 (쿠팡 Wing API 규격)
    const method = 'POST';
    const path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
    const datetime = Utilities.formatDate(new Date(), 'UTC', "yyMMdd'T'HHmmss'Z'");
    
    const message = datetime + method + path;
    const signature = Utilities.computeHmacSha256Signature(message, secretKey)
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    
    const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
    
    const payload = {
      sellerProductName: body.name,
      displayCategoryCode: body.categoryCode || 0,
      vendorId: '',
      salePrice: body.price || 0,
      deliveryChargeType: 'FREE',
      deliveryCharge: 0,
      items: [{
        itemName: body.name,
        originalPrice: body.price,
        salePrice: body.price,
        maximumBuyCount: 999,
        maximumBuyForPerson: 0,
        content: body.html || body.description || '',
        images: (body.images || []).map((url, i) => ({
          imageOrder: i, imageType: i === 0 ? 'REPRESENTATIVE' : 'DETAIL', vendorPath: url,
        })),
      }],
    };
    
    const res = UrlFetchApp.fetch('https://api-gateway.coupang.com' + path, {
      method: 'post',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    
    const result = JSON.parse(res.getContentText());
    
    // 마켓등록 기록
    if (result.data) {
      const regSheet = getSheet_('마켓등록');
      regSheet.appendRow([body.name, '쿠팡', result.data || '', '', new Date().toISOString(), 'registered']);
    }
    
    return toJSON_({
      success: !!result.data,
      productId: result.data || '',
      error: result.message || '',
    });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 8. registerTo11st — 11번가 상품 등록
// ═══════════════════════════════════════════════════════════════
function registerTo11st(body) {
  try {
    const apiKey = getProp_('11st-api-key');
    if (!apiKey) {
      return toJSON_({ success: false, error: '11번가 API 키 미설정. T7에서 등록하세요.' });
    }
    
    // 11번가 OpenAPI 상품 등록
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
    <Product>
      <prdNm>${_xmlEscape(body.name)}</prdNm>
      <prdPrice>${body.price || 0}</prdPrice>
      <htmlDetail><![CDATA[${body.html || body.description || ''}]]></htmlDetail>
      <selMthdCd>01</selMthdCd>
      <dispCtgrNo>0</dispCtgrNo>
      <suplDtyfrPrdClfCd>35</suplDtyfrPrdClfCd>
      <minorSelCnYn>Y</minorSelCnYn>
      <dlvGrntYn>Y</dlvGrntYn>
      <prdStatCd>01</prdStatCd>
    </Product>`;
    
    const res = UrlFetchApp.fetch('https://api.11st.co.kr/rest/productservices/product', {
      method: 'post',
      headers: { 'openapikey': apiKey, 'Content-Type': 'application/xml; charset=UTF-8' },
      payload: xmlPayload,
      muteHttpExceptions: true,
    });
    
    const resText = res.getContentText();
    const productId = _extractXmlTag(resText, 'prdNo');
    
    if (productId) {
      const regSheet = getSheet_('마켓등록');
      regSheet.appendRow([body.name, '11번가', productId, '', new Date().toISOString(), 'registered']);
    }
    
    return toJSON_({
      success: !!productId,
      productId: productId || '',
      error: productId ? '' : '등록 실패 — 응답 확인 필요',
    });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 9. registerToSmartstore — 스마트스토어 상품 등록
// ═══════════════════════════════════════════════════════════════
function registerToSmartstore(body) {
  try {
    const clientId = getProp_('smartstore-client-id');
    const clientSecret = getProp_('smartstore-client-secret');
    if (!clientId || !clientSecret) {
      return toJSON_({ success: false, error: 'API 키 미설정' });
    }
    
    // 토큰
    const tokenRes = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&type=SELF`,
      muteHttpExceptions: true,
    });
    const token = JSON.parse(tokenRes.getContentText()).access_token;
    if (!token) return toJSON_({ success: false, error: '토큰 실패' });
    
    // 상품 등록 API
    const payload = {
      originProduct: {
        statusType: 'SALE',
        saleType: 'NEW',
        leafCategoryId: '',
        name: body.name,
        detailContent: body.html || body.description || '',
        salePrice: body.price || 0,
        stockQuantity: 999,
        deliveryInfo: {
          deliveryType: 'DELIVERY',
          deliveryAttributeType: 'NORMAL',
          deliveryFee: { deliveryFeeType: 'FREE' },
        },
        images: {
          representativeImage: { url: (body.images || [])[0] || '' },
          optionalImages: (body.images || []).slice(1).map(url => ({ url })),
        },
      },
      smartstoreChannelProduct: {
        channelProductName: body.name,
        naverShoppingRegistration: true,
      },
    };
    
    const res = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v2/products', {
      method: 'post',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    
    const result = JSON.parse(res.getContentText());
    const productId = result.smartstoreChannelProductNo || result.originProductNo || '';
    const url = productId ? `https://smartstore.naver.com/products/${productId}` : '';
    
    if (productId) {
      const regSheet = getSheet_('마켓등록');
      regSheet.appendRow([body.name, '스마트스토어', productId, url, new Date().toISOString(), 'registered']);
    }
    
    return toJSON_({ success: !!productId, productId, url, error: result.message || '' });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 10. registerToGmarket — G마켓/옥션 상품 등록
// ═══════════════════════════════════════════════════════════════
function registerToGmarket(body) {
  try {
    // G마켓 ESM API (eBay Korea → SMILE 전환 후 API 변경됨)
    // 현재는 기본 인터페이스만 제공 — 실제 API 연동 시 수정 필요
    
    const regSheet = getSheet_('마켓등록');
    regSheet.appendRow([body.name, 'G마켓', 'PENDING', '', new Date().toISOString(), 'pending']);
    
    return toJSON_({
      success: true,
      productId: 'PENDING-' + Date.now(),
      message: 'G마켓은 ESM Plus에서 수동 등록하세요. 등록 이력이 기록되었습니다.',
      isManual: true,
    });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 추가: productSalesCount — 상품 판매 건수 조회
// ═══════════════════════════════════════════════════════════════
function productSalesCount(body) {
  try {
    const sheet = getSheet_('주문');
    const data = sheet.getDataRange().getValues();
    const productName = body.productName || '';
    
    let count = 0, revenue = 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).includes(productName) && new Date(data[i][7]) >= thirtyDaysAgo) {
        count++;
        revenue += Number(data[i][4] || 0);
      }
    }
    
    return toJSON_({ success: true, count, revenue });
    
  } catch (e) {
    return toJSON_({ success: false, count: 0, revenue: 0 });
  }
}


// ═══════════════════════════════════════════════════════════════
// 추가: monthlyClose — 월별 마감
// ═══════════════════════════════════════════════════════════════
function monthlyClose(body) {
  try {
    const ledgerSheet = getSheet_('장부');
    const closeSheet = getSheet_('월별정산');
    const yearMonth = body.yearMonth || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
    
    const data = ledgerSheet.getDataRange().getValues();
    let income = 0, expense = 0, fees = 0;
    
    for (let i = 1; i < data.length; i++) {
      const date = String(data[i][4] || '');
      if (!date.startsWith(yearMonth)) continue;
      const amount = Number(data[i][2] || 0);
      if (data[i][0] === 'income') income += amount;
      else if (data[i][0] === 'expense') {
        expense += amount;
        if (String(data[i][1]).includes('수수료')) fees += amount;
      }
    }
    
    closeSheet.appendRow([yearMonth, income, expense, fees, income - expense, '마감', new Date().toISOString()]);
    
    return toJSON_({ success: true, yearMonth, income, expense, fees, netProfit: income - expense });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 추가: exportLedger — CSV 내보내기
// ═══════════════════════════════════════════════════════════════
function exportLedger(body) {
  try {
    const sheet = getSheet_('장부');
    const data = sheet.getDataRange().getValues();
    const from = body.from || '';
    const to = body.to || '';
    
    const filtered = data.filter((row, i) => {
      if (i === 0) return true; // 헤더
      const date = String(row[4] || '');
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
    
    return toJSON_({ success: true, data: filtered });
    
  } catch (e) {
    return toJSON_({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 트리거 설정 (1회 실행)
// ═══════════════════════════════════════════════════════════════
function setupV7Triggers() {
  // 기존 트리거 정리
  ScriptApp.getProjectTriggers().forEach(t => {
    const name = t.getHandlerFunction();
    if (['priceWatchdogCron', 'trendWatchdogCron', 'fetchOrdersCron'].includes(name)) {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // 매일 09:00 — 가격 워치독
  ScriptApp.newTrigger('priceWatchdogCron').timeBased().everyDays(1).atHour(9).create();
  
  // 매주 월요일 10:00 — 트렌드 워치독
  ScriptApp.newTrigger('trendWatchdogCron').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();
  
  // 3시간마다 — 주문 수집
  ScriptApp.newTrigger('fetchOrdersCron').timeBased().everyHours(3).create();
  
  Logger.log('✅ V7 트리거 설정 완료');
}

// 트리거 핸들러
function priceWatchdogCron() { priceWatchdog({}); }
function trendWatchdogCron() { trendWatchdog({ mode: 'check' }); }
function fetchOrdersCron() { 
  const clientId = getProp_('smartstore-client-id');
  if (clientId) fetchSmartstoreOrders({}); 
}


// ─── XML 유틸 ───
function _xmlEscape(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _extractXmlTag(xml, tag) {
  const match = String(xml).match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match ? match[1] : '';
}
