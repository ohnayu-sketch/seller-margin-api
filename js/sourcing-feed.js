/**
 * @file sourcing-feed.js v4
 * @description 📰 멀티엔진 소싱 뉴스피드
 * Engine A: 네이버 쇼핑 카테고리 완전탐색 (57개 서브카테고리) → 도매 매칭
 * Engine B: 도매꾹/도매매 인기상품 → 네이버 시장가 역분석
 * Engine C: 네이버 데이터랩 내부 API → 분야별 인기 키워드
 * + 쿠팡 파트너스 판매가능성 뱃지
 */

window._sourcingFeedCache = [];
window._currentFeedFilter = 'all';
window._feedPage = 1;
window._feedPerPage = 12;
window._feedSourcingMode = 'drop'; // 'drop' (위탁) 또는 'bulk' (사입)

// ★ T1 하위 탭 전환: 위탁/사입
function t1SetSourcingMode(mode) {
    window._feedSourcingMode = mode;
    window._feedPage = 1;
    // UI 탭 활성화
    document.querySelectorAll('.t1-subtab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    // 제목 변경
    var title = document.getElementById('t1-feed-title');
    if (title) title.textContent = mode === 'drop' ? '🟢 위탁 추천 상품' : '📦 사입 추천 상품';
    // 피드 캐시 비우고 재로드
    window._sourcingFeedCache = [];
    loadSourcingFeed(window._currentFeedFilter);
}

function setFeedSourcingMode(mode) {
    t1SetSourcingMode(mode);
}

/** 네이버 쇼핑 2depth 카테고리 트리 (57개 서브카테고리) */
var NAVER_CATEGORY_TREE = [
    // 패션의류
    { id:'50000803', name:'원피스', parent:'패션의류' },
    { id:'50000804', name:'티셔츠', parent:'패션의류' },
    { id:'50000805', name:'니트/스웨터', parent:'패션의류' },
    { id:'50000806', name:'셔츠/블라우스', parent:'패션의류' },
    { id:'50000813', name:'바지/팬츠', parent:'패션의류' },
    // 디지털/가전
    { id:'50001010', name:'청소기', parent:'디지털/가전' },
    { id:'50001011', name:'선풍기/에어컨', parent:'디지털/가전' },
    { id:'50001012', name:'공기청정기', parent:'디지털/가전' },
    { id:'50001004', name:'이어폰/헤드폰', parent:'디지털/가전' },
    { id:'50001005', name:'보조배터리', parent:'디지털/가전' },
    { id:'50001030', name:'에어프라이어', parent:'디지털/가전' },
    // 생활/건강
    { id:'50000574', name:'주방용품', parent:'생활/건강' },
    { id:'50000575', name:'욕실용품', parent:'생활/건강' },
    { id:'50000576', name:'세탁용품', parent:'생활/건강' },
    { id:'50000577', name:'생활잡화', parent:'생활/건강' },
    { id:'50000585', name:'건강관리용품', parent:'생활/건강' },
    // 식품
    { id:'50000590', name:'건강식품', parent:'식품' },
    { id:'50000591', name:'과일', parent:'식품' },
    { id:'50000592', name:'견과/간식', parent:'식품' },
    // 출산/육아
    { id:'50000600', name:'유아동복', parent:'출산/육아' },
    { id:'50000601', name:'완구/교구', parent:'출산/육아' },
    { id:'50000602', name:'유모차/카시트', parent:'출산/육아' },
    // 스포츠/레저
    { id:'50000610', name:'캠핑용품', parent:'스포츠/레저' },
    { id:'50000611', name:'자전거', parent:'스포츠/레저' },
    { id:'50000612', name:'요가/필라테스', parent:'스포츠/레저' },
    { id:'50000613', name:'골프', parent:'스포츠/레저' },
    { id:'50000614', name:'등산용품', parent:'스포츠/레저' },
    { id:'50000615', name:'낚시용품', parent:'스포츠/레저' },
    { id:'50000616', name:'수영/물놀이', parent:'스포츠/레저' },
    // 화장품/미용
    { id:'50000620', name:'스킨케어', parent:'화장품/미용' },
    { id:'50000621', name:'메이크업', parent:'화장품/미용' },
    { id:'50000622', name:'바디케어', parent:'화장품/미용' },
    { id:'50000623', name:'헤어케어', parent:'화장품/미용' },
    { id:'50000624', name:'선케어', parent:'화장품/미용' },
    // 패션잡화
    { id:'50000630', name:'가방', parent:'패션잡화' },
    { id:'50000631', name:'지갑', parent:'패션잡화' },
    { id:'50000632', name:'시계', parent:'패션잡화' },
    { id:'50000633', name:'선글라스/안경', parent:'패션잡화' },
    { id:'50000634', name:'모자', parent:'패션잡화' },
    { id:'50000635', name:'벨트', parent:'패션잡화' },
    // 가구/인테리어
    { id:'50000640', name:'수납/정리', parent:'가구/인테리어' },
    { id:'50000641', name:'침구', parent:'가구/인테리어' },
    { id:'50000642', name:'조명', parent:'가구/인테리어' },
    { id:'50000643', name:'커튼/블라인드', parent:'가구/인테리어' },
    // 반려동물
    { id:'50000650', name:'강아지용품', parent:'반려동물' },
    { id:'50000651', name:'고양이용품', parent:'반려동물' },
    // 자동차용품
    { id:'50000660', name:'차량용방향제', parent:'자동차용품' },
    { id:'50000661', name:'차량용충전기', parent:'자동차용품' },
    // 문구/오피스
    { id:'50000670', name:'필기류', parent:'문구/오피스' },
    { id:'50000671', name:'사무용품', parent:'문구/오피스' },
];

// =====================================================================
//  1. 메인 로드
// =====================================================================
async function loadSourcingFeed(filter) {
    console.warn('📰📰📰 loadSourcingFeed 호출됨 filter=' + (filter || 'all'));
    filter = filter || window._currentFeedFilter || 'all';
    window._feedPage = 1;
    var grid = document.getElementById('sourcing-feed-grid');
    var timeEl = document.getElementById('feed-update-time');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;">' +
        '<div class="spinner" style="margin:0 auto 8px;width:24px;height:24px;"></div>' +
        '<span style="color:var(--text-muted);font-size:0.75rem;font-weight:600;">📡 멀티엔진 수집 중... (카테고리 탐색 + 도매 + 데이터랩)</span></div>';

    try {
        var feedData = [];
        try {
            var res = await window.fetchGas('getSourcingFeed', { filter: filter, limit: 80 });
            if (res && res.success && res.data && res.data.length > 0) feedData = res.data;
        } catch(e) {}

        if (feedData.length === 0) {
            var results = await Promise.allSettled([
                engineA_NaverToWholesale(),
                engineB_WholesaleToNaver(),
                engineC_DatalabKeywords()
            ]);
            var aItems = (results[0].status === 'fulfilled' && results[0].value) ? results[0].value : [];
            var bItems = (results[1].status === 'fulfilled' && results[1].value) ? results[1].value : [];
            var cItems = (results[2].status === 'fulfilled' && results[2].value) ? results[2].value : [];

            feedData = mergeAndRankAll([aItems, bItems, cItems]);
            feedData = await enrichWithCoupang(feedData.slice(0, 40));
        } else {
            // ★ GAS 캐시 데이터 구조 확인 로그
            console.log('📰 GAS 캐시 데이터 수신 (' + feedData.length + '개), 샘플:', JSON.stringify(feedData[0] || {}).substring(0, 300));
            // ★ 듀얼 필드가 없거나 0인 항목이 있으면 도매 매칭으로 보강
            var hasDual = feedData.filter(function(it) { return (it.dropPrice > 0 || it.bulkPrice > 0); }).length;
            console.log('📰 듀얼 가격 보유: ' + hasDual + '/' + feedData.length);
            if (hasDual < feedData.length / 2) {
                console.log('📰 도매 매칭 보강 시작 (' + Math.min(20, feedData.length) + '개)...');
                try {
                    var candidates = feedData.slice(0, 20).map(function(it) {
                        return {
                            keyword: it.keyword || '',
                            title: it.title || '',
                            image: it.image || '',
                            link: it.link || '',
                            retailPrice: it.retailPrice || 0,
                            category: it.category || '',
                            engine: it.engine || 'GAS',
                            feedType: it.feedType || 'trending'
                        };
                    });
                    var enriched = await matchWholesale(candidates);
                    console.log('📰 matchWholesale 결과: ' + enriched.length + '개, 도매가격 보유: ' + enriched.filter(function(e) { return e.dropPrice > 0 || e.bulkPrice > 0; }).length);
                    // 보강된 결과로 교체 (키워드 매칭)
                    var enrichMap = {};
                    enriched.forEach(function(e) { enrichMap[e.keyword] = e; });
                    feedData = feedData.map(function(it) {
                        var e = enrichMap[it.keyword];
                        if (e) {
                            it.dropPrice = e.dropPrice;
                            it.bulkPrice = e.bulkPrice;
                            it.dropMargin = e.dropMargin;
                            it.bulkMargin = e.bulkMargin;
                            it.dropProfit = e.dropProfit;
                            it.bulkProfit = e.bulkProfit;
                            it.dropUrl = e.dropUrl || '';
                            it.bulkUrl = e.bulkUrl || '';
                            it.availType = e.availType;
                            it.hasWholesale = e.hasWholesale;
                            if (e.wholesalePrice > 0) it.wholesalePrice = e.wholesalePrice;
                            if (e.margin > it.margin) it.margin = e.margin;
                        }
                        return it;
                    });
                    console.log('📰 듀얼 보강 완료 ✅');
                } catch(ex) {
                    console.warn('📰 듀얼 보강 실패 (무시):', ex);
                }
            }
        }

        window._sourcingFeedCache = feedData;
        renderFeedPage(feedData, filter);

        if (timeEl) {
            var now = new Date();
            timeEl.textContent = now.toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) + ' 업데이트';
        }
    } catch(err) {
        console.error('📰 피드 오류:', err);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);">⚠️ 피드 로드 실패</div>';
    }
}

// =====================================================================
//  2. Engine A: 네이버 쇼핑 카테고리 완전탐색
// =====================================================================
async function engineA_NaverToWholesale() {
    console.log('📰 [A] 카테고리 완전탐색 시작 (' + NAVER_CATEGORY_TREE.length + '개)');
    var selected = shuffleArr(NAVER_CATEGORY_TREE).slice(0, 15);
    var month = new Date().getMonth() + 1;
    getSeasonalQueries(month).forEach(function(sq) {
        selected.push({ id: '', name: sq.query, parent: sq.category });
    });

    var searches = selected.map(function(cat) {
        return window.fetchGas('naverProxy', { type: 'search-shop', query: cat.name, display: 10 })
            .then(function(r) { return { cat: cat, r: r }; })
            .catch(function() { return { cat: cat, r: null }; });
    });
    var results = await Promise.allSettled(searches);

    var candidates = [];
    results.forEach(function(r) {
        if (r.status !== 'fulfilled' || !r.value.r || !r.value.r.success) return;
        var cat = r.value.cat;
        var items = r.value.r.items || (r.value.r.data && r.value.r.data.items) || [];
        items.filter(function(it) {
            var p = parseInt(it.lprice) || 0;
            return p >= 5000 && p <= 150000;
        }).slice(0, 4).forEach(function(it) {
            var title = (it.title || '').replace(/<[^>]*>/g, '').trim();
            if (!title) return;
            candidates.push({
                keyword: extractFeedKeyword(title),
                title: title, image: it.image || '', link: it.link || '',
                retailPrice: parseInt(it.lprice) || 0,
                category: cat.parent + '>' + cat.name, engine: 'A', feedType: 'trending'
            });
        });
    });

    var kwMap = {};
    candidates.forEach(function(c) { if (!kwMap[c.keyword]) kwMap[c.keyword] = c; });
    var unique = Object.values(kwMap).slice(0, 20);
    console.log('📰 [A] 카테고리 탐색 후보 ' + unique.length + '개');
    return await matchWholesale(unique);
}

// =====================================================================
//  3. Engine B: 도매 인기상품 → 네이버 시장가 역분석
// =====================================================================
async function engineB_WholesaleToNaver() {
    var mode = window._feedSourcingMode || 'drop';
    var market = mode === 'drop' ? 'supply' : 'dome';
    var marketLabel = mode === 'drop' ? '도매매' : '도매꾹';
    console.log('📰 [B] ' + marketLabel + '→네이버 수집 시작');
    var wsSearches = [
        { market: market, keyword: '인기', label: marketLabel + ' 인기' },
        { market: market, keyword: '신상품', label: marketLabel + ' 신상' },
    ];

    var wsResults = await Promise.allSettled(wsSearches.map(function(s) {
        return window.fetchGas('domeggookProxy', { type: 'search', keyword: s.keyword, market: s.market, size: 20 })
            .then(function(r) { return { s: s, r: r }; })
            .catch(function() { return { s: s, r: null }; });
    }));

    var wsCandidates = [];
    wsResults.forEach(function(r) {
        if (r.status !== 'fulfilled' || !r.value.r) return;
        var s = r.value.s;
        var data = r.value.r;
        var items = data.data || data.items || [];
        if (!Array.isArray(items)) return;

        items.filter(function(it) {
            var p = parseInt(it.price || it.unitPrice || 0);
            return p >= 1000 && p <= 80000;
        }).slice(0, 8).forEach(function(it) {
            var title = (it.name || it.subject || it.title || '').replace(/<[^>]*>/g, '').trim();
            var wsPrice = parseInt(it.price || it.unitPrice || 0);
            var img = it.thumb || it.imageUrl || it.image || it.mainImageUrl || '';
            var mkt = it.market || {};
            if (!title || wsPrice === 0) return;

            wsCandidates.push({
                keyword: extractFeedKeyword(title),
                title: title, image: img,
                link: it.url || it.link || '',
                no: it.no || '',
                wholesalePrice: wsPrice,
                source: s.market === 'dome' ? 'bulk' : 'drop',
                marketDome: (mkt.domeggook === 'true' || mkt.domeggook === true),
                marketSupply: (mkt.supply === 'true' || mkt.supply === true),
                engine: 'B', feedType: 'bestseller'
            });
        });
    });

    // ★ 상품번호(no) 기준 dome/supply 가격 매칭
    var supplyByNo = {}, domeByNo = {};
    wsCandidates.forEach(function(c) {
        if (!c.no) return;
        if (c.source === 'drop') supplyByNo[c.no] = c;
        if (c.source === 'bulk') domeByNo[c.no] = c;
    });
    console.log('🔍 [engineB] wsCandidates: ' + wsCandidates.length + '개, dome=' + Object.keys(domeByNo).length + ', supply=' + Object.keys(supplyByNo).length);
    console.log('🔍 [engineB] dome nos: ' + Object.keys(domeByNo).slice(0,5).join(','));
    console.log('🔍 [engineB] supply nos: ' + Object.keys(supplyByNo).slice(0,5).join(','));
    var matchCount = 0;
    Object.keys(domeByNo).forEach(function(no) { if (supplyByNo[no]) matchCount++; });
    console.log('🔍 [engineB] no 매칭: ' + matchCount + '개');

    // 중복 제거: 상품번호 우선, 없으면 키워드
    var seen = {};
    var kwMap = {};
    wsCandidates.forEach(function(c) {
        var key = c.no || c.keyword;
        if (seen[key]) return;
        seen[key] = true;
        // 같은 상품의 dome/supply 가격 병합
        if (c.source === 'bulk' && c.no && supplyByNo[c.no]) {
            c._dropWs = supplyByNo[c.no].wholesalePrice;
            c._dropLink = supplyByNo[c.no].link;
        } else if (c.source === 'drop' && c.no && domeByNo[c.no]) {
            c._bulkWs = domeByNo[c.no].wholesalePrice;
            c._bulkLink = domeByNo[c.no].link;
        }
        // marketSupply/marketDome 필드: URL만 보완 (가격은 복사하지 않음)
        if (c._dropWs && !c._dropLink && c.no) {
            c._dropLink = 'http://domeme.domeggook.com/s/' + c.no;
        }
        if (c._bulkWs && !c._bulkLink && c.no) {
            c._bulkLink = 'https://domeggook.com/' + c.no;
        }
        kwMap[c.keyword] = c;
    });
    // 디버그: 최종 결과 샘플
    var _dbgItems = Object.values(kwMap).slice(0,3);
    _dbgItems.forEach(function(c) {
        console.log('🔍 [engineB] 결과: kw=' + c.keyword + ' no=' + c.no + ' src=' + c.source + ' ws=' + c.wholesalePrice + ' drop=' + (c._dropWs||'없음') + ' bulk=' + (c._bulkWs||'없음') + ' dLink=' + (c._dropLink||'없음').substring(0,40) + ' bLink=' + (c._bulkLink||'없음').substring(0,40) + ' mktS=' + c.marketSupply + ' mktD=' + c.marketDome);
    });
    var unique = Object.values(kwMap).slice(0, 15);

    var naverChecks = await Promise.allSettled(unique.map(function(c) {
        return window.fetchGas('naverProxy', { type: 'search-shop', query: c.keyword, display: 3 })
            .then(function(r) { return { c: c, r: r }; })
            .catch(function() { return { c: c, r: null }; });
    }));

    var FEE_RATE = parseFloat(localStorage.getItem('marketFeeRate')) || 0.08;
    var feedItems = [];
    var mode = window._feedSourcingMode || 'drop';

    naverChecks.forEach(function(r) {
        if (r.status !== 'fulfilled') return;
        var c = r.value.c;
        var res = r.value.r;
        var retailPrice = 0;
        var naverLink = c.link;
        var naverImg = c.image;

        if (res && res.success) {
            var nItems = res.items || (res.data && res.data.items) || [];
            if (nItems.length > 0) {
                retailPrice = parseInt(nItems[0].lprice) || 0;
                if (nItems[0].link) naverLink = nItems[0].link;
                if (nItems[0].image) naverImg = nItems[0].image;
            }
        }
        if (retailPrice === 0) retailPrice = Math.round(c.wholesalePrice * 2.2);

        var fee = Math.round(retailPrice * FEE_RATE);
        var totalCost = c.wholesalePrice + 3000 + fee;
        var margin = retailPrice > 0 ? Math.round((retailPrice - totalCost) / retailPrice * 100) : 0;
        if (margin < -20) return;

        var feedType = margin >= 35 ? 'blueocean' : c.feedType;
        // ★ 싱글 가격: 현재 mode에 해당하는 도매가만
        var _wsUrl = c.link || '';
        if (!_wsUrl && c.no) {
            _wsUrl = mode === 'drop'
                ? 'http://domeme.domeggook.com/s/' + c.no
                : 'https://domeggook.com/' + c.no;
        }

        feedItems.push({
            keyword: c.keyword, title: c.title,
            image: c.image || naverImg, link: naverLink,
            retailPrice: retailPrice, wholesalePrice: c.wholesalePrice,
            dropPrice: mode === 'drop' ? c.wholesalePrice : 0,
            bulkPrice: mode === 'bulk' ? c.wholesalePrice : 0,
            dropMargin: mode === 'drop' ? margin : null,
            bulkMargin: mode === 'bulk' ? margin : null,
            dropProfit: mode === 'drop' ? Math.max(0, retailPrice - totalCost) : 0,
            bulkProfit: mode === 'bulk' ? Math.max(0, retailPrice - totalCost) : 0,
            dropUrl: mode === 'drop' ? _wsUrl : '',
            bulkUrl: mode === 'bulk' ? _wsUrl : '',
            wsUrl: _wsUrl,
            margin: margin, score: calculateFeedScore(margin, mode === 'drop', mode === 'bulk', retailPrice),
            feedType: feedType, category: '도매발굴',
            hasWholesale: true, engine: 'B',
            availType: mode,
            trendDelta: 0, timestamp: new Date().toISOString()
        });
    });
    return feedItems;
}

// =====================================================================
//  4. Engine C: 데이터랩 내부 API → 분야별 인기 키워드
// =====================================================================
async function engineC_DatalabKeywords() {
    console.log('📰 [C] 데이터랩 인기키워드 수집 시작');
    try {
        var res = await window.fetchGas('naverDatalabKeywords', { limit: 20 });
        if (!res || !res.success || !res.keywords || res.keywords.length === 0) {
            console.warn('📰 [C] 데이터랩 API 응답 없음, 스킵');
            return [];
        }
        var keywords = res.keywords;
        var searches = keywords.slice(0, 12).map(function(kw) {
            return window.fetchGas('naverProxy', { type: 'search-shop', query: kw, display: 3 })
                .then(function(r) { return { kw: kw, r: r }; })
                .catch(function() { return { kw: kw, r: null }; });
        });
        var results = await Promise.allSettled(searches);
        var candidates = [];
        results.forEach(function(r) {
            if (r.status !== 'fulfilled' || !r.value.r || !r.value.r.success) return;
            var kw = r.value.kw;
            var items = r.value.r.items || (r.value.r.data && r.value.r.data.items) || [];
            if (items.length === 0) return;
            var it = items[0];
            var price = parseInt(it.lprice) || 0;
            if (price < 3000 || price > 200000) return;
            candidates.push({
                keyword: kw,
                title: (it.title || '').replace(/<[^>]*>/g, '').trim(),
                image: it.image || '', link: it.link || '',
                retailPrice: price,
                category: '데이터랩', engine: 'C', feedType: 'trending'
            });
        });
        console.log('📰 [C] 데이터랩 후보 ' + candidates.length + '개');
        return await matchWholesale(candidates);
    } catch(e) {
        console.warn('📰 [C] 데이터랩 엔진 실패:', e);
        return [];
    }
}

// =====================================================================
//  5. 쿠팡 판매가능성 보강
// =====================================================================
async function enrichWithCoupang(items) {
    if (!items || items.length === 0) return items;
    try {
        var checks = items.slice(0, 20).map(function(item) {
            return window.fetchGas('coupangPartners', { type: 'search', keyword: item.keyword, limit: 1 })
                .then(function(r) { return { item: item, r: r }; })
                .catch(function() { return { item: item, r: null }; });
        });
        var results = await Promise.allSettled(checks);
        results.forEach(function(r) {
            if (r.status !== 'fulfilled') return;
            var item = r.value.item;
            var res = r.value.r;
            if (!res || !res.success) return;
            var cItems = res.data || res.items || [];
            if (!Array.isArray(cItems) || cItems.length === 0) return;
            var cp = cItems[0];
            item.coupangReviews = parseInt(cp.reviewCount || cp.ratingTotalCount || 0);
            item.coupangRating = parseFloat(cp.rating || cp.ratingScore || 0);
            item.coupangPrice = parseInt(cp.salePrice || cp.productPrice || 0);
            item.coupangRank = cp.rank || cp.bestRank || 0;
            if (item.coupangReviews > 100) item.score = Math.min(100, item.score + 8);
            else if (item.coupangReviews > 30) item.score = Math.min(100, item.score + 4);
        });
    } catch(e) {
        console.warn('📰 쿠팡 보강 실패 (무시):', e);
    }
    items.sort(function(a, b) { return b.score - a.score; });
    return items;
}

// =====================================================================
//  6. 도매 매칭 유틸 (Engine A/C 공용)
// =====================================================================
async function matchWholesale(candidates) {
    var FEE_RATE = parseFloat(localStorage.getItem('marketFeeRate')) || 0.08;
    var SHIPPING = 3000;
    var mode = window._feedSourcingMode || 'drop';
    var market = mode === 'drop' ? 'supply' : 'dome';
    
    var wsResults = await Promise.allSettled(candidates.map(function(c) {
        return window.fetchGas('domeggookProxy', { type: 'search', keyword: c.keyword, market: market, size: 3 })
            .then(function(r) { return { c: c, r: r }; })
            .catch(function() { return { c: c, r: null }; });
    }));

    var items = [];
    wsResults.forEach(function(r) {
        if (r.status !== 'fulfilled') return;
        var c = r.value.c;
        var wsItem = _extractWsItem({ status: 'fulfilled', value: r.value.r });
        var wsPrice = wsItem.price;
        var wsUrl = wsItem.url;
        if (wsPrice > 0 && !wsUrl && wsItem.no) {
            wsUrl = mode === 'drop' 
                ? 'http://domeme.domeggook.com/s/' + wsItem.no 
                : 'https://domeggook.com/' + wsItem.no;
        }
        if (wsPrice <= 0) return; // 도매가 없으면 스킵
        
        var fee = Math.round(c.retailPrice * FEE_RATE);
        var wsMargin = (wsPrice > 0 && c.retailPrice > 0) ? Math.round((c.retailPrice - wsPrice - SHIPPING - fee) / c.retailPrice * 100) : 0;
        var wsProfit = wsPrice > 0 ? Math.max(0, c.retailPrice - wsPrice - SHIPPING - fee) : 0;
        
        var feedType = (wsMargin >= 35) ? 'blueocean' : c.feedType;

        items.push({
            keyword: c.keyword, title: c.title, image: c.image, link: c.link,
            retailPrice: c.retailPrice, wholesalePrice: wsPrice,
            dropPrice: mode === 'drop' ? wsPrice : 0,
            bulkPrice: mode === 'bulk' ? wsPrice : 0,
            dropMargin: mode === 'drop' ? wsMargin : null,
            bulkMargin: mode === 'bulk' ? wsMargin : null,
            dropProfit: mode === 'drop' ? wsProfit : 0,
            bulkProfit: mode === 'bulk' ? wsProfit : 0,
            dropUrl: mode === 'drop' ? wsUrl : '',
            bulkUrl: mode === 'bulk' ? wsUrl : '',
            margin: wsMargin, wsUrl: wsUrl,
            score: calculateFeedScore(wsMargin, mode === 'drop', mode === 'bulk', c.retailPrice),
            feedType: feedType, category: c.category,
            hasWholesale: wsPrice > 0, engine: c.engine,
            availType: mode,
            trendDelta: 0, timestamp: new Date().toISOString()
        });
    });
    return items;
}

function _extractWsItem(promiseResult) {
    if (!promiseResult || promiseResult.status !== 'fulfilled' || !promiseResult.value) return { price: 0, url: '', no: '' };
    var v = promiseResult.value;
    if (v.success === false) return { price: 0, url: '', no: '' };
    var items = v.data || v.items || [];
    if (!Array.isArray(items) || items.length === 0) return { price: 0, url: '', no: '' };
    var it = items[0];
    return {
        price: parseInt(it.price || it.salePrice || it.sellPrice || it.unitPrice || 0),
        url: it.url || it.link || '',
        no: it.no || ''
    };
}

// =====================================================================
//  7. 합산 + 중복 제거 + 랭킹 (멀티엔진)
// =====================================================================
function mergeAndRankAll(engineArrays) {
    var all = [];
    engineArrays.forEach(function(arr) { all = all.concat(arr); });
    var kwMap = {};
    all.forEach(function(item) {
        var key = item.keyword;
        if (!kwMap[key]) {
            kwMap[key] = item;
        } else {
            var existing = kwMap[key];
            // score가 높으면 대표 정보 교체
            if (item.score > existing.score) {
                if (existing.engine === 'B' && item.engine !== 'B' && item.score - existing.score < 10) return;
                kwMap[key] = item;
            }
        }
    });
    var merged = Object.values(kwMap);
    merged.sort(function(a, b) { return b.score - a.score; });
    var counts = {};
    all.forEach(function(i) { counts[i.engine] = (counts[i.engine] || 0) + 1; });
    console.log('📰 [Feed] 엔진별: A=' + (counts.A||0) + ' B=' + (counts.B||0) + ' C=' + (counts.C||0) + ' → 최종 ' + merged.length + '개 매칭 완료');
    return merged;
}

// =====================================================================
//  8. 페이지네이션 + 렌더링
// =====================================================================
function renderFeedPage(items, filter) {
    var filtered = filter === 'all' ? items : items.filter(function(i) { return i.feedType === filter; });
    // 이미 mode에 맞는 상품만 가져오기 때문에 추가 필터링 불필요
    
    var total = filtered.length;
    var perPage = window._feedPerPage;
    var page = window._feedPage;
    var totalPages = Math.ceil(total / perPage) || 1;
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * perPage;
    var pageItems = filtered.slice(start, start + perPage);

    // ★ 소싱 모드 탭 렌더링
    var modeEl = document.getElementById('sourcing-mode-tabs');
    if (!modeEl) {
        var grid = document.getElementById('sourcing-feed-grid');
        if (grid) {
            modeEl = document.createElement('div');
            modeEl.id = 'sourcing-mode-tabs';
            modeEl.className = 'sourcing-mode-tabs';
            grid.parentNode.insertBefore(modeEl, grid);
        }
    }
    if (modeEl) {
        var allCount = (filter === 'all' ? items : items.filter(function(i) { return i.feedType === filter; })).length;
        var dropCount = items.filter(function(i) { return i.dropPrice > 0; }).length;
        var bulkCount = items.filter(function(i) { return i.bulkPrice > 0; }).length;
        var bothCount = items.filter(function(i) { return i.availType === 'both'; }).length;
        modeEl.innerHTML = '<button class="smt-btn' + (sMode === 'all' ? ' active' : '') + '" onclick="setFeedSourcingMode(\'all\')">전체 ' + allCount + '</button>'
            + '<button class="smt-btn' + (sMode === 'drop' ? ' active' : '') + '" onclick="setFeedSourcingMode(\'drop\')">🟢 위탁만 ' + dropCount + '</button>'
            + '<button class="smt-btn' + (sMode === 'bulk' ? ' active' : '') + '" onclick="setFeedSourcingMode(\'bulk\')">📦 사입만 ' + bulkCount + '</button>'
            + '<button class="smt-btn' + (sMode === 'both' ? ' active' : '') + '" onclick="setFeedSourcingMode(\'both\')">💎 둘 다 ' + bothCount + '</button>';
    }

    renderFeedCards(pageItems);
    renderFeedPagination(total, totalPages, page);

    var countEl = document.getElementById('feed-count');
    if (countEl) countEl.textContent = total + '개 발견';
}

function renderFeedCards(items) {
    var grid = document.getElementById('sourcing-feed-grid');
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);">🔍 해당 카테고리에 상품이 없습니다.</div>';
        return;
    }

    grid.innerHTML = items.map(function(item) {
        var sGrad = item.score >= 70 ? '#10b981,#059669' : (item.score >= 50 ? '#f59e0b,#d97706' : '#6366f1,#4f46e5');
        var tagCls = item.feedType || 'trending';
        var tags = { trending:'🔥', blueocean:'💎', seasonal:'🌦️', bestseller:'🏆' };
        var tag = tags[tagCls] || '📦';
        var engineTag = {A:'📊', B:'🏪', C:'📈'}[item.engine] || '🔍';
        var safeKw = item.keyword.replace(/'/g, "\\'");
        var cpBadge = '';
        if (item.coupangReviews > 0) {
            cpBadge = '<span class="fcc-tag" style="background:rgba(168,85,247,0.12);color:#a855f7;">🛒' + item.coupangReviews + '리뷰</span>';
        }

        // ★ MODE별 완전 분리: 색상, 배지, 링크, 동선
        var _mode = window._feedSourcingMode || 'drop';
        var _isDrop = _mode === 'drop';
        
        // 도매처 정보
        var _wsPrice = _isDrop ? item.dropPrice : item.bulkPrice;
        var _wsMargin = _isDrop ? item.dropMargin : item.bulkMargin;
        var _wsProfit = _isDrop ? item.dropProfit : item.bulkProfit;
        var _wsUrl = item.wsUrl || (_isDrop ? item.dropUrl : item.bulkUrl) || '#';
        
        // 카드 테두리 + 라벨
        var _borderColor = _isDrop ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)';
        var _hoverColor = _isDrop ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)';
        var _label = _isDrop ? '🟢 위탁가 (도매매)' : '📦 사입가 (도매꾹)';
        var _trackCls = _isDrop ? 'fcc-track-drop' : 'fcc-track-bulk';
        var _accentColor = _isDrop ? '#10b981' : '#3b82f6';
        var _sourceBadge = _isDrop ? '🟢 위탁' : '📦 사입';
        var _sourceLabel = _isDrop ? '도매매' : '도매꾹';

        // 가격 영역
        var priceHtml = '';
        if (_wsPrice > 0) {
            var _m = _wsMargin != null ? _wsMargin : 0;
            var _mColor = _m >= 25 ? '#4ade80' : (_m >= 15 ? '#fbbf24' : '#ef4444');
            priceHtml = '<div class="fcc-dual">'
                + '<div class="fcc-track ' + _trackCls + '" onclick="event.stopPropagation();window.open(\'' + _wsUrl.replace(/'/g,"\\'") + '\',\'_blank\');" style="cursor:pointer;">'
                + '<div class="fcc-track-label">' + _label + '</div>'
                + '<div class="fcc-track-price">₩' + _wsPrice.toLocaleString() + '</div>'
                + '<div class="fcc-track-margin" style="color:' + _mColor + ';">' + _m + '% · ₩' + (_wsProfit || 0).toLocaleString() + '</div>'
                + '</div>'
                + '</div>';
        } else {
            priceHtml = '<div class="fcc-prices" style="color:#475569;text-align:center;padding:8px;font-size:10px;">'
                + _sourceLabel + ' 가격 정보 없음'
                + '</div>';
        }

        // ★ 카드 클릭 → 도매처 상품 페이지 / 링크 버튼 → 도매처
        var cardOnclick = _wsUrl !== '#'
            ? 'window.open(\'' + _wsUrl.replace(/'/g,"\\'") + '\',\'_blank\')'
            : 'feedCardClick(\'' + safeKw + '\')';
        
        // ★ 소싱하기 버튼 → T2 시뮬레이터로 데이터 전달
        var t2Data = JSON.stringify({
            name: item.keyword, cost: _wsPrice || item.wholesalePrice,
            retailPrice: item.retailPrice, margin: _wsMargin || item.margin,
            mode: _mode, wsUrl: _wsUrl, image: item.image
        }).replace(/"/g, '&quot;').replace(/'/g, "\\'");
        
        var sourcingBtnColor = _isDrop 
            ? 'background:linear-gradient(135deg,#10b981,#059669);color:#fff;'
            : 'background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;';

        return '<div class="feed-card-compact" onclick="' + cardOnclick + '" style="border-color:' + _borderColor + ';" onmouseenter="this.style.borderColor=\'' + _hoverColor + '\'" onmouseleave="this.style.borderColor=\'' + _borderColor + '\'">'
            + '<div class="fcc-img-wrap">'
                + '<img src="' + item.image + '" onerror="this.src=\'https://placehold.co/120x120?text=' + encodeURIComponent(item.keyword.substring(0,4)) + '\'" alt="">'
                + '<span class="fcc-score" style="background:linear-gradient(135deg,' + sGrad + ');">' + item.score + '</span>'
                + '<span style="position:absolute;bottom:4px;left:4px;background:' + _accentColor + ';color:#fff;font-size:7px;font-weight:800;padding:2px 5px;border-radius:3px;">' + _sourceBadge + '</span>'
            + '</div>'
            + '<div class="fcc-body">'
                + '<div class="fcc-kw">' + item.keyword + '</div>'
                + '<div class="fcc-tags">'
                    + '<span class="fcc-tag ' + tagCls + '">' + tag + '</span>'
                    + '<span class="fcc-tag" style="background:rgba(100,116,139,0.1);color:#94a3b8;">' + engineTag + ' ' + item.category + '</span>'
                    + cpBadge
                + '</div>'
                + '<div class="fcc-retail" style="font-size:10px;color:#94a3b8;margin:2px 0;">시장가 ₩' + item.retailPrice.toLocaleString() + '</div>'
                + priceHtml
                + '<div class="fcc-actions">'
                    + '<button onclick="event.stopPropagation();t1SendToSimulator(' + t2Data + ');" style="' + sourcingBtnColor + '">🚀 소싱</button>'
                    + '<button onclick="event.stopPropagation();window.open(\'' + _wsUrl.replace(/'/g,"\\'") + '\',\'_blank\');" style="background:rgba(255,255,255,0.06);color:' + _accentColor + ';">🔗 ' + _sourceLabel + '</button>'
                    + '<button onclick="event.stopPropagation();window.open(\'' + (item.link || '#').replace(/'/g,"\\'") + '\',\'_blank\');" style="background:rgba(255,255,255,0.06);color:#94a3b8;">🔍 네이버</button>'
                + '</div>'
            + '</div>'
        + '</div>';
    }).join('');
}

function renderFeedPagination(total, totalPages, currentPage) {
    var pag = document.getElementById('feed-pagination');
    if (!pag) {
        var grid = document.getElementById('sourcing-feed-grid');
        if (!grid) return;
        pag = document.createElement('div');
        pag.id = 'feed-pagination';
        grid.parentNode.insertBefore(pag, grid.nextSibling);
    }
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    var html = '<div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:12px 0;">';
    html += '<button onclick="feedGoPage(' + Math.max(1, currentPage - 1) + ')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-muted);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;" ' + (currentPage <= 1 ? 'disabled' : '') + '>◀</button>';
    for (var p = 1; p <= totalPages; p++) {
        var active = p === currentPage;
        html += '<button onclick="feedGoPage(' + p + ')" style="' +
            (active ? 'background:var(--accent);color:#0d0f14;font-weight:800;' : 'background:var(--surface2);color:var(--text-muted);') +
            'border:1px solid var(--border);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;min-width:32px;">' + p + '</button>';
    }
    html += '<button onclick="feedGoPage(' + Math.min(totalPages, currentPage + 1) + ')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-muted);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;" ' + (currentPage >= totalPages ? 'disabled' : '') + '>▶</button>';
    html += '<span style="font-size:0.65rem;color:var(--text-muted);margin-left:8px;">' + total + '개 중 ' + ((currentPage - 1) * window._feedPerPage + 1) + '-' + Math.min(total, currentPage * window._feedPerPage) + '</span>';
    html += '</div>';
    pag.innerHTML = html;
}

function feedGoPage(p) {
    window._feedPage = p;
    renderFeedPage(window._sourcingFeedCache, window._currentFeedFilter);
    var section = document.getElementById('sourcing-feed-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =====================================================================
//  9. 필터 + 이벤트
// =====================================================================
function filterFeed(type) {
    window._currentFeedFilter = type;
    window._feedPage = 1;
    document.querySelectorAll('.feed-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.filter === type);
    });
    if (window._sourcingFeedCache.length > 0) {
        renderFeedPage(window._sourcingFeedCache, type);
    } else {
        loadSourcingFeed(type);
    }
}

function feedCardClick(keyword) { feedSearchKeyword(keyword); }

function feedSearchKeyword(keyword) {
    // T1 피드 내 검색: 현재 mode에 맞는 도매 검색 실행
    var input = document.getElementById('t1-feed-search');
    if (input) input.value = keyword;
    loadSourcingFeed(window._currentFeedFilter);
}

// ★ T1 피드 검색 (좌측 검색바에서 호출)
function t1FeedSearch() {
    var input = document.getElementById('t1-feed-search');
    if (!input || !input.value.trim()) return;
    var kw = input.value.trim();
    // 현재 mode에 맞는 matchWholesale로 검색
    var mode = window._feedSourcingMode || 'drop';
    var market = mode === 'drop' ? 'supply' : 'dome';
    console.log('🔍 [t1FeedSearch] mode=' + mode + ' market=' + market + ' kw=' + kw);
    
    var grid = document.getElementById('sourcing-feed-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);">🔍 "' + kw + '" 검색 중...</div>';
    
    // 도매 API + 네이버 매칭
    matchWholesale([{
        keyword: kw, title: kw, image: '', link: '',
        retailPrice: 0, category: '검색', engine: 'S', feedType: 'trending'
    }]).then(function(items) {
        // retailPrice가 0인 건 네이버에서 가져오기
        var searches = items.map(function(item) {
            if (item.retailPrice > 0) return Promise.resolve(item);
            return window.fetchGas('naverProxy', { type: 'search-shop', query: item.keyword, display: 3 })
                .then(function(r) {
                    if (r && r.success) {
                        var nItems = r.items || (r.data && r.data.items) || [];
                        if (nItems.length > 0) {
                            item.retailPrice = parseInt(nItems[0].lprice) || 0;
                            item.link = nItems[0].link || '';
                            item.image = nItems[0].image || item.image;
                        }
                    }
                    return item;
                }).catch(function() { return item; });
        });
        return Promise.all(searches);
    }).then(function(items) {
        items = items.filter(function(i) { return i.wholesalePrice > 0; });
        window._sourcingFeedCache = items;
        window._feedPage = 1;
        renderFeedPage(items, 'all');
        var countEl = document.getElementById('t1-feed-count');
        if (countEl) countEl.textContent = items.length + '개 검색 결과';
    }).catch(function(e) {
        console.warn('t1FeedSearch 실패:', e);
        if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#ef4444;">검색 실패</div>';
    });
}

// ★ 카드 → T2 마진 시뮬레이터로 데이터 전달
function t1SendToSimulator(data) {
    if (!data) return;
    // T2 입력 필드에 자동 입력
    var nameEl = document.getElementById('t2-product-name');
    var costEl = document.getElementById('t2-cost');
    if (nameEl) nameEl.value = data.name || '';
    if (costEl) costEl.value = data.cost || '';
    // T2 시뮬레이터 모드 전환 (위탁/사입)
    if (data.mode === 'bulk' && typeof t2SetSimMode === 'function') {
        t2SetSimMode('consign'); // 사입도 온라인 위탁 시뮬에서 계산
    }
    // T2 탭으로 이동
    if (typeof showTab === 'function') showTab('inventory');
    // 마진 재계산
    setTimeout(function() {
        if (typeof t2RecalcMargin === 'function') t2RecalcMargin();
    }, 200);
}

// =====================================================================
//  10. 유틸리티
// =====================================================================
function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

function extractFeedKeyword(title) {
    var clean = title.replace(/<[^>]*>/g, '');
    clean = clean.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
    clean = clean.replace(/\d+\s*(ml|g|kg|cm|mm|개|장|매|ea|pack|set|세트|입|P|p)\b/gi, '');
    clean = clean.replace(/[^\w\s가-힣]/g, ' ');
    var stops = ['무료배송','할인','특가','인기','추천','베스트','신상','한정','당일발송','국내','해외','정품','브랜드','공식','인증','무배','세일','이벤트','큐텐','쿠팡'];
    var words = clean.split(/\s+/).filter(function(w) { return w.length >= 2 && stops.indexOf(w) === -1; });
    return words.slice(0, 3).join(' ').trim() || title.substring(0, 12);
}

function calculateFeedScore(margin, hasDrop, hasBulk, price) {
    var s = 15;
    s += Math.min(40, Math.max(0, margin * 1.2));
    if (hasDrop && hasBulk) s += 30; else if (hasDrop) s += 22; else if (hasBulk) s += 18; else s += 5;
    if (price >= 10000 && price <= 50000) s += 15; else if (price >= 5000 && price <= 100000) s += 10; else s += 3;
    return Math.min(100, Math.round(s));
}

function getSeasonalQueries(month) {
    if (month >= 3 && month <= 5) return [{ query: '봄나들이용품', category: '시즌' }, { query: '자외선차단', category: '뷰티' }];
    if (month >= 6 && month <= 8) return [{ query: '냉감용품', category: '시즌' }, { query: '물놀이장난감', category: '레저' }];
    if (month >= 9 && month <= 11) return [{ query: '가을캠핑', category: '시즌' }, { query: '가습기', category: '가전' }];
    return [{ query: '방한용품', category: '시즌' }, { query: '크리스마스선물', category: '기타' }];
}

// 자동 로드
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        var g = document.getElementById('sourcing-feed-grid');
        if (g && window._sourcingFeedCache.length === 0) loadSourcingFeed();
    }, 2000);
});

console.log('📰 [sourcing-feed.js v4] 멀티엔진 로드 완료 (카테고리탐색 + 도매 + 데이터랩 + 쿠팡)');

// ★ 듀얼 트랙 카드 CSS 주입
(function() {
    var style = document.createElement('style');
    style.textContent = ''
        + '.fcc-dual { display:flex; gap:4px; margin-top:4px; }'
        + '.fcc-track { flex:1; padding:4px 6px; border-radius:6px; text-align:center; }'
        + '.fcc-track-drop { background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); }'
        + '.fcc-track-bulk { background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); }'
        + '.fcc-track-label { font-size:9px; font-weight:700; margin-bottom:2px; color:#94a3b8; }'
        + '.fcc-track-price { font-size:11px; font-weight:800; color:var(--text); }'
        + '.fcc-track-margin { font-size:9px; font-weight:600; }'
        + '.fcc-retail { font-size:10px; color:#94a3b8; margin:2px 0; }'
        + '.sourcing-mode-tabs { display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap; }'
        + '.smt-btn { padding:5px 10px; border-radius:6px; border:1px solid var(--border); background:var(--surface2); color:var(--text-muted); font-size:11px; font-weight:600; cursor:pointer; transition:all 0.2s; }'
        + '.smt-btn:hover { background:var(--surface3); color:var(--text); }'
        + '.smt-btn.active { background:var(--accent); color:#0d0f14; font-weight:800; border-color:var(--accent); }';
    document.head.appendChild(style);
})();
