/**
 * T1 트렌드 피드 — 소싱 추천 상품 카드 피드
 * 파일: js/t1-feed.js
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js, ui-components.js
 *
 * 기능:
 *  1. 첫 화면: 트렌드 피드 (도매 비교 + 마진 분석 완료된 상품 카드)
 *  2. 검색 시: 피드 → 검색 결과로 전환
 *  3. 좌측 패널: 급상승 키워드 TOP 20, 소싱 추천 카테고리 TOP 20
 *  4. 페이지네이션
 *  5. 필터/정렬
 *  6. Gemini 이미지 매칭 일치도 표시
 *  7. 담기 → confirmSourcing (T2로)
 *  8. 도매 비교 아이콘 → 도매처별 가격 모달
 */

const T1Feed = {
    items: [],              // 전체 피드 상품 배열
    filteredItems: [],      // 필터 적용된 상품
    currentPage: 1,
    itemsPerPage: 12,       // PC: 12, 모바일: 8
    totalPages: 1,
    filter: 'ALL',          // ALL / 소싱추천 / 지켜보기 / 급상승 / 고마진
    sortBy: 'margin_desc',  // margin_desc / trend_desc / search_desc / price_asc
    isSearchMode: false,
    searchKeyword: '',
    trendingKeywords: [],   // 급상승 키워드 TOP 20
    trendingCategories: [], // 소싱 추천 카테고리 TOP 20
    loading: false,
};

// ═══════════════════════════════════════
// 초기화
// ═══════════════════════════════════════

async function t1FeedInit() {
    // 반응형: PC는 12개, 모바일은 8개
    T1Feed.itemsPerPage = window.innerWidth > 768 ? 12 : 8;

    // KPI 바 렌더링 (데이터 로드 후 갱신)
    t1FeedRenderKPI({ total: '-', go: '-', avgMargin: '-', priceAlert: '-' });

    // 좌측 패널: 급상승 키워드 + 카테고리 로드
    t1FeedLoadRankings();

    // 트렌드 피드 로드
    await t1FeedLoadFeed();

    // 검색바 이벤트
    const searchInput = document.getElementById('t1-feed-search');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') t1FeedSearch();
        });
    }
}

// ═══════════════════════════════════════
// KPI 바
// ═══════════════════════════════════════

function t1FeedRenderKPI(data) {
    renderKPIBar('t1-feed-kpi', [
        { value: data.total, label: '등록상품', color: 'var(--text)' },
        { value: data.go, label: '소싱추천', color: '#10b981' },
        { value: data.avgMargin, label: '평균마진', color: 'var(--text)' },
        { value: data.priceAlert, label: '가격변동', color: data.priceAlert > 0 ? '#ef4444' : '#10b981' },
    ]);
}

// ═══════════════════════════════════════
// 좌측 패널 순위 로드
// ═══════════════════════════════════════

async function t1FeedLoadRankings() {
    // 급상승 키워드 TOP 20
    try {
        const kwResult = await fetchGas('getTrendingKeywords', { limit: 20 });
        if (kwResult?.keywords?.length) {
            T1Feed.trendingKeywords = kwResult.keywords;
        }
    } catch (e) {
        console.warn('[T1Feed] 급상승 키워드 로드 실패');
    }
    t1FeedRenderKeywordRanking();

    // 소싱 추천 카테고리 TOP 20
    try {
        const catResult = await fetchGas('getTrendingCategories', { limit: 20 });
        if (catResult?.categories?.length) {
            T1Feed.trendingCategories = catResult.categories;
        }
    } catch (e) {
        console.warn('[T1Feed] 카테고리 순위 로드 실패');
    }
    t1FeedRenderCategoryRanking();
}

function t1FeedRenderKeywordRanking() {
    const el = document.getElementById('t1-feed-kw-list');
    if (!el) return;

    if (!T1Feed.trendingKeywords.length) {
        el.innerHTML = '<div style="font-size:10px;color:#475569;padding:8px">데이터 로딩 중...</div>';
        return;
    }

    el.innerHTML = T1Feed.trendingKeywords.map((kw, i) => `
        <div class="rank-item" onclick="t1FeedClickKeyword('${escapeHtml(kw.keyword).replace(/'/g, "\\'")}')">
            <span class="rank-num ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="rank-name">${escapeHtml(kw.keyword)}</span>
            <span class="rank-val">${kw.change > 0 ? '+' : ''}${kw.change}%</span>
        </div>
    `).join('');
}

function t1FeedRenderCategoryRanking() {
    const el = document.getElementById('t1-feed-cat-list');
    if (!el) return;

    if (!T1Feed.trendingCategories.length) {
        el.innerHTML = '<div style="font-size:10px;color:#475569;padding:8px">데이터 로딩 중...</div>';
        return;
    }

    el.innerHTML = T1Feed.trendingCategories.map((cat, i) => `
        <div class="rank-item" onclick="t1FeedClickCategory('${escapeHtml(cat.name).replace(/'/g, "\\'")}')">
            <span class="rank-num ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="rank-name">${escapeHtml(cat.name)}</span>
            <span class="rank-sub">마진 ${cat.avgMargin}%</span>
        </div>
    `).join('');
}

// 키워드/카테고리 클릭 → 검색 실행
function t1FeedClickKeyword(keyword) {
    const input = document.getElementById('t1-feed-search');
    if (input) input.value = keyword;
    t1FeedSearch();
}

function t1FeedClickCategory(catName) {
    const input = document.getElementById('t1-feed-search');
    if (input) input.value = catName;
    t1FeedSearch();
}

// ═══════════════════════════════════════
// 트렌드 피드 로드
// ═══════════════════════════════════════

async function t1FeedLoadFeed() {
    if (T1Feed.loading) return;
    T1Feed.loading = true;
    T1Feed.isSearchMode = false;

    const grid = document.getElementById('t1-feed-grid');
    if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-size:12px">상품 피드 로딩 중...</div>';

    try {
        const result = await fetchGas('getTrendFeed', {
            page: T1Feed.currentPage,
            limit: T1Feed.itemsPerPage,
            filter: T1Feed.filter,
            sort: T1Feed.sortBy,
        });

        if (result?.items?.length) {
            T1Feed.items = result.items;
            T1Feed.totalPages = result.totalPages || Math.ceil((result.totalCount || result.items.length) / T1Feed.itemsPerPage);

            // KPI 갱신
            t1FeedRenderKPI({
                total: result.totalCount || result.items.length,
                go: result.goCount || result.items.filter(i => i.signal === '소싱추천').length,
                avgMargin: (result.avgMargin || 0) + '%',
                priceAlert: result.priceAlertCount || 0,
            });
        } else {
            T1Feed.items = [];
            T1Feed.totalPages = 1;
        }
    } catch (e) {
        console.error('[T1Feed] 피드 로드 오류:', e);
        T1Feed.items = [];
        showToast('피드 로드 실패: ' + e.message, false);
    }

    T1Feed.loading = false;
    t1FeedApplyFilter();
}

// ═══════════════════════════════════════
// 검색
// ═══════════════════════════════════════

async function t1FeedSearch() {
    const input = document.getElementById('t1-feed-search');
    const keyword = (input?.value || '').trim();
    if (!keyword) {
        // 빈 검색 → 트렌드 피드로 복귀
        T1Feed.isSearchMode = false;
        T1Feed.currentPage = 1;
        await t1FeedLoadFeed();
        return;
    }

    T1Feed.isSearchMode = true;
    T1Feed.searchKeyword = keyword;
    T1Feed.currentPage = 1;
    T1Feed.loading = true;

    const grid = document.getElementById('t1-feed-grid');
    if (grid) grid.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;font-size:12px">"${escapeHtml(keyword)}" 검색 중...</div>`;

    try {
        // 기존 t1SingleSearch 로직을 피드 형태로 실행
        const result = await fetchGas('searchProductFeed', {
            query: keyword,
            page: T1Feed.currentPage,
            limit: T1Feed.itemsPerPage,
        });

        if (result?.items?.length) {
            T1Feed.items = result.items;
            T1Feed.totalPages = result.totalPages || 1;
        } else {
            T1Feed.items = [];
            T1Feed.totalPages = 1;
        }
    } catch (e) {
        console.error('[T1Feed] 검색 오류:', e);
        T1Feed.items = [];
    }

    T1Feed.loading = false;
    t1FeedApplyFilter();
}

// ═══════════════════════════════════════
// 필터/정렬
// ═══════════════════════════════════════

function t1FeedSetFilter(filter, btn) {
    T1Feed.filter = filter;
    T1Feed.currentPage = 1;

    document.querySelectorAll('.feed-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (T1Feed.isSearchMode) {
        t1FeedApplyFilter();
    } else {
        t1FeedLoadFeed();
    }
}

function t1FeedSetSort(value) {
    T1Feed.sortBy = value;
    T1Feed.currentPage = 1;

    if (T1Feed.isSearchMode) {
        t1FeedApplyFilter();
    } else {
        t1FeedLoadFeed();
    }
}

function t1FeedApplyFilter() {
    let items = [...T1Feed.items];

    // 필터
    if (T1Feed.filter === '소싱추천') items = items.filter(i => i.signal === '소싱추천');
    else if (T1Feed.filter === '지켜보기') items = items.filter(i => i.signal === '지켜보기');
    else if (T1Feed.filter === '급상승') items = items.filter(i => (i.searchChange || 0) > 20);
    else if (T1Feed.filter === '고마진') items = items.filter(i => (i.margin || 0) >= 30);

    // 정렬
    switch (T1Feed.sortBy) {
        case 'margin_desc': items.sort((a, b) => (b.margin || 0) - (a.margin || 0)); break;
        case 'trend_desc': items.sort((a, b) => (b.searchChange || 0) - (a.searchChange || 0)); break;
        case 'search_desc': items.sort((a, b) => (b.monthlySearch || 0) - (a.monthlySearch || 0)); break;
        case 'price_asc': items.sort((a, b) => (a.wholesalePrice || 0) - (b.wholesalePrice || 0)); break;
    }

    T1Feed.filteredItems = items;
    t1FeedRenderGrid();
    t1FeedRenderPagination();
}

// ═══════════════════════════════════════
// 그리드 렌더링
// ═══════════════════════════════════════

function t1FeedRenderGrid() {
    const grid = document.getElementById('t1-feed-grid');
    if (!grid) return;

    if (!T1Feed.filteredItems.length) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-size:12px">표시할 상품이 없습니다</div>';
        return;
    }

    grid.innerHTML = T1Feed.filteredItems.map(item => t1FeedRenderCard(item)).join('');
}

function t1FeedRenderCard(item) {
    // 신호 뱃지
    const signalClass = item.signal === '소싱추천' ? 'pc-badge-go'
        : item.signal === '지켜보기' ? 'pc-badge-watch' : 'pc-badge-skip';

    // 마진 색상
    const marginClass = (item.margin || 0) >= 25 ? 'pc-mg-g'
        : (item.margin || 0) >= 15 ? 'pc-mg-y' : 'pc-mg-r';

    // 일치도
    const matchLevel = item.matchLevel || 'unknown';
    const marginPrefix = matchLevel === 'medium' ? '추정 ' : matchLevel === 'low' ? '' : '';
    const matchBadge = matchLevel === 'high' ? '<span class="pc-match pc-match-high">일치 높음</span>'
        : matchLevel === 'medium' ? '<span class="pc-match pc-match-medium">추정</span>'
        : matchLevel === 'low' ? '<span class="pc-match pc-match-low">직접확인</span>' : '';

    // 트렌드 뱃지
    const trendBadge = (item.searchChange || 0) > 0
        ? `<div class="pc-trend">검색 +${item.searchChange}%</div>` : '';

    // 도매가 링크
    const wsLink = item.wholesaleUrl
        ? `<a class="pc-ws" href="${item.wholesaleUrl}" target="_blank" title="${escapeHtml(item.wholesaleSource || '')} 상품 페이지">${fmt(item.wholesalePrice)}원</a>`
        : `<span style="color:#f59e0b;font-weight:700">${fmt(item.wholesalePrice)}원</span>`;

    // 담기 버튼 스타일 (지켜보기/비추천은 muted)
    const addBtnClass = item.signal === '소싱추천' ? 'pc-btn-add' : 'pc-btn-add muted';

    // 이미지
    const imgHtml = item.image
        ? `<img src="${item.image}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('beforeend','<span>이미지 없음</span>')">`
        : '이미지 없음';

    const itemJson = JSON.stringify({
        title: item.name,
        _wsPrice: item.wholesalePrice,
        lprice: item.retailPrice || item.avgPrice,
        image: item.image,
        keyword: item.keyword || item.name,
        wholesaleUrl: item.wholesaleUrl || '',
        wholesaleSource: item.wholesaleSource || '',
    }).replace(/"/g, '&quot;');

    return `<div class="pc">
        <div class="pc-img">
            <div class="pc-badge ${signalClass}">${item.signal || ''}</div>
            ${trendBadge}
            ${imgHtml}
        </div>
        <div class="pc-body">
            <div class="pc-name">${escapeHtml(item.name || '')}</div>
            <table class="pc-table">
                <tr><td class="pc-lb">도매가</td><td class="pc-vl">${wsLink}<span class="pc-src">${escapeHtml(item.wholesaleSource || '')}</span></td></tr>
                <tr><td class="pc-lb">시중가</td><td class="pc-vl">${fmt(item.retailPrice || item.avgPrice || 0)}원</td></tr>
                <tr class="pc-divider"><td colspan="2"><div></div></td></tr>
                <tr><td class="pc-lb">마진율</td><td class="pc-vl"><span class="pc-mg ${marginClass}">${marginPrefix}${item.margin || 0}%</span></td></tr>
                <tr><td class="pc-lb">최적마켓</td><td class="pc-vl">${escapeHtml(item.bestMarket || '')}</td></tr>
                <tr><td class="pc-lb">월검색</td><td class="pc-vl pc-sub">${fmt(item.monthlySearch || 0)}회</td></tr>
                ${matchBadge ? `<tr><td class="pc-lb">일치도</td><td class="pc-vl">${matchBadge}</td></tr>` : ''}
            </table>
            <div class="pc-actions">
                <button class="${addBtnClass}" onclick="event.stopPropagation();confirmSourcing(${itemJson})">
                    <svg viewBox="0 0 20 20"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>담기
                </button>
                <div class="pc-icon-btns">
                    <div class="pc-icon-btn" onclick="event.stopPropagation();t1FeedShowWholesaleCompare('${escapeHtml(item.name).replace(/'/g, "\\'")}')" title="도매 비교">
                        <svg viewBox="0 0 20 20"><rect x="2" y="6" width="7" height="11" rx="1"/><rect x="11" y="3" width="7" height="14" rx="1"/></svg>
                        <span class="tip">도매 비교</span>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// ═══════════════════════════════════════
// 페이지네이션
// ═══════════════════════════════════════

function t1FeedRenderPagination() {
    const el = document.getElementById('t1-feed-pagination');
    if (!el) return;

    if (T1Feed.totalPages <= 1) {
        el.innerHTML = '';
        return;
    }

    const p = T1Feed.currentPage;
    const total = T1Feed.totalPages;
    let pages = [];

    // 항상 표시: 1, 현재, 마지막
    pages.push(1);
    for (let i = Math.max(2, p - 1); i <= Math.min(total - 1, p + 1); i++) pages.push(i);
    pages.push(total);
    pages = [...new Set(pages)].sort((a, b) => a - b);

    let html = `<div class="pg-btn" onclick="t1FeedGoPage(${p - 1})" ${p <= 1 ? 'style="opacity:.3;pointer-events:none"' : ''}>◀</div>`;

    let lastPage = 0;
    pages.forEach(pg => {
        if (pg - lastPage > 1) html += `<div class="pg-btn" style="pointer-events:none;color:#475569">...</div>`;
        html += `<div class="pg-btn ${pg === p ? 'active' : ''}" onclick="t1FeedGoPage(${pg})">${pg}</div>`;
        lastPage = pg;
    });

    html += `<div class="pg-btn" onclick="t1FeedGoPage(${p + 1})" ${p >= total ? 'style="opacity:.3;pointer-events:none"' : ''}>▶</div>`;

    el.innerHTML = html;
}

function t1FeedGoPage(page) {
    if (page < 1 || page > T1Feed.totalPages) return;
    T1Feed.currentPage = page;

    if (T1Feed.isSearchMode) {
        t1FeedSearch();
    } else {
        t1FeedLoadFeed();
    }

    // 스크롤 상단으로
    const main = document.querySelector('.right-main') || document.getElementById('page-sourcing');
    if (main) main.scrollTop = 0;
}

// ═══════════════════════════════════════
// 도매 비교 모달
// ═══════════════════════════════════════

async function t1FeedShowWholesaleCompare(productName) {
    showToast(`"${productName}" 도매처 비교 조회 중...`);

    try {
        const sites = WholesaleSiteManager.getEnabledApiSites();
        if (!sites.length) {
            showToast('연결된 도매사이트가 없습니다. T7 설정에서 API 키를 등록하세요.');
            return;
        }

        const results = [];
        for (const site of sites) {
            try {
                const action = site.id === 'domeggook' ? 'domeggookProxy' : site.id + 'Proxy';
                const res = await fetchGas(action, { query: productName });
                if (res?.items?.length) {
                    res.items.slice(0, 3).forEach(item => {
                        results.push({
                            source: site.name,
                            name: item.name || item.상품명 || '',
                            price: parseInt(item.price || item.도매가 || 0),
                            link: item.link || item.url || '',
                            image: item.image || '',
                        });
                    });
                }
            } catch (e) { /* 개별 실패 무시 */ }
        }

        results.sort((a, b) => a.price - b.price);

        // 간단한 toast 대신 모달로 보여주기
        let msg = results.slice(0, 6).map(r =>
            `${r.source}: ${fmt(r.price)}원`
        ).join(' | ');

        showToast(`도매 비교: ${msg}`);

    } catch (e) {
        showToast('도매 비교 실패: ' + e.message, false);
    }
}

// ═══════════════════════════════════════
// 초기화 실행
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', t1FeedInit);

// 전역 노출
window.T1Feed = T1Feed;
window.t1FeedInit = t1FeedInit;
window.t1FeedSearch = t1FeedSearch;
window.t1FeedSetFilter = t1FeedSetFilter;
window.t1FeedSetSort = t1FeedSetSort;
window.t1FeedGoPage = t1FeedGoPage;
window.t1FeedClickKeyword = t1FeedClickKeyword;
window.t1FeedClickCategory = t1FeedClickCategory;
window.t1FeedShowWholesaleCompare = t1FeedShowWholesaleCompare;
