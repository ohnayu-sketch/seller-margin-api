// ==================== core.js ====================
// EventBus, StandardProductInfo, ProductAdapter, API 통신


/**
 * 전역 이벤트 버스 (Pub/Sub 패턴)
 * 탭 간 통신 결합도를 낮추기 위해 사용됩니다.
 */
const AppEventBus = {
    events: {},
    on(event, listener) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
    },
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(listener => listener(data));
        }
    }
};

/**
 * T1 -> T2 소싱 확정 함수 (EventBus 파이프라인)
 */
function confirmSourcing(itemId) {
    console.log("Sourcing confirmed for ID:", itemId);

    // 임시 더미 데이터 생성 (실제로는 스크래핑된 정보 사용)
    const productData = new StandardProductInfo({
        id: itemId,
        name: itemId === 'item-123' ? '트렌치 코트 오버핏 여성용 가을 신상' : '초경량 접이식 캠핑 의자 블랙',
        wholesale_price: itemId === 'item-123' ? 85 * 195 : 45 * 195, // 환율 임의 적용
        source_type: '1688',
        thumbnail_url: 'https://placehold.co/150'
    });

    // T2로 이동 및 하위 탭 선택
    showTab('inventory');
    if (typeof showT2SubTab === 'function') {
        showT2SubTab('field');
    }

    // EventBus를 통해 데이터 전달 (T2에서 수신하도록 구성)
    AppEventBus.emit('PRODUCT_SOURCED', productData);
    showToast('소싱 상품이 T2(현장 사입)로 전달되었습니다.', 'success');
}

/**
 * 하위 호환성을 위한 sendToSimulator
 */
function sendToSimulator(data) {
    if(!data) {
        showToast('선택된 항목이 없습니다.', 'error');
        return;
    }
    const product = new StandardProductInfo(data);
    showTab('inventory');
    if (typeof showT2SubTab === 'function') {
        showT2SubTab('field');
    }
    AppEventBus.emit('PRODUCT_SOURCED', product);
    showToast('시뮬레이터(현장 사입)로 데이터가 전달되었습니다.', 'success');
}

// T2(현장 사입 탭)에서 데이터 수신 대기
document.addEventListener('DOMContentLoaded', () => {
    AppEventBus.on('PRODUCT_SOURCED', (productInfo) => {
        console.log("Received via EventBus:", productInfo);
        const costInput = document.getElementById('costPrice');
        if (costInput) {
            costInput.value = productInfo.wholesale_price;
            // trigger recalculation if available
            if(typeof window.autoCalcSimulator === 'function') {
                window.autoCalcSimulator();
            }
        }
    });
});


/**
 * @file models.js
 * @description V4 프론트엔드 내에서 사용되는 통합 데이터 규격 구조체 모델 정의.
 * 마스터 지시서(v1.0)의 `StandardProductInfo` 사양을 준수합니다.
 */

// 상수 (Enums)
const ProductStatus = Object.freeze({
    DRAFT: 'draft',                 // 초안
    ACTIVE: 'active',               // 판매중
    PENDING: 'pending',             // 검토중
    DISCONTINUED: 'discontinued'    // 판매중단
});

const SourceType = Object.freeze({
    DOMEGGOOK: 'domeggook',         // 도매꾹
    DOMAE: 'domae',                 // 도매토피아
    ALIBABA: '1688',                // 1688
    ALIEXPRESS: 'aliexpress',       // 알리익스프레스
    MANUAL: 'manual'                // 엑셀/직접입력
});

/**
 * 어떤 소싱처에서 넘어오든 프론트엔드에서는
 * 반드시 이 형태로 데이터를 파싱/관리해야 합니다.
 */
class StandardProductInfo {
    constructor(data = {}) {
        // [기본 정보]
        this.id = data.id || null;
        this.name = data.name || '';                        // 가공된 상품명 (SEO 특화)
        this.original_name = data.original_name || '';      // 원본 도매상품명

        // [가격 정보]
        this.wholesale_price = Number(data.wholesale_price) || 0; // 도매 원가(원)
        this.selling_price = Number(data.selling_price) || 0;     // 최종 설정 판매가(원)
        this.margin_rate = data.margin_rate !== undefined ? Number(data.margin_rate) : null;

        // [데이터 기원]
        this.source_type = data.source_type || SourceType.MANUAL;
        this.source_url = data.source_url || '';
        this.source_id = data.source_id || '';              // 원천 고유번호 (예: 1234567)

        // [이미지 자산]
        this.thumbnail_url = data.thumbnail_url || '';
        this.image_urls = Array.isArray(data.image_urls) ? data.image_urls : [];

        // [메타데이터 및 분류]
        this.category = data.category || '';
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        this.keywords = Array.isArray(data.keywords) ? data.keywords : [];

        // [설명 및 재고]
        this.description = data.description || '';
        this.detail_html = data.detail_html || '';
        this.stock_quantity = Number(data.stock_quantity) || 0;
        this.min_order_quantity = Number(data.min_order_quantity) || 1; // MOQ

        // [상태 관리]
        this.status = data.status || ProductStatus.DRAFT;
        this.created_at = data.created_at || new Date().toISOString();
        this.updated_at = data.updated_at || new Date().toISOString();

        // [마켓 정보]
        this.market_ids = data.market_ids || {};            // { "smartstore": "상품번호" }

        // 객체 생성 시 마진율 강제 재계산
        this.calculateMargin();
    }

    /**
     * 보증 로직: 원가와 판매가가 유효할 경우에만 자체적으로 마진율(%)을 계산하여 무결성을 유지.
     */
    calculateMargin() {
        if (this.margin_rate === null && this.wholesale_price > 0 && this.selling_price > 0) {
            // (판매가 - 원가) / 판매가 * 100
            this.margin_rate = ((this.selling_price - this.wholesale_price) / this.selling_price) * 100;
            // 소수점 2자리에서 반올림
            this.margin_rate = Math.round(this.margin_rate * 100) / 100;
        }
    }

    /**
     * API 통신용 JSON 객체로 안전하게 직렬화.
     */
    toJSON() {
        return { ...this };
    }
}


