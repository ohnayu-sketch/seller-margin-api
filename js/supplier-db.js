// ==================== supplier-db.js ====================
// 통합 공급처 DB — 도매꾹/도매토피아/1688 통합 검색 + 비교
// ANTI_PATTERNS #1 준수: 외부 JS 파일로 분리

const SupplierDB = {
    sources: [
        { key: 'domeggook', name: '도매꾹', icon: '🏪', color: '#ff6b35', country: 'KR', currency: 'KRW' },
        { key: 'dometopia', name: '도매토피아', icon: '🏬', color: '#2196f3', country: 'KR', currency: 'KRW' },
        { key: '1688', name: '1688(중국)', icon: '🇨🇳', color: '#ff4444', country: 'CN', currency: 'CNY' },
        { key: 'aliexpress', name: '알리익스프레스', icon: '🌐', color: '#e43225', country: 'CN', currency: 'USD' },
        { key: 'taobao', name: '타오바오', icon: '🛍️', color: '#ff5722', country: 'CN', currency: 'CNY' },
    ],

    // 데모 공급처 상품 데이터 (실제 API 연동 전 MVP)
    demoProducts: [
        { source: 'domeggook', name: '스텐레스 텀블러 500ml', price: 4500, moq: 50, deliveryDays: 2, rating: 4.5, image: '', category: '주방/생활', margin: 35 },
        { source: 'domeggook', name: '무선 충전 패드 15W', price: 6800, moq: 30, deliveryDays: 3, rating: 4.2, image: '', category: '전자/IT', margin: 28 },
        { source: 'domeggook', name: '실리콘 주방장갑 (1쌍)', price: 2200, moq: 100, deliveryDays: 2, rating: 4.7, image: '', category: '주방/생활', margin: 42 },
        { source: 'dometopia', name: '텀블러 보온/보냉 600ml', price: 3900, moq: 30, deliveryDays: 3, rating: 4.3, image: '', category: '주방/생활', margin: 38 },
        { source: 'dometopia', name: 'LED 무드등 터치형', price: 5500, moq: 20, deliveryDays: 2, rating: 4.6, image: '', category: '인테리어', margin: 32 },
        { source: 'dometopia', name: '접이식 경량 우산', price: 4200, moq: 50, deliveryDays: 3, rating: 4.1, image: '', category: '패션잡화', margin: 30 },
        { source: '1688', name: '보온 텀블러 316스텐 500ml', price: 15, moq: 200, deliveryDays: 14, rating: 4.8, image: '', category: '주방/생활', margin: 55, currencySymbol: '¥' },
        { source: '1688', name: 'TWS 블루투스 이어폰', price: 28, moq: 100, deliveryDays: 12, rating: 4.4, image: '', category: '전자/IT', margin: 48, currencySymbol: '¥' },
        { source: '1688', name: 'USB 미니 가습기', price: 18, moq: 150, deliveryDays: 15, rating: 4.3, image: '', category: '생활가전', margin: 50, currencySymbol: '¥' },
        { source: 'aliexpress', name: '스마트폰 거치대 차량용', price: 3.5, moq: 1, deliveryDays: 10, rating: 4.5, image: '', category: '자동차', margin: 40, currencySymbol: '$' },
        { source: 'aliexpress', name: '에코백 캔버스 대형', price: 2.8, moq: 1, deliveryDays: 12, rating: 4.2, image: '', category: '패션잡화', margin: 45, currencySymbol: '$' },
        { source: 'taobao', name: '데스크 오거나이저 원목', price: 35, moq: 50, deliveryDays: 14, rating: 4.6, image: '', category: '사무용품', margin: 42, currencySymbol: '¥' },
    ],

    // 환율 (AppConfig에서 가져오거나 기본값)
    getExchangeRate(currency) {
        const rates = { KRW: 1, CNY: 195, USD: 1400, JPY: 9.5, EUR: 1520 };
        return rates[currency] || 1;
    },

    // 공급처 검색
    search(keyword, filters = {}) {
        let results = this.demoProducts.filter(p =>
            p.name.toLowerCase().includes(keyword.toLowerCase()) ||
            p.category.includes(keyword)
        );

        if (filters.source) results = results.filter(p => p.source === filters.source);
        if (filters.maxPrice) {
            results = results.filter(p => {
                const src = this.sources.find(s => s.key === p.source);
                const krwPrice = p.price * this.getExchangeRate(src?.currency || 'KRW');
                return krwPrice <= filters.maxPrice;
            });
        }
        if (filters.maxMoq) results = results.filter(p => p.moq <= filters.maxMoq);
        if (filters.minMargin) results = results.filter(p => p.margin >= filters.minMargin);

        // KRW 환산가 추가
        return results.map(p => {
            const src = this.sources.find(s => s.key === p.source);
            const rate = this.getExchangeRate(src?.currency || 'KRW');
            return { ...p, krwPrice: Math.round(p.price * rate), sourceName: src?.name || p.source, sourceIcon: src?.icon || '📦', sourceColor: src?.color || '#888' };
        }).sort((a, b) => a.krwPrice - b.krwPrice);
    },

    // 비교 테이블 렌더링
    renderCompareTable(results, containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!results.length) {
            el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">검색 결과가 없습니다</div>';
            return;
        }

        el.innerHTML = `
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);border-bottom:2px solid var(--border);">
                        <th style="padding:10px 12px;text-align:left;">공급처</th>
                        <th style="padding:10px 12px;text-align:left;">상품명</th>
                        <th style="padding:10px 12px;text-align:right;">원가</th>
                        <th style="padding:10px 12px;text-align:right;">원가(KRW)</th>
                        <th style="padding:10px 12px;text-align:center;">MOQ</th>
                        <th style="padding:10px 12px;text-align:center;">배송</th>
                        <th style="padding:10px 12px;text-align:center;">평점</th>
                        <th style="padding:10px 12px;text-align:center;">예상마진</th>
                        <th style="padding:10px 12px;text-align:center;">액션</th>
                    </tr>
                </thead>
                <tbody>${results.map(p => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                        <td style="padding:8px 12px;"><span style="color:${p.sourceColor};font-weight:700;font-size:11px;">${p.sourceIcon} ${p.sourceName}</span></td>
                        <td style="padding:8px 12px;font-weight:600;">${p.name}</td>
                        <td style="padding:8px 12px;text-align:right;font-family:monospace;">${p.currencySymbol || '₩'}${p.price.toLocaleString()}</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:700;">₩${p.krwPrice.toLocaleString()}</td>
                        <td style="padding:8px 12px;text-align:center;">${p.moq}개</td>
                        <td style="padding:8px 12px;text-align:center;">${p.deliveryDays}일</td>
                        <td style="padding:8px 12px;text-align:center;">⭐${p.rating}</td>
                        <td style="padding:8px 12px;text-align:center;"><span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;${p.margin >= 30 ? 'background:#10b98122;color:#10b981;' : 'background:#f59e0b22;color:#f59e0b;'}">${p.margin}%</span></td>
                        <td style="padding:8px 12px;text-align:center;">
                            <button onclick="SupplierDB.sendToSimulator('${p.name}',${p.krwPrice},'${p.source}')" style="padding:4px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;">→ 시뮬레이터</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
            </div>
            <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
                <span style="font-size:12px;color:var(--text-muted);">총 ${results.length}개 결과</span>
                <span style="font-size:12px;color:var(--text-muted);">최저가: ₩${Math.min(...results.map(p=>p.krwPrice)).toLocaleString()} | 최고 마진: ${Math.max(...results.map(p=>p.margin))}%</span>
            </div>
        `;
    },

    // 시뮬레이터로 전송
    sendToSimulator(name, price, source) {
        if (typeof showToast === 'function') {
            showToast(`📤 "${name}" → T2 시뮬레이터로 전송됨`, false);
        }
        if (typeof AppEventBus !== 'undefined') {
            AppEventBus.emit('PRODUCT_SOURCED', { name, wholesale_price: price, source_type: source });
        }
    },

    // 공급처 검색 UI 이벤트 바인딩
    initSearchUI() {
        const searchBtn = document.getElementById('supplier-search-btn');
        const searchInput = document.getElementById('supplier-search-input');
        const sourceFilter = document.getElementById('supplier-source-filter');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.executeSearch());
        }
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.executeSearch(); });
        }
    },

    executeSearch() {
        const keyword = document.getElementById('supplier-search-input')?.value || '';
        const source = document.getElementById('supplier-source-filter')?.value || '';
        const minMargin = parseInt(document.getElementById('supplier-margin-filter')?.value || '0');

        if (!keyword.trim()) {
            if (typeof showToast === 'function') showToast('검색어를 입력해주세요', true);
            return;
        }

        const filters = {};
        if (source) filters.source = source;
        if (minMargin > 0) filters.minMargin = minMargin;

        const results = this.search(keyword, filters);
        this.renderCompareTable(results, 'supplier-results');

        if (typeof showToast === 'function') {
            showToast(`🔍 "${keyword}" 검색: ${results.length}개 상품 발견`);
        }
    },

    // 전체 카탈로그 로드 (데모)
    loadFullCatalog() {
        const results = this.demoProducts.map(p => {
            const src = this.sources.find(s => s.key === p.source);
            const rate = this.getExchangeRate(src?.currency || 'KRW');
            return { ...p, krwPrice: Math.round(p.price * rate), sourceName: src?.name || p.source, sourceIcon: src?.icon || '📦', sourceColor: src?.color || '#888' };
        }).sort((a, b) => a.krwPrice - b.krwPrice);
        this.renderCompareTable(results, 'supplier-results');
        if (typeof showToast === 'function') showToast(`📦 전체 카탈로그 ${results.length}개 로드`);
    }
};

// DOMContentLoaded에서 초기화
document.addEventListener('DOMContentLoaded', () => { SupplierDB.initSearchUI(); });
