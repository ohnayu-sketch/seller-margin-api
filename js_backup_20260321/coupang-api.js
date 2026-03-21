// ==================== coupang-api.js ====================
// 쿠팡 파트너스 + WING API 프론트엔드 클라이언트
// 키 미설정 시 graceful 실패 (에러 없음)

(function() {
  'use strict';

  // ── Apps Script 통신 함수 ──
  async function callCoupangProxy(action, payload) {
    const scriptUrl = localStorage.getItem('appsScriptUrl') || '';
    if (!scriptUrl) {
      console.warn('[CoupangAPI] Apps Script URL 미설정');
      return { success: false, error: 'Apps Script URL이 설정되지 않았습니다.', code: 'NO_SCRIPT_URL' };
    }
    try {
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...payload })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch(e) {
      console.error('[CoupangAPI]', action, e);
      return { success: false, error: e.message };
    }
  }

  // ── 공개 API ──
  window.CoupangAPI = {
    // ━━━━━ 파트너스 API (시세 조회/소싱) ━━━━━

    /**
     * 키워드로 쿠팡 전체 상품 검색 (시장가 확인용)
     * @param {string} keyword 검색 키워드
     * @param {number} limit 결과 수 (기본 10)
     * @returns {Promise<{success, data}>}
     */
    async searchProducts(keyword, limit = 10) {
      if (!keyword) return { success: false, error: '키워드 필요' };
      return callCoupangProxy('coupangPartners', { type: 'search', keyword, limit });
    },

    /**
     * 카테고리별 베스트셀러 조회
     * @param {string} categoryId 쿠팡 카테고리 ID
     * @param {number} limit 결과 수
     */
    async getBestSellers(categoryId = '0', limit = 10) {
      return callCoupangProxy('coupangPartners', { type: 'bestSeller', categoryId, limit });
    },

    /**
     * 골드박스 타임딜 상품 조회
     */
    async getGoldbox() {
      return callCoupangProxy('coupangPartners', { type: 'goldbox' });
    },

    // ━━━━━ WING API (셀러 관리) ━━━━━

    /**
     * 본인 상품 정보 조회
     * @param {string} sellerProductId 셀러 상품 ID
     */
    async getMyProduct(sellerProductId) {
      return callCoupangProxy('coupangWing', { type: 'productInfo', sellerProductId });
    },

    /**
     * 상품 가격 변경
     */
    async updatePrice(sellerProductId, vendorItemId, newPrice) {
      return callCoupangProxy('coupangWing', {
        type: 'updatePrice', sellerProductId, vendorItemId, newPrice
      });
    },

    /**
     * 발주서(주문) 목록 조회
     * @param {string} status 주문 상태 (ACCEPT, INSTRUCT 등)
     * @param {string} dateFrom 시작일 (예: 2026-03-01)
     * @param {string} dateTo 종료일
     */
    async getOrders(status = 'ACCEPT', dateFrom = '', dateTo = '') {
      return callCoupangProxy('coupangWing', {
        type: 'orderList', status, createdAtFrom: dateFrom, createdAtTo: dateTo
      });
    },

    /**
     * 매출/정산 내역 조회
     */
    async getSettlement(dateFrom, dateTo) {
      return callCoupangProxy('coupangWing', {
        type: 'settlement', dateFrom, dateTo
      });
    },

    /**
     * 쿠팡 카테고리 목록 조회
     */
    async getCategories() {
      return callCoupangProxy('coupangWing', { type: 'categories' });
    },

    // ━━━━━ 상태 확인 ━━━━━

    /**
     * 파트너스 API 키 설정 여부 확인
     */
    isPartnersReady() {
      const ak = localStorage.getItem('coupangPartnersAccessKey') || '';
      const sk = localStorage.getItem('coupangPartnersSecretKey') || '';
      return !!(ak && sk);
    },

    /**
     * WING API 키 설정 여부 확인
     */
    isWingReady() {
      const ak = localStorage.getItem('coupangWingAccessKey') || '';
      const sk = localStorage.getItem('coupangWingSecretKey') || '';
      return !!(ak && sk);
    },

    /**
     * T7에서 키 저장 시 호출 — Apps Script ScriptProperties에 동기화
     * @param {Object} keys { partnersAccessKey, partnersSecretKey, wingAccessKey, wingSecretKey, vendorId }
     */
    async syncKeysToServer(keys) {
      // localStorage에 저장
      if (keys.partnersAccessKey) localStorage.setItem('coupangPartnersAccessKey', keys.partnersAccessKey);
      if (keys.partnersSecretKey) localStorage.setItem('coupangPartnersSecretKey', keys.partnersSecretKey);
      if (keys.wingAccessKey) localStorage.setItem('coupangWingAccessKey', keys.wingAccessKey);
      if (keys.wingSecretKey) localStorage.setItem('coupangWingSecretKey', keys.wingSecretKey);
      if (keys.vendorId) localStorage.setItem('coupangVendorId', keys.vendorId);

      // Apps Script ScriptProperties에 동기화
      const scriptUrl = localStorage.getItem('appsScriptUrl') || '';
      if (!scriptUrl) return { success: false, error: 'Apps Script URL 미설정' };

      try {
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'setCoupangKeys',
            partnersAccessKey: keys.partnersAccessKey || '',
            partnersSecretKey: keys.partnersSecretKey || '',
            wingAccessKey: keys.wingAccessKey || '',
            wingSecretKey: keys.wingSecretKey || '',
            vendorId: keys.vendorId || ''
          })
        });
        return await res.json();
      } catch(e) {
        return { success: false, error: e.message };
      }
    },

    /**
     * 연결 테스트 (파트너스: 골드박스, WING: 카테고리)
     */
    async testConnection(apiType) {
      if (apiType === 'partners') {
        return this.getGoldbox();
      } else {
        return this.getCategories();
      }
    }
  };

  console.log('[CoupangAPI] 모듈 로드 완료 — 파트너스:', CoupangAPI.isPartnersReady() ? '✅' : '⏳키 필요',
    '| WING:', CoupangAPI.isWingReady() ? '✅' : '⏳키 필요');
})();
