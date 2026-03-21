/* ═══ js/core/block-1.js ═══ */

/**
 * @file adapters.js
 * @description 외부 데이터를 StandardProductInfo 형상으로 안전하게 변환하는 어댑터 패턴 모듈
 */

class ProductAdapter {
    /**
     * 직접 입력(수동) 폼 데이터에서 표준 객체로 변환
     * @param {Object} rawData - T2(재고 사입 관리) 등에서 직접 입력받은 폼 데이터
     * @returns {StandardProductInfo}
     */
    static fromManualInput(rawData) {
        return new StandardProductInfo({
            name: rawData.name || '미지정 상품',
            wholesale_price: rawData.cost || 0,
            selling_price: rawData.price || 0,
            source_type: rawData.isGlobal ? SourceType.ALIBABA : SourceType.MANUAL,
            stock_quantity: rawData.quantity || 1,
            thumbnail_url: rawData.photoUrl || '',
            category: rawData.category || '',
            status: ProductStatus.PENDING
        });
    }

    /**
     * 도매꾹 API(혹은 스크래핑) 응답 데이터에서 표준 객체로 변환 (예시)
     * @param {Object} domeResponse - 도매꾹 원시 응답 JSON
     * @returns {StandardProductInfo}
     */
    static fromDomeggook(domeResponse) {
        return new StandardProductInfo({
            source_id: domeResponse.no || '',
            name: domeResponse.title || '',
            original_name: domeResponse.title || '',
            wholesale_price: Number(domeResponse.price) || 0,
            source_type: SourceType.DOMEGGOOK,
            source_url: `https://domeggook.com/${domeResponse.no}`,
            thumbnail_url: domeResponse.thumb || '',
            min_order_quantity: domeResponse.moq || 1,
            status: ProductStatus.DRAFT
        });
    }
}