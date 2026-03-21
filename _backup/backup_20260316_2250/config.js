/**
 * AppConfig — 전역 설정 상수
 * Sacred Zone: MARKET_FEES 값 변경 금지 (마진 계산 기반)
 */
const AppConfig = {
    APPS_SCRIPT_URL: localStorage.getItem('proxyApiUrl') || localStorage.getItem('script-url') || '',

    // 8마켓 수수료율 (%) — Sacred Zone
    MARKET_FEES: {
        'smartstore':  { name: '스마트스토어', fee: 5.5,  color: '#03c75a', icon: '🟢' },
        'coupang':     { name: '쿠팡',        fee: 10.8, color: '#e44332', icon: '🟠' },
        'gmarket':     { name: 'G마켓',       fee: 12.0, color: '#4285f4', icon: '🔵' },
        'auction':     { name: '옥션',        fee: 12.0, color: '#ff6f00', icon: '🟤' },
        '11st':        { name: '11번가',      fee: 11.0, color: '#ff0000', icon: '🔴' },
        'wemakeprice': { name: '위메프',      fee: 9.0,  color: '#e91e63', icon: '🩷' },
        'tmon':        { name: '티몬',        fee: 9.0,  color: '#ff5722', icon: '🟣' },
        'kakao':       { name: '카카오쇼핑',  fee: 8.0,  color: '#fee500', icon: '🟡' },
    },

    // 기본 배송비
    DEFAULT_SHIPPING: {
        supplier: 0,     // 도매 배송비 (상품별 상이)
        market: 3000,    // 마켓 배송비 (소비자 부담 기본값)
    },

    // 도매사이트 기본 목록
    DEFAULT_WHOLESALE_SITES: [
        { id: 'domeggook', name: '도매꾹',   url: 'https://domeggook.com',     type: 'api',   urlPattern: 'domeggook.com',  apiKeyField: 'domeggook-api-key', free: true },
        { id: 'domemae',   name: '도매매',   url: 'https://domemae.com',       type: 'api',   urlPattern: 'domemae.com',    apiKeyField: 'domemae-api-key',   free: true },
        { id: 'onchannel', name: '온채널',   url: 'https://www.onch3.co.kr',   type: 'api',   urlPattern: 'onch3.co.kr',    apiKeyField: 'onchannel-api-key', free: true },
        { id: 'ownerclan', name: '오너클랜', url: 'https://ownerclan.com',     type: 'excel', urlPattern: 'ownerclan.com',  apiKeyField: '',                  free: true },
        { id: 'dometopia', name: '도매토피아', url: 'https://dometopia.com',   type: 'api',   urlPattern: 'dometopia.com',  apiKeyField: 'dometopia-api-key', free: true },
        { id: 'zentrade',  name: '젠트레이드', url: 'https://www.zentrade.co.kr', type: 'excel', urlPattern: 'zentrade.co.kr', apiKeyField: '',               free: true },
    ],

    // 엑셀 파일 컬럼 자동 감지 패턴
    EXCEL_COLUMN_PATTERNS: {
        domeggook: { name: ['상품명','품명','product'], price: ['판매가','도매가','price','단가'], stock: ['재고','stock','수량'], image: ['이미지','image','사진'] },
        domemae:   { name: ['상품명','품명'], price: ['공급가','도매가','단가'], stock: ['재고수량','재고'], image: ['대표이미지','이미지'] },
        onchannel: { name: ['상품명'], price: ['공급단가','공급가'], stock: ['재고'], image: ['이미지URL','이미지'] },
        generic:   { name: ['상품명','품명','제품명','name','product','item'], price: ['도매가','공급가','원가','단가','price','cost'], stock: ['재고','stock','수량','qty'], image: ['이미지','image','사진','photo','img'] },
    },

    // 마진 신호등 기준
    MARGIN_THRESHOLDS: {
        go:    25,  // GO: 25% 이상
        watch: 15,  // WATCH: 15~24%
        skip:  15,  // SKIP: 15% 미만
    }
};

// 도매사이트 관리 (localStorage)
const WholesaleSiteManager = {
    KEY: 'wholesale-sites-v7',

    getAll() {
        const saved = localStorage.getItem(this.KEY);
        if (saved) return JSON.parse(saved);
        return JSON.parse(JSON.stringify(AppConfig.DEFAULT_WHOLESALE_SITES));
    },

    save(sites) {
        localStorage.setItem(this.KEY, JSON.stringify(sites));
    },

    add(site) {
        const sites = this.getAll();
        site.id = site.id || 'custom_' + Date.now();
        sites.push(site);
        this.save(sites);
        return site;
    },

    remove(id) {
        const sites = this.getAll().filter(s => s.id !== id);
        this.save(sites);
    },

    getApiKey(siteId) {
        const site = this.getAll().find(s => s.id === siteId);
        if (site && site.apiKeyField) return localStorage.getItem(site.apiKeyField) || '';
        return '';
    },

    detectSiteFromUrl(url) {
        if (!url) return null;
        return this.getAll().find(s => url.includes(s.urlPattern));
    },

    getEnabledApiSites() {
        return this.getAll().filter(s => s.type === 'api' && this.getApiKey(s.id));
    }
};

window.AppConfig = AppConfig;
window.WholesaleSiteManager = WholesaleSiteManager;
