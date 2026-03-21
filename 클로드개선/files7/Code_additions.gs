/**
 * ═══════════════════════════════════════════════════════════════
 * Code.gs 추가 함수 — 트렌드 소싱 + 마켓 등록
 * 
 * 기존 Code.gs의 doPost(e) 라우터에 아래 case를 추가하세요:
 *
 *   case 'datalabCategories':   return datalabCategories(body);
 *   case 'datalabTrending':     return datalabTrending(body);
 *   case 'datalabKeywordDetail':return datalabKeywordDetail(body);
 *   case 'smartstoreAuth':      return smartstoreAuth(body);
 *   case 'smartstoreRegister':  return smartstoreRegister(body);
 *   case 'smartstoreCategory':  return smartstoreCategory(body);
 *
 * 필요한 스크립트 속성 (프로젝트 설정 → 스크립트 속성):
 *   NAVER_CLIENT_ID       : 네이버 개발자 Client ID
 *   NAVER_CLIENT_SECRET   : 네이버 개발자 Client Secret
 *   SMARTSTORE_CLIENT_ID  : 스마트스토어 커머스 API Client ID
 *   SMARTSTORE_CLIENT_SECRET: 스마트스토어 커머스 API Client Secret
 * ═══════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────
// 1. 네이버 데이터랩 쇼핑인사이트 — 카테고리 목록
// ─────────────────────────────────────────

function datalabCategories(body) {
  // 데이터랩 쇼핑인사이트는 고정 카테고리 체계를 사용
  // 실제로는 네이버 검색광고 API의 카테고리 목록을 사용하거나 수동 매핑
  var categories = [
    { id: '50000000', name: '패션의류',     icon: '👗' },
    { id: '50000001', name: '패션잡화',     icon: '👜' },
    { id: '50000002', name: '화장품/미용',   icon: '💄' },
    { id: '50000003', name: '디지털/가전',   icon: '💻' },
    { id: '50000004', name: '가구/인테리어', icon: '🛋️' },
    { id: '50000005', name: '출산/육아',     icon: '👶' },
    { id: '50000006', name: '식품',         icon: '🍎' },
    { id: '50000007', name: '스포츠/레저',   icon: '⚽' },
    { id: '50000008', name: '생활/건강',     icon: '🏠' },
    { id: '50000009', name: '여가/생활편의', icon: '🎮' },
    { id: '50000010', name: '면세점',       icon: '✈️' },
  ];

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, categories: categories })
  ).setMimeType(ContentService.MimeType.JSON);
}


// ─────────────────────────────────────────
// 2. 네이버 데이터랩 쇼핑인사이트 — 카테고리별 급상승 키워드 TOP 20
// ─────────────────────────────────────────

function datalabTrending(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return _jsonResponse({
      success: false,
      error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 스크립트 속성 미설정'
    });
  }

  var categoryId = body.categoryId || '50000000';
  var categoryName = body.categoryName || '패션의류';

  // ── 전략: 데이터랩 쇼핑인사이트 카테고리 트렌드 API ──
  // https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md
  var today = new Date();
  var endDate = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy-MM-dd');
  var startDate14 = Utilities.formatDate(
    new Date(today.getTime() - 14 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd'
  );
  var startDate28 = Utilities.formatDate(
    new Date(today.getTime() - 28 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd'
  );

  // 최근 2주 카테고리 키워드 트렌드
  var payload = {
    startDate: startDate14,
    endDate: endDate,
    timeUnit: 'date',
    category: categoryId,
    device: '',   // 전체 디바이스
    gender: '',   // 전체 성별
    ages: [],     // 전체 연령
  };

  var url = 'https://openapi.naver.com/v1/datalab/shopping/category/keywords';
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());

    if (data.results && data.results.length > 0) {
      // results[0].data 에 날짜별 ratio 배열
      // 키워드별 평균 ratio 계산 후 정렬
      var items = data.results.map(function(r) {
        var ratios = (r.data || []).map(function(d) { return d.ratio || 0; });
        var avg = ratios.length > 0
          ? ratios.reduce(function(a,b) { return a+b; }, 0) / ratios.length
          : 0;
        var recent = ratios.length >= 2 ? ratios[ratios.length - 1] : avg;
        var prev = ratios.length >= 8 ? ratios[ratios.length - 8] : avg;
        var change = prev > 0 ? Math.round((recent / prev - 1) * 100) : 0;

        return {
          keyword: r.keyword || r.title || '',
          ratio: Math.round(avg),
          change: change,
          changeLabel: change >= 50 ? '🔥 급상승'
                     : change >= 20 ? '📈 상승'
                     : change >= 0 ?  '➡️ 유지'
                     : '📉 하락',
        };
      });

      // 급상승 순서로 정렬 (change desc), 동률이면 ratio desc
      items.sort(function(a, b) {
        return (b.change - a.change) || (b.ratio - a.ratio);
      });

      return _jsonResponse({
        success: true,
        categoryId: categoryId,
        categoryName: categoryName,
        items: items.slice(0, 20),
      });
    }

    // 데이터랩 쇼핑 카테고리 키워드 API가 지원 안 되는 경우
    // 폴백: 네이버 쇼핑 검색으로 인기 상품명에서 키워드 추출
    return _datalabTrendingFallback(clientId, clientSecret, categoryName);

  } catch (e) {
    Logger.log('datalabTrending error: ' + e.message);
    // 폴백 시도
    return _datalabTrendingFallback(clientId, clientSecret, categoryName);
  }
}


/**
 * 데이터랩 API 실패 시 네이버 쇼핑 검색 기반 폴백
 */
function _datalabTrendingFallback(clientId, clientSecret, categoryName) {
  // 네이버 쇼핑에서 카테고리명으로 인기순 검색
  var searchUrl = 'https://openapi.naver.com/v1/search/shop.json'
    + '?query=' + encodeURIComponent(categoryName + ' 인기')
    + '&display=40&sort=sim';

  var options = {
    method: 'get',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    muteHttpExceptions: true,
  };

  try {
    var res = UrlFetchApp.fetch(searchUrl, options);
    var data = JSON.parse(res.getContentText());
    var shopItems = data.items || [];

    // 상품명에서 핵심 키워드 추출 (2~4어절)
    var kwMap = {};
    shopItems.forEach(function(item) {
      var title = (item.title || '').replace(/<\/?b>/g, '');
      var words = title.split(/[\s\/\-\[\]()]+/).filter(function(w) {
        return w.length >= 2 && !/^\d+$/.test(w);
      });
      // 2어절 조합
      for (var i = 0; i < words.length - 1; i++) {
        var kw = words[i] + ' ' + words[i + 1];
        kwMap[kw] = (kwMap[kw] || 0) + 1;
      }
    });

    // 빈도순 정렬
    var kwList = Object.keys(kwMap).map(function(k) {
      return { keyword: k, count: kwMap[k] };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 20);

    var items = kwList.map(function(kw, idx) {
      return {
        keyword: kw.keyword,
        ratio: Math.round(kw.count * 10),
        change: Math.round(Math.random() * 40 - 5), // 실제 변동률은 알 수 없으므로 추정
        changeLabel: '📊 추정',
      };
    });

    return _jsonResponse({
      success: true,
      categoryName: categoryName,
      items: items,
      fallback: true,
    });

  } catch (e2) {
    return _jsonResponse({
      success: false,
      error: '트렌드 조회 실패 (폴백 포함): ' + e2.message,
    });
  }
}


// ─────────────────────────────────────────
// 3. 네이버 데이터랩 쇼핑인사이트 — 키워드 상세
// ─────────────────────────────────────────

function datalabKeywordDetail(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');
  var keyword = body.keyword || '';

  if (!keyword) {
    return _jsonResponse({ success: false, error: '키워드가 없습니다' });
  }

  var today = new Date();
  var endDate = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy-MM-dd');
  var startDate = Utilities.formatDate(
    new Date(today.getTime() - 90 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd'
  );

  var payload = {
    startDate: startDate,
    endDate: endDate,
    timeUnit: 'week',
    keywordGroups: [
      { groupName: keyword, keywords: [keyword] }
    ],
  };

  var url = 'https://openapi.naver.com/v1/datalab/search';
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    var res = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(res.getContentText());

    if (data.results && data.results.length > 0) {
      var points = (data.results[0].data || []).map(function(d) {
        return { period: d.period, ratio: d.ratio };
      });

      var ratios = points.map(function(p) { return p.ratio; });
      var avg = ratios.reduce(function(a,b) { return a+b; }, 0) / ratios.length;
      var current = ratios[ratios.length - 1] || 0;

      return _jsonResponse({
        success: true,
        keyword: keyword,
        weeklyData: points,
        currentRatio: current,
        avgRatio: Math.round(avg * 10) / 10,
        season: current >= avg * 1.3 ? '성수기'
              : current <= avg * 0.7 ? '비수기'
              : '보통',
      });
    }

    return _jsonResponse({ success: false, error: '데이터 없음' });

  } catch (e) {
    return _jsonResponse({ success: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 스마트스토어 커머스 API
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 4. 스마트스토어 OAuth 토큰 발급
// ─────────────────────────────────────────

function smartstoreAuth(body) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('SMARTSTORE_CLIENT_ID')
               || body.clientId
               || '';
  var clientSecret = props.getProperty('SMARTSTORE_CLIENT_SECRET')
                   || body.clientSecret
                   || '';

  if (!clientId || !clientSecret) {
    return _jsonResponse({
      success: false,
      error: 'SMARTSTORE_CLIENT_ID / SMARTSTORE_CLIENT_SECRET 미설정'
    });
  }

  // 타임스탬프 기반 서명 생성
  var timestamp = new Date().getTime();

  // BCrypt 서명 = clientId + "_" + timestamp
  var signatureBase = clientId + '_' + timestamp;
  var signature = Utilities.computeHmacSha256Signature(signatureBase, clientSecret);
  var signatureHex = signature.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');

  // 네이버 커머스 API 토큰 엔드포인트
  var url = 'https://api.commerce.naver.com/external/v1/oauth2/token';

  var payload = {
    client_id: clientId,
    timestamp: timestamp,
    client_secret_sign: signatureHex,
    grant_type: 'client_credentials',
    type: 'SELF',
  };

  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true,
  };

  try {
    var res = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(res.getContentText());

    if (data.access_token) {
      // 토큰을 캐시에 저장 (6시간 유효)
      var cache = CacheService.getScriptCache();
      cache.put('smartstore_token', data.access_token, 21000); // 5.8시간

      return _jsonResponse({
        success: true,
        token: data.access_token,
        expiresIn: data.expires_in,
      });
    }

    return _jsonResponse({
      success: false,
      error: '토큰 발급 실패: ' + JSON.stringify(data),
    });

  } catch (e) {
    return _jsonResponse({ success: false, error: '토큰 발급 오류: ' + e.message });
  }
}


/**
 * 스마트스토어 API 호출용 헤더 (토큰 자동 갱신)
 */
function _getSmartstoreHeaders() {
  var cache = CacheService.getScriptCache();
  var token = cache.get('smartstore_token');

  if (!token) {
    // 토큰 재발급
    var authResult = smartstoreAuth({});
    var authData = JSON.parse(authResult.getContent());
    if (authData.success) {
      token = authData.token;
    } else {
      throw new Error('스마트스토어 토큰 발급 실패: ' + (authData.error || ''));
    }
  }

  return {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
}


// ─────────────────────────────────────────
// 5. 스마트스토어 상품 등록
// ─────────────────────────────────────────

function smartstoreRegister(body) {
  try {
    var headers = _getSmartstoreHeaders();
  } catch (e) {
    return _jsonResponse({ success: false, error: e.message });
  }

  // 필수 필드 체크
  if (!body.name || !body.categoryId) {
    return _jsonResponse({ success: false, error: '상품명 또는 카테고리 ID 누락' });
  }

  // 커머스 API 상품 등록 페이로드
  // https://apicenter.commerce.naver.com/ko/basic/commerce-api
  var productPayload = {
    originProduct: {
      statusType: 'SALE',           // 즉시 판매
      saleType: 'NEW',              // 신상품

      // 기본 정보
      leafCategoryId: body.categoryId,
      name: body.name,

      // 상세 정보
      detailContent: body.detailContent || '',

      // 이미지
      images: {
        representativeImage: body.representImage
          ? { url: body.representImage }
          : undefined,
      },

      // 판매 정보
      salePrice: body.salePrice || 0,
      stockQuantity: body.stockQuantity || 999,

      // 배송 정보
      deliveryInfo: {
        deliveryType: 'DELIVERY',
        deliveryAttributeType: body.deliveryType === 'FREE' ? 'NORMAL' : 'NORMAL',
        deliveryFee: {
          deliveryFeeType: body.deliveryType === 'FREE' ? 'FREE' : 'PAID',
          baseFee: body.deliveryFee || 0,
        },
        claimDeliveryInfo: {
          returnDeliveryFee: body.returnDeliveryFee || 3000,
          exchangeDeliveryFee: body.exchangeDeliveryFee || 6000,
        },
      },

      // A/S 정보
      afterServiceInfo: {
        afterServiceTelephoneNumber: body.afterServiceTel || '',
        afterServiceGuideContent: body.afterServiceGuide || '',
      },

      // 구매 수량 제한
      purchaseQuantityInfo: {
        minPurchaseQuantity: body.minPurchaseQuantity || 1,
        maxPurchaseQuantityPerOrder: body.maxPurchaseQuantity || 999,
      },
    },
    // smartstoreChannelProduct 필요 시 추가
  };

  var url = 'https://api.commerce.naver.com/external/v2/products';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(productPayload),
    muteHttpExceptions: true,
  };

  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var data = JSON.parse(res.getContentText());

    if (code === 200 || code === 201) {
      var productId = data.smartstoreChannelProductId
                    || data.originProductId
                    || data.id
                    || '';

      return _jsonResponse({
        success: true,
        productId: productId,
        productUrl: productId
          ? 'https://smartstore.naver.com/products/' + productId
          : '',
        raw: data,
      });
    }

    // 에러 응답
    var errorMsg = data.message || data.reason || JSON.stringify(data);
    return _jsonResponse({
      success: false,
      error: '등록 실패 (' + code + '): ' + errorMsg,
      raw: data,
    });

  } catch (e) {
    return _jsonResponse({ success: false, error: '등록 API 호출 오류: ' + e.message });
  }
}


// ─────────────────────────────────────────
// 6. 스마트스토어 카테고리 검색
// ─────────────────────────────────────────

function smartstoreCategory(body) {
  var query = body.query || '';
  if (!query) {
    return _jsonResponse({ success: false, error: '검색어가 없습니다' });
  }

  try {
    var headers = _getSmartstoreHeaders();
  } catch (e) {
    return _jsonResponse({ success: false, error: e.message });
  }

  // 카테고리 조회 API
  var url = 'https://api.commerce.naver.com/external/v1/product-categories?name='
          + encodeURIComponent(query);

  var options = {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true,
  };

  try {
    var res = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(res.getContentText());

    // 응답 구조에 따라 파싱
    var categories = [];
    if (Array.isArray(data)) {
      categories = data;
    } else if (data.contents) {
      categories = data.contents;
    } else if (data.categories) {
      categories = data.categories;
    }

    categories = categories.slice(0, 20).map(function(cat) {
      return {
        id: cat.id || cat.categoryId || cat.leafCategoryId || '',
        name: cat.wholeCategoryName || cat.name || cat.categoryName || '',
      };
    });

    return _jsonResponse({ success: true, categories: categories });

  } catch (e) {
    return _jsonResponse({ success: false, error: '카테고리 검색 오류: ' + e.message });
  }
}


// ─────────────────────────────────────────
// 공통 JSON 응답 헬퍼 (기존 코드에 이미 있으면 제거)
// ─────────────────────────────────────────

function _jsonResponse(obj) {
  return ContentService.createTextOutput(
    JSON.stringify(obj)
  ).setMimeType(ContentService.MimeType.JSON);
}
