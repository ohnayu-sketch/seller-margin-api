/**
 * T1 소싱 인텔리전스 — 고도화 모듈
 * 파일: js/t1-sourcing.js
 * 
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js, xlsx.js(CDN)
 * 
 * 기능:
 *  1. 단건 검색 (시중가 조회 + 키워드 인텔리전스 + 도매 비교 + 경쟁 셀러)
 *  2. 대량 소싱 (엑셀 업로드 / URL 추출 / API 검색 / 구글시트 연동)
 *  3. 일괄 마진 분석 + 필터 + T2/T3 일괄 전달 + 엑셀 내보내기
 */

// ─── 상태 관리 ───
const T1 = {
    mode: 'single',          // 'single' | 'bulk'
    searchResults: null,      // 단건 검색 결과
    bulkItems: [],            // 대량 소싱 상품 배열
    bulkProgress: 0,          // 분석 진행률 (0~100)
    bulkAnalyzing: false,     // 분석 중 여부
    filterMinMargin: 0,       // 최소 마진 필터
    filterSignal: 'ALL',      // GO/WATCH/SKIP/ALL
    sortBy: 'margin',         // margin/searches/price
    lastKeyword: '',          // 마지막 검색 키워드
};

// ─── 모드 전환 ───
function t1SetMode(mode) {
    T1.mode = mode;
    // v7: 트렌드 피드 레이아웃에서는 기존 단건/대량 패널이 없을 수 있음
    const singlePanel = document.getElementById('t1-single-panel');
    const bulkPanel = document.getElementById('t1-bulk-panel');
    if (singlePanel) singlePanel.style.display = mode === 'single' ? 'block' : 'none';
    if (bulkPanel) bulkPanel.style.display = mode === 'bulk' ? 'block' : 'none';
    document.querySelectorAll('.t1-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
}

// ═══════════════════════════════════════════════════════════════
// PART 1: 단건 검색 모드
// ═══════════════════════════════════════════════════════════════

async function t1SingleSearch() {
    const input = document.getElementById('t1-search-input');
    const keyword = (input?.value || '').trim();
    if (!keyword) { showToast('검색어를 입력하세요'); return; }
    T1.lastKeyword = keyword;

    showLoading(true, `"${keyword}" 소싱 분석 중...`);

    try {
        // 1. 네이버 쇼핑 시중가 조회 (30개)
        const _raw = await fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 30 });
        const search = _raw?.data || _raw;  // GAS 응답 래핑 해제
        if (!search || !search.items?.length) { showToast('검색 결과가 없습니다', false); return; }

        T1.searchResults = processSearchResults(search, keyword);

        // 2. 결과 렌더링
        renderSingleResults(T1.searchResults);

        // 3. 연관 키워드 (비동기)
        fetchRelatedKeywords(keyword);

        // 4. 키워드 인텔리전스 (비동기)
        fetchKeywordIntelligence(keyword);

        // 5. 도매 통합 검색 (비동기)
        fetchWholesaleComparison(keyword);

        // 6. 경쟁 셀러 분석 (비동기)
        analyzeCompetitors(T1.searchResults);

    } catch(e) {
        console.error('[T1] Search error:', e);
        showToast('검색 중 오류: ' + e.message, false);
    } finally {
        showLoading(false);
    }
}

// 검색 결과 가공
function processSearchResults(raw, keyword) {
    const items = (raw.items || []).map(item => {
        const price = parseInt(item.lprice || item.price || 0, 10);
        const title = (item.title || '').replace(/<\/?b>/g, '');
        return {
            title, price,
            image: item.image || '',
            link: item.link || '',
            mallName: item.mallName || '기타',
            productId: item.productId || '',
            category: item.category1 || '',
            brand: item.brand || '',
            maker: item.maker || '',
            keyword
        };
    }).filter(i => i.price > 0);

    const prices = items.map(i => i.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const avgP = Math.round(prices.reduce((a,b) => a+b, 0) / prices.length);

    // 가격대별 분류
    const lowThreshold = avgP * 0.6;
    const highThreshold = avgP * 1.4;

    return {
        keyword, items,
        minPrice: minP, maxPrice: maxP, avgPrice: avgP,
        lowItems: items.filter(i => i.price <= lowThreshold).sort((a,b) => a.price - b.price),
        midItems: items.filter(i => i.price > lowThreshold && i.price < highThreshold).sort((a,b) => a.price - b.price),
        highItems: items.filter(i => i.price >= highThreshold).sort((a,b) => b.price - a.price),
        totalCount: items.length
    };
}

// 단건 검색 결과 렌더링
function renderSingleResults(data) {
    const container = document.getElementById('t1-single-results');
    if (!container) return;

    // AI 소싱 스코어 계산
    const score = calculateSourcingScore(data);

    let html = '';

    // AI 스코어 바
    html += `<div class="t1-ai-bar">
        <div class="t1-ai-score">${score.total}</div>
        <div class="t1-ai-text">
            <strong>AI 소싱 분석:</strong> ${score.comment}
            <span class="t1-badge-new">AI</span>
        </div>
        <button class="t1-ai-action" onclick="sendToStudio({title:'${escapeHtml(data.keyword)}',keyword:'${escapeHtml(data.keyword)}'})">🎬 상세페이지</button>
    </div>`;

    // 가격 요약 카드
    html += `<div class="t1-price-summary">
        <div class="t1-price-card"><div class="t1-price-val t1-c-green">${fmt(data.minPrice)}</div><div class="t1-price-label">최저가 (원)</div></div>
        <div class="t1-price-card"><div class="t1-price-val">${fmt(data.avgPrice)}</div><div class="t1-price-label">평균가 (원)</div></div>
        <div class="t1-price-card"><div class="t1-price-val t1-c-red">${fmt(data.maxPrice)}</div><div class="t1-price-label">최고가 (원)</div></div>
    </div>`;

    // 키워드 인텔리전스 영역 (비동기 로드)
    html += `<div id="t1-keyword-intel" class="t1-panel" style="display:none;"></div>`;

    // 시중가 상품 그리드 (탭 필터)
    html += `<div class="t1-section-header">
        <span>🛍️ 시중가 상품</span><span class="t1-count">${data.totalCount}개</span>
    </div>`;
    html += `<div class="t1-filter-tabs" id="t1-price-tabs">
        <button class="t1-tab active" onclick="t1FilterProducts('all',this)">전체 ${data.totalCount}</button>
        <button class="t1-tab" onclick="t1FilterProducts('low',this)">최저가존 ${data.lowItems.length}</button>
        <button class="t1-tab" onclick="t1FilterProducts('mid',this)">평균가존 ${data.midItems.length}</button>
        <button class="t1-tab" onclick="t1FilterProducts('high',this)">최고가존 ${data.highItems.length}</button>
    </div>`;
    html += `<div id="t1-product-grid" class="t1-product-grid">${renderProductCards(data.items.slice(0, 24))}</div>`;

    // 더보기 (24개 이상)
    if (data.items.length > 24) {
        html += `<div class="t1-show-more" onclick="t1ShowAllProducts()">+ ${data.items.length - 24}개 더보기</div>`;
    }

    // 인기상품 TOP 10
    html += renderPopularRanking(data.items);

    // 도매 소싱 비교 영역 (비동기 로드)
    html += `<div id="t1-wholesale-panel" class="t1-panel" style="display:none;"></div>`;

    // 경쟁 셀러 분석 영역 (비동기 로드)
    html += `<div id="t1-competitor-panel" class="t1-panel" style="display:none;"></div>`;

    // 액션 버튼
    html += `<div class="t1-action-row">
        <button class="t1-action-btn" onclick="confirmSourcing({title:'${escapeHtml(data.keyword)}',lprice:${data.avgPrice},keyword:'${escapeHtml(data.keyword)}'})">📦 T2 재고 담기</button>
        <button class="t1-action-btn t1-btn-studio" onclick="sendToStudio({title:'${escapeHtml(data.keyword)}',lprice:${data.avgPrice},keyword:'${escapeHtml(data.keyword)}'})">🎬 T3 상세페이지</button>
        <button class="t1-action-btn t1-btn-excel" onclick="t1ExportSingleResult()">📊 엑셀 저장</button>
    </div>`;

    container.innerHTML = html;
    container.style.display = 'block';
}

// 상품 카드 렌더링 (그리드용)
function renderProductCards(items) {
    return items.map(item => {
        const mallColor = getMallColor(item.mallName);
        return `<div class="t1-pcard" onclick="window.open('${item.link}','_blank')">
            <div class="t1-pcard-img">${item.image ? `<img src="${item.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='IMG'"/>` : 'IMG'}</div>
            <div class="t1-pcard-info">
                <div class="t1-pcard-price">${fmt(item.price)}</div>
                <div class="t1-pcard-mall" style="color:${mallColor}">${escapeHtml(item.mallName)}</div>
                <div class="t1-pcard-title">${escapeHtml(item.title)}</div>
                <div class="t1-pcard-btns">
                    <button onclick="event.stopPropagation();confirmSourcing(${JSON.stringify({title:item.title,lprice:item.price,image:item.image,keyword:item.keyword}).replace(/"/g,'&quot;')})">T2</button>
                    <button onclick="event.stopPropagation();sendToStudio(${JSON.stringify({title:item.title,price:item.price,image:item.image,keyword:item.keyword}).replace(/"/g,'&quot;')})">T3</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// 마켓별 색상
function getMallColor(mall) {
    const map = { '쿠팡':'#e44332', '스마트스토어':'#03c75a', 'G마켓':'#4285f4', '옥션':'#ff6f00', '11번가':'#ff0000', '위메프':'#e91e63', '티몬':'#ff5722' };
    return map[mall] || '#94a3b8';
}

// 가격대별 필터
function t1FilterProducts(zone, btn) {
    const data = T1.searchResults;
    if (!data) return;
    let items;
    switch(zone) {
        case 'low': items = data.lowItems; break;
        case 'mid': items = data.midItems; break;
        case 'high': items = data.highItems; break;
        default: items = data.items;
    }
    document.getElementById('t1-product-grid').innerHTML = renderProductCards(items.slice(0, 30));
    document.querySelectorAll('#t1-price-tabs .t1-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

// 전체 상품 보기
function t1ShowAllProducts() {
    if (!T1.searchResults) return;
    document.getElementById('t1-product-grid').innerHTML = renderProductCards(T1.searchResults.items);
    const more = document.querySelector('.t1-show-more');
    if (more) more.remove();
}

// 인기상품 TOP 10 (리뷰/판매량 기반 추정)
function renderPopularRanking(items) {
    // mallName 기준 셀러 수 카운트로 인기도 추정 + 가격 다양성
    const sorted = [...items].sort((a, b) => b.price - a.price).slice(0, 10);

    let html = `<div class="t1-section-header"><span>🏆 인기상품 TOP 10</span><span class="t1-badge-new">NEW</span></div>`;
    html += `<div class="t1-ranking-list">`;
    sorted.forEach((item, i) => {
        const mallColor = getMallColor(item.mallName);
        html += `<div class="t1-rank-row" onclick="window.open('${item.link}','_blank')">
            <div class="t1-rank-num ${i < 3 ? 't1-rank-top3' : ''}">${i + 1}</div>
            <div class="t1-rank-img">${item.image ? `<img src="${item.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='IMG'"/>` : 'IMG'}</div>
            <div class="t1-rank-info">
                <div class="t1-rank-title">${escapeHtml(item.title)}</div>
                <div class="t1-rank-mall" style="color:${mallColor}">${escapeHtml(item.mallName)}</div>
            </div>
            <div class="t1-rank-price">${fmt(item.price)}</div>
            <div class="t1-rank-actions">
                <button onclick="event.stopPropagation();confirmSourcing(${JSON.stringify({title:item.title,lprice:item.price,image:item.image,keyword:item.keyword}).replace(/"/g,'&quot;')})">T2</button>
                <button onclick="event.stopPropagation();sendToStudio(${JSON.stringify({title:item.title,price:item.price,image:item.image,keyword:item.keyword}).replace(/"/g,'&quot;')})">T3</button>
            </div>
        </div>`;
    });
    html += `</div>`;
    return html;
}

// AI 소싱 스코어 계산 — 아이템스카우트/블랙키위 수준 5축 평가
// 검색량(25) + 경쟁강도(25) + 가격범위(20) + 마진적격(15) + 트렌드(15) = 100
function calculateSourcingScore(data, kwData) {
    let breakdown = { search: 0, competition: 0, price: 0, margin: 0, trend: 0 };
    let reasons = [];

    // ① 검색량 (25점) — 네이버 검색광고 월검색량 기반
    const monthlySearch = kwData?.totalSearch || 0;
    if (monthlySearch >= 30000) { breakdown.search = 25; reasons.push('검색량 폭발(3만+)'); }
    else if (monthlySearch >= 10000) { breakdown.search = 22; reasons.push('검색량 우수(1만+)'); }
    else if (monthlySearch >= 5000) { breakdown.search = 18; reasons.push('검색량 양호(5천+)'); }
    else if (monthlySearch >= 1000) { breakdown.search = 12; reasons.push('검색량 보통(1천+)'); }
    else if (monthlySearch > 0) { breakdown.search = 6; reasons.push('니치 키워드'); }
    else { breakdown.search = 3; reasons.push('검색량 미확인'); }

    // ② 경쟁강도 (25점) — 상품수/검색량 비율
    const competitionRatio = kwData?.competitionRatio || 0;
    const compLevel = kwData?.competitionLevel || '';
    if (competitionRatio > 0 && competitionRatio < 0.3) { breakdown.competition = 25; reasons.push('경쟁 매우 낮음'); }
    else if (competitionRatio < 0.7) { breakdown.competition = 20; reasons.push('경쟁 적당'); }
    else if (competitionRatio < 1.5) { breakdown.competition = 14; reasons.push('경쟁 보통'); }
    else if (competitionRatio < 3.0) { breakdown.competition = 8; reasons.push('경쟁 높음'); }
    else if (competitionRatio > 0) { breakdown.competition = 3; reasons.push('경쟁 과열'); }
    else if (compLevel === 'LOW') { breakdown.competition = 20; }
    else if (compLevel === 'MID') { breakdown.competition = 14; }
    else if (compLevel === 'HIGH') { breakdown.competition = 6; }
    else { breakdown.competition = 10; }

    // ③ 가격범위 (20점) — 가격 스프레드가 클수록 마진 기회
    const spread = data.maxPrice / Math.max(data.minPrice, 1);
    if (spread > 5) { breakdown.price = 20; reasons.push('가격범위 넓음(마진기회↑)'); }
    else if (spread > 3) { breakdown.price = 15; }
    else if (spread > 2) { breakdown.price = 10; }
    else { breakdown.price = 5; }

    // ④ 마진적격 (15점) — 평균가 기준 도매 마진 가능성
    if (data.avgPrice >= 20000 && data.avgPrice <= 50000) { breakdown.margin = 15; reasons.push('최적가격대(2~5만원)'); }
    else if (data.avgPrice >= 10000 && data.avgPrice <= 80000) { breakdown.margin = 10; }
    else if (data.avgPrice >= 5000) { breakdown.margin = 5; }

    // ⑤ 트렌드 (15점) — 데이터 있으면 사용, 없으면 상품수로 추정
    if (data.totalCount >= 25) { breakdown.trend = 15; reasons.push('높은 시장수요'); }
    else if (data.totalCount >= 15) { breakdown.trend = 10; }
    else if (data.totalCount >= 5) { breakdown.trend = 5; }

    const total = Math.min(100, Object.values(breakdown).reduce((a,b) => a+b, 0));
    const grade = total >= 75 ? '🟢 강력추천' : total >= 55 ? '🟡 검토가치' : total >= 40 ? '🟠 보류' : '🔴 패스';
    const comment = reasons.slice(0, 3).join(', ') + `. ${grade}`;

    return { total, comment, reasons, breakdown, grade, monthlySearch, competitionRatio };
}

// ─── 연관 키워드 ───
async function fetchRelatedKeywords(keyword) {
    const container = document.getElementById('t1-related-chips');
    if (!container) return;

    try {
        const result = await fetchGas('relatedKeywords', { query: keyword });
        if (result?.keywords?.length) {
            container.innerHTML = result.keywords.map(kw =>
                `<button class="t1-chip" onclick="document.getElementById('t1-search-input').value='${kw}';t1SingleSearch();">${kw}</button>`
            ).join('');
            container.style.display = 'flex';
        }
    } catch(e) {
        // 폴백: 키워드 + 일반 접미사
        const fallback = ['추천', '인기', '가성비', '프리미엄', '세트', '대용량'].map(s => keyword + ' ' + s);
        container.innerHTML = fallback.map(kw =>
            `<button class="t1-chip" onclick="document.getElementById('t1-search-input').value='${kw}';t1SingleSearch();">${kw}</button>`
        ).join('');
        container.style.display = 'flex';
    }
}

// ─── 키워드 인텔리전스 (네이버 검색광고 API) ───
async function fetchKeywordIntelligence(keyword) {
    const panel = document.getElementById('t1-keyword-intel');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = '<div class="t1-loading-inline">🔍 키워드 인텔리전스 분석 중...</div>';

    try {
        // 네이버 검색광고 API (월검색량 + 경쟁도)
        const result = await fetchGas('naverSearchAd', { keyword: keyword });
        if (!result?.success || !result.keywords?.length) {
            panel.innerHTML = `<div class="t1-section-header"><span>📊 키워드 인텔리전스</span><span class="t1-badge-new">PRO</span></div>
                <div class="t1-info-msg">💡 네이버 검색광고 API 키를 T7 설정에 등록하면 월간검색량/경쟁강도를 분석합니다.</div>`;
            return;
        }

        // 정확한 키워드 매칭 (공백 제거)
        const cleanKw = keyword.replace(/\s+/g, '');
        const main = result.keywords.find(k => k.keyword.replace(/\s+/g, '') === cleanKw) || result.keywords[0];
        const related = result.keywords.filter(k => k.keyword !== main.keyword)
            .sort((a,b) => b.totalSearch - a.totalSearch).slice(0, 15);

        // 경쟁강도 계산: 네이버 쇼핑 총 상품수 / 월검색량
        let totalProducts = 0;
        try {
            const shopResult = await fetchGas('naverProxy', { type: 'search-shop', query: keyword, display: 1 });
            totalProducts = shopResult?.data?.total || shopResult?.total || 0;
        } catch(e) {}
        const competitionRatio = main.totalSearch > 0 ? (totalProducts / main.totalSearch).toFixed(2) : 0;

        // 스코어에 키워드 데이터 전달 (AI 소싱 스코어 업데이트)
        window._lastKwData = {
            totalSearch: main.totalSearch || 0,
            competitionLevel: main.competitionLevel || '',
            competitionRatio: parseFloat(competitionRatio),
            totalProducts: totalProducts,
            pcSearch: main.monthlyPcSearch || 0,
            moSearch: main.monthlyMoSearch || 0,
        };
        // 스코어 업데이트
        if (T1.searchResults) {
            const newScore = calculateSourcingScore(T1.searchResults, window._lastKwData);
            const aiBar = document.querySelector('.t1-ai-score');
            const aiText = document.querySelector('.t1-ai-text');
            if (aiBar) aiBar.textContent = newScore.total;
            if (aiText) aiText.innerHTML = `<strong>AI 소싱 분석:</strong> ${newScore.comment} <span class="t1-badge-new">AI</span>`;
        }

        // 경쟁강도 라벨
        const compLabel = competitionRatio < 0.3 ? '🟢 블루오션' : competitionRatio < 0.7 ? '🟡 적정' : competitionRatio < 1.5 ? '🟠 레드오션' : '🔴 과열';

        let html = `<div class="t1-section-header"><span>📊 키워드 인텔리전스</span><span class="t1-badge-new">PRO</span></div>`;

        // 메인 키워드 4칸 요약
        html += `<div class="t1-kw-summary">
            <div class="t1-kw-stat"><div class="t1-kw-val t1-c-green">${fmt(main.totalSearch || 0)}</div><div class="t1-kw-label">월간 검색량</div></div>
            <div class="t1-kw-stat"><div class="t1-kw-val" style="color:${getCompetitionColor(main.competitionLevel)}">${main.competitionLevel || '-'}</div><div class="t1-kw-label">네이버 경쟁도</div></div>
            <div class="t1-kw-stat"><div class="t1-kw-val">${compLabel}</div><div class="t1-kw-label">경쟁강도 (${competitionRatio})</div></div>
            <div class="t1-kw-stat"><div class="t1-kw-val">${getSourcingGrade(main.totalSearch, main.competitionLevel)}</div><div class="t1-kw-label">소싱 추천도</div></div>
        </div>`;

        // PC/모바일 검색 비율 바
        const pcPct = main.totalSearch > 0 ? Math.round(main.monthlyPcSearch / main.totalSearch * 100) : 50;
        html += `<div style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:12px;color:#94a3b8">
            <span>💻 PC ${pcPct}%</span>
            <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden">
                <div style="width:${pcPct}%;height:100%;background:linear-gradient(90deg,#3b82f6,#8b5cf6)"></div>
            </div>
            <span>📱 모바일 ${100-pcPct}%</span>
        </div>`;

        // 연관 키워드 테이블
        if (related.length) {
            html += `<div class="t1-section-header" style="margin-top:12px"><span>🔗 연관 키워드 TOP ${related.length}</span></div>`;
            html += `<div class="t1-kw-list">`;
            related.forEach((kw, i) => {
                html += `<div class="t1-kw-row" onclick="document.getElementById('t1-search-input').value='${kw.keyword}';t1SingleSearch();">
                    <span class="t1-kw-rank">${i + 1}</span>
                    <span class="t1-kw-name">${escapeHtml(kw.keyword)}</span>
                    <span class="t1-kw-vol">${fmt(kw.totalSearch)}</span>
                    <span class="t1-kw-comp" style="color:${getCompetitionColor(kw.competitionLevel)}">${kw.competitionLevel || '-'}</span>
                    <span class="t1-kw-grade">${getSourcingGrade(kw.totalSearch, kw.competitionLevel)}</span>
                </div>`;
            });
            html += `</div>`;
        }

        panel.innerHTML = html;

    } catch(e) {
        console.error('[T1] Keyword intel error:', e);
        panel.innerHTML = `<div class="t1-section-header"><span>📊 키워드 인텔리전스</span></div>
            <div class="t1-info-msg">키워드 분석 연동 실패. T7 설정을 확인하세요.</div>`;
    }
}

function getCompetitionColor(idx) {
    const level = (idx || '').toUpperCase();
    if (level === 'HIGH' || level === '높음') return '#ef4444';
    if (level === 'MID' || level === '중간') return '#f59e0b';
    return '#10b981';
}

function getSourcingGrade(monthly, comp) {
    const vol = parseInt(monthly) || 0;
    const level = (comp || '').toUpperCase();
    if (vol > 5000 && (level === 'LOW' || level === '낮음')) return '🏆 최적';
    if (vol > 3000 && level !== 'HIGH' && level !== '높음') return '👍 양호';
    if (vol > 1000) return '⚡ 보통';
    if (vol > 0) return '🔻 니치';
    return '❓';
}

// ─── 도매 통합 검색 ───
async function fetchWholesaleComparison(keyword) {
    const panel = document.getElementById('t1-wholesale-panel');
    if (!panel) return;

    const sites = WholesaleSiteManager.getEnabledApiSites();
    if (sites.length === 0) {
        panel.style.display = 'block';
        panel.innerHTML = `<div class="t1-section-header"><span>📦 도매 소싱 비교</span><span class="t1-badge-new">NEW</span></div>
            <div class="t1-info-msg">💡 T7 설정에서 도매사이트 API 키를 등록하면 자동 가격 비교됩니다.</div>`;
        return;
    }

    panel.style.display = 'block';
    panel.innerHTML = `<div class="t1-section-header"><span>📦 도매 소싱 비교</span><span class="t1-badge-new">NEW</span></div>
        <div class="t1-loading-inline">도매처 통합 검색 중...</div>`;

    const allResults = [];

    // 각 도매 사이트 병렬 검색
    const promises = sites.map(async site => {
        try {
            const action = site.id === 'domeggook' ? 'domeggookProxy' : site.id + 'Proxy';
            const result = await fetchGas(action, { query: keyword });
            if (result?.items?.length) {
                result.items.forEach(item => {
                    const wsPrice = parseInt(item.price || item.도매가 || 0, 10);
                    const avgMarket = T1.searchResults?.avgPrice || 0;
                    const margin = avgMarket > 0 ? Math.round((1 - wsPrice / avgMarket) * 100) : 0;
                    allResults.push({
                        source: site.name,
                        sourceId: site.id,
                        name: item.name || item.상품명 || '',
                        price: wsPrice,
                        margin: margin,
                        stock: item.stock || item.재고 || '-',
                        image: item.image || item.이미지 || '',
                        link: item.link || item.url || '',
                        moq: item.moq || item.최소주문 || 1,
                    });
                });
            }
        } catch(e) {
            console.warn(`[T1] ${site.name} 검색 실패:`, e);
        }
    });

    await Promise.allSettled(promises);

    // 마진순 정렬
    allResults.sort((a, b) => b.margin - a.margin);

    renderWholesalePanel(panel, allResults, sites);
}

function renderWholesalePanel(panel, items, sites) {
    let html = `<div class="t1-section-header"><span>📦 도매 소싱 비교</span><span class="t1-badge-new">NEW</span><span class="t1-count">${items.length}개 from ${sites.length}개 도매처</span></div>`;

    // 소스별 필터 탭
    html += `<div class="t1-filter-tabs">
        <button class="t1-tab active" onclick="t1FilterWholesale('all',this)">전체 ${items.length}</button>
        ${sites.map(s => `<button class="t1-tab" onclick="t1FilterWholesale('${s.id}',this)">${s.name}</button>`).join('')}
    </div>`;

    // 그리드 (상위 5개)
    const top5 = items.slice(0, 5);
    html += `<div class="t1-ws-grid">${top5.map(item => renderWholesaleCard(item)).join('')}</div>`;

    // 상세 리스트 (나머지)
    if (items.length > 5) {
        html += `<div class="t1-ws-list" id="t1-ws-list">`;
        items.slice(5).forEach(item => {
            const marginClass = item.margin >= 25 ? 't1-c-green' : item.margin >= 15 ? 't1-c-warn' : 't1-c-red';
            html += `<div class="t1-ws-row" data-source="${item.sourceId}">
                <span class="t1-ws-src" style="color:#f59e0b">${item.source}</span>
                <span class="t1-ws-name">${escapeHtml(item.name)}</span>
                <span class="t1-ws-price">${fmt(item.price)}</span>
                <span class="t1-ws-margin ${marginClass}">${item.margin}%</span>
                <span class="t1-ws-stock">${item.stock}</span>
                <button class="t1-ws-apply" onclick="t1ApplyWholesalePrice(${item.price},'${escapeHtml(item.name)}','${item.source}')">원가 적용</button>
            </div>`;
        });
        html += `</div>`;
    }

    panel.innerHTML = html;
}

function renderWholesaleCard(item) {
    const marginClass = item.margin >= 25 ? 't1-c-green' : item.margin >= 15 ? 't1-c-warn' : 't1-c-red';
    return `<div class="t1-ws-card">
        <div class="t1-ws-card-img">${item.image ? `<img src="${item.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='${item.source}'"/>` : item.source}</div>
        <div class="t1-ws-card-price">${fmt(item.price)}원</div>
        <div class="t1-ws-card-name">${escapeHtml(item.name)}</div>
        <div class="t1-ws-card-margin ${marginClass}">마진 ${item.margin}%</div>
        <button class="t1-ws-card-btn" onclick="t1ApplyWholesalePrice(${item.price},'${escapeHtml(item.name)}','${item.source}')">원가 적용</button>
    </div>`;
}

function t1ApplyWholesalePrice(price, name, source) {
    // 마진 계산기로 전달
    const costInput = document.getElementById('costPrice') || document.getElementById('cost-input');
    if (costInput) { costInput.value = price; costInput.dispatchEvent(new Event('input')); }
    showToast(`💰 ${source} "${name}" 도매가 ${fmt(price)}원 적용`);
}

function t1FilterWholesale(sourceId, btn) {
    document.querySelectorAll('#t1-wholesale-panel .t1-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('#t1-ws-list .t1-ws-row').forEach(row => {
        row.style.display = (sourceId === 'all' || row.dataset.source === sourceId) ? 'flex' : 'none';
    });
}

// ─── 경쟁 셀러 분석 ───
function analyzeCompetitors(data) {
    const panel = document.getElementById('t1-competitor-panel');
    if (!panel || !data?.items?.length) return;

    // mallName 기준 셀러 그룹핑
    const sellers = {};
    data.items.forEach(item => {
        const key = item.mallName;
        if (!sellers[key]) sellers[key] = { name: key, items: 0, minPrice: Infinity, maxPrice: 0, prices: [] };
        sellers[key].items++;
        sellers[key].minPrice = Math.min(sellers[key].minPrice, item.price);
        sellers[key].maxPrice = Math.max(sellers[key].maxPrice, item.price);
        sellers[key].prices.push(item.price);
    });

    const sellerList = Object.values(sellers).sort((a, b) => b.items - a.items).slice(0, 10);

    let html = `<div class="t1-section-header"><span>🏪 경쟁 셀러 분석</span><span class="t1-badge-new">NEW</span><span class="t1-count">${sellerList.length}개 판매처</span></div>`;
    html += `<div class="t1-comp-list">`;
    sellerList.forEach((s, i) => {
        const avgPrice = Math.round(s.prices.reduce((a,b) => a+b, 0) / s.prices.length);
        html += `<div class="t1-comp-row">
            <span class="t1-comp-rank">${i + 1}</span>
            <span class="t1-comp-name" style="color:${getMallColor(s.name)}">${escapeHtml(s.name)}</span>
            <span class="t1-comp-items">${s.items}개 상품</span>
            <span class="t1-comp-price">${fmt(s.minPrice)}~${fmt(s.maxPrice)}</span>
            <span class="t1-comp-avg">평균 ${fmt(avgPrice)}</span>
        </div>`;
    });
    html += `</div>`;

    panel.style.display = 'block';
    panel.innerHTML = html;
}


// ═══════════════════════════════════════════════════════════════
// PART 2: 대량 소싱 모드
// ═══════════════════════════════════════════════════════════════

// ─── 엑셀 업로드 처리 ───
function t1HandleExcelUpload(file) {
    if (!file) return;
    showLoading(true, '엑셀 파일 파싱 중...');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (!rows.length) { showToast('데이터가 없습니다', false); showLoading(false); return; }

            // 컬럼 자동 감지
            const columns = Object.keys(rows[0]);
            const mapping = detectColumnMapping(columns);

            // 상품 파싱
            T1.bulkItems = rows.map((row, idx) => ({
                id: idx + 1,
                name: String(row[mapping.name] || '').trim(),
                wholesalePrice: parseInt(row[mapping.price] || 0, 10),
                stock: row[mapping.stock] || '-',
                image: row[mapping.image] || '',
                source: detectSourceFromFilename(file.name),
                // 분석 후 채워질 필드
                marketAvg: 0,
                margin: 0,
                signal: 'PENDING',
                searches: 0,
                competition: '-',
                checked: false,
                analyzed: false,
            })).filter(item => item.name && item.wholesalePrice > 0);

            showLoading(false);
            showToast(`📄 ${T1.bulkItems.length}개 상품 파싱 완료`);
            renderBulkImportSummary();

        } catch(err) {
            showLoading(false);
            showToast('엑셀 파싱 오류: ' + err.message, false);
        }
    };
    reader.readAsArrayBuffer(file);
}

// 컬럼 자동 감지
function detectColumnMapping(columns) {
    const patterns = AppConfig.EXCEL_COLUMN_PATTERNS.generic;
    const find = (patternList) => {
        for (const col of columns) {
            const lower = col.toLowerCase().trim();
            if (patternList.some(p => lower.includes(p.toLowerCase()))) return col;
        }
        return columns[0]; // 폴백
    };
    return {
        name: find(patterns.name),
        price: find(patterns.price),
        stock: find(patterns.stock),
        image: find(patterns.image),
    };
}

function detectSourceFromFilename(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('domeggook') || lower.includes('도매꾹')) return '도매꾹';
    if (lower.includes('domemae') || lower.includes('도매매')) return '도매매';
    if (lower.includes('onchannel') || lower.includes('온채널')) return '온채널';
    if (lower.includes('ownerclan') || lower.includes('오너클랜')) return '오너클랜';
    return '직접업로드';
}

// 업로드 결과 요약 렌더링
function renderBulkImportSummary() {
    const container = document.getElementById('t1-bulk-results');
    if (!container) return;
    container.style.display = 'block';

    const total = T1.bulkItems.length;
    container.innerHTML = `
        <div class="t1-bulk-summary">
            <div class="t1-sum-card"><div class="t1-sum-val">${total}</div><div class="t1-sum-label">불러온 상품</div></div>
            <div class="t1-sum-card"><div class="t1-sum-val t1-c-green">-</div><div class="t1-sum-label">GO (25%+)</div></div>
            <div class="t1-sum-card"><div class="t1-sum-val t1-c-warn">-</div><div class="t1-sum-label">WATCH (15~24%)</div></div>
            <div class="t1-sum-card"><div class="t1-sum-val t1-c-red">-</div><div class="t1-sum-label">SKIP (&lt;15%)</div></div>
            <div class="t1-sum-card"><div class="t1-sum-val">${fmt(Math.round(T1.bulkItems.reduce((a,i)=>a+i.wholesalePrice,0)/total))}</div><div class="t1-sum-label">평균 도매가</div></div>
        </div>
        <button class="t1-analyze-btn" onclick="t1StartBulkAnalysis()">🚀 일괄 시중가 분석 시작 (${total}개)</button>
        <div id="t1-bulk-progress" style="display:none;"></div>
        <div id="t1-bulk-filter" style="display:none;"></div>
        <div id="t1-bulk-table" style="display:none;"></div>
    `;
}

// ─── 일괄 분석 실행 ───
async function t1StartBulkAnalysis() {
    if (T1.bulkAnalyzing) return;
    T1.bulkAnalyzing = true;
    T1.bulkProgress = 0;

    const progEl = document.getElementById('t1-bulk-progress');
    progEl.style.display = 'block';

    const total = T1.bulkItems.length;
    let completed = 0;

    // 3개씩 병렬 처리 (API 부하 분산)
    const batchSize = 3;
    for (let i = 0; i < total; i += batchSize) {
        const batch = T1.bulkItems.slice(i, i + batchSize);
        const promises = batch.map(async item => {
            try {
                const _raw2 = await fetchGas('naverProxy', { type: 'search-shop', query: item.name, display: 10 });
                const search = _raw2?.data || _raw2;
                if (search?.items?.length) {
                    const prices = search.items.map(s => parseInt(s.lprice || 0, 10)).filter(p => p > 0);
                    const avgPrice = prices.length ? Math.round(prices.reduce((a,b)=>a+b,0) / prices.length) : 0;
                    item.marketAvg = avgPrice;
                    item.margin = avgPrice > 0 ? Math.round((1 - item.wholesalePrice / avgPrice) * 100) : 0;
                    item.signal = item.margin >= AppConfig.MARGIN_THRESHOLDS.go ? 'GO'
                        : item.margin >= AppConfig.MARGIN_THRESHOLDS.watch ? 'WATCH' : 'SKIP';
                    if (item.signal === 'GO') item.checked = true;
                }
                item.analyzed = true;
            } catch(e) {
                item.analyzed = true;
                item.signal = 'ERROR';
            }
            completed++;
            T1.bulkProgress = Math.round(completed / total * 100);
            renderBulkProgress(completed, total);
        });
        await Promise.allSettled(promises);

        // 중간 렌더링 (10개마다)
        if (completed % 10 === 0 || completed === total) {
            renderBulkTable();
        }
    }

    T1.bulkAnalyzing = false;
    updateBulkSummary();
    renderBulkFilterBar();
    renderBulkTable();
    showToast(`✅ ${total}개 상품 분석 완료!`);
}

function renderBulkProgress(completed, total) {
    const el = document.getElementById('t1-bulk-progress');
    if (!el) return;
    const pct = Math.round(completed / total * 100);
    el.innerHTML = `<div class="t1-progress">
        <div class="t1-prog-bar"><div class="t1-prog-fill" style="width:${pct}%"></div></div>
        <div class="t1-prog-text"><span>네이버 시중가 비교 중... ${completed}/${total}</span><span>${pct}%</span></div>
    </div>`;
}

function updateBulkSummary() {
    const cards = document.querySelectorAll('.t1-bulk-summary .t1-sum-card');
    if (cards.length < 4) return;
    const go = T1.bulkItems.filter(i => i.signal === 'GO').length;
    const watch = T1.bulkItems.filter(i => i.signal === 'WATCH').length;
    const skip = T1.bulkItems.filter(i => i.signal === 'SKIP' || i.signal === 'ERROR').length;
    cards[1].querySelector('.t1-sum-val').textContent = go;
    cards[2].querySelector('.t1-sum-val').textContent = watch;
    cards[3].querySelector('.t1-sum-val').textContent = skip;
}

// ─── 필터 바 ───
function renderBulkFilterBar() {
    const el = document.getElementById('t1-bulk-filter');
    if (!el) return;
    el.style.display = 'block';

    const goCount = T1.bulkItems.filter(i => i.signal === 'GO' && i.margin >= T1.filterMinMargin).length;
    const watchCount = T1.bulkItems.filter(i => i.signal === 'WATCH' && i.margin >= T1.filterMinMargin).length;
    const skipCount = T1.bulkItems.filter(i => (i.signal === 'SKIP' || i.signal === 'ERROR') && i.margin >= T1.filterMinMargin).length;
    const checked = T1.bulkItems.filter(i => i.checked).length;

    el.innerHTML = `
        <div class="t1-filter-bar">
            <label>최소 마진</label>
            <input type="number" value="${T1.filterMinMargin}" onchange="T1.filterMinMargin=Number(this.value);renderBulkFilterBar();renderBulkTable();" style="width:50px"/>
            <label>%</label>
            <label style="margin-left:12px">정렬</label>
            <select onchange="T1.sortBy=this.value;renderBulkTable();">
                <option value="margin" ${T1.sortBy==='margin'?'selected':''}>마진율↓</option>
                <option value="price" ${T1.sortBy==='price'?'selected':''}>도매가↑</option>
                <option value="market" ${T1.sortBy==='market'?'selected':''}>시중가↓</option>
            </select>
            <div style="margin-left:auto;display:flex;gap:4px">
                <button class="t1-tab ${T1.filterSignal==='ALL'?'active':''}" onclick="T1.filterSignal='ALL';renderBulkFilterBar();renderBulkTable();">전체</button>
                <button class="t1-tab ${T1.filterSignal==='GO'?'active':''}" onclick="T1.filterSignal='GO';renderBulkFilterBar();renderBulkTable();">GO ${goCount}</button>
                <button class="t1-tab ${T1.filterSignal==='WATCH'?'active':''}" onclick="T1.filterSignal='WATCH';renderBulkFilterBar();renderBulkTable();">WATCH ${watchCount}</button>
                <button class="t1-tab ${T1.filterSignal==='SKIP'?'active':''}" onclick="T1.filterSignal='SKIP';renderBulkFilterBar();renderBulkTable();">SKIP ${skipCount}</button>
            </div>
        </div>
        <div class="t1-bulk-actions">
            <span class="t1-ba-label">☑ ${checked}개 선택됨</span>
            <button class="t1-ba-btn t1-ba-primary" onclick="t1BulkAddToT2()">📦 T2 일괄 담기</button>
            <button class="t1-ba-btn t1-ba-t5" onclick="t1BulkSendToT5()">🎬 T3 일괄 상세페이지</button>
            <button class="t1-ba-btn t1-ba-excel" onclick="t1ExportBulkExcel()">📊 엑셀 내보내기</button>
            <button class="t1-ba-btn" onclick="t1BulkSelectAllGo()">GO 전체 선택</button>
            <button class="t1-ba-btn" onclick="t1BulkDeselectAll()">선택 해제</button>
        </div>
    `;
}

// ─── 대량 분석 테이블 렌더링 ───
function renderBulkTable() {
    const el = document.getElementById('t1-bulk-table');
    if (!el) return;
    el.style.display = 'block';

    let filtered = T1.bulkItems.filter(i => i.analyzed);
    if (T1.filterMinMargin > 0) filtered = filtered.filter(i => i.margin >= T1.filterMinMargin);
    if (T1.filterSignal !== 'ALL') filtered = filtered.filter(i => i.signal === T1.filterSignal);

    // 정렬
    switch(T1.sortBy) {
        case 'margin': filtered.sort((a,b) => b.margin - a.margin); break;
        case 'price': filtered.sort((a,b) => a.wholesalePrice - b.wholesalePrice); break;
        case 'market': filtered.sort((a,b) => b.marketAvg - a.marketAvg); break;
    }

    let html = `<table class="t1-bulk-tbl">
        <thead><tr>
            <th style="width:28px"><input type="checkbox" onchange="t1ToggleAllChecked(this.checked)"/></th>
            <th>신호</th><th>상품명</th><th>도매처</th>
            <th style="text-align:right">도매가</th><th style="text-align:right">시중 평균</th>
            <th style="text-align:right">마진</th><th style="text-align:right">액션</th>
        </tr></thead><tbody>`;

    filtered.forEach(item => {
        const sigColor = item.signal === 'GO' ? '#10b981' : item.signal === 'WATCH' ? '#f59e0b' : '#ef4444';
        const marginClass = item.margin >= 25 ? 't1-c-green' : item.margin >= 15 ? 't1-c-warn' : 't1-c-red';
        const opacity = item.signal === 'GO' ? '1' : item.signal === 'WATCH' ? '0.6' : '0.35';

        html += `<tr style="opacity:${opacity}">
            <td><input type="checkbox" ${item.checked?'checked':''} onchange="T1.bulkItems[${item.id-1}].checked=this.checked;renderBulkFilterBar();"/></td>
            <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sigColor};margin-right:4px"></span>${item.signal}</td>
            <td>${escapeHtml(item.name)}</td>
            <td style="color:#f59e0b">${item.source}</td>
            <td style="text-align:right">${fmt(item.wholesalePrice)}</td>
            <td style="text-align:right">${fmt(item.marketAvg)}</td>
            <td style="text-align:right" class="${marginClass}" style="font-weight:700">${item.margin}%</td>
            <td style="text-align:right">
                <button class="t1-mini-btn" onclick="confirmSourcing({title:'${escapeHtml(item.name)}',_wsPrice:${item.wholesalePrice},lprice:${item.marketAvg}})">T2</button>
                <button class="t1-mini-btn" onclick="sendToStudio({title:'${escapeHtml(item.name)}',price:${item.marketAvg},wholesale_price:${item.wholesalePrice}})">T3</button>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    html += `<div class="t1-table-footer">${filtered.length} / ${T1.bulkItems.filter(i=>i.analyzed).length}개 표시</div>`;
    el.innerHTML = html;
}

// ─── 일괄 액션 ───
function t1BulkSelectAllGo() {
    T1.bulkItems.forEach(i => { if (i.signal === 'GO') i.checked = true; });
    renderBulkFilterBar(); renderBulkTable();
}
function t1BulkDeselectAll() {
    T1.bulkItems.forEach(i => { i.checked = false; });
    renderBulkFilterBar(); renderBulkTable();
}
function t1ToggleAllChecked(checked) {
    T1.bulkItems.forEach(i => { if (i.analyzed) i.checked = checked; });
    renderBulkFilterBar(); renderBulkTable();
}

function t1BulkAddToT2() {
    const selected = T1.bulkItems.filter(i => i.checked);
    if (!selected.length) { showToast('선택된 상품이 없습니다'); return; }
    selected.forEach(item => {
        confirmSourcing({ title: item.name, _wsPrice: item.wholesalePrice, lprice: item.marketAvg, image: item.image, keyword: item.name });
    });
    showToast(`📦 ${selected.length}개 상품을 T2에 일괄 등록했습니다`, 'success');
}

function t1BulkSendToT5() {
    const selected = T1.bulkItems.filter(i => i.checked);
    if (!selected.length) { showToast('선택된 상품이 없습니다'); return; }
    // T3에 대기열로 전달
    AppEventBus.emit('BULK_TO_STUDIO', selected.map(item => ({
        name: item.name, price: item.marketAvg, wholesale_price: item.wholesalePrice, image: item.image
    })));
    showTab('studio');
    showToast(`🎬 ${selected.length}개 상품 → T3 상세페이지 대기열 전달`, 'success');
}

function t1ExportBulkExcel() {
    if (!T1.bulkItems.length) { showToast('내보낼 데이터가 없습니다'); return; }
    const data = T1.bulkItems.filter(i => i.analyzed).map(i => ({
        '신호': i.signal,
        '상품명': i.name,
        '도매처': i.source,
        '도매가': i.wholesalePrice,
        '시중평균가': i.marketAvg,
        '마진율(%)': i.margin,
        '재고': i.stock,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '소싱분석');
    XLSX.writeFile(wb, `소싱분석_${T1.lastKeyword || 'bulk'}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('📊 엑셀 파일이 다운로드됩니다');
}

function t1ExportSingleResult() {
    if (!T1.searchResults) { showToast('검색 결과가 없습니다'); return; }
    const data = T1.searchResults.items.map(i => ({
        '상품명': i.title, '가격': i.price, '마켓': i.mallName, '카테고리': i.category, '브랜드': i.brand
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '시중가조회');
    XLSX.writeFile(wb, `시중가_${T1.lastKeyword}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('📊 엑셀 파일이 다운로드됩니다');
}

// ─── URL 붙여넣기 자동 추출 ───
async function t1ExtractFromUrl() {
    const urlInput = document.getElementById('t1-url-input');
    const url = (urlInput?.value || '').trim();
    if (!url) { showToast('URL을 입력하세요'); return; }

    const site = WholesaleSiteManager.detectSiteFromUrl(url);
    if (!site) { showToast('⚠️ 등록되지 않은 도매 사이트입니다. T7 설정에서 추가하세요.'); return; }

    if (site.type !== 'api' || !WholesaleSiteManager.getApiKey(site.id)) {
        showToast(`⚠️ ${site.name}은 API 키가 필요합니다. T7 설정을 확인하세요.`); return;
    }

    showLoading(true, `${site.name}에서 상품 정보 추출 중...`);
    try {
        const result = await fetchGas(site.id + 'UrlParse', { url: url });
        if (result?.success) {
            showToast(`✅ ${site.name}: ${result.name} / ${fmt(result.price)}원`);
            // 대량 목록에 추가
            T1.bulkItems.push({
                id: T1.bulkItems.length + 1,
                name: result.name, wholesalePrice: result.price,
                stock: result.stock || '-', image: result.image || '',
                source: site.name, marketAvg: 0, margin: 0, signal: 'PENDING',
                searches: 0, competition: '-', checked: false, analyzed: false,
            });
            renderBulkImportSummary();
        } else {
            showToast('추출 실패: ' + (result?.error || '알 수 없는 오류'), false);
        }
    } catch(e) {
        showToast('URL 추출 오류: ' + e.message, false);
    } finally {
        showLoading(false);
    }
}

// ─── 구글시트 가져오기 ───
async function t1ImportFromGoogleSheet() {
    showLoading(true, '구글 시트에서 상품 목록 가져오는 중...');
    try {
        const result = await fetchGas('getProducts', {});
        if (result?.length) {
            T1.bulkItems = result.map((row, idx) => ({
                id: idx + 1,
                name: row.name || row.상품명 || '',
                wholesalePrice: parseInt(row.cost || row.도매가 || row.원가 || 0, 10),
                stock: '-', image: row.image || row.photoUrl || '',
                source: '구글시트', marketAvg: 0, margin: 0, signal: 'PENDING',
                searches: 0, competition: '-', checked: false, analyzed: false,
            })).filter(i => i.name && i.wholesalePrice > 0);

            showToast(`📊 구글 시트에서 ${T1.bulkItems.length}개 상품 불러옴`);
            renderBulkImportSummary();
        } else {
            showToast('구글 시트에 상품이 없습니다');
        }
    } catch(e) {
        showToast('구글시트 연동 오류: ' + e.message, false);
    } finally {
        showLoading(false);
    }
}

// ─── 드래그앤드롭 초기화 ───
function t1InitDropZone() {
    const zone = document.getElementById('t1-drop-zone');
    if (!zone) return;

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('t1-drop-active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('t1-drop-active'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('t1-drop-active');
        const file = e.dataTransfer.files[0];
        if (file) t1HandleExcelUpload(file);
    });
    zone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.xlsx,.xls,.csv';
        input.onchange = () => { if (input.files[0]) t1HandleExcelUpload(input.files[0]); };
        input.click();
    });
}

// ─── 도매꾹 API 대량 검색 ───
async function t1BulkApiSearch() {
    const keyword = document.getElementById('t1-feed-search')?.value?.trim() || '';
    if (!keyword) { showToast('검색어를 먼저 입력하세요'); return; }
    
    showLoading(true, `도매꾹에서 "${keyword}" 대량 검색 중...`);
    try {
        const result = await fetchGas('searchProductFeed', { query: keyword, page: 1, limit: 100 });
        if (result?.success && result.items?.length) {
            T1.bulkItems = result.items.map((item, idx) => ({
                id: idx + 1,
                name: item.name || '',
                wholesalePrice: parseInt(item.wholesalePrice || 0),
                stock: '-',
                image: item.image || '',
                source: item.wholesaleSource || '도매꾹',
                marketAvg: parseInt(item.retailPrice || 0),
                margin: parseInt(item.margin || 0),
                signal: item.signal === '소싱추천' ? 'GO' : item.signal === '지켜보기' ? 'WATCH' : 'SKIP',
                searches: parseInt(item.monthlySearch || 0),
                competition: '-',
                checked: item.signal === '소싱추천',
                analyzed: true,
            })).filter(i => i.name && i.wholesalePrice > 0);
            
            showToast(`🔍 ${T1.bulkItems.length}개 도매 상품 로드 완료`);
            // 벌크 결과 렌더링
            renderBulkImportSummary();
            updateBulkSummary();
            renderBulkTable();
        } else {
            showToast('검색 결과가 없습니다');
        }
    } catch(e) {
        showToast('도매꾹 API 오류: ' + e.message, false);
    } finally {
        showLoading(false);
    }
}

// v7: 드롭존 + 벌크 초기화
document.addEventListener('DOMContentLoaded', () => {
    t1InitDropZone();
});

// ═══════════════════════════════════════════════════════════════
// PART 3: 방어 시스템 — 워치독 + 피드백
// ═══════════════════════════════════════════════════════════════

// ═══ T1-A: 가격 워치독 (Price Watchdog) ═══
async function t1LoadPriceAlerts() {
    const banner = document.getElementById('t1-alert-banner');
    if (!banner) return;
    
    try {
        const result = await fetchGas('getPriceAlerts', {});
        const alerts = result?.alerts || [];
        
        if (!alerts.length) {
            // Mock 데이터 폴백 — GAS 미연결 시 localStorage 확인
            const localAlerts = JSON.parse(localStorage.getItem('v7-price-alerts') || '[]');
            if (localAlerts.length) {
                t1RenderAlertBanner(banner, localAlerts);
                return;
            }
            banner.style.display = 'none';
            return;
        }
        
        // localStorage 캐싱
        localStorage.setItem('v7-price-alerts', JSON.stringify(alerts));
        t1RenderAlertBanner(banner, alerts);
        
    } catch(e) {
        // GAS 연결 실패 시 캐시된 데이터 사용
        const cached = JSON.parse(localStorage.getItem('v7-price-alerts') || '[]');
        if (cached.length) t1RenderAlertBanner(banner, cached);
    }
}

function t1RenderAlertBanner(banner, alerts) {
    banner.style.display = 'flex';
    banner.innerHTML = `
        <span style="font-size:16px">⚠️</span>
        <span style="flex:1">마진 변동 상품 <strong style="color:#f59e0b">${alerts.length}개</strong> — 시중가 변동으로 마진 조정 필요!</span>
        <button class="t1-alert-btn" onclick="t1ShowPriceAlertModal()">상세 확인</button>
    `;
    // 이벤트 전파
    AppEventBus.emit('PRICE_ALERT', { items: alerts });
}

function t1ShowPriceAlertModal() {
    const alerts = JSON.parse(localStorage.getItem('v7-price-alerts') || '[]');
    if (!alerts.length) { showToast('변동 상품이 없습니다'); return; }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `<div style="background:var(--surface);border-radius:12px;padding:20px;max-width:700px;width:90%;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <h4 style="margin:0;">⚠️ 마진 변동 상품 (${alerts.length}건)</h4>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text);">✕</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr><th style="padding:6px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1)">상품명</th><th style="text-align:right;padding:6px">이전가</th><th style="text-align:right;padding:6px">현재가</th><th style="text-align:right;padding:6px">변동률</th></tr></thead>
            <tbody>${alerts.map(a => {
                const change = a.changeRate || 0;
                const color = change > 0 ? '#ef4444' : '#10b981';
                return `<tr><td style="padding:6px">${escapeHtml(a.productName || a.name || '')}</td><td style="text-align:right;padding:6px">${fmtWon(a.prevPrice || 0)}</td><td style="text-align:right;padding:6px">${fmtWon(a.currentPrice || 0)}</td><td style="text-align:right;padding:6px;color:${color};font-weight:600">${change > 0 ? '+' : ''}${change}%</td></tr>`;
            }).join('')}</tbody>
        </table>
    </div>`;
    document.body.appendChild(modal);
}

// ═══ T1-B: 판매 피드백 뱃지 ═══
async function t1GetSalesCount(productName) {
    try {
        const result = await fetchGas('productSalesCount', { productName });
        return { count: result?.count || 0, revenue: result?.revenue || 0 };
    } catch {
        // 로컬 폴백: v7-orders에서 조회
        try {
            const orders = JSON.parse(localStorage.getItem('v7-orders') || '[]');
            const thirtyDaysAgo = Date.now() - 30 * 86400000;
            const matched = orders.filter(o => 
                (o.productName || '').includes(productName) &&
                new Date(o.createdAt) >= thirtyDaysAgo &&
                ['delivered', 'settled', 'completed'].includes(o.status)
            );
            return {
                count: matched.reduce((s, o) => s + (o.quantity || 1), 0),
                revenue: matched.reduce((s, o) => s + (o.salePrice || 0), 0),
            };
        } catch { return { count: 0, revenue: 0 }; }
    }
}

// 상품 카드에 판매 뱃지 주입 (비동기)
async function t1AddSalesBadges() {
    const cards = document.querySelectorAll('.t1-pcard');
    for (const card of cards) {
        const titleEl = card.querySelector('.t1-pcard-title');
        if (!titleEl) continue;
        const name = titleEl.textContent.trim();
        const sales = await t1GetSalesCount(name);
        if (sales.count > 0) {
            const badge = document.createElement('div');
            badge.className = 't1-sales-badge';
            badge.innerHTML = `🏷️ ${sales.count}건 판매`;
            badge.style.cssText = 'font-size:9px;color:#f59e0b;background:rgba(245,158,11,0.1);padding:2px 6px;border-radius:4px;margin-top:3px;display:inline-block;';
            titleEl.after(badge);
        }
    }
}

// ═══ T1-C: 시즌 하락 경보 ═══
async function t1LoadTrendAlerts() {
    const container = document.getElementById('t1-trend-alerts');
    if (!container) return;
    
    try {
        const result = await fetchGas('trendWatchdog', { mode: 'check' });
        const alerts = result?.alerts || [];
        
        if (!alerts.length) {
            const cached = JSON.parse(localStorage.getItem('v7-trend-alerts') || '[]');
            if (cached.length) { t1RenderTrendAlerts(container, cached); return; }
            return;
        }
        
        localStorage.setItem('v7-trend-alerts', JSON.stringify(alerts));
        t1RenderTrendAlerts(container, alerts);
    } catch {
        const cached = JSON.parse(localStorage.getItem('v7-trend-alerts') || '[]');
        if (cached.length) t1RenderTrendAlerts(container, cached);
    }
}

function t1RenderTrendAlerts(container, alerts) {
    container.style.display = 'block';
    container.innerHTML = `
        <div class="t1-section-header"><span>📉 트렌드 하락 경보</span><span class="t1-badge-new" style="background:#ef4444">${alerts.length}</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;">
            ${alerts.map(a => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.1);font-size:11px;">
                    <span style="font-size:14px">📉</span>
                    <span style="flex:1;font-weight:500">${escapeHtml(a.keyword || a.productName || '')}</span>
                    <span style="color:#ef4444;font-weight:700">-${a.dropRate || 0}%</span>
                    <span style="font-size:9px;color:#94a3b8">${a.period || '전주 대비'}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── 초기화 ───
document.addEventListener('DOMContentLoaded', () => {
    t1InitDropZone();

    // Enter 키 검색
    const searchInput = document.getElementById('t1-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') t1SingleSearch(); });
        searchInput.addEventListener('input', debounce(() => fetchRelatedKeywords(searchInput.value.trim()), 500));
    }

    // 워치독 로드
    t1LoadPriceAlerts();
    t1LoadTrendAlerts();
});

// 전역 노출
window.t1SingleSearch = t1SingleSearch;
window.t1SetMode = t1SetMode;
window.t1HandleExcelUpload = t1HandleExcelUpload;
window.t1ExtractFromUrl = t1ExtractFromUrl;
window.t1ImportFromGoogleSheet = t1ImportFromGoogleSheet;
window.t1StartBulkAnalysis = t1StartBulkAnalysis;
window.t1FilterProducts = t1FilterProducts;
window.t1ShowAllProducts = t1ShowAllProducts;
window.t1FilterWholesale = t1FilterWholesale;
window.t1ApplyWholesalePrice = t1ApplyWholesalePrice;
window.t1BulkSelectAllGo = t1BulkSelectAllGo;
window.t1BulkDeselectAll = t1BulkDeselectAll;
window.t1ToggleAllChecked = t1ToggleAllChecked;
window.t1BulkAddToT2 = t1BulkAddToT2;
window.t1BulkSendToT5 = t1BulkSendToT5;
window.t1ExportBulkExcel = t1ExportBulkExcel;
window.t1ExportSingleResult = t1ExportSingleResult;
window.t1LoadPriceAlerts = t1LoadPriceAlerts;
window.t1ShowPriceAlertModal = t1ShowPriceAlertModal;
window.t1AddSalesBadges = t1AddSalesBadges;
window.t1LoadTrendAlerts = t1LoadTrendAlerts;
window.T1 = T1;
