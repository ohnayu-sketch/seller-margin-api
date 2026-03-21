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
    console.log('📰 [B] 도매→네이버 수집 시작');
    var wsSearches = [
        { market: 'dome', keyword: '인기', label: '도매꾹 인기' },
        { market: 'dome', keyword: '신상품', label: '도매꾹 신상' },
        { market: 'domeme', keyword: '인기', label: '도매매 인기' },
        { market: 'domeme', keyword: '신상품', label: '도매매 신상' },
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
            var img = it.imageUrl || it.image || it.mainImageUrl || '';
            if (!title || wsPrice === 0) return;

            wsCandidates.push({
                keyword: extractFeedKeyword(title),
                title: title, image: img,
                link: it.url || it.link || '',
                wholesalePrice: wsPrice,
                source: s.market === 'dome' ? 'bulk' : 'drop',
                engine: 'B', feedType: 'bestseller'
            });
        });
    });

    var kwMap = {};
    wsCandidates.forEach(function(c) { if (!kwMap[c.keyword]) kwMap[c.keyword] = c; });
    var unique = Object.values(kwMap).slice(0, 15);

    var naverChecks = await Promise.allSettled(unique.map(function(c) {
        return window.fetchGas('naverProxy', { type: 'search-shop', query: c.keyword, display: 3 })
            .then(function(r) { return { c: c, r: r }; })
            .catch(function() { return { c: c, r: null }; });
    }));

    var FEE_RATE = parseFloat(localStorage.getItem('marketFeeRate')) || 0.08;
    var feedItems = [];

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
        var score = calculateFeedScore(margin, c.source === 'drop', c.source === 'bulk', retailPrice);

        feedItems.push({
            keyword: c.keyword, title: c.title,
            image: naverImg || c.image, link: naverLink,
            retailPrice: retailPrice, wholesalePrice: c.wholesalePrice,
            dropPrice: c.source === 'drop' ? c.wholesalePrice : 0,
            bulkPrice: c.source === 'bulk' ? c.wholesalePrice : 0,
            margin: margin, score: score,
            feedType: feedType, category: '도매발굴',
            hasWholesale: true, engine: 'B',
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
    var wsResults = await Promise.allSettled(candidates.map(function(c) {
        return Promise.allSettled([
            window.fetchGas('domeggookProxy', { type: 'search', keyword: c.keyword, market: 'dome', size: 3 }).catch(function() { return null; }),
            window.fetchGas('domeggookProxy', { type: 'search', keyword: c.keyword, market: 'domeme', size: 3 }).catch(function() { return null; })
        ]).then(function(r) { return { c: c, dome: r[0], domeme: r[1] }; });
    }));

    var items = [];
    wsResults.forEach(function(r) {
        if (r.status !== 'fulfilled') return;
        var c = r.value.c;
        var bulkPrice = extractWsPrice(r.value.dome);
        var dropPrice = extractWsPrice(r.value.domeme);
        var costPrice = dropPrice > 0 ? dropPrice : (bulkPrice > 0 ? bulkPrice : Math.round(c.retailPrice * 0.5));
        var fee = Math.round(c.retailPrice * FEE_RATE);
        var margin = c.retailPrice > 0 ? Math.round((c.retailPrice - costPrice - 3000 - fee) / c.retailPrice * 100) : 0;
        var feedType = (margin >= 35 && (dropPrice > 0 || bulkPrice > 0)) ? 'blueocean' : c.feedType;

        items.push({
            keyword: c.keyword, title: c.title, image: c.image, link: c.link,
            retailPrice: c.retailPrice, wholesalePrice: costPrice,
            dropPrice: dropPrice, bulkPrice: bulkPrice,
            margin: margin, score: calculateFeedScore(margin, dropPrice > 0, bulkPrice > 0, c.retailPrice),
            feedType: feedType, category: c.category,
            hasWholesale: dropPrice > 0 || bulkPrice > 0, engine: c.engine,
            trendDelta: 0, timestamp: new Date().toISOString()
        });
    });
    return items;
}

function extractWsPrice(promiseResult) {
    if (!promiseResult || promiseResult.status !== 'fulfilled' || !promiseResult.value) return 0;
    var v = promiseResult.value;
    if (v.success === false) return 0;
    var items = v.data || v.items || [];
    if (!Array.isArray(items) || items.length === 0) return 0;
    return parseInt(items[0].price || items[0].unitPrice || 0);
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
        if (!kwMap[key] || item.score > kwMap[key].score) {
            if (kwMap[key] && kwMap[key].engine === 'B' && item.engine !== 'B' && item.score - kwMap[key].score < 10) return;
            kwMap[key] = item;
        }
    });
    var merged = Object.values(kwMap);
    merged.sort(function(a, b) { return b.score - a.score; });
    var counts = {};
    all.forEach(function(i) { counts[i.engine] = (counts[i.engine] || 0) + 1; });
    console.log('📰 [Feed] 엔진별: A=' + (counts.A||0) + ' B=' + (counts.B||0) + ' C=' + (counts.C||0) + ' → 최종 ' + merged.length + '개');
    return merged;
}

// =====================================================================
//  8. 페이지네이션 + 렌더링
// =====================================================================
function renderFeedPage(items, filter) {
    var filtered = filter === 'all' ? items : items.filter(function(i) { return i.feedType === filter; });
    var total = filtered.length;
    var perPage = window._feedPerPage;
    var page = window._feedPage;
    var totalPages = Math.ceil(total / perPage) || 1;
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * perPage;
    var pageItems = filtered.slice(start, start + perPage);

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
        var mColor = item.margin >= 30 ? '#4ade80' : (item.margin >= 15 ? '#fbbf24' : '#ef4444');
        var sGrad = item.score >= 70 ? '#10b981,#059669' : (item.score >= 50 ? '#f59e0b,#d97706' : '#6366f1,#4f46e5');
        var tagCls = item.feedType || 'trending';
        var tags = { trending:'🔥', blueocean:'💎', seasonal:'🌦️', bestseller:'🏆' };
        var tag = tags[tagCls] || '📦';
        var srcBadge = item.hasWholesale ? (item.dropPrice > 0 ? '🟢위탁' : '📦사입') : '추정';
        var srcColor = item.hasWholesale ? 'rgba(74,222,128,0.2)' : 'rgba(148,163,184,0.15)';
        var engineTag = {A:'📊', B:'🏪', C:'📈'}[item.engine] || '🔍';
        var profit = Math.max(0, item.retailPrice - item.wholesalePrice - 3000 - Math.round(item.retailPrice * 0.08));
        var safeKw = item.keyword.replace(/'/g, "\\'");
        var cpBadge = '';
        if (item.coupangReviews > 0) {
            cpBadge = '<span class="fcc-tag" style="background:rgba(168,85,247,0.12);color:#a855f7;">🛒' + item.coupangReviews + '리뷰</span>';
        }

        return '<div class="feed-card-compact" onclick="feedCardClick(\'' + safeKw + '\')">' +
            '<div class="fcc-img-wrap">' +
                '<img src="' + item.image + '" onerror="this.src=\'https://placehold.co/120x120?text=' + encodeURIComponent(item.keyword.substring(0,4)) + '\'" alt="">' +
                '<span class="fcc-score" style="background:linear-gradient(135deg,' + sGrad + ');">' + item.score + '</span>' +
            '</div>' +
            '<div class="fcc-body">' +
                '<div class="fcc-kw">' + item.keyword + '</div>' +
                '<div class="fcc-tags">' +
                    '<span class="fcc-tag ' + tagCls + '">' + tag + '</span>' +
                    '<span class="fcc-tag" style="background:' + srcColor + ';color:' + (item.hasWholesale ? '#4ade80' : '#94a3b8') + ';">' + srcBadge + '</span>' +
                    '<span class="fcc-tag" style="background:rgba(100,116,139,0.1);color:#94a3b8;">' + engineTag + ' ' + item.category + '</span>' +
                    cpBadge +
                '</div>' +
                '<div class="fcc-prices">' +
                    '<div><span class="fcc-label">시장</span><span class="fcc-val">₩' + item.retailPrice.toLocaleString() + '</span></div>' +
                    '<div><span class="fcc-label">도매</span><span class="fcc-val" style="color:#60a5fa;">₩' + item.wholesalePrice.toLocaleString() + '</span></div>' +
                    '<div><span class="fcc-label">마진</span><span class="fcc-val" style="color:' + mColor + ';">' + item.margin + '%</span></div>' +
                    '<div><span class="fcc-label">이익</span><span class="fcc-val" style="color:' + mColor + ';">₩' + profit.toLocaleString() + '</span></div>' +
                '</div>' +
                '<div class="fcc-actions">' +
                    '<button onclick="event.stopPropagation();feedSearchKeyword(\'' + safeKw + '\');">🔍</button>' +
                    '<button onclick="event.stopPropagation();window.open(\'' + (item.link || '#') + '\',\'_blank\');" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;">🔗</button>' +
                '</div>' +
            '</div>' +
        '</div>';
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
    var input = document.getElementById('v5-search-input');
    if (input) { input.value = keyword; input.dispatchEvent(new Event('input')); }
    var searchPanel = document.querySelector('.search-box-v5');
    if (searchPanel) searchPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof runIntegratedV5Search === 'function') setTimeout(function() { runIntegratedV5Search(); }, 300);
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
