/**
 * AppEventBus — 전역 Pub/Sub 이벤트 버스
 * 탭 간 통신의 결합도를 낮추기 위한 표준 통신 채널
 * Sacred Zone: 함수명/인터페이스 변경 금지
 */
const AppEventBus = {
    _events: {},
    on(event, listener) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(listener);
    },
    off(event, listener) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(l => l !== listener);
    },
    emit(event, data) {
        if (this._events[event]) {
            this._events[event].forEach(listener => {
                try { listener(data); } catch(e) { console.error(`[EventBus] ${event} error:`, e); }
            });
        }
    }
};

/**
 * T1 → T2 소싱 확정 함수
 */
function confirmSourcing(itemData) {
    const productData = {
        id: itemData.id || itemData.productId || Date.now().toString(),
        name: itemData.title || itemData.name || itemData.product || '(상품명 없음)',
        wholesale_price: parseInt(itemData._wsPrice || itemData.wholesalePrice || itemData.lprice || itemData.price || 0, 10),
        retail_price: parseInt(itemData.lprice || itemData.price || itemData.retailPrice || 0, 10),
        margin_rate: itemData._margin || itemData.marginRate || 0,
        source_type: itemData.source_type || itemData.vendor || 'naver',
        thumbnail_url: itemData.image || itemData.photoUrl || '',
        keyword: itemData.keyword || ''
    };
    if (typeof showTab === 'function') showTab('inventory');
    if (typeof showT2SubTab === 'function') showT2SubTab('field');
    AppEventBus.emit('PRODUCT_SOURCED', productData);
    if (typeof showToast === 'function') showToast(`✅ "${productData.name}" → T2(재고/사입)로 전달 완료`, 'success');
}

/**
 * T1 → T5 상세페이지 전달 함수
 */
function sendToStudio(itemData) {
    const studioData = {
        name: itemData.title || itemData.name || '',
        image: itemData.image || itemData.photoUrl || '',
        price: parseInt(itemData.lprice || itemData.price || 0, 10),
        wholesale_price: parseInt(itemData._wsPrice || itemData.wholesalePrice || 0, 10),
        keyword: itemData.keyword || '',
        source: itemData.source_type || 'naver'
    };
    if (typeof showTab === 'function') showTab('studio');
    AppEventBus.emit('PRODUCT_TO_STUDIO', studioData);
    if (typeof showToast === 'function') showToast(`🎬 "${studioData.name}" → T5 상세페이지 스튜디오로 전달`);
}

window.AppEventBus = AppEventBus;
window.confirmSourcing = confirmSourcing;
window.sendToStudio = sendToStudio;
