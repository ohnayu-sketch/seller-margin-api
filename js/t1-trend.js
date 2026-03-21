/**
 * T1 트렌드 소싱 — 네이버 데이터랩 쇼핑인사이트 연동
 * 파일: js/t1-trend.js
 *
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js, t1-sourcing.js
 *
 * 기능:
 *  1. 네이버 데이터랩 쇼핑인사이트 카테고리별 급상승 TOP 20
 *  2. 클릭 → 인기 키워드 추출 → 도매 자동 검색 → 마진 분석
 *  3. GO 상품 선택 → T5 대량 상세페이지 대기열 전달
 *
 * GAS 프록시 액션:
 *  - 'datalabCategories'  : 데이터랩 분야 목록 반환
 *  - 'datalabTrending'    : 특정 카테고리 급상승 키워드 TOP 20
 *  - 'datalabKeywordDetail': 키워드 검색량 + 연관어 상세
 */

// ─── 트렌드 상태 ───
const T1Trend = {
    categories: [],           // 데이터랩 분야 목록 캐시
    selectedCatId: '',        // 선택된 카테고리 ID
    selectedCatName: '',      // 선택된 카테고리명
    trendingItems: [],        // 급상승 TOP 20
    analyzedItems: [],        // 마진 분석 완료 상품들
    analyzing: false,
    filterSignal: 'ALL',      // GO/WATCH/SKIP/ALL
};

// ─── 카테고리 목록 (네이버 데이터랩 쇼핑인사이트 분야) ───
// GAS에서 가져오되, 로컬 폴백용 기본 목록
const DATALAB_DEFAULT_CATEGORIES = [
    { id: '50000000', name: '패션의류', icon: '👗' },
    { id: '50000001', name: '패션잡화', icon: '👜' },
    { id: '50000002', name: '화장품/미용', icon: '💄' },
    { id: '50000003', name: '디지털/가전', icon: '💻' },
    { id: '50000004', name: '가구/인테리어', icon: '🛋️' },
    { id: '50000005', name: '출산/육아', icon: '👶' },
    { id: '50000006', name: '식품', icon: '🍎' },
    { id: '50000007', name: '스포츠/레저', icon: '⚽' },
    { id: '50000008', name: '생활/건강', icon: '🏠' },
    { id: '50000009', name: '여가/생활편의', icon: '🎮' },
    { id: '50000010', name: '면세점', icon: '✈️' },
];

// ═══════════════════════════════════════════════════════════════
// PART 1: 모드 전환 확장 (기존 single/bulk에 trend 추가)
// ═══════════════════════════════════════════════════════════════

/**
 * 기존 t1SetMode를 확장하여 'trend' 모드 지원
 * HTML에 t1-trend-panel이 추가되어야 함
 */
const _originalT1SetMode = window.t1SetMode;
window.t1SetMode = function(mode) {
    // trend 패널 토글
    const trendPanel = document.getElementById('t1-trend-panel');
    if (trendPanel) trendPanel.style.display = mode === 'trend' ? 'block' : 'none';

    if (mode === 'trend') {
        // trend 모드일 때 기존 패널 숨기기
        const singlePanel = document.getElementById('t1-single-panel');
        const bulkPanel = document.getElementById('t1-bulk-panel');
        if (singlePanel) singlePanel.style.display = 'none';
        if (bulkPanel) bulkPanel.style.display = 'none';

        // 모드 버튼 active 처리
        document.querySelectorAll('.t1-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === 'trend');
        });

        // 상태 저장
        if (window.T1) T1.mode = 'trend';

        // 첫 진입 시 카테고리 로드
        if (!T1Trend.categories.length) t1TrendLoadCategories();
    } else {
        // 기존 모드 로직 위임
        if (_originalT1SetMode) _originalT1SetMode(mode);
    }
};

// ═══════════════════════════════════════════════════════════════
// PART 2: 카테고리 로드 + 급상승 키워드
// ═══════════════════════════════════════════════════════════════

async function t1TrendLoadCategories() {
    const grid = document.getElementById('t1-trend-cat-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="t1-loading-inline">📊 카테고리 로딩 중...</div>';

    try {
        const result = await fetchGas('datalabCategories', {});
        if (result?.categories?.length) {
            T1Trend.categories = result.categories;
        } else {
            T1Trend.categories = DATALAB_DEFAULT_CATEGORIES;
        }
    } catch (e) {
        console.warn('[T1Trend] 카테고리 로드 실패, 기본값 사용:', e);
        T1Trend.categories = DATALAB_DEFAULT_CATEGORIES;
    }

    renderTrendCategories();
}

function renderTrendCategories() {
    const grid = document.getElementById('t1-trend-cat-grid');
    if (!grid) return;

    grid.innerHTML = T1Trend.categories.map(cat => `
        <div class="t1-trend-cat-card ${T1Trend.selectedCatId === cat.id ? 'active' : ''}"
             onclick="t1TrendSelectCategory('${cat.id}','${escapeHtml(cat.name)}')">
            <div class="t1-trend-cat-icon">${cat.icon || '📦'}</div>
            <div class="t1-trend-cat-name">${escapeHtml(cat.name)}</div>
        </div>
    `).join('');
}

async function t1TrendSelectCategory(catId, catName) {
    T1Trend.selectedCatId = catId;
    T1Trend.selectedCatName = catName;
    T1Trend.trendingItems = [];
    T1Trend.analyzedItems = [];

    renderTrendCategories();

    const resultPanel = document.getElementById('t1-trend-results');
    if (!resultPanel) return;

    resultPanel.style.display = 'block';
    resultPanel.innerHTML = `<div class="t1-loading-inline">📈 "${catName}" 급상승 키워드 조회 중...</div>`;

    try {
        const result = await fetchGas('datalabTrending', {
            categoryId: catId,
            categoryName: catName,
        });

        if (result?.success && result.items?.length) {
            T1Trend.trendingItems = result.items.map((item, idx) => ({
                rank: idx + 1,
                keyword: item.keyword || item.title || '',
                ratio: item.ratio || item.value || 0,
                change: item.change || 0,            // 전주 대비 증감률
                changeLabel: item.changeLabel || '',  // '급상승', '상승' 등
                categoryId: catId,
                categoryName: catName,
            }));
            renderTrendingList();
        } else {
            resultPanel.innerHTML = `
                <div class="t1-info-msg">
                    📊 "${catName}" 카테고리의 트렌드 데이터를 가져오지 못했습니다.<br>
                    <span style="font-size:10px;color:#94a3b8">GAS에 datalabTrending 함수와 네이버 API 키가 설정되어 있는지 확인하세요.</span>
                </div>`;
        }
    } catch (e) {
        console.error('[T1Trend] 트렌드 조회 오류:', e);
        resultPanel.innerHTML = `<div class="t1-info-msg">⚠️ 트렌드 조회 실패: ${e.message}</div>`;
    }
}

function renderTrendingList() {
    const panel = document.getElementById('t1-trend-results');
    if (!panel) return;

    let html = `
        <div class="t1-section-header">
            <span>📈 ${escapeHtml(T1Trend.selectedCatName)} — 급상승 키워드 TOP ${T1Trend.trendingItems.length}</span>
            <span class="t1-badge-new">TREND</span>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-bottom:10px;">
            💡 키워드를 클릭하면 도매 검색 + 마진 분석이 시작됩니다. 분석 완료 후 GO 상품을 T5로 보낼 수 있습니다.
        </div>
        <div class="t1-trend-kw-list">`;

    T1Trend.trendingItems.forEach(item => {
        const changeColor = item.change > 0 ? '#10b981' : item.change < 0 ? '#ef4444' : '#94a3b8';
        const changeIcon = item.change > 20 ? '🔥' : item.change > 0 ? '📈' : item.change < 0 ? '📉' : '➡️';
        const barWidth = Math.min(100, Math.max(10, item.ratio));

        html += `
            <div class="t1-trend-kw-row" onclick="t1TrendAnalyzeKeyword('${escapeHtml(item.keyword).replace(/'/g, "\\'")}')">
                <span class="t1-trend-rank ${item.rank <= 3 ? 't1-trend-rank-top' : ''}">${item.rank}</span>
                <div class="t1-trend-kw-info">
                    <div class="t1-trend-kw-name">${escapeHtml(item.keyword)}</div>
                    <div class="t1-trend-kw-bar">
                        <div class="t1-trend-kw-bar-fill" style="width:${barWidth}%"></div>
                    </div>
                </div>
                <span class="t1-trend-change" style="color:${changeColor}">
                    ${changeIcon} ${item.change > 0 ? '+' : ''}${item.change}%
                </span>
                <span class="t1-trend-kw-label">${item.changeLabel || ''}</span>
                <button class="t1-mini-btn" onclick="event.stopPropagation();t1TrendAnalyzeKeyword('${escapeHtml(item.keyword).replace(/'/g, "\\'")}')">🔍 분석</button>
            </div>`;
    });

    html += `</div>`;

    // 분석 결과 영역
    html += `<div id="t1-trend-analysis" style="display:none;margin-top:14px;"></div>`;

    panel.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// PART 3: 키워드 선택 → 도매 검색 → 마진 분석
// ═══════════════════════════════════════════════════════════════

async function t1TrendAnalyzeKeyword(keyword) {
    if (T1Trend.analyzing) {
        showToast('이전 분석이 진행 중입니다');
        return;
    }

    T1Trend.analyzing = true;
    T1Trend.analyzedItems = [];
    T1Trend.filterSignal = 'ALL';

    const analysisPanel = document.getElementById('t1-trend-analysis');
    if (!analysisPanel) { T1Trend.analyzing = false; return; }

    analysisPanel.style.display = 'block';
    analysisPanel.innerHTML = `
        <div class="t1-section-header">
            <span>🔍 "${escapeHtml(keyword)}" 소싱 분석</span>
            <span class="t1-badge-new">AI</span>
        </div>
        <div class="t1-trend-progress">
            <div class="t1-trend-progress-bar" id="t1-trend-pbar" style="width:0%"></div>
        </div>
        <div id="t1-trend-ptext" class="t1-loading-inline">1/3 — 시중가 조회 중...</div>`;

    const pbar = document.getElementById('t1-trend-pbar');
    const ptext = document.getElementById('t1-trend-ptext');

    try {
        // Step 1: 시중가 조회 (네이버 쇼핑)
        if (pbar) pbar.style.width = '15%';
        const _rawTrend = await fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 20 });
        const searchResult = _rawTrend?.data || _rawTrend;  // GAS 응답 래핑 해제
        const items = (searchResult?.items || []).filter(i => parseInt(i.lprice || 0) > 0);

        if (!items.length) {
            analysisPanel.innerHTML = `<div class="t1-info-msg">⚠️ "${keyword}" 시중가 검색 결과가 없습니다.</div>`;
            T1Trend.analyzing = false;
            return;
        }

        const prices = items.map(i => parseInt(i.lprice || 0));
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        if (pbar) pbar.style.width = '35%';
        if (ptext) ptext.textContent = '2/3 — 도매처 검색 중...';

        // Step 2: 도매 통합 검색
        const wholesaleResults = [];
        const enabledSites = WholesaleSiteManager.getEnabledApiSites();

        if (enabledSites.length > 0) {
            const promises = enabledSites.map(async site => {
                try {
                    const action = site.id === 'domeggook' ? 'domeggookProxy' : site.id + 'Proxy';
                    const res = await fetchGas(action, { query: keyword });
                    if (res?.items?.length) {
                        res.items.forEach(item => {
                            wholesaleResults.push({
                                name: item.name || item.상품명 || keyword,
                                wholesalePrice: parseInt(item.price || item.도매가 || 0, 10),
                                stock: item.stock || item.재고 || '-',
                                image: item.image || item.이미지 || '',
                                link: item.link || item.url || '',
                                source: site.name,
                                sourceId: site.id,
                                moq: item.moq || item.최소주문 || 1,
                            });
                        });
                    }
                } catch (e) {
                    console.warn(`[T1Trend] ${site.name} 검색 실패:`, e);
                }
            });
            await Promise.allSettled(promises);
        }

        // 도매 결과 없으면 추정 도매가로 분석
        if (!wholesaleResults.length) {
            // 시중가의 40~60%를 추정 도매가로 사용
            const estWholesale = Math.round(avgPrice * 0.45);
            wholesaleResults.push({
                name: keyword + ' (추정 도매가)',
                wholesalePrice: estWholesale,
                stock: '-',
                image: items[0]?.image || '',
                link: '',
                source: '추정값',
                sourceId: 'estimate',
                moq: 1,
            });
        }

        if (pbar) pbar.style.width = '70%';
        if (ptext) ptext.textContent = '3/3 — 마진 분석 중...';

        // Step 3: 마진 분석
        T1Trend.analyzedItems = wholesaleResults.map(ws => {
            const margins = {};
            let bestMarket = '';
            let bestMargin = -999;

            Object.entries(AppConfig.MARKET_FEES).forEach(([key, mkt]) => {
                const fee = mkt.fee / 100;
                const sellingPrice = avgPrice;
                const revenue = sellingPrice - (sellingPrice * fee) - ws.wholesalePrice - AppConfig.DEFAULT_SHIPPING.supplier;
                const marginRate = sellingPrice > 0 ? Math.round((revenue / sellingPrice) * 100) : 0;
                margins[key] = { marketName: mkt.name, margin: marginRate, revenue };
                if (marginRate > bestMargin) {
                    bestMargin = marginRate;
                    bestMarket = mkt.name;
                }
            });

            const signal = bestMargin >= AppConfig.MARGIN_THRESHOLDS.go ? 'GO'
                : bestMargin >= AppConfig.MARGIN_THRESHOLDS.watch ? 'WATCH' : 'SKIP';

            return {
                ...ws,
                keyword,
                avgPrice,
                minPrice,
                maxPrice,
                margins,
                bestMarket,
                bestMargin,
                signal,
                checked: false,
            };
        }).sort((a, b) => b.bestMargin - a.bestMargin);

        if (pbar) pbar.style.width = '100%';

        // 렌더링
        renderTrendAnalysis(keyword, avgPrice, minPrice, maxPrice);

    } catch (e) {
        console.error('[T1Trend] 분석 오류:', e);
        analysisPanel.innerHTML = `<div class="t1-info-msg">⚠️ 분석 실패: ${e.message}</div>`;
    } finally {
        T1Trend.analyzing = false;
    }
}

function renderTrendAnalysis(keyword, avgPrice, minPrice, maxPrice) {
    const panel = document.getElementById('t1-trend-analysis');
    if (!panel) return;

    const goCount = T1Trend.analyzedItems.filter(i => i.signal === 'GO').length;
    const watchCount = T1Trend.analyzedItems.filter(i => i.signal === 'WATCH').length;
    const skipCount = T1Trend.analyzedItems.filter(i => i.signal === 'SKIP').length;

    let html = '';

    // 요약 카드
    html += `
        <div class="t1-section-header">
            <span>🔍 "${escapeHtml(keyword)}" 소싱 분석 결과</span>
            <span class="t1-count">${T1Trend.analyzedItems.length}개 도매상품</span>
        </div>
        <div class="t1-price-summary">
            <div class="t1-price-card"><div class="t1-price-val t1-c-green">${fmt(minPrice)}</div><div class="t1-price-label">시중 최저가</div></div>
            <div class="t1-price-card"><div class="t1-price-val">${fmt(avgPrice)}</div><div class="t1-price-label">시중 평균가</div></div>
            <div class="t1-price-card"><div class="t1-price-val t1-c-red">${fmt(maxPrice)}</div><div class="t1-price-label">시중 최고가</div></div>
        </div>`;

    // 신호 필터 + 액션 버튼
    html += `
        <div class="t1-trend-action-bar">
            <div class="t1-filter-tabs">
                <button class="t1-tab ${T1Trend.filterSignal === 'ALL' ? 'active' : ''}" onclick="t1TrendSetFilter('ALL',this)">전체 ${T1Trend.analyzedItems.length}</button>
                <button class="t1-tab" onclick="t1TrendSetFilter('GO',this)" style="color:#10b981">🟢 GO ${goCount}</button>
                <button class="t1-tab" onclick="t1TrendSetFilter('WATCH',this)" style="color:#f59e0b">🟡 WATCH ${watchCount}</button>
                <button class="t1-tab" onclick="t1TrendSetFilter('SKIP',this)" style="color:#ef4444">🔴 SKIP ${skipCount}</button>
            </div>
            <div class="t1-trend-batch-btns">
                <button class="t1-mini-btn" onclick="t1TrendSelectAllGo()">✅ GO 전체선택</button>
                <button class="t1-mini-btn" onclick="t1TrendDeselectAll()">☐ 선택해제</button>
                <button class="t1-action-btn t1-btn-studio" onclick="t1TrendSendToT5()">🎬 T5 대기열 전달</button>
                <button class="t1-action-btn" onclick="t1TrendSendToT2()">📦 T2 재고 담기</button>
            </div>
        </div>`;

    // 상품 테이블
    const filtered = T1Trend.filterSignal === 'ALL'
        ? T1Trend.analyzedItems
        : T1Trend.analyzedItems.filter(i => i.signal === T1Trend.filterSignal);

    html += `<div class="t1-trend-table-wrap"><table class="t1-trend-table">
        <thead><tr>
            <th><input type="checkbox" onchange="t1TrendToggleAll(this.checked)"></th>
            <th>신호</th><th>상품명</th><th>도매처</th><th>도매가</th><th>시중평균</th><th>최적마진</th><th>최적마켓</th><th>액션</th>
        </tr></thead><tbody>`;

    filtered.forEach((item, idx) => {
        const signalEmoji = item.signal === 'GO' ? '🟢' : item.signal === 'WATCH' ? '🟡' : '🔴';
        const marginClass = item.bestMargin >= 25 ? 't1-c-green' : item.bestMargin >= 15 ? 't1-c-warn' : 't1-c-red';
        const globalIdx = T1Trend.analyzedItems.indexOf(item);

        html += `<tr>
            <td><input type="checkbox" ${item.checked ? 'checked' : ''} onchange="T1Trend.analyzedItems[${globalIdx}].checked=this.checked"></td>
            <td>${signalEmoji} ${item.signal}</td>
            <td class="t1-trend-td-name">
                ${item.image ? `<img src="${item.image}" class="t1-trend-thumb" onerror="this.style.display='none'"/>` : ''}
                <span>${escapeHtml(item.name)}</span>
            </td>
            <td><span style="color:#f59e0b">${escapeHtml(item.source)}</span></td>
            <td style="text-align:right">${fmt(item.wholesalePrice)}</td>
            <td style="text-align:right">${fmt(item.avgPrice)}</td>
            <td style="text-align:right;font-weight:700" class="${marginClass}">${item.bestMargin}%</td>
            <td>${escapeHtml(item.bestMarket)}</td>
            <td>
                <button class="t1-mini-btn" onclick="sendToStudio({title:'${escapeHtml(item.name).replace(/'/g,"\\'")}',price:${item.avgPrice},wholesale_price:${item.wholesalePrice},image:'${item.image}',keyword:'${escapeHtml(item.keyword).replace(/'/g,"\\'")}'})" title="T5 상세페이지">T5</button>
                <button class="t1-mini-btn" onclick="confirmSourcing({title:'${escapeHtml(item.name).replace(/'/g,"\\'")}',_wsPrice:${item.wholesalePrice},lprice:${item.avgPrice},image:'${item.image}',keyword:'${escapeHtml(item.keyword).replace(/'/g,"\\'")}'})" title="T2 재고담기">T2</button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    html += `<div class="t1-table-footer">${filtered.length}개 표시 (전체 ${T1Trend.analyzedItems.length}개)</div>`;

    panel.innerHTML = html;
}

// ─── 필터/선택 함수들 ───
function t1TrendSetFilter(signal, btn) {
    T1Trend.filterSignal = signal;
    document.querySelectorAll('#t1-trend-analysis .t1-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTrendAnalysis(
        T1Trend.analyzedItems[0]?.keyword || '',
        T1Trend.analyzedItems[0]?.avgPrice || 0,
        T1Trend.analyzedItems[0]?.minPrice || 0,
        T1Trend.analyzedItems[0]?.maxPrice || 0,
    );
}

function t1TrendSelectAllGo() {
    T1Trend.analyzedItems.forEach(i => { if (i.signal === 'GO') i.checked = true; });
    renderTrendAnalysis(
        T1Trend.analyzedItems[0]?.keyword || '',
        T1Trend.analyzedItems[0]?.avgPrice || 0,
        T1Trend.analyzedItems[0]?.minPrice || 0,
        T1Trend.analyzedItems[0]?.maxPrice || 0,
    );
}

function t1TrendDeselectAll() {
    T1Trend.analyzedItems.forEach(i => { i.checked = false; });
    renderTrendAnalysis(
        T1Trend.analyzedItems[0]?.keyword || '',
        T1Trend.analyzedItems[0]?.avgPrice || 0,
        T1Trend.analyzedItems[0]?.minPrice || 0,
        T1Trend.analyzedItems[0]?.maxPrice || 0,
    );
}

function t1TrendToggleAll(checked) {
    const signal = T1Trend.filterSignal;
    T1Trend.analyzedItems.forEach(i => {
        if (signal === 'ALL' || i.signal === signal) i.checked = checked;
    });
    renderTrendAnalysis(
        T1Trend.analyzedItems[0]?.keyword || '',
        T1Trend.analyzedItems[0]?.avgPrice || 0,
        T1Trend.analyzedItems[0]?.minPrice || 0,
        T1Trend.analyzedItems[0]?.maxPrice || 0,
    );
}

// ─── T5 대기열 전달 ───
function t1TrendSendToT5() {
    const selected = T1Trend.analyzedItems.filter(i => i.checked);
    if (!selected.length) { showToast('선택된 상품이 없습니다'); return; }

    AppEventBus.emit('BULK_TO_STUDIO', selected.map(item => ({
        name: item.name,
        price: item.avgPrice,
        wholesale_price: item.wholesalePrice,
        image: item.image,
        keyword: item.keyword,
    })));

    showTab('studio');
    showToast(`🎬 ${selected.length}개 트렌드 상품 → T5 상세페이지 대기열 전달`, 'success');
}

// ─── T2 재고 담기 ───
function t1TrendSendToT2() {
    const selected = T1Trend.analyzedItems.filter(i => i.checked);
    if (!selected.length) { showToast('선택된 상품이 없습니다'); return; }

    selected.forEach(item => {
        confirmSourcing({
            title: item.name,
            _wsPrice: item.wholesalePrice,
            lprice: item.avgPrice,
            image: item.image,
            keyword: item.keyword,
        });
    });
    showToast(`📦 ${selected.length}개 트렌드 상품 → T2 재고 일괄 등록`, 'success');
}

// ─── 전역 노출 ───
window.T1Trend = T1Trend;
window.t1TrendLoadCategories = t1TrendLoadCategories;
window.t1TrendSelectCategory = t1TrendSelectCategory;
window.t1TrendAnalyzeKeyword = t1TrendAnalyzeKeyword;
window.t1TrendSetFilter = t1TrendSetFilter;
window.t1TrendSelectAllGo = t1TrendSelectAllGo;
window.t1TrendDeselectAll = t1TrendDeselectAll;
window.t1TrendToggleAll = t1TrendToggleAll;
window.t1TrendSendToT5 = t1TrendSendToT5;
window.t1TrendSendToT2 = t1TrendSendToT2;
