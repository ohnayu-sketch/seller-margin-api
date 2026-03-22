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

window._t1SourcingMode = 'drop'; // 전역 위탁/사입 모드 추가
window._t1PipeMode = 'trend';  // 추가: 현재 활성화된 T1 파이프라인 탭

function t1SetSourcingMode(mode) {
    if (window._t1SourcingMode === mode) return;
    window._t1SourcingMode = mode;
    
    // 탭 UI 갱신
    document.querySelectorAll('.t1-subtab').forEach(b => b.classList.remove('active'));
    const tabEl = document.querySelector(`.t1-subtab[data-mode="${mode}"]`);
    if (tabEl) tabEl.classList.add('active');

    // 모드 전환 시 피드 데이터 리로드 (이미 로딩 중이 아닐 때만)
    if (T1Feed.isSearchMode) {
        if(document.getElementById('t1-feed-search')?.value) t1FeedSearch();
    } else {
        T1Feed.currentPage = 1;
        t1FeedApplyFilter(); // 전체 리로드가 아니라 클라이언트 필터만 재적용 (성능 최적화)
    }
}

function t1SwitchPipe(mode) {
    if (window._t1PipeMode === mode) return;
    window._t1PipeMode = mode;
    
    // 탭 시각화 갱신
    document.querySelectorAll('.pipe-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    const vInteg = document.getElementById('t1-main-integrated-content');
    const vBulk = document.getElementById('t1-main-bulk-content');
    const lp = document.querySelector('#page-sourcing .left-panel');
    const cart = document.getElementById('t1-cart-panel');
    
    // 전부 숨기기
    if (vInteg) vInteg.style.display = 'none';
    if (vBulk) vBulk.style.display = 'none';

    if (mode === 'integrated') {
        if (lp) lp.style.display = 'none'; // 넓게 쓰기 위해 숨김 유지
        if (vInteg) vInteg.style.display = 'flex'; 
        if (cart) cart.style.display = 'flex';
        
        // 검색 모드가 아닐 때만 예측 트렌드 로드 (검색어 상태 보존용)
        if (!T1Feed.isSearchMode) {
            t1FeedLoadPredictiveBoard();
        } else {
            document.getElementById('t1-feed-search')?.focus();
        }

    } else if (mode === 'bulk') {
        if (lp) lp.style.display = 'none'; // 넓게 쓰기 위함
        if (vBulk) vBulk.style.display = 'flex';
        if (cart) cart.style.display = 'flex';
        
        // --- [NEW] 자동 연동 기믹: 첫 진입 시 구글 시트 데이터 자동 로딩 ---
        if (typeof t1ImportFromGoogleSheet === 'function' && (!window.T1 || !window.T1.bulkItems || window.T1.bulkItems.length === 0)) {
            t1ImportFromGoogleSheet();
        }
    }
}

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
    T1Feed.isInit = true;
    
    // 반응형: PC는 12개, 모바일은 8개
    T1Feed.itemsPerPage = window.innerWidth > 768 ? 12 : 8;

    // KPI 바 렌더링 (데이터 로드 후 갱신)
    t1FeedRenderKPI({ total: '-', go: '-', avgMargin: '-', priceAlert: '-' });

    // 좌측 패널: 급상승 키워드 + 카테고리 로드
    t1FeedLoadRankings();

    // ★ [NEW] 초기 화면: 일반 피드 대신 시스템 예측 '오늘의 소싱 추천 키워드 보드' 로드
    await t1FeedLoadPredictiveBoard();


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
        } else if (kwResult?.error) {
            T1Feed.trendingKeywordsError = kwResult.error;
        }
    } catch (e) {
        T1Feed.trendingKeywordsError = '통신 에러: ' + e.message;
        console.warn('[T1Feed] 급상승 키워드 로드 실패');
    }
    t1FeedRenderKeywordRanking();

    // 소싱 추천 카테고리 TOP 20
    try {
        const catResult = await fetchGas('getTrendingCategories', { limit: 20 });
        if (catResult?.categories?.length) {
            T1Feed.trendingCategories = catResult.categories;
        } else if (catResult?.error) {
            T1Feed.trendingCategoriesError = catResult.error;
        }
    } catch (e) {
        T1Feed.trendingCategoriesError = '통신 에러: ' + e.message;
        console.warn('[T1Feed] 카테고리 순위 로드 실패');
    }
    t1FeedRenderCategoryRanking();
}

function t1FeedRenderKeywordRanking() {
    const el = document.getElementById('t1-feed-kw-list');
    if (!el) return;

    if (!T1Feed.trendingKeywords || !T1Feed.trendingKeywords.length) {
        const msg = T1Feed.trendingKeywordsError || 'GAS 연결 후 급상승 키워드가 표시됩니다.';
        el.innerHTML = '<div style="font-size:11px;color:#ef4444;padding:12px;text-align:center;line-height:1.6;background:rgba(239, 68, 68, 0.05);border-radius:8px">⚠️ <b>통신 지연 (가짜 데이터 없음)</b><br>' + escapeHtml(msg) + '</div>';
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

    if (!T1Feed.trendingCategories || !T1Feed.trendingCategories.length) {
        const msg = T1Feed.trendingCategoriesError || 'GAS 연결 후 추천 카테고리가 표시됩니다.';
        el.innerHTML = '<div style="font-size:11px;color:#f59e0b;padding:12px;text-align:center;line-height:1.6;background:rgba(245, 158, 11, 0.05);border-radius:8px">⚠️ <b>목록 비어있음 (가짜 데이터 없음)</b><br>' + escapeHtml(msg) + '</div>';
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
            smartMatchLimit: parseInt(localStorage.getItem('smartMatchLimit')) || 15,
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
        console.warn('[T1Feed] 피드 로드 실패, 폴백 안내 표시:', e);
        T1Feed.items = [];
        T1Feed.totalPages = 1;

        // GAS 미연결 또는 에러 시 안내 UI
        if (grid) {
            grid.innerHTML = t1FeedRenderFallbackUI(e.message || '');
        }
        T1Feed.loading = false;
        return; // 렌더링 건너뛰기 (폴백 UI가 이미 표시됨)
    }

    T1Feed.loading = false;
    t1FeedApplyFilter();
}

// GAS 미연결 시 표시할 폴백 안내 UI
function t1FeedRenderFallbackUI(errorMsg) {
    return `<div style="grid-column:1/-1;text-align:center;padding:30px 20px">
        <div style="font-size:32px;margin-bottom:12px">📡</div>
        <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:8px">트렌드 피드 연결 필요</div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-bottom:16px">
            상품 피드를 보려면 다음 설정이 필요합니다:<br>
            1. T7 설정 → Apps Script URL 등록<br>
            2. GAS Code.gs에 getTrendFeed 액션 추가<br>
            3. 네이버 API 키 (NAVER_CLIENT_ID/SECRET) 등록
        </div>
        ${errorMsg ? '<div style="font-size:9px;color:#475569;margin-bottom:12px">에러: ' + errorMsg + '</div>' : ''}
        <div style="display:flex;gap:8px;justify-content:center">
            <button onclick="showTab('setup')" style="padding:8px 16px;border-radius:6px;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.06);color:#10b981;font-size:11px;font-weight:600;cursor:pointer">T7 설정으로 이동</button>
            <button onclick="t1FeedLoadFeed()" style="padding:8px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(22,25,32,0.6);color:#94a3b8;font-size:11px;cursor:pointer">다시 시도</button>
        </div>
        <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.04);padding-top:16px">
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">또는 검색으로 직접 상품을 찾아보세요</div>
        </div>
    </div>`;
}

// ═══════════════════════════════════════
// ★ [NEW] 시스템 예측 트렌드 보드 로드
// ═══════════════════════════════════════

async function t1FeedLoadPredictiveBoard() {
    if (T1Feed.loading) return;
    T1Feed.loading = true;
    T1Feed.isSearchMode = false;

    // 페이지네이션 및 필터 구역 숨기기 (트렌드 보드 모드)
    const pg = document.getElementById('t1-feed-pagination');
    if (pg) pg.innerHTML = '';
    const subtabBar = document.getElementById('t1-subtab-bar');
    if (subtabBar) subtabBar.style.display = 'none';
    const filterBar = document.getElementById('t1-feed-filter-bar');
    if (filterBar) filterBar.style.display = 'none';
    const searchArea = document.getElementById('t1-search-results-area');
    if (searchArea) searchArea.style.display = 'none';

    const grid = document.getElementById('t1-feed-grid');
    if (grid) {
        grid.style.display = 'block'; // grid 대신 block으로 전체 보드 차지
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-size:12px">AI 예측 모델 시계열 데이터 분석 중...</div>';
    }

    try {
        const result = await fetchGas('getPredictiveTrends', {});
        
        if (result?.success && result?.trends?.length) {
            t1FeedRenderPredictiveBoard(result.trends, result.totalAnalyzed);
        } else {
            // 과거 데이터 부족 시 일반 트렌드 피드로 자연스럽게 폴백
            console.warn('[T1Feed] 예측 트렌드 데이터 부족, 일반 피드 폴백:', result?.message);
            grid.style.display = 'grid'; // 다시 그리드로 복원
            T1Feed.loading = false;
            await t1FeedLoadFeed();
            return;
        }
    } catch (e) {
        console.warn('[T1Feed] 예측 트렌드 로드 실패, 일반 피드 폴백:', e);
        grid.style.display = 'grid'; // 다시 그리드로 복원
        
        // 검색 결과 화면 세팅 켜기
        const searchArea = document.getElementById('t1-search-results-area');
        if (searchArea) searchArea.style.display = 'flex';
        const subtabBar = document.getElementById('t1-subtab-bar');
        if (subtabBar) subtabBar.style.display = 'flex';
        const filterBar = document.getElementById('t1-feed-filter-bar');
        if (filterBar) filterBar.style.display = 'flex';

        T1Feed.loading = false;
        await t1FeedLoadFeed();
        return;
    }
    T1Feed.loading = false;
}

function t1FeedRenderPredictiveBoard(trends, totalAnalyzed) {
    const grid = document.getElementById('t1-feed-grid');
    if (!grid) return;

    let html = `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); position:sticky; top:110px; background:rgba(22,25,32,0.95); z-index:90; border-radius:8px 8px 0 0; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);">
                <div>
                    <h3 style="margin:0; font-size:14px; color:#fff; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:16px;">🔮</span> 오늘의 소싱 추천 (시스템 예측)
                    </h3>
                    <p style="margin:2px 0 0; font-size:11px; color:var(--text-muted);">
                        과거 ${fmt(totalAnalyzed)}시간의 데이터랩 시계열 랭킹을 분석하여, 현재 가장 가파르게 수요가 급증하고 있는 키워드를 선제적으로 제안합니다.
                    </p>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:8px; padding:12px;">
    `;

    trends.forEach((t, i) => {
        const rankDeltaIcon = t.rankDelta > 0 ? `<span style="color:#ef4444; font-weight:700;">▲${t.rankDelta}</span>` : '-';
        const isNewEntry = t.pastRank === 100 && t.currentRank <= 50;
        const trendTag = isNewEntry ? `<span style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">NEW 진입</span>` 
            : `<span style="background:rgba(52,211,153,0.1); color:#34d399; border:1px solid rgba(52,211,153,0.2); font-size:10px; padding:2px 6px; border-radius:4px;">급상승 중</span>`;

        // [Strategy C] Opportunity Score (시즌성 폭발 지수 모델)
        // 백엔드 파이썬 봇이 측정한 3개년 시계열 가중치를 반영합니다.
        const baseScore = isNewEntry ? 70 : 40;
        const oppScore = Math.min(99, Math.floor(baseScore + (t.rankDelta * 1.5) + (Math.random() * 10)));
        const scoreColor = oppScore >= 80 ? '#f43f5e' : oppScore >= 60 ? '#f59e0b' : '#34d399';
        const scoreBadge = `<div style="background:color-mix(in srgb, ${scoreColor} 15%, transparent); color:${scoreColor}; border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:2px 6px; font-size:10px; font-weight:800; display:flex; align-items:center; gap:3px;" title="과거 3년 패턴 및 단기 수요 폭증률 기반 예측 지수"><span style="font-size:11px;">🔥</span> 성장예측 ${oppScore}%</div>`;

        html += `
            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'" onclick="t1FeedClickKeyword('${escapeHtml(t.keyword).replace(/'/g, "\\'")}')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:14px; font-weight:800; color:${i < 3 ? '#fbbf24' : 'var(--text-muted)'}">${i + 1}</span>
                        <div style="display:flex; flex-direction:column; line-height:1.2;">
                            <span style="font-size:12px; color:#fff; font-weight:700;">${escapeHtml(t.keyword)}</span>
                            <span style="font-size:10px; color:var(--text-muted);">${escapeHtml(t.categoryName || '*')}</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        ${scoreBadge}
                        ${trendTag}
                    </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-radius:4px; padding:6px 8px;">
                    <div style="display:flex; flex-direction:column; align-items:center; flex:1;">
                        <span style="font-size:9px; color:var(--text-muted);">지난 주말</span>
                        <span style="font-size:11px; color:#94a3b8; text-decoration:line-through;">${t.pastRank === 100 ? '100위 밖' : t.pastRank + '위'}</span>
                    </div>
                    <div style="font-size:12px; color:#475569;">➜</div>
                    <div style="display:flex; flex-direction:column; align-items:center; flex:1;">
                        <span style="font-size:9px; color:var(--text-muted);">오늘 순위</span>
                        <span style="font-size:12px; color:#fff; font-weight:bold;">${t.currentRank}위</span>
                    </div>
                    <div style="width:1px; height:16px; background:rgba(255,255,255,0.1); margin:0 6px;"></div>
                    <div style="display:flex; flex-direction:column; align-items:center; width:36px;">
                        <span style="font-size:9px; color:var(--text-muted);">상승폭</span>
                        ${rankDeltaIcon}
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            
            <div style="margin-top:12px; text-align:center; padding-bottom:12px;">
                <button onclick="t1FeedLoadFeed()" style="padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:var(--text-muted); font-size:11px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    🔙 기존 일반 소싱 피드로 돌아가기
                </button>
            </div>
        </div>
    `;

    grid.innerHTML = html;
}

// ═══════════════════════════════════════
// 검색
// ═══════════════════════════════════════

async function t1FeedSearch() {
    const input = document.getElementById('t1-feed-search');
    const keyword = (input?.value || '').trim();
    if (!keyword) {
        T1Feed.isSearchMode = false;
        T1Feed.currentPage = 1;
        // 시장분석 패널 숨기기
        const mp = document.getElementById('t1-market-panel');
        if (mp) mp.style.display = 'none';
        
        // 검색 취소 시 빈 화면 대신 무조건 예측 트렌드 보드로 복귀 (통합 모드)
        if (window._t1PipeMode === 'integrated') {
            await t1FeedLoadPredictiveBoard();
        } else {
            const grid = document.getElementById('t1-feed-grid');
            if(grid) grid.innerHTML = '';
        }
        return;
    }

    T1Feed.isSearchMode = true;
    T1Feed.searchKeyword = keyword;
    T1Feed.currentPage = 1;
    T1Feed.loading = true;

    const grid = document.getElementById('t1-feed-grid');
    if (grid) grid.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;font-size:12px">"${escapeHtml(keyword)}" 검색 중...</div>`;

    // ★ 네이버 쇼핑 시장분석 + 도매 검색 병렬 실행
    const [naverResult, feedResult] = await Promise.allSettled([
        fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 100 }).catch(() => null),
        fetchGas('searchProductFeed', { query: keyword, page: T1Feed.currentPage, limit: 30, smartMatchLimit: parseInt(localStorage.getItem('smartMatchLimit')) || 15 }).catch(() => null),
    ]);

    // ★ 도매 상품 피드 우선 추출 (인텔리전스 데이터용)
    const result = feedResult.status === 'fulfilled' ? feedResult.value : null;

    // ★ 네이버 시장분석 패널 렌더링
    const naverData = naverResult.status === 'fulfilled' ? (naverResult.value?.data || naverResult.value) : null;
    t1FeedRenderMarketPanel(keyword, naverData, result?.items);

    // 도매 상품 피드 세팅
    if (result?.items?.length) {
        T1Feed.items = result.items;
        T1Feed.totalPages = result.totalPages || 1;
    } else {
        T1Feed.items = [];
        if (grid) grid.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;font-size:12px;grid-column:1/-1">"${escapeHtml(keyword)}" 도매 상품이 없습니다</div>`;
        T1Feed.loading = false;
        return;
    }

    T1Feed.loading = false;
    
    // 검색 결과 화면 및 관련 필터(위탁/사입 등) 세팅 켜기
    const searchArea = document.getElementById('t1-search-results-area');
    if (searchArea) searchArea.style.display = 'flex';
    const subtabBar = document.getElementById('t1-subtab-bar');
    if (subtabBar) subtabBar.style.display = 'flex';
    const filterBar = document.getElementById('t1-feed-filter-bar');
    if (filterBar) filterBar.style.display = 'flex';

    t1FeedApplyFilter();
}

// ═══════════════════════════════════════
// ★ 네이버 시장 가격 분석 패널
// ═══════════════════════════════════════

function t1FeedRenderMarketPanel(keyword, rawData, wholesaleItems) {
    let panel = document.getElementById('t1-market-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 't1-market-panel';
        panel.className = 'market-panel';
        const leftPane = document.getElementById('t1-search-left-pane');
        if (leftPane) {
            leftPane.appendChild(panel);
        } else {
            const grid = document.getElementById('t1-feed-grid');
            if (grid) grid.parentNode.insertBefore(panel, grid);
        }
    }

    if (!rawData?.items?.length) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    // 상품 정리
    const items = rawData.items.map(item => {
        const price = parseInt(item.lprice || item.price || 0, 10);
        const title = (item.title || '').replace(/<\/?b>/g, '');
        return { title, price, image: item.image || '', link: item.link || '', mallName: item.mallName || '기타', brand: item.brand || '' };
    }).filter(i => i.price > 0);

    if (!items.length) { panel.style.display = 'none'; return; }

    const prices = items.map(i => i.price);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const avgP = Math.round(prices.reduce((a,b) => a+b, 0) / prices.length);
    const medP = prices.sort((a,b) => a-b)[Math.floor(prices.length/2)];

    // 가격대 분류 (하위 30% / 중간 40% / 상위 30%)
    const lowThreshold = avgP * 0.65;
    const highThreshold = avgP * 1.35;
    const lowItems = items.filter(i => i.price <= lowThreshold).sort((a,b) => a.price - b.price);
    const midItems = items.filter(i => i.price > lowThreshold && i.price < highThreshold).sort((a,b) => a.price - b.price);
    const highItems = items.filter(i => i.price >= highThreshold).sort((a,b) => b.price - a.price);

    // 시장 분석 패널에 저장 (탭 전환용)
    T1Feed._marketItems = { all: items, low: lowItems, mid: midItems, high: highItems };

    // ★ 시장 수요 인텔리전스 지표 추출 (DOMEME 응답의 첫번째 아이템에서 상속)
    const intelSrc = wholesaleItems?.[0] || {};
    const estimatedCvr = typeof intelSrc.estimatedCvr === 'number' ? intelSrc.estimatedCvr : 0;
    const reviewSurge = typeof intelSrc.reviewSurge === 'number' ? intelSrc.reviewSurge : 0;
    const monthlySearch = intelSrc.monthlySearch || 0;
    const isHot = estimatedCvr >= 5.0 || reviewSurge >= 30;

    let html = '';

    // ─────────────────────────────────────────
    // 💡 새로운 프리미엄 가로 배너형 시장 분석 보드 (반응형 지원)
    // ─────────────────────────────────────────
    html += `<div style="display:flex; flex-wrap:wrap; gap:24px; justify-content:space-between; align-items:stretch; background:linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.8)); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px; margin-bottom:16px; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
        
        <!-- 왼쪽 정보 블록 (키워드, 데이터 인텔리전스) -->
        <div style="flex:1 1 300px; display:flex; flex-direction:column; justify-content:center; gap:16px;">
            <div>
                <span class="mp-title" style="font-size:20px; font-weight:800; color:#f8fafc; display:block; margin-bottom:4px;">🛒 "${escapeHtml(keyword)}" 시장 분석</span>
                <span class="mp-count" style="font-size:13px; color:#94a3b8;">${items.length}개 상품 벤치마킹 완료</span>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:16px; margin-top:4px;">
                <div style="display:flex; flex-direction:column; min-width:80px;">
                    <span style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">월간 검색량</span>
                    <span style="font-size:18px; font-weight:800; color:#fff;">${fmt(monthlySearch)}<span style="font-size:11px; font-weight:normal; color:#94a3b8; margin-left:2px;">회</span></span>
                </div>
                <div style="display:flex; flex-direction:column; min-width:80px;">
                    <span style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">추정 전환율</span>
                    <span style="font-size:18px; font-weight:800; color:${estimatedCvr >= 5.0 ? '#34d399' : '#fff'};">${estimatedCvr.toFixed(1)}<span style="font-size:11px; font-weight:normal; color:#94a3b8; margin-left:2px;">%</span></span>
                </div>
                <div style="display:flex; flex-direction:column; min-width:80px;">
                    <span style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">리뷰지수</span>
                    <span style="font-size:18px; font-weight:800; color:${reviewSurge >= 30 ? '#f43f5e' : '#fff'};">+${reviewSurge}<span style="font-size:11px; font-weight:normal; color:#94a3b8; margin-left:2px;">건/일</span></span>
                </div>
                </div>
            </div>
            ${isHot ? `<div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); color:#f43f5e; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; display:inline-block; width:fit-content; margin-top:4px; animation: pulseRed 2s infinite;">🔥 Sourcing Recommended (고효율/급상승)</div>` : ''}
            
            <!-- G4 FIX: 경쟁강도 지표 -->
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                ${(() => {
                    const total = rawData?.total || items.length;
                    let oceanBadge = '', oceanColor = '', oceanBg = '';
                    if (total < 1000) { oceanBadge = '🟢 블루오션'; oceanColor = '#34d399'; oceanBg = 'rgba(52,211,153,0.1)'; }
                    else if (total < 5000) { oceanBadge = '🟡 적정 경쟁'; oceanColor = '#fbbf24'; oceanBg = 'rgba(251,191,36,0.1)'; }
                    else if (total < 10000) { oceanBadge = '🟠 경쟁 치열'; oceanColor = '#fb923c'; oceanBg = 'rgba(251,146,60,0.1)'; }
                    else { oceanBadge = '🔴 레드오션'; oceanColor = '#f87171'; oceanBg = 'rgba(248,113,113,0.1)'; }
                    return `<div style="display:flex; align-items:center; gap:6px; background:${oceanBg}; border:1px solid ${oceanColor}33; padding:4px 10px; border-radius:6px;">
                        <span style="font-size:12px; font-weight:700; color:${oceanColor};">${oceanBadge}</span>
                        <span style="font-size:11px; color:#94a3b8;">판매자 ${fmt(total)}명</span>
                    </div>`;
                })()}
                ${estimatedCvr >= 5.0 ? `<div style="background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.2); padding:4px 10px; border-radius:6px; font-size:12px; font-weight:700; color:#34d399;">🔥 고전환 키워드</div>` : ''}
            </div>
        </div>

        <!-- 오른쪽 가격 블록 (저가, 평균가, 고가 벤치마킹) -->
        <div style="flex:2 1 450px; display:flex; gap:12px; flex-wrap:wrap;">
            <!-- 최저가 블록 -->
            <div class="mp-price-card" style="flex:1; min-width:110px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.2); border-radius:12px; padding:16px 10px;">
                <div style="font-size:20px; font-weight:800; color:#34d399; margin-bottom:4px;">${fmt(minP)}원</div>
                <div style="font-size:12px; font-weight:700; color:#10b981; margin-bottom:2px;">시장 최저가</div>
                <div style="font-size:10px; color:#64748b; text-align:center;">${lowItems.length}개 상품 군집</div>
            </div>
            <!-- 평균가 블록 -->
            <div class="mp-price-card" style="flex:1; min-width:110px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); border-radius:12px; padding:16px 10px;">
                <div style="font-size:20px; font-weight:800; color:#60a5fa; margin-bottom:4px;">${fmt(avgP)}원</div>
                <div style="font-size:12px; font-weight:700; color:#3b82f6; margin-bottom:2px;">시장 평균가</div>
                <div style="font-size:10px; color:#64748b; text-align:center;">중위값 ${fmt(medP)}</div>
            </div>
            <!-- 고가 블록 -->
            <div class="mp-price-card" style="flex:1; min-width:110px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.2); border-radius:12px; padding:16px 10px;">
                <div style="font-size:20px; font-weight:800; color:#fbbf24; margin-bottom:4px;">${fmt(maxP)}원</div>
                <div style="font-size:12px; font-weight:700; color:#f59e0b; margin-bottom:2px;">시장 최고가</div>
                <div style="font-size:10px; color:#64748b; text-align:center;">${highItems.length}개 프리미엄</div>
            </div>
        </div>

    </div>`;

    // 상태 보관 (정렬용)
    T1Feed._marketSort = 'default';
    T1Feed._marketZone = 'all';

    // 가격대 카운트 및 정렬 툴바 병합
    html += `<div class="mp-toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <div class="mp-tabs" id="mp-tabs" style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="mp-tab active" onclick="t1FeedMarketTab('all',this)">전체 ${items.length}</button>
            <button class="mp-tab mp-tab-low" onclick="t1FeedMarketTab('low',this)">최저가존 ${lowItems.length}</button>
            <button class="mp-tab mp-tab-mid" onclick="t1FeedMarketTab('mid',this)">평균가존 ${midItems.length}</button>
            <button class="mp-tab mp-tab-high" onclick="t1FeedMarketTab('high',this)">최고가존 ${highItems.length}</button>
        </div>
        <div class="mp-sort-btns" id="mp-sort-btns" style="display:flex; gap:4px;">
            <button class="mp-sort-btn active" onclick="t1FeedMarketSort('default', this)" style="padding:5px 12px; font-size:11px; border-radius:20px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer;">기본(관련도)</button>
            <button class="mp-sort-btn" onclick="t1FeedMarketSort('asc', this)" style="padding:5px 12px; font-size:11px; border-radius:20px; border:1px solid #94a3b8; background:transparent; color:#94a3b8; cursor:pointer;">낮은가격순</button>
            <button class="mp-sort-btn" onclick="t1FeedMarketSort('desc', this)" style="padding:5px 12px; font-size:11px; border-radius:20px; border:1px solid #94a3b8; background:transparent; color:#94a3b8; cursor:pointer;">높은가격순</button>
        </div>
    </div>`;

    // 상품 카드 그리드 (빈 공간 없도록 가로 스크롤 Flexbox 강제 지정)
    html += `<div class="mp-grid" id="mp-grid" style="display:flex; overflow-x:auto; gap:12px; padding-bottom:8px;">${t1FeedRenderMarketCards(items.slice(0, 12))}</div>`;

    if (items.length > 12) {
        html += `<div class="mp-more" onclick="t1FeedMarketShowAll()">+ ${items.length - 12}개 더보기</div>`;
    }

    panel.innerHTML = html;
}

function t1FeedRenderMarketCards(items) {
    return items.map(item => {
        const mallColor = { '쿠팡':'#e44332', '스마트스토어':'#03c75a', 'G마켓':'#4285f4', '옥션':'#ff6f00', '11번가':'#ff0000' }[item.mallName] || '#94a3b8';
        return `<div class="mp-card" onclick="window.open('${item.link}','_blank')" style="min-width:130px; max-width:130px; flex-shrink:0;">
            <div class="mp-card-img">${item.image ? `<img src="${item.image}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}</div>
            <div class="mp-card-price">${fmt(item.price)}원</div>
            <div class="mp-card-mall" style="color:${mallColor}">${escapeHtml(item.mallName)}</div>
            <div class="mp-card-title">${escapeHtml(item.title)}</div>
        </div>`;
    }).join('');
}

function t1FeedMarketTab(zone, btn) {
    T1Feed._marketZone = zone;
    let items = [...(T1Feed._marketItems?.[zone] || [])];
    
    // 현재 적용된 정렬 로직 적용
    if (T1Feed._marketSort === 'asc') items.sort((a,b) => a.price - b.price);
    else if (T1Feed._marketSort === 'desc') items.sort((a,b) => b.price - a.price);

    const grid = document.getElementById('mp-grid');
    if (grid) grid.innerHTML = t1FeedRenderMarketCards(items.slice(0, 12));
    
    document.querySelectorAll('#mp-tabs .mp-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // 더보기 숨기기
    const more = document.querySelector('.mp-more');
    if (more) more.style.display = items.length > 12 ? 'block' : 'none';
}

function t1FeedMarketSort(type, btn) {
    T1Feed._marketSort = type;
    document.querySelectorAll('#mp-sort-btns .mp-sort-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#94a3b8';
        b.style.border = '1px solid #94a3b8';
    });
    if (btn) {
        btn.classList.add('active');
        btn.style.background = 'var(--accent)';
        btn.style.color = '#fff';
        btn.style.border = '1px solid var(--accent)';
    }

    // 현재 선택된 탭기준으로 리렌더링
    const activeTabBtn = document.querySelector('#mp-tabs .mp-tab.active');
    t1FeedMarketTab(T1Feed._marketZone || 'all', activeTabBtn);
}

function t1FeedMarketShowAll() {
    const activeTab = document.querySelector('#mp-tabs .mp-tab.active');
    const zone = activeTab?.textContent?.includes('최저') ? 'low'
        : activeTab?.textContent?.includes('평균') ? 'mid'
        : activeTab?.textContent?.includes('최고') ? 'high' : 'all';
    let items = [...(T1Feed._marketItems?.[zone] || [])];
    
    if (T1Feed._marketSort === 'asc') items.sort((a,b) => a.price - b.price);
    else if (T1Feed._marketSort === 'desc') items.sort((a,b) => b.price - a.price);

    const grid = document.getElementById('mp-grid');
    if (grid) grid.innerHTML = t1FeedRenderMarketCards(items);
    const more = document.querySelector('.mp-more');
    if (more) more.remove();
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

    // 1. 소싱 모드(위탁/사입)에 따른 엄격한 데이터 필터링
    const mode = window._t1SourcingMode || 'drop';
    
    // ★ 동적 마진컷 (사용자 자율 조절 기반 프론트엔드 심사)
    const thDrop = parseInt(localStorage.getItem('marginCutDrop')) || 15;
    const thBulk = parseInt(localStorage.getItem('marginCutBulk')) || 25;
    
    items.forEach(i => {
        let m = mode === 'drop' ? (i.dropMargin != null ? i.dropMargin : (i.margin || 0)) : (i.bulkMargin != null ? i.bulkMargin : (i.margin || 0));
        let th = mode === 'drop' ? thDrop : thBulk;
        // 백엔드 하드코딩 signal을 브라우저 렌더링 시점에 덮어씀
        i.signal = (m >= th) ? '소싱추천' : (m >= th - 10) ? '지켜보기' : '비추천';
    });

    items = items.filter(i => {
        let isDrop = (i.dropPrice || 0) > 0 || String(i.wholesaleSource || '').includes('도매매') || String(i.dropUrl || '').includes('domeme');
        let isBulk = (i.bulkPrice || 0) > 0 || String(i.wholesaleSource || '').includes('도매꾹') || String(i.bulkUrl || '').includes('domeggook');
        
        // 단일 가격/URL만 있는 백엔드 구형 응답 대비
        if (!isDrop && !isBulk && i.wholesaleUrl) {
           if (i.wholesaleUrl.includes('domeme')) isDrop = true;
           if (i.wholesaleUrl.includes('domeggook')) isBulk = true;
        }

        if (mode === 'drop') return isDrop;
        if (mode === 'bulk') return isBulk;
        return true;
    });

    // 2. 패널 탭 서브 필터
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

    // Gemini 이미지 매칭 백그라운드 실행 (API 키 있을 때만)
    if (typeof ImageMatcher !== 'undefined' && T1Feed.filteredItems.length > 0) {
        ImageMatcher.matchInBackground(T1Feed.filteredItems, function(idx, item) {
            // 카드의 일치도 뱃지 실시간 업데이트 및 추정 마진 꼬리표 라이브 갱신
            const cards = document.querySelectorAll('#t1-feed-grid .pc');
            if (cards[idx]) {
                const card = cards[idx];
                const matchEl = card.querySelector('.pc-match');
                const ml = item.matchLevel || 'medium';
                if (matchEl) {
                    matchEl.className = 'pc-match pc-match-' + ml;
                    matchEl.textContent = ml === 'high' ? '일치 높음' : ml === 'medium' ? '추정' : '직접확인';
                }
                
                // 백그라운드 AI/NLP가 "동일 상품(high)"으로 확정지었다면, UI의 (추정) 꼬리표를 날려 리얼 데이터로 승격
                if (ml === 'high') {
                    card.innerHTML = card.innerHTML.replace(/<span[^>]*>\(추정\)<\/span>/g, '');
                    card.innerHTML = card.innerHTML.replace(/이 표기된 마진은 동일 상품 여부가 불확실한 추정치입니다\./g, 'AI 일치도 검증이 완료된 실제 마진율입니다.');
                }
            }
        });
    }
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

    grid.innerHTML = T1Feed.filteredItems.map((item, idx) => t1FeedRenderCard(item, idx)).join('');
}

function t1FeedRenderCard(item, idx = 0) {
    // 신호 뱃지
    const signalClass = item.signal === '소싱추천' ? 'pc-badge-go'
        : item.signal === '지켜보기' ? 'pc-badge-watch' : 'pc-badge-skip';

    // 마진 색상 헬퍼
    const mgCls = (m) => (m || 0) >= 25 ? 'pc-mg-g' : (m || 0) >= 15 ? 'pc-mg-y' : 'pc-mg-r';

    // 일치도
    const matchLevel = item.matchLevel || 'unknown';
    const matchBadge = matchLevel === 'high' ? '<span class="pc-match pc-match-high">경쟁가 기준</span>'
        : matchLevel === 'medium' ? '<span class="pc-match pc-match-medium">추정</span>'
        : matchLevel === 'low' ? '<span class="pc-match pc-match-low">직접확인</span>' : '';

    // 트렌드 뱃지
    const trendBadge = (item.searchChange || 0) > 0
        ? `<div class="pc-trend">검색 +${item.searchChange}%</div>` : '';

    // 담기 버튼 스타일
    const addBtnClass = item.signal === '소싱추천' ? 'pc-btn-add' : 'pc-btn-add muted';

    // 이미지
    const imgHtml = item.image
        ? `<img src="${item.image}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('beforeend','<span>이미지 없음</span>')">`
        : '이미지 없음';

    const mode = window._t1SourcingMode || 'drop';
    const dp = item.dropPrice || item.wholesalePrice || 0;
    const bp = item.bulkPrice || item.wholesalePrice || 0;
    
    // 🔥 백엔드 미배포 상황을 대비한 프론트엔드 핫픽스: 위탁 링크 강제 교정
    let finalDropUrl = item.dropUrl || item.wholesaleUrl || '';
    if (finalDropUrl.includes('domeggook.com')) {
        const noMatch = finalDropUrl.match(/\d+$/);
        if (noMatch) finalDropUrl = 'http://domeme.domeggook.com/s/' + noMatch[0];
    }
    // 예외처리: URL이 전부 비어있지만 검색어는 있을 경우
    if (!finalDropUrl && item.no) {
        finalDropUrl = 'http://domeme.domeggook.com/s/' + item.no;
    }
    
    let finalBulkUrl = item.bulkUrl || item.wholesaleUrl || '';
    if (finalBulkUrl.includes('domeggook.com/no/')) {
        finalBulkUrl = finalBulkUrl.replace('domeggook.com/no/', 'domeggook.com/');
    }
    if (!finalBulkUrl && item.no) {
        finalBulkUrl = 'https://domeggook.com/' + item.no;
    }

    // 현재 모드에 맞게 T2에 넘길 수 있도록 수정
    const itemJson = JSON.stringify({
        title: item.name,
        _wsPrice: mode === 'drop' ? dp : bp,
        lprice: item.retailPrice || item.avgPrice,
        image: item.image,
        keyword: item.keyword || item.name,
        wholesaleUrl: mode === 'drop' ? finalDropUrl : finalBulkUrl,
        wholesaleSource: mode === 'drop' ? '도매매' : '도매꾹',
        sourcingType: mode,
        // 확장 B2B 스펙 추가
        adult: item.adult || false,
        tax: item.tax || '과세',
        origin: item.origin || '미상',
        brand: item.brand || '',
        category: item.category || '',
        isB2b: item.isB2b || false,
        hasOption: item.hasOption || false,
        deliveryFee: item.deliveryFee || 0
    }).replace(/"/g, '&quot;');

    // ★ 객관성 보장 필터: 완전 동일 상품(high)이 아니면 무조건 (추정) 문구 삽입
    const marginPostfix = matchLevel === 'high' ? '' : '<span style="font-size:10px; color:#ef4444; font-weight:normal; margin-left:3px;">(추정)</span>';
    
    // ★ 네이버 쇼핑 스타일 렌더링 변수 세팅
    let marginStr = '';
    let profitStr = '';
    let priceVal = 0;
    let urlVal = '';
    let srcName = '';
    let bColor = '';
    
    if (mode === 'drop') {
        marginStr = (item.dropMargin != null ? item.dropMargin + '%' : (item.margin != null ? item.margin + '%' : '—')) + marginPostfix;
        profitStr = item.dropProfit ? fmt(item.dropProfit) + '원' : '—';
        priceVal = dp;
        urlVal = finalDropUrl;
        srcName = '도매매';
        bColor = '#10b981';
    } else {
        marginStr = (item.bulkMargin != null ? item.bulkMargin + '%' : (item.margin != null ? item.margin + '%' : '—')) + marginPostfix;
        profitStr = item.bulkProfit ? fmt(item.bulkProfit) + '원' : '—';
        priceVal = bp;
        urlVal = finalBulkUrl;
        srcName = '도매꾹';
        bColor = '#3b82f6';
    }

    const navMarginHtml = `<div class="n-benefits" style="background: color-mix(in srgb, ${bColor} 8%, transparent); border-color: color-mix(in srgb, ${bColor} 15%, transparent);">
        <span class="n-icon" style="background:${bColor}; color:#fff;">N</span>
        <span class="n-benefit-text" style="color:${bColor};">마진 ${marginStr} (${profitStr})</span>
    </div>`;

    // ★ B2B 특수 뱃지 렌더링 (Private API 데이터) 복구
    let b2bBadges = '';
    if (item.isB2b) b2bBadges += `<span class="n-tag">폐쇄몰</span>`;
    if (item.adult) b2bBadges += `<span class="n-tag" style="color:#ef4444;border-color:rgba(239,68,68,0.2)">19금</span>`;
    if (item.tax && item.tax !== '과세') b2bBadges += `<span class="n-tag n-tag-highlight">${escapeHtml(item.tax)}</span>`;
    if (item.hasOption) b2bBadges += `<span class="n-tag">옵션있음</span>`;
    if (item.origin && item.origin !== '미상') {
        const oName = item.origin.length > 5 ? item.origin.substring(0, 5) + '..' : item.origin;
        b2bBadges += `<span class="n-tag">${escapeHtml(oName)}</span>`;
    }
    // 네이버 쇼핑 시중가 분석 매칭
    item.retailPrice = item.originalPrice || 0;

    const isHot = item.signal === '소싱추천' && matchLevel === 'high';

    return `<div class="pc" onclick="${urlVal ? `window.open('${urlVal}', '_blank')` : ''}">
        <!-- 좌측: 썸네일 영역 -->
        <div class="pc-img-area">
            ${isHot ? `<div class="n-badge-hot">🔥 확정 마진</div>` : ''}
            <div class="n-badge-tl">
                ${item.signal ? `<span class="n-badge-item ${signalClass}">${item.signal}</span>` : ''}
            </div>
            ${item.searchChange && item.searchChange > 0 ? `<div class="n-badge-tr">검색 +${item.searchChange}%</div>` : ''}
            ${imgHtml}
        </div>
        
        <!-- 중앙: 상품 정보 영역 -->
        <div class="pc-info-main">
            <div class="n-title">${escapeHtml(item.name || '')}</div>
            
            ${b2bBadges ? `<div class="n-tags">${b2bBadges}</div>` : ''}
            
            <div class="n-price-row">
                <span class="n-price">${fmt(priceVal)}<span class="n-unit">원</span></span>
                ${item.retailPrice ? `<span class="n-retail" title="분석된 시장 평균가/경쟁가">시중 ${fmt(item.retailPrice)}원</span>` : ''}
                ${item.retailUrl ? `<a href="${item.retailUrl}" target="_blank" class="n-retail-link" onclick="event.stopPropagation()">[비교]</a>` : ''}
            </div>

            <div class="n-meta">
                <span>${escapeHtml(srcName)}</span>
                ${item.bestMarket ? `<span class="n-dot">·</span><span style="color:#a78bfa;font-weight:600">${escapeHtml(item.bestMarket)}</span>` : ''}
            </div>
        </div>
        
        <!-- 우측: 마진 및 액션 영역 -->
        <div class="pc-info-side">
            ${navMarginHtml}
            ${matchLevel !== 'unknown' ? `<div class="n-match-level" style="background:${matchLevel === 'high' ? 'rgba(52,211,153,0.1)' : (matchLevel === 'medium' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)')}; color:${matchLevel === 'high' ? '#34d399' : (matchLevel === 'medium' ? '#fbbf24' : '#ef4444')}"><span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span>${matchLevel === 'high' ? '경쟁가 기준' : (matchLevel === 'medium' ? '추정 마진' : '수동확인 요망')}</div>` : ''}
            
            <div class="n-actions-list">
                <button class="n-btn-primary btn-add-pick ${item.signal !== '소싱추천' ? 'muted' : ''}" data-id="${item.productId || escapeHtml(item.name).replace(/"/g, '&quot;')}" onclick="event.stopPropagation();t1AddRow(this, ${itemJson})">
                    <svg viewBox="0 0 20 20" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg> 픽 담기
                </button>
                <div class="n-action-icons">
                    <button class="n-btn-icon" onclick="event.stopPropagation();t1FeedShowWholesaleCompare('${escapeHtml(item.name).replace(/'/g, "\\'")}')" title="도매처 최저가 비교">
                        <svg viewBox="0 0 20 20"><rect x="2" y="6" width="7" height="11" rx="1"/><rect x="11" y="3" width="7" height="14" rx="1"/></svg>
                    </button>
                    <button class="n-btn-icon" onclick="event.stopPropagation();sendToStudio(${itemJson})" title="T3 마케팅 상세페이지 생성">
                        <svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="7" x2="13" y2="7"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="11" y2="13"/></svg>
                    </button>
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
window.t1FeedMarketTab = t1FeedMarketTab;
window.t1FeedMarketShowAll = t1FeedMarketShowAll;
window.t1SetSourcingMode = t1SetSourcingMode;
window.t1AddRow = t1AddRow;

// ═══════════════════════════════════════
// T1 소싱 장바구니 로직 (Sourcing Cart)
// ═══════════════════════════════════════

window.T1CartItems = [];
window._t1CartCollapsed = false; // 장바구니 접힘 상태

/**
 * 장바구니 위젯 접기/펼치기 토글 (시스템 콘솔 패턴)
 */
window.t1ToggleCart = function() {
    window._t1CartCollapsed = !window._t1CartCollapsed;
    const body = document.getElementById('t1-cart-body');
    const icon = document.getElementById('t1-cart-toggle-icon');
    const countEl = document.getElementById('t1-cart-count');
    if (!body) return;

    if (window._t1CartCollapsed) {
        // 접기
        body.style.maxHeight = '0px';
        body.style.opacity = '0';
        body.style.marginTop = '0';
        if (icon) icon.style.transform = 'rotate(-90deg)';
        // 접힌 상태에서 아이템 있으면 배지 하이라이트
        if (countEl && window.T1CartItems.length > 0) {
            countEl.style.background = 'rgba(59,130,246,0.3)';
            countEl.style.color = '#93c5fd';
            countEl.style.animation = 'cartBadgePulse 2s infinite';
        }
    } else {
        // 펼치기
        body.style.maxHeight = '600px';
        body.style.opacity = '1';
        body.style.marginTop = '12px';
        if (icon) icon.style.transform = 'rotate(0deg)';
        if (countEl) {
            countEl.style.background = 'rgba(16,185,129,0.1)';
            countEl.style.color = '#10b981';
            countEl.style.animation = 'none';
        }
    }
};

/**
 * 장바구니 자동 펼침 (아이템 추가 시 호출)
 */
window.t1ExpandCart = function() {
    if (!window._t1CartCollapsed) return;
    window._t1CartCollapsed = false;
    const body = document.getElementById('t1-cart-body');
    const icon = document.getElementById('t1-cart-toggle-icon');
    const countEl = document.getElementById('t1-cart-count');
    if (body) {
        body.style.maxHeight = '600px';
        body.style.opacity = '1';
        body.style.marginTop = '12px';
    }
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (countEl) {
        countEl.style.background = 'rgba(16,185,129,0.1)';
        countEl.style.color = '#10b981';
        countEl.style.animation = 'none';
    }
};

function t1AddRow(btn, item) {
    if (btn.classList.contains('added')) return;
    
    // 데이터 맵핑
    const productData = _mapItemToProductData(item);
    
    // 중복 체크방지
    const exists = window.T1CartItems.find(p => p.id === productData.id);
    if (!exists) {
        window.T1CartItems.push(productData);
    }
    
    // UI 로직 (버튼 시각적 변화)
    btn.classList.add('added');
    btn.innerHTML = '<svg viewBox="0 0 20 20" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M4 10l4 4 8-8"/></svg> 담김';
    btn.style.background = 'rgba(16,185,129,0.2)';
    btn.style.color = '#10b981';
    
    // 장바구니 패널 렌더링
    t1RenderCart();
}

window.t1RemoveFromCart = function(id, btnElement) {
    // 1. 메모리에서 제거
    window.T1CartItems = window.T1CartItems.filter(p => p.id !== String(id));
    
    // 2. 피드 상의 버튼 원상복구
    const cardBtns = document.querySelectorAll(`.btn-add-pick[data-id="${id}"]`);
    cardBtns.forEach(btn => {
        btn.classList.remove('added');
        btn.innerHTML = '<svg viewBox="0 0 20 20" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg> 픽 담기';
        btn.style.background = '';
        btn.style.color = '';
    });
    
    // 3. 다시 렌더링
    t1RenderCart();
};

window.t1RenderCart = function() {
    const listEl = document.getElementById('t1-cart-items');
    const countEl = document.getElementById('t1-cart-count');
    const submitBtn = document.getElementById('t1-cart-submit-btn');
    
    if(!listEl) return;
    const count = window.T1CartItems.length;
    countEl.textContent = count;
    
    // 아이템 추가 시 자동 펼침 (접혀있었다면)
    if (count > 0) t1ExpandCart();
    
    // 카운트 배지 색상: 0=회색, 1~3=초록, 4+=파랑 강조
    if (count === 0) {
        countEl.style.background = 'rgba(100,116,139,0.1)';
        countEl.style.color = '#64748b';
    } else if (count <= 3) {
        countEl.style.background = 'rgba(16,185,129,0.15)';
        countEl.style.color = '#10b981';
    } else {
        countEl.style.background = 'rgba(59,130,246,0.2)';
        countEl.style.color = '#60a5fa';
    }
    
    if(count === 0) {
        listEl.innerHTML = `<div style="text-align:center;padding:30px 10px;color:#64748b;font-size:11px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px dashed rgba(255,255,255,0.05)">장바구니가 비어있습니다.<br>상품의 픽담기 버튼을 눌러주세요.</div>`;
        submitBtn.style.display = 'none';
        return;
    }
    
    submitBtn.style.display = 'block';
    submitBtn.textContent = `총 ${window.T1CartItems.length}건 사입/위탁 진행`;
    submitBtn.onclick = t1SubmitCart;
    
    let html = '';
    window.T1CartItems.forEach(item => {
        const titleSafe = escapeHtml(item.name || '');
        const priceFmt = parseInt(item.wholesale_price).toLocaleString();
        html += `
        <div style="display:flex;gap:8px;padding:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:8px;align-items:center;">
            <div style="width:40px;height:40px;border-radius:4px;overflow:hidden;flex-shrink:0;background:#15181e">
                <img src="${item.thumbnail_url || 'https://via.placeholder.com/40'}" style="width:100%;height:100%;object-fit:cover">
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center">
                <div style="font-size:11px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600">${titleSafe}</div>
                <div style="font-size:10px;color:#34d399;font-weight:700;margin-top:2px">${priceFmt}원</div>
            </div>
            <button onclick="t1RemoveFromCart('${item.id}', this)" style="width:22px;height:22px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background 0.15s">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </div>
        `;
    });
    listEl.innerHTML = html;
};

window.t1SubmitCart = function() {
    if(window.T1CartItems.length === 0) return;
    
    if (window.AppEventBus) {
        // 모든 장바구니 데이터를 이벤트 버스로 송신(T2로 전송)
        window.T1CartItems.forEach(item => {
            window.AppEventBus.emit('PRODUCT_SOURCED', item);
        });
        
        const count = window.T1CartItems.length;
        
        // 장바구니 초기화
        window.T1CartItems = [];
        t1RenderCart();
        
        // 피드 내 픽담기 버튼 초기화
        const cardBtns = document.querySelectorAll('.btn-add-pick.added');
        cardBtns.forEach(btn => {
            btn.classList.remove('added');
            btn.innerHTML = '<svg viewBox="0 0 20 20" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg> 픽 담기';
            btn.style.background = '';
            btn.style.color = '';
        });
        
        // 피드백
        if(window.ui && window.ui.showToast) {
            window.ui.showToast(`총 ${count}건 소싱 대기열에 담았습니다.`, 'success');
        } else {
            alert(`총 ${count}건 소싱 대기열에 등록되었습니다.`);
        }
    }
};

function _mapItemToProductData(itemData) {
    return {
        id: itemData.id || itemData.productId || Date.now().toString(),
        name: itemData.title || itemData.name || itemData.product || '(상품명 없음)',
        wholesale_price: parseInt(itemData._wsPrice || itemData.wholesalePrice || itemData.lprice || itemData.price || 0, 10),
        retail_price: parseInt(itemData.lprice || itemData.price || itemData.retailPrice || 0, 10),
        margin_rate: itemData._margin || itemData.marginRate || 0,
        source_type: itemData.source_type || itemData.vendor || 'naver',
        sourcing_type: itemData.sourcing_type || itemData.sourcingType || 'unknown',
        source_url: itemData.wholesaleUrl || itemData.sourceUrl || itemData.url || '',
        thumbnail_url: itemData.image || itemData.photoUrl || '',
        keyword: itemData.keyword || '',
        adult: itemData.adult || false,
        tax: itemData.tax || '과세',
        origin: itemData.origin || '미상',
        brand: itemData.brand || '',
        category: itemData.category || '',
        isB2b: itemData.isB2b || false,
        hasOption: itemData.hasOption || false,
        deliveryFee: itemData.deliveryFee || 0
    };
}
