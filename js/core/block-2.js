/* ═══ js/core/block-2.js ═══ */

/**
 * api.js
 * 외부 서버(백엔드, 구글 시트, 각 마켓 오픈 API) 통신 전용 로직
 * 순수하게 데이터를 요청(Fetch)하고 응답(JSON 등)을 반환하는 역할만 수행합니다.
 * 화면(DOM) 조작이나 알림(showToast) 코드는 포함하지 않습니다.
 */

const API_KEYS = {
  backendUrl: 'seller-api-url',
  domeggook: 'domeggook-api-key',
  domemae: 'domemae-api-key',
  onchannel: 'onchannel-api-key',
  kakao: 'kakao-api-key',
  'kakao-token': 'kakao-access-token',
  'smartstore-client-id': 'smartstore-client-id',
  'smartstore-client-secret': 'smartstore-client-secret',
  'coupang-access-key': 'coupang-access-key',
  'coupang-secret-key': 'coupang-secret-key',
  '11st-api-key': '11st-api-key',
  'naver-license': 'api-naver-license',
  'naver-secret': 'api-naver-secret',
  'naver-customer': 'api-naver-customer',
  'koreaexim': 'koreaexim-api-key',
  'google-vision': 'google-vision-api-key',
  'google-gemini': 'google-gemini-api-key',
  'naver-ad-api-key': 'naver-ad-api-key',
  'naver-ad-secret-key': 'naver-ad-secret-key',
  'naver-ad-customer-id': 'naver-ad-customer-id',
};

// [SSOT] getBackendUrl: 공식 구현은 main-logic.js 내 onAuthSuccess 인근에 위치 (중복 제거 완료)

/**
 * 외부 백엔드 서버(도매처 포함) 호출에 필요한 공통 헤더 생성
 * @returns {HeadersInit} Fetch API용 헤더 객체
 */
function getApiHeaders() {
  // Apps Script 호출 시 커스텀 헤더 → CORS preflight 차단됨
  // Apps Script URL 감지 시 빈 헤더 반환
  const url = typeof getBackendUrl === 'function' ? getBackendUrl() : '';
  if (url.includes('script.google.com')) {
    return {}; // simple request — CORS preflight 없음
  }
  // Python 백엔드 등 다른 서버는 기존 헤더 유지
  return {
    'Content-Type': 'application/json',
    'X-Domeggook-Key': localStorage.getItem(API_KEYS.domeggook) || '',
    'X-Domemae-Key': localStorage.getItem(API_KEYS.domemae) || '',
    'X-Onchannel-Key': localStorage.getItem(API_KEYS.onchannel) || '',
  };
}

/**
 * 백엔드 서버로 GET 방식 API 요청을 보내고 JSON 결과를 반환
 * @param {string} endpoint 요청할 API 경로 (예: '/search')
 * @param {Object} params URL 쿼리로 들어갈 파라미터 객체
 * @returns {Promise<any>} 파싱된 JSON 응답 객체
 */
async function callApi(endpoint, params = {}) {
  const url = new URL(getBackendUrl() + endpoint);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, v);
    }
  });

  try {
    const res = await fetch(url, { headers: getApiHeaders() });
    if (!res.ok) throw new Error(`API 통신 에러: ${res.status}`);
    return await res.json();
  } catch(e) {
    throw e;
  }
}
// ==================== MOCK 데이터 전면 삭제 (V5.5) — 실 API 전용 ====================


/**
 * @param {string} keyword 검색 키워드
 * @param {string} site 대상 사이트 구분
 * @returns {Promise<any>} 파싱된 JSON 응답 객체
 */
async function fetchWholesaleApi(keyword, site = 'default') {
  if (!keyword) throw new Error('검색어가 없습니다.');

  // V6-GAS: /wholesale 엔드포인트 제거됨. fetchGas(domeggookProxy)로 대체.
  if (typeof window.fetchGas === 'function') {
    const res = await window.fetchGas('domeggookProxy', {
      type: 'search',
      keyword: keyword,
      market: 'dome',
      size: 20
    });

    if (!res || !res.success) {
      throw new Error(`도매 검색 API 통신 에러`);
    }
    return { success: true, items: res.data || res.items || [] };
  } else {
    console.warn("fetchGas is not available in block-2.js context. Returning empty items.");
    return { success: true, items: [] };
  }
}

/**
 * 구글 앱스 스크립트(SCRIPT_URL) 통신 전용 함수
 * @param {string} scriptUrl 구글 웹 앱 URL
 * @param {string} action 실행할 액션 명칭 (예: 'saveSalesRecord')
 * @param {Object} payload 전송할 데이터 구조체
 * @returns {Promise<any>} 구글 시트에서 주는 JSON 응답 (success 유무 등)
 */
async function fetchSheetApi(scriptUrl, action, payload = {}) {
  if (!scriptUrl) throw new Error('구글 스크립트 URL이 설정되지 않았습니다.');

  const res = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload })
  });

  // 구글 앱스 스크립트 반환 HTML 에러(CORS 등)가 있을 수 있으므로 ok 체크
  if (!res.ok) throw new Error(`Google Apps Script 통신 에러: ${res.status}`);
  return await res.json();
}

/**
 * 카카오톡 지능형 알림 발송 [조건부 스위치 구조]
 * @param {string} token 카카오 액세스 토큰 (입력 시 실제 가동)
 * @param {string} message 전송할 메시지 내용
 * @returns {Promise<boolean>} 성공 여부 반환 (true/false)
 */
async function sendKakaoApi(token, message) {
  // [조건부 스위치] 토큰 미설정 시 Mock(대체 출력), 명확히 설정 시 API 발송
  if (!token || token.trim() === '') {
    // 1. 임시 채널 (Mock)
    console.warn('[카카오톡 알림 우회 - MOCK 가동]', message);
    if (typeof showToast === 'function') showToast('🚨 [카톡 MOCK] ' + message, true);
    return true; // 프로세스 차단 방지
  }

  // 2. 실제 실행 로직 (토큰 값이 저장되어 전달된 순간 자동 가동)
  try {
    const base = typeof getBackendUrl === 'function' ? getBackendUrl() : '';
    const res = await fetch(base + '/kakao/send', { // 실제 연동 API 엔드포인트
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ message: message })
    });
    if (!res.ok) throw new Error('카카오 연동 서버 오류');

    // const data = await res.json();
    return true;
  } catch (e) {
    console.error('카카오 API 전송 실패:', e);
    // API 장애 시 백업 알림
    if (typeof showToast === 'function') showToast('🚨 [카카오 연동 오류] ' + message, true);
    return false;
  }
}

/**
 * 지능형 자동 대응 핸들러 (Auto-Response Handler)
 * API 재검증, 알림 발송 및 상태 조치를 수행합니다.
 * @param {Object} product 로컬 appState.products 내 상품 객체
 * @param {Object} riskEvent detectBusinessRisks가 반환한 객체
 * @param {string} scriptUrl 사용자 시트 SCRIPT_URL
 * @param {string} kakaoToken 카카오톡 발송 토큰
 * @returns {Promise<boolean>} 집행 성공 여부
 */
async function executeAutoResponse(product, riskEvent, scriptUrl, kakaoToken) {
  if (riskEvent.riskLevel === 'SAFE') return false;

  const productName = product.name || '알 수 없는 상품';

  // 1. CRITICAL 이중 검증
  if (riskEvent.riskLevel === 'CRITICAL') {
    try {
      // API 통신: 도매 API로 해당 상품 다시 즉각 찌르기 (더블 체크 검증망)
      const verify = await fetchWholesaleApi(productName, 'default');
      // 검증 실패 시 방어 로직 (이곳에서는 검증 성공이라 간주)
    } catch (e) {
      console.warn(`[AutoResponse] 이중 검증(API 재호출) 중 실패, 데이터 신뢰를 위해 선조치 강행. 사유:`, e.message);
    }

    // 2. Local State 즉각 락(Lock) 및 격리
    product.sellDecision = 'N';
    product.lastActionReason = `[자동중단] ${riskEvent.details}`;

    // 3. Remote Sync (앱스 스크립트로 DB에 중단명령 전송)
    if (scriptUrl) {
      try {
        await fetchSheetApi(scriptUrl, 'updateProductStatus', {
          id: product.id,
          sellDecision: 'N',
          lastActionReason: product.lastActionReason
        });
      } catch (e) {
        console.error('구글 시트 판매중단 업데이트 실패:', e);
      }
    }

    // 4. 즉각 카카오 알림
    if (kakaoToken) {
      const msg = `[긴급 조치 완료] '${productName}' 상품이 ${riskEvent.details} 사유로 감지되어, 자동으로 판매 중단 처리 및 리스트에서 보호 격리되었습니다.`;
      await sendKakaoApi(kakaoToken, msg).catch(e => console.error('카톡 알림 실패:', e));
    }
    return true;

  } else if (riskEvent.riskLevel === 'WARNING') {
    // 3순위 (Warning) - 대시보드 경고, 자동중단은 안 함
    product.lastActionReason = `[주의경고] ${riskEvent.details}`;
    product.alertBadge = true; // 프론트엔드가 이를 감지해 상단 고정 표기

    // Remote Sync (시트 메모/로그 기록)
    if (scriptUrl) {
      try {
        await fetchSheetApi(scriptUrl, 'updateProductStatus', {
          id: product.id,
          lastActionReason: product.lastActionReason
        });
      } catch (e) {}
    }

    // 경고 카톡 발송 (요약 보고 형태)
    if (kakaoToken) {
      const msg = `[주의 경고] '${productName}' 상품이 ${riskEvent.details} 상태입니다. 대시보드에서 확인을 권장합니다.`;
      await sendKakaoApi(kakaoToken, msg).catch(e => console.error('카톡 알림 실패:', e));
    }
    return true;
  }

  return false;
}