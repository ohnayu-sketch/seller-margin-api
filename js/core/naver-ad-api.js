
// ★ 네이버 검색광고 API 프록시 (월간 검색조회수 추출)
function naverSearchAdProxy(data) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('NAVER_AD_API_KEY');
  var secretKey = props.getProperty('NAVER_AD_SECRET_KEY');
  var customerId = props.getProperty('NAVER_AD_CUSTOMER_ID');

  if (!apiKey || !secretKey || !customerId) {
    return { success: false, error: '네이버 검색광고 API 키(CUSTOMER_ID, API_KEY, SECRET_KEY)가 설정되지 않았습니다.' };
  }

  var keyword = data.keyword || data.hintKeywords;
  if (!keyword) return { success: false, error: '검색어(keyword) 파라미터가 필요합니다.' };

  // URI는 쿼리스트링 제외한 기본 경로
  var uri = '/keywordstool';
  var method = 'GET';
  var timestamp = String(new Date().getTime());

  // Signature 생성: timestamp + "." + method + "." + uri
  var message = timestamp + "." + method + "." + uri;
  var signatureBytes = Utilities.computeHmacSha256Signature(message, secretKey);
  var signature = Utilities.base64Encode(signatureBytes);

  var url = 'https://api.naver.com' + uri + '?hintKeywords=' + encodeURIComponent(keyword.replace(/\s+/g,'')) + '&showDetail=1';

  var options = {
    method: method,
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': apiKey,
      'X-Customer': customerId,
      'X-Signature': signature
    },
    muteHttpExceptions: true
  };

  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var text = res.getContentText();
    var parsed = JSON.parse(text);

    if (code !== 200) {
      return { success: false, error: 'Naver Search Ad API HTTP ' + code + ': ' + text };
    }
    
    // keywordList 배열 추출
    if (parsed && parsed.keywordList && parsed.keywordList.length > 0) {
      var topResult = parsed.keywordList[0];
      // PC와 Mobile 검색수 합산 (단, 숫자가 아닐 시 처리. API에서는 '< 10'을 문자열로 반환하기도 함)
      var pcCount = typeof topResult.monthlyPcQcCnt === 'number' ? topResult.monthlyPcQcCnt : (String(topResult.monthlyPcQcCnt).indexOf('<') > -1 ? 10 : parseInt(topResult.monthlyPcQcCnt)||0);
      var mobileCount = typeof topResult.monthlyMobileQcCnt === 'number' ? topResult.monthlyMobileQcCnt : (String(topResult.monthlyMobileQcCnt).indexOf('<') > -1 ? 10 : parseInt(topResult.monthlyMobileQcCnt)||0);
      
      topResult.totalSearch = pcCount + mobileCount;
      
      return { success: true, data: parsed.keywordList, firstExact: topResult };
    } else {
      return { success: true, data: [], error: '검색 결과가 없습니다.' };
    }
  } catch (e) {
    return { success: false, error: 'naverSearchAdProxy exception: ' + e.toString() };
  }
}
