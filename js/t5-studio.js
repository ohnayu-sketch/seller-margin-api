/**
 * T5 마케팅 스튜디오 — 고도화 모듈
 * 파일: js/t5-studio.js
 * 
 * 의존성: event-bus.js, fetch-gas.js, ui-helpers.js, config.js
 * 
 * 기능:
 *  1. 8종 상세페이지 템플릿 (clean/premium/trendy/minimal/tech/nature/kids/food)
 *  2. 마켓별 규격 프리셋 (스마트스토어/쿠팡/G마켓/11번가/티몬)
 *  3. AI 카피라이팅 (Gemini Flash — 헤드카피+설명+특장점+SEO키워드 JSON 출력)
 *  4. T1/T2에서 상품 데이터 자동 수신
 *  5. 대량 상세페이지 대기열 (T1 대량소싱 연동)
 *  6. HTML 복사/다운로드/미리보기
 *  7. 다중 이미지 URL 지원
 */

// ─── 상태 관리 ───
const T5 = {
    template: 'clean',
    market: 'smartstore',
    queue: [],           // 대량 생성 대기열
    lastHTML: '',
    seoKeywords: [],
};

// ─── 마켓별 규격 ───
const MARKET_SPECS = {
    smartstore:  { name: '스마트스토어', width: 860, icon: '🟢' },
    coupang:     { name: '쿠팡',        width: 780, icon: '🟠' },
    gmarket:     { name: 'G마켓/옥션',   width: 860, icon: '🔵' },
    '11st':      { name: '11번가',       width: 800, icon: '🔴' },
    tmon:        { name: '티몬',         width: 900, icon: '🟣' },
};

// ─── 8종 템플릿 정의 ───
const TEMPLATES = {
    clean:   { name: '✨ 깔끔',     desc: '미니멀 화이트',     bg: '#fff',    text: '#1e293b', accent: '#0f172a',  featureBg: '#f8fafc' },
    premium: { name: '💎 프리미엄', desc: '다크 럭셔리',       bg: '#0f172a', text: '#fff',    accent: '#a78bfa',  featureBg: 'rgba(255,255,255,0.05)' },
    trendy:  { name: '🔥 트렌디',   desc: '오렌지 그라데이션', bg: '#fffbf5', text: '#1e293b', accent: '#f59e0b',  featureBg: 'rgba(251,191,36,0.05)' },
    minimal: { name: '🤍 미니멀',   desc: '여백 중심 감성',    bg: '#fafaf9', text: '#292524', accent: '#78716c',  featureBg: '#f5f5f4' },
    tech:    { name: '💻 테크',     desc: '다크블루 스펙강조', bg: '#020617', text: '#e2e8f0', accent: '#3b82f6',  featureBg: 'rgba(59,130,246,0.08)' },
    nature:  { name: '🌿 내추럴',   desc: '그린톤 친환경',     bg: '#f0fdf4', text: '#14532d', accent: '#16a34a',  featureBg: '#dcfce7' },
    kids:    { name: '🧸 키즈',     desc: '파스텔 둥근느낌',   bg: '#fef7ff', text: '#581c87', accent: '#a855f7',  featureBg: '#fae8ff' },
    food:    { name: '🍽️ 푸드',    desc: '따뜻한톤 식욕자극', bg: '#fffbeb', text: '#78350f', accent: '#d97706',  featureBg: '#fef3c7' },
};

// ─── 초기화 ───
function t5Init() {
    // T1/T2에서 단건 수신
    AppEventBus.on('PRODUCT_TO_STUDIO', t5ReceiveProduct);
    // T1 대량 소싱에서 대기열 수신
    AppEventBus.on('BULK_TO_STUDIO', t5ReceiveBulkQueue);

    // 초기 템플릿 세팅
    setTimeout(() => t5SetTemplate('clean'), 100);
    t5SetMarket('smartstore');
    t5RenderQueue();
}

// ─── T1/T2 데이터 수신 ───
function t5ReceiveProduct(data) {
    const nameEl = document.getElementById('t5-product-name');
    const imageEl = document.getElementById('t5-image-urls');
    const priceEl = document.getElementById('t5-price');

    if (nameEl) nameEl.value = data.name || '';
    if (imageEl) imageEl.value = data.image || '';
    if (priceEl) priceEl.value = data.price || '';

    // 도매가 대비 마진 표시
    if (data.wholesale_price && data.price) {
        const margin = Math.round((1 - data.wholesale_price / data.price) * 100);
        showToast(`💡 도매가 ${fmt(data.wholesale_price)}원 / 마진 ${margin}%`);
    }

    // 클리퍼에서 넘어온 벤치마킹 사이트(도매/마켓) 스크립트 및 텍스트 메타데이터 저장
    T5.currentSourceText = data.sourceText || '';

    // 제목/키워드 기반 카테고리(테마) 자동 추론 및 변경 (Auto-Slotting 핵심)
    const suggestedTpl = t5DeduceTemplate(data.name || '');
    if (suggestedTpl && suggestedTpl !== T5.template) {
        showToast(`💡 상품명 기반 자동 템플릿 추천: '${TEMPLATES[suggestedTpl].name}' 적용`);
        t5SetTemplate(suggestedTpl);
    } else {
        t5UpdatePreview();
    }

    // 자동 AI 카피 트리거
    if (data.name) setTimeout(() => t5GenerateAICopy(), 500);
}

// ─── 카테고리 기반 템플릿 자동 추론 ───
function t5DeduceTemplate(productName) {
    if (!productName) return 'clean';
    const text = productName.toLowerCase();
    
    // 키워드 사전
    const categories = {
        food: ['식품', '간식', '과자', '김치', '커피', '원두', '유기농', '우유', '빵', '고기', '과일', '야채', '음료', '차', '밀키트', '영양제', '건강', '홍삼'],
        kids: ['장난감', '아기', '유아', '어린이', '키즈', '임산부', '맘', '기저귀', '장난감', '블록', '동화', '인형', '모빌'],
        nature: ['화장품', '스킨케어', '뷰티', '바디', '헤어', '로션', '크림', '에센스', '세럼', '마스크팩', '여성용품', '생리대', '향수', '디퓨저', '아로마', '식물', '화분', '원예'],
        tech: ['전자기기', '스마트폰', '컴퓨터', '노트북', '태블릿', '이어폰', '헤드폰', '마우스', '키보드', '충전기', '케이블', '모니터', '가전', '청소기', '선풍기', '블루투스', '카메라', '드릴', '공구', '차량용', '블랙박스'],
        premium: ['골프', '명품', '시계', '지갑', '가죽', '프리미엄', '한우', '위스키', '와인', '정장', '예물', '다이아'],
        trendy: ['패션', '의류', '여성복', '남성복', '스트릿', '신발', '스니커즈', '모자', '액세서리', '주얼리', '가방', '백', '선글라스', '수영복', '폰케이스'],
        minimal: ['인테리어', '가구', '책상', '의자', '조명', '러그', '커튼', '침구', '이불', '수납', '정리', '무지', '심플', '문구', '다이어리', '디자인'],
        clean: ['생활가전', '주방가전', '냄비', '후라이팬', '그릇', '접시', '수저', '수건', '세제', '섬유유연제', '화장지', '물티슈', '치약', '칫솔', '샴푸', '바디워시']
    };

    // 점수 시스템으로 가장 일치하는 테마 선정
    let bestTpl = 'clean';
    let maxScore = 0;

    for (const [tpl, kws] of Object.entries(categories)) {
        let score = 0;
        kws.forEach(kw => {
            if (text.includes(kw)) score++;
        });
        if (score > maxScore) {
            maxScore = score;
            bestTpl = tpl;
        }
    }
    
    return maxScore > 0 ? bestTpl : 'clean';
}

function t5ReceiveBulkQueue(items) {
    if (!Array.isArray(items)) return;
    T5.queue = items.map((item, idx) => ({
        id: idx + 1,
        name: item.name || '',
        price: item.price || 0,
        wholesalePrice: item.wholesale_price || 0,
        image: item.image || '',
        status: 'pending', // pending/generating/done
        html: '',
    }));
    t5RenderQueue();
    showToast(`🎬 ${T5.queue.length}개 상품 → 상세페이지 대기열 수신`);
}

// ─── 템플릿 선택 ───
function t5SetTemplate(tpl) {
    T5.template = tpl;
    document.querySelectorAll('.t5-tpl-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tpl === tpl);
    });
    t5UpdatePreview();
}

// ─── 마켓 규격 선택 ───
function t5SetMarket(key) {
    T5.market = key;
    const spec = MARKET_SPECS[key];
    const frame = document.getElementById('t5-preview-frame');
    if (frame) frame.style.maxWidth = spec.width + 'px';
    document.querySelectorAll('.t5-mkt-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.market === key);
    });
    t5UpdatePreview();
}

// ─── 입력값 수집 ───
function t5GetInputs() {
    return {
        name: document.getElementById('t5-product-name')?.value || '상품명을 입력하세요',
        desc: document.getElementById('t5-product-desc')?.value || '',
        images: (document.getElementById('t5-image-urls')?.value || '').split('\n').map(u => u.trim()).filter(Boolean),
        features: (document.getElementById('t5-features')?.value || '').split('\n').filter(f => f.trim()),
        price: parseInt(document.getElementById('t5-price')?.value) || 0,
        badge: document.getElementById('t5-badge')?.value || '',
    };
}

// ─── HTML 생성 엔진 (프리미엄 렌더링) ───
function t5GenerateHTML(inputs, templateKey, marketKey) {
    const tpl = TEMPLATES[templateKey || T5.template];
    const spec = MARKET_SPECS[marketKey || T5.market];
    const { name, desc, images, features, price, badge } = inputs;
    const priceStr = price > 0 ? price.toLocaleString() + '원' : '';
    const mainImage = images[0] || 'https://placehold.co/800x800/f8fafc/94a3b8?text=PRODUCT+IMAGE';
    const isDark = ['premium', 'tech'].includes(templateKey || T5.template);

    // 특장점 카드 HTML (프리미엄 그리드)
    const featureHTML = features.length > 0 ? features.map((f, idx) => {
        const parts = f.includes(' - ') ? f.split(' - ') : f.includes('\n  - ') ? f.split('\n  - ') : [f, ''];
        const title = parts[0].replace(/✔ /, '').trim();
        const detail = parts[1] ? parts[1].trim() : '';
        return `
        <div class="usp-card">
            <div class="usp-num">0${idx+1}</div>
            <div class="usp-title">${title}</div>
            ${detail ? `<div class="usp-desc">${detail}</div>` : ''}
        </div>`;
    }).join('') : '';

    // 추가 이미지 (2번째부터 풀위드)
    const extraImages = images.slice(1).map(url =>
        `<div class="img-wrap"><img src="${url}" alt="detail info" loading="lazy"></div>`
    ).join('');

    // 뱃지
    const badgeHTML = badge ? `<div class="badge">${badge}</div>` : '';

    // CTA 영역
    const ctaHTML = `<div class="cta-section">
        <div class="cta-price">${priceStr ? priceStr : '한정수량 특가'}</div>
        <button class="cta-btn">지금 바로 구매하기</button>
    </div>`;

    // SEO 키워드
    const seoMeta = T5.seoKeywords.length ? `<meta name="keywords" content="${T5.seoKeywords.join(',')}">` : '';

    // 신뢰 근거 섹션 HTML
    const trustHTML = `<div class="trust-section">
        <h2 class="section-title" style="font-size:22px;">🛡️ 안심 구매 보장</h2>
        <div class="trust-grid">
            <div class="trust-card">
                <div class="trust-icon">✅</div>
                <div class="trust-title">정품 보증</div>
                <div class="trust-desc">공식 인증 제품만 취급합니다</div>
            </div>
            <div class="trust-card">
                <div class="trust-icon">🚚</div>
                <div class="trust-title">빠른 배송</div>
                <div class="trust-desc">오후 2시 전 주문 시 당일 출고</div>
            </div>
            <div class="trust-card">
                <div class="trust-icon">🔄</div>
                <div class="trust-title">무료 반품</div>
                <div class="trust-desc">수령 후 7일 이내 무료 교환·반품</div>
            </div>
            <div class="trust-card">
                <div class="trust-icon">💬</div>
                <div class="trust-title">1:1 상담</div>
                <div class="trust-desc">카카오톡 / 전화 빠른 응대</div>
            </div>
        </div>
    </div>`;

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${seoMeta}
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/variable/pretendardvariable.css" />
<style>
/* Reset & Base */
:root {
    --bg-color: ${tpl.bg};
    --text-color: ${tpl.text};
    --accent-color: ${tpl.accent};
    --feature-bg: ${tpl.featureBg};
    --card-bg: ${isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'};
    --border-color: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
    --muted-color: ${isDark ? '#94a3b8' : '#64748b'};
}
html, body { margin: 0; padding: 0; background: var(--bg-color); color: var(--text-color); font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif; letter-spacing: -0.02em; line-height: 1.6; word-break: keep-all; -webkit-font-smoothing: antialiased; }
.container { max-width: ${spec.width}px; margin: 0 auto; background: var(--bg-color); box-shadow: 0 0 40px rgba(0,0,0,0.03); overflow: hidden; position: relative; }
img { width: 100%; max-width: 100%; display: block; height: auto; border: 0; }

/* Animation */
@keyframes fadeUp {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
}
.animate-fade { animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Hero Section */
.hero { position: relative; width: 100%; min-height: 60vh; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-img { position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
.hero-overlay { position: absolute; top:0; left:0; width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(0,0,0,0) 30%, ${tpl.bg} 95%, ${tpl.bg} 100%); z-index: 2; }
.hero-content { position: relative; z-index: 3; padding: 40px; }
.badge { display: inline-block; padding: 8px 16px; border-radius: 4px; background: var(--accent-color); color: #fff; font-size: 13px; font-weight: 700; margin-bottom: 20px; letter-spacing: 0.05em; text-transform: uppercase; }
.title { font-size: clamp(32px, 5vw, 42px); font-weight: 800; line-height: 1.3; margin: 0 0 16px; color: var(--text-color); }
.price-tag { font-size: 28px; font-weight: 800; color: var(--accent-color); margin: 0 0 24px; }

/* Copy & Description */
.desc-section { padding: 20px 40px 60px; text-align: center; }
.desc-text { font-size: 18px; line-height: 1.8; color: var(--muted-color); font-weight: 500; white-space: pre-wrap; margin: 0 auto; max-width: 80%; }

/* USP / Features */
.features-section { padding: 60px 40px; background: var(--feature-bg); }
.section-title { font-size: 28px; font-weight: 800; text-align: center; margin-bottom: 40px; color: var(--text-color); }
.usp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.usp-card { background: var(--card-bg); border: 1px solid var(--border-color); padding: 32px; border-radius: 16px; transition: transform 0.3s ease; }
.usp-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
.usp-num { font-size: 14px; font-weight: 800; color: var(--accent-color); margin-bottom: 12px; }
.usp-title { font-size: 18px; font-weight: 700; color: var(--text-color); margin-bottom: 8px; line-height: 1.4; }
.usp-desc { font-size: 15px; color: var(--muted-color); line-height: 1.6; }

/* Trust Section */
.trust-section { padding: 60px 40px; background: var(--feature-bg); border-top: 1px solid var(--border-color); }
.trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.trust-card { text-align: center; padding: 24px 12px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); }
.trust-icon { font-size: 28px; margin-bottom: 8px; }
.trust-title { font-size: 15px; font-weight: 700; color: var(--text-color); margin-bottom: 4px; }
.trust-desc { font-size: 12px; color: var(--muted-color); line-height: 1.4; }

/* Layout & CTA */
.gallery { display: flex; flex-direction: column; }
.img-wrap { width: 100%; margin: 0; }
.cta-section { padding: 60px 40px; text-align: center; background: var(--bg-color); border-top: 1px solid var(--border-color); }
.cta-price { font-size: 24px; font-weight: 800; color: var(--text-color); margin-bottom: 20px; }
.cta-btn { display: inline-block; width: 100%; max-width: 400px; padding: 20px; background: var(--accent-color); color: #fff; border: none; border-radius: 8px; font-size: 18px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 10px 20px rgba(var(--accent-color), 0.2); }
.cta-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
.notice { text-align: center; padding: 40px; font-size: 13px; color: var(--muted-color); background: var(--card-bg); }
</style>
</head>
<body>
<div class="container">
    <!-- Hero (Intro) -->
    <div class="hero animate-fade">
        <img src="${mainImage}" alt="${name}" class="hero-img">
        <div class="hero-overlay"></div>
        <div class="hero-content">
            ${badgeHTML}
            <h1 class="title">${name}</h1>
            ${priceStr ? `<div class="price-tag">${priceStr}</div>` : ''}
        </div>
    </div>

    <!-- Description -->
    <div class="desc-section animate-fade" style="animation-delay: 0.2s;">
        <div class="desc-text">${desc}</div>
    </div>

    <!-- Features -->
    ${features.length ? `
    <div class="features-section">
        <h2 class="section-title">${getFeatureTitle(templateKey || T5.template)}</h2>
        <div class="usp-grid">
            ${featureHTML}
        </div>
    </div>` : ''}

    <!-- Detail Gallery -->
    <div class="gallery">
        ${extraImages}
    </div>

    <!-- Trust Evidence Section -->
    ${trustHTML}

    <!-- CTA & Footer -->
    ${ctaHTML}
    <div class="notice">${getNoticeText(templateKey || T5.template)}</div>
</div>
</body>
</html>`;
}

function getFeatureTitle(tpl) {
    const map = {
        clean: '✨ 제품 특장점', premium: '💎 프리미엄 포인트', trendy: '🔥 이것만은 알고 가세요!',
        minimal: '핵심 포인트', tech: '⚡ 스펙 & 특징', nature: '🌿 친환경 포인트',
        kids: '🧸 안심 포인트', food: '🍽️ 맛있는 이유'
    };
    return map[tpl] || '✨ 특장점';
}

function getNoticeText(tpl) {
    const map = {
        clean: '본 상품은 정품이며, 교환/반품은 수령 후 7일 이내 가능합니다.',
        premium: 'PREMIUM SELLER | 정품 보증 | 안심 거래',
        trendy: '⏰ 한정 수량 | 빠른 배송 | 교환/반품 7일 보장',
        minimal: '심플한 선택, 현명한 소비.',
        tech: '제조사 공식 보증 | A/S 안내는 상세 설명 참조',
        nature: '🌱 자연을 생각하는 포장 | 친환경 인증 제품',
        kids: '🛡️ KC 인증 완료 | 안전한 소재 사용 | 7일 무료 반품',
        food: '📦 신선 포장 배송 | 유통기한 표시 확인 | 개봉 후 냉장 보관'
    };
    return map[tpl] || '';
}

// ─── 미리보기 업데이트 ───
function t5UpdatePreview() {
    const inputs = t5GetInputs();
    const html = t5GenerateHTML(inputs);
    const frame = document.getElementById('t5-preview-frame');
    if (frame) {
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open(); doc.write(html); doc.close();
    }
    const counter = document.getElementById('t5-char-count');
    if (counter) counter.textContent = html.length.toLocaleString() + '자';
    T5.lastHTML = html;
}

// ─── AI 카피라이팅 ───
async function t5GenerateAICopy() {
    const nameEl = document.getElementById('t5-product-name');
    const descEl = document.getElementById('t5-product-desc');
    const featuresEl = document.getElementById('t5-features');
    if (!nameEl?.value) { showToast('상품명을 입력하세요'); return; }

    showToast('🤖 AI 디렉터가 마케팅 카피를 작성 중입니다...');

    try {
        const payload = {
            title: nameEl.value,
            price: document.getElementById('t5-price')?.value || 0,
            sourceText: T5.currentSourceText || window.T5ImageAuto?.sourceText || '', // 도매/시장 데이터 즉각 활용 (사용자 피드백)
            competitorFlaws: document.getElementById('t5-competitor-flaws')?.value || '',
            // (추후 네이버 3위 랭커 데이터 연동 가능)
            targetCompetitors: []
        };

        const result = await fetchGas('generateMarketingStrategy', payload);

        if (result?.success && result.aiCopy) {
            const copy = result.aiCopy;
            
            // 프리미엄 카피라이팅 조합 적용
            const fullDesc = `【 ${copy.hook || ''} 】\n\n${copy.agitation || ''}\n\n✨ ${copy.solution || ''}\n\n${copy.cta || ''}`;
            if (descEl) descEl.value = fullDesc;
            
            if (copy.uspList && copy.uspList.length) {
                const featureText = copy.uspList.map(u => `✔ ${u.title}\n  - ${u.desc}`).join('\n\n');
                if (featuresEl) featuresEl.value = featureText;
            }

            // ★ 단건 생성 시에도 T5 queue 맨 앞 아이템에 추출된 옵션 저장 (마켓 API 등록용)
            if (copy.marketExtracted && copy.marketExtracted.options && window.T5 && window.T5.queue.length > 0) {
                window.T5.queue[0].marketOptions = copy.marketExtracted.options;
            }

            t5UpdatePreview();
            showToast('✅ 엔터프라이즈 AI 카피 + 기획 생성 완료!');
        } else {
            console.warn('AI Copy backend failed:', result?.error);
            showToast('⚠️ AI 호출 실패 (' + (result?.error || '알 수 없는 오류') + '), 로컬 대체');
            descEl.value = t5LocalCopy(nameEl.value);
            t5UpdatePreview();
        }
    } catch(e) {
        console.error('AI Copy Error:', e);
        descEl.value = t5LocalCopy(nameEl.value);
        t5UpdatePreview();
        showToast('⚠️ 통신 오류, 로컬 카피로 대체');
    }
}

function t5LocalCopy(name) {
    // ★ 상위 셀러 패턴 기반 4단계 프레임워크 (Hook → Problem → Solution → CTA)
    const hooks = [
        `"${name}" 하나로 달라지는 일상`,
        `왜 이 ${name}만 반복 구매율 87%일까?`,
        `SNS에서 난리난 ${name}, 직접 써봤습니다`,
        `${name} 고르기 전에 반드시 알아야 할 것`,
    ];
    const problems = [
        `많은 분들이 비슷한 제품을 사고 실망합니다.\n저렴한 가격에 혹해서 구매했다가 품질에 실망하고,\n결국 또 다른 제품을 찾아 헤매게 되죠.`,
        `시중에 넘쳐나는 유사 제품들.\n하지만 실제로 만족스러운 건 손에 꼽습니다.\n"이번엔 다르겠지" 하고 구매해도 후회하기 일쑤...`,
        `가격만 보고 고르면 결국 두 번 삽니다.\n품질, 내구성, A/S까지 꼼꼼하게 따져야\n진짜 가성비 좋은 제품을 만날 수 있습니다.`,
    ];
    const solutions = [
        `바로 이 ${name}이 그 답입니다.\n\n엄선된 소재와 꼼꼼한 품질 관리로\n 한번 쓰면 다른 제품으로 돌아갈 수 없습니다.\n 이미 수천 명이 선택한 이유, 직접 확인해보세요.`,
        `저희 ${name}은 다릅니다.\n\n✅ 프리미엄 소재 — 오래 써도 처음 그대로\n✅ 꼼꼼한 검수 — 불량률 0.1% 미만\n✅ 합리적 가격 — 중간 마진 없는 직거래`,
    ];
    const ctas = [
        `지금 바로 경험해보세요.\n한정 수량이 소진되면 다음 입고까지 기다리셔야 합니다.`,
        `오늘 주문하시면 내일 바로 만나보실 수 있습니다.\n🚚 당일출고 | 🔄 7일 무료 반품 | 💰 최저가 보장`,
    ];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return `【 ${pick(hooks)} 】\n\n${pick(problems)}\n\n✨ ${pick(solutions)}\n\n${pick(ctas)}`;
}

function t5LocalFeatures(name) {
    return [
        `✔ 프리미엄 소재\n  - 엄선된 원자재로 내구성과 촉감 모두 만족`,
        `✔ 정밀 품질 관리\n  - 3단계 검수 시스템으로 불량률 0.1% 미만 달성`,
        `✔ 합리적인 가격\n  - 유통 마진을 줄여 최저가 수준의 합리적 가격 실현`,
        `✔ 빠른 배송\n  - 오후 2시 이전 주문 시 당일 출고, 1~2일 내 수령`,
        `✔ 안심 교환/반품\n  - 수령 후 7일 이내 무료 반품, 교환비 판매자 부담`,
    ].join('\n\n');
}

// ─── 복사/다운로드 ───
function t5CopyHTML() {
    if (!T5.lastHTML) { showToast('먼저 상품 정보를 입력하세요'); return; }
    navigator.clipboard.writeText(T5.lastHTML).then(() => showToast('📋 상세페이지 HTML이 복사되었습니다!'));
}

function t5DownloadHTML() {
    if (!T5.lastHTML) { showToast('먼저 상품 정보를 입력하세요'); return; }
    const name = document.getElementById('t5-product-name')?.value || 'detail_page';
    const blob = new Blob([T5.lastHTML], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[^가-힣a-zA-Z0-9]/g, '_') + `_${T5.market}_상세페이지.html`;
    a.click();
    showToast('💾 HTML 파일 다운로드');
}

// ─── 대량 대기열 ───
function t5RenderQueue() {
    const el = document.getElementById('t5-queue-panel');
    if (!el) return;

    if (!T5.queue.length) {
        el.style.display = 'none';
        return;
    }

    el.style.display = 'block';
    const done = T5.queue.filter(q => q.status === 'done').length;
    const pending = T5.queue.filter(q => q.status === 'pending').length;

    let html = `<div class="t5-section-header"><span>📋 상세페이지 대기열</span><span class="t5-count">${done}/${T5.queue.length} 완료</span></div>`;

    if (pending > 0) {
        html += `<button class="t5-batch-btn" onclick="t5ProcessQueue()">🚀 ${pending}개 일괄 생성 시작</button>`;
    }

    html += '<div class="t5-queue-list">';
    T5.queue.forEach(item => {
        const statusIcon = item.status === 'done' ? '✅' : item.status === 'generating' ? '⏳' : '⬜';
        html += `<div class="t5-queue-row">
            <span class="t5-queue-status">${statusIcon}</span>
            <span class="t5-queue-name">${escapeHtml(item.name)}</span>
            <span class="t5-queue-price">${item.price ? fmtWon(item.price) : '-'}</span>
            ${item.status === 'done' 
                ? `<button class="t5-mini-btn" onclick="t5PreviewQueueItem(${item.id})">미리보기</button>
                   <button class="t5-mini-btn" onclick="t5DownloadQueueItem(${item.id})">다운로드</button>`
                : `<button class="t5-mini-btn" onclick="t5EditQueueItem(${item.id})">편집</button>`
            }
        </div>`;
    });
    html += '</div>';

    if (done === T5.queue.length && done > 0) {
        html += `<button class="t5-batch-btn t5-btn-dl" onclick="t5DownloadAllQueue()">📦 전체 다운로드 (ZIP)</button>`;
    }

    el.innerHTML = html;
}

async function t5ProcessQueue() {
    const pending = T5.queue.filter(q => q.status === 'pending');
    if (!pending.length) return;

    showToast(`🎬 ${pending.length}개 상세페이지 생성 시작...`);

    for (const item of pending) {
        item.status = 'generating';
        t5RenderQueue();

        const inputs = {
            name: item.name,
            desc: '',
            images: item.image ? [item.image] : [],
            features: [],
            price: item.price,
            badge: '',
        };

        // AI 카피 시도 (프리미엄 fetchGas 연동)
        try {
            const payload = {
                title: item.name,
                price: item.price || 0,
                sourceText: item.sourceText || '', // Bulk에서 원본 텍스트가 있다면
                competitorFlaws: ''
            };
            const result = await fetchGas('generateMarketingStrategy', payload);
            if (result?.success && result.aiCopy) {
                const copy = result.aiCopy;
                inputs.desc = `【 ${copy.hook || ''} 】\n\n${copy.agitation || ''}\n\n✨ ${copy.solution || ''}\n\n${copy.cta || ''}`;
                
                if (copy.uspList && copy.uspList.length) {
                    inputs.features = copy.uspList.map(u => `✔ ${u.title}\n  - ${u.desc}`);
                }
                
                if (copy.marketExtracted && copy.marketExtracted.options) {
                    item.marketOptions = copy.marketExtracted.options;
                }
            } else {
                inputs.desc = t5LocalCopy(item.name);
            }
        } catch(e) {
            inputs.desc = t5LocalCopy(item.name);
        }

        item.html = t5GenerateHTML(inputs, T5.template, T5.market);
        item.status = 'done';
        t5RenderQueue();

        // API 부하 방지 딜레이
        await new Promise(r => setTimeout(r, 500));
    }

    showToast(`✅ ${pending.length}개 상세페이지 생성 완료!`, 'success');
}

function t5EditQueueItem(id) {
    const item = T5.queue.find(q => q.id === id);
    if (!item) return;
    const nameEl = document.getElementById('t5-product-name');
    const priceEl = document.getElementById('t5-price');
    const imageEl = document.getElementById('t5-image-urls');
    if (nameEl) nameEl.value = item.name;
    if (priceEl) priceEl.value = item.price || '';
    if (imageEl) imageEl.value = item.image || '';
    t5UpdatePreview();
    showToast(`📝 "${item.name}" 편집 모드`);
}

function t5PreviewQueueItem(id) {
    const item = T5.queue.find(q => q.id === id);
    if (!item?.html) return;
    const frame = document.getElementById('t5-preview-frame');
    if (frame) {
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open(); doc.write(item.html); doc.close();
    }
}

function t5DownloadQueueItem(id) {
    const item = T5.queue.find(q => q.id === id);
    if (!item?.html) return;
    const blob = new Blob([item.html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (item.name || 'detail').replace(/[^가-힣a-zA-Z0-9]/g, '_') + '_상세페이지.html';
    a.click();
}

function t5DownloadAllQueue() {
    // 개별 파일로 다운로드 (ZIP은 추가 라이브러리 필요하므로 순차 다운로드)
    T5.queue.filter(q => q.status === 'done' && q.html).forEach((item, idx) => {
        setTimeout(() => t5DownloadQueueItem(item.id), idx * 300);
    });
    showToast(`📦 ${T5.queue.filter(q => q.status === 'done').length}개 파일 다운로드 시작`);
}

// ═══════════════════════════════════════════════════════════════
// PART A: AI 배너 이미지 자동 생성 (HTML→Canvas→PNG)
// ═══════════════════════════════════════════════════════════════

/**
 * 상품 이미지 + 텍스트를 조합하여 마켓용 배너 이미지를 생성합니다.
 * 외부 API 없이 Canvas로 렌더링 — 무료 운영 원칙 유지.
 *
 * 배너 타입:
 *  - hero:     대표 배너 (860×500, 상품 이미지 + 상품명 + 가격 + 뱃지)
 *  - feature:  특장점 배너 (860×400, 아이콘 + 텍스트 그리드)
 *  - cta:      구매 유도 배너 (860×300, 강력한 CTA + 가격)
 *  - sns:      SNS 공유용 정사각형 (1080×1080)
 */
const BANNER_PRESETS = {
    hero:    { w: 860, h: 500, label: '대표 배너', desc: '860×500' },
    feature: { w: 860, h: 400, label: '특장점 배너', desc: '860×400' },
    cta:     { w: 860, h: 300, label: 'CTA 배너', desc: '860×300' },
    sns:     { w: 1080, h: 1080, label: 'SNS 정사각', desc: '1080×1080' },
};

// 배너 색상 테마 (템플릿 연동)
function t5GetBannerTheme(templateKey) {
    const themes = {
        clean:   { bg: '#ffffff', text: '#0f172a', accent: '#10b981', sub: '#64748b' },
        premium: { bg: '#0f172a', text: '#f8fafc', accent: '#a78bfa', sub: '#94a3b8' },
        trendy:  { bg: '#fffbf5', text: '#0f172a', accent: '#f59e0b', sub: '#78350f' },
        minimal: { bg: '#fafaf9', text: '#292524', accent: '#78716c', sub: '#a8a29e' },
        tech:    { bg: '#020617', text: '#e2e8f0', accent: '#3b82f6', sub: '#94a3b8' },
        nature:  { bg: '#f0fdf4', text: '#14532d', accent: '#16a34a', sub: '#4ade80' },
        kids:    { bg: '#fef7ff', text: '#581c87', accent: '#a855f7', sub: '#c084fc' },
        food:    { bg: '#fffbeb', text: '#78350f', accent: '#d97706', sub: '#f59e0b' },
    };
    return themes[templateKey] || themes.clean;
}

async function t5GenerateBanner(bannerType) {
    const inputs = t5GetInputs();
    const preset = BANNER_PRESETS[bannerType || 'hero'];
    const theme = t5GetBannerTheme(T5.template);

    const canvas = document.createElement('canvas');
    canvas.width = preset.w;
    canvas.height = preset.h;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, preset.w, preset.h);

    // 상품 이미지 로드 시도
    let productImg = null;
    if (inputs.images[0]) {
        try {
            productImg = await t5LoadImage(inputs.images[0]);
        } catch(e) {
            console.warn('Banner: image load failed, proceeding without image');
        }
    }

    if (bannerType === 'hero') {
        await t5DrawHeroBanner(ctx, preset, theme, inputs, productImg);
    } else if (bannerType === 'feature') {
        t5DrawFeatureBanner(ctx, preset, theme, inputs);
    } else if (bannerType === 'cta') {
        t5DrawCtaBanner(ctx, preset, theme, inputs);
    } else if (bannerType === 'sns') {
        await t5DrawSnsBanner(ctx, preset, theme, inputs, productImg);
    }

    // Canvas → Blob → 다운로드
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(inputs.name || 'banner').replace(/[^가-힣a-zA-Z0-9]/g, '_')}_${bannerType}_${preset.w}x${preset.h}.png`;
        a.click();
        URL.revokeObjectURL(url);

        // 미리보기도 표시
        const preview = document.getElementById('t5-banner-preview');
        if (preview) {
            preview.innerHTML = `<img src="${canvas.toDataURL()}" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">`;
        }

        showToast(`🖼️ ${preset.label} (${preset.desc}) 배너 생성 완료!`);
    }, 'image/png');
}

function t5LoadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

// 대표 배너 (히어로)
async function t5DrawHeroBanner(ctx, preset, theme, inputs, productImg) {
    const { w, h } = preset;

    // 좌측: 텍스트 영역 (60%)
    const textW = Math.round(w * 0.58);

    // 강조색 액센트 바
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 0, 6, h);

    // 뱃지
    if (inputs.badge) {
        ctx.fillStyle = theme.accent;
        t5RoundRect(ctx, 40, 40, ctx.measureText(inputs.badge).width + 28, 28, 14);
        ctx.fill();
        ctx.fillStyle = theme.bg;
        ctx.font = '700 12px "Malgun Gothic", sans-serif';
        ctx.fillText(inputs.badge, 54, 58);
    }

    // 상품명
    ctx.fillStyle = theme.text;
    ctx.font = '800 28px "Malgun Gothic", sans-serif';
    const nameLines = t5WrapText(ctx, inputs.name, textW - 80);
    let nameY = inputs.badge ? 110 : 80;
    nameLines.forEach(line => {
        ctx.fillText(line, 40, nameY);
        nameY += 38;
    });

    // 설명 (최대 2줄)
    if (inputs.desc) {
        ctx.fillStyle = theme.sub;
        ctx.font = '400 14px "Malgun Gothic", sans-serif';
        const descLines = t5WrapText(ctx, inputs.desc.replace(/\n/g, ' '), textW - 80).slice(0, 2);
        let descY = nameY + 12;
        descLines.forEach(line => {
            ctx.fillText(line, 40, descY);
            descY += 22;
        });
    }

    // 가격
    if (inputs.price > 0) {
        ctx.fillStyle = theme.accent;
        ctx.font = '800 32px "Malgun Gothic", sans-serif';
        ctx.fillText(inputs.price.toLocaleString() + '원', 40, h - 60);
    }

    // 우측: 상품 이미지 (40%)
    if (productImg) {
        const imgX = textW + 20;
        const imgSize = Math.min(w - textW - 40, h - 40);
        const imgY = Math.round((h - imgSize) / 2);

        // 둥근 클리핑
        ctx.save();
        t5RoundRect(ctx, imgX, imgY, imgSize, imgSize, 16);
        ctx.clip();
        // 이미지 중앙 크롭
        const scale = Math.max(imgSize / productImg.width, imgSize / productImg.height);
        const sw = imgSize / scale, sh = imgSize / scale;
        const sx = (productImg.width - sw) / 2, sy = (productImg.height - sh) / 2;
        ctx.drawImage(productImg, sx, sy, sw, sh, imgX, imgY, imgSize, imgSize);
        ctx.restore();
    } else {
        // 이미지 없을 때 플레이스홀더
        ctx.fillStyle = theme.accent + '15';
        t5RoundRect(ctx, textW + 20, 40, w - textW - 60, h - 80, 16);
        ctx.fill();
        ctx.fillStyle = theme.sub;
        ctx.font = '400 14px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('상품 이미지', textW + 20 + (w - textW - 60) / 2, h / 2);
        ctx.textAlign = 'left';
    }
}

// 특장점 배너
function t5DrawFeatureBanner(ctx, preset, theme, inputs) {
    const { w, h } = preset;

    // 상단 제목
    ctx.fillStyle = theme.accent;
    ctx.font = '800 22px "Malgun Gothic", sans-serif';
    ctx.fillText('✨ 제품 특장점', 40, 50);

    // 특장점 그리드 (2열)
    const features = inputs.features.slice(0, 6);
    const colW = (w - 100) / 2;
    const startY = 90;

    features.forEach((feat, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 40 + col * (colW + 20);
        const y = startY + row * 90;

        // 번호 원
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.bg;
        ctx.font = '700 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), x + 16, y + 21);
        ctx.textAlign = 'left';

        // 텍스트
        ctx.fillStyle = theme.text;
        ctx.font = '600 14px "Malgun Gothic", sans-serif';
        const lines = t5WrapText(ctx, feat.trim(), colW - 50);
        lines.slice(0, 2).forEach((line, li) => {
            ctx.fillText(line, x + 44, y + 14 + li * 20);
        });
    });
}

// CTA 배너
function t5DrawCtaBanner(ctx, preset, theme, inputs) {
    const { w, h } = preset;

    // 그라데이션 배경
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, theme.accent);
    grad.addColorStop(1, theme.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 텍스트
    ctx.fillStyle = theme.text === '#fff' || theme.text === '#f8fafc' ? '#ffffff' : '#ffffff';
    ctx.font = '800 36px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(inputs.name, w / 2, h / 2 - 30);

    if (inputs.price > 0) {
        ctx.font = '800 28px "Malgun Gothic", sans-serif';
        ctx.fillText(inputs.price.toLocaleString() + '원', w / 2, h / 2 + 20);
    }

    ctx.font = '700 16px "Malgun Gothic", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('지금 바로 구매하기 →', w / 2, h / 2 + 65);
    ctx.textAlign = 'left';
}

// SNS 정사각 배너
async function t5DrawSnsBanner(ctx, preset, theme, inputs, productImg) {
    const { w, h } = preset;

    // 배경
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // 상품 이미지 (상단 70%)
    if (productImg) {
        const imgH = Math.round(h * 0.65);
        ctx.save();
        ctx.rect(0, 0, w, imgH);
        ctx.clip();
        const scale = Math.max(w / productImg.width, imgH / productImg.height);
        const sw = w / scale, sh = imgH / scale;
        const sx = (productImg.width - sw) / 2, sy = (productImg.height - sh) / 2;
        ctx.drawImage(productImg, sx, sy, sw, sh, 0, 0, w, imgH);
        ctx.restore();
    }

    // 하단 텍스트 영역
    const textY = Math.round(h * 0.68);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, textY - 20, w, h - textY + 20);

    // 상품명
    ctx.fillStyle = theme.text;
    ctx.font = '800 32px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    const nameLines = t5WrapText(ctx, inputs.name, w - 80);
    nameLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, w / 2, textY + 30 + i * 40);
    });

    // 가격
    if (inputs.price > 0) {
        ctx.fillStyle = theme.accent;
        ctx.font = '800 40px "Malgun Gothic", sans-serif';
        ctx.fillText(inputs.price.toLocaleString() + '원', w / 2, h - 60);
    }

    ctx.textAlign = 'left';
}

// Canvas 유틸: 둥근 사각형
function t5RoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// Canvas 유틸: 텍스트 줄바꿈
function t5WrapText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = text.split('');
    const lines = [];
    let currentLine = '';

    for (const char of words) {
        const testLine = currentLine + char;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = char;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

// 전체 배너 세트 일괄 생성
async function t5GenerateAllBanners() {
    showToast('🖼️ 4종 배너 일괄 생성 중...');
    for (const type of ['hero', 'feature', 'cta', 'sns']) {
        await t5GenerateBanner(type);
        await new Promise(r => setTimeout(r, 300));
    }
    showToast('✅ 대표/특장점/CTA/SNS 배너 4종 생성 완료!', 'success');
}


// ═══════════════════════════════════════════════════════════════
// PART B: SEO 최적화 상품명 자동 생성
// ═══════════════════════════════════════════════════════════════

/**
 * 네이버 검색광고 API 키워드 데이터 + AI를 결합하여
 * 검색 노출에 최적화된 상품명을 자동 생성합니다.
 *
 * 알고리즘:
 *  1. 입력된 상품명에서 핵심 키워드 추출
 *  2. 네이버 검색광고 API로 연관 키워드 + 월간검색량 조회
 *  3. "검색량 높고 경쟁 낮은" 키워드를 우선 선별
 *  4. 마켓별 상품명 글자 제한에 맞춰 조합
 *  5. AI로 자연스러운 문장형 상품명 생성
 */

const MARKET_TITLE_LIMITS = {
    smartstore: 100,  // 네이버: 100자
    coupang: 100,     // 쿠팡: 100자
    gmarket: 100,     // G마켓: 100자
    '11st': 100,      // 11번가: 100자
    tmon: 100,        // 티몬: 100자
};

async function t5GenerateSEOTitle() {
    const nameEl = document.getElementById('t5-product-name');
    const baseName = (nameEl?.value || '').trim();
    if (!baseName) { showToast('상품명을 먼저 입력하세요'); return; }

    const resultEl = document.getElementById('t5-seo-title-result');
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="t5-loading-inline">🔍 키워드 분석 + SEO 상품명 생성 중...</div>';
    }

    // Step 1: 네이버 검색광고 API로 키워드 데이터 수집
    let keywordData = [];
    try {
        const result = await fetchGas('naverSearchAd', { keyword: baseName });
        if (result?.success && result.keywords?.length) {
            keywordData = result.keywords
                .filter(kw => kw.monthlyTotal > 0)
                .sort((a, b) => {
                    // 검색량 높고 경쟁 낮은 순서
                    const scoreA = (a.monthlyTotal || 0) * (a.competitionIdx === '낮음' ? 3 : a.competitionIdx === '중간' ? 2 : 1);
                    const scoreB = (b.monthlyTotal || 0) * (b.competitionIdx === '낮음' ? 3 : b.competitionIdx === '중간' ? 2 : 1);
                    return scoreB - scoreA;
                })
                .slice(0, 15);
        }
    } catch(e) {
        console.warn('SEO Title: keyword API failed, using AI fallback');
    }

    // Step 2: AI로 상품명 생성 (키워드 데이터 포함)
    const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    let suggestions = [];

    if (apiKey && keywordData.length > 0) {
        try {
            const kwList = keywordData.slice(0, 8).map(k =>
                `"${k.keyword}" (월검색 ${k.monthlyTotal}, 경쟁 ${k.competitionIdx})`
            ).join('\n');

            const prompt = `당신은 한국 오픈마켓 SEO 전문가입니다.

기본 상품명: ${baseName}

네이버 검색 키워드 데이터:
${kwList}

위 키워드 중 검색량이 높고 경쟁이 낮은 키워드를 최대한 자연스럽게 조합하여
마켓 상품명을 5가지 버전으로 생성하세요.

규칙:
- 각 100자 이내
- 검색량 높은 키워드를 앞쪽에 배치
- 스팸성 키워드 나열 금지 (자연스러운 문장)
- 브랜드명 미포함 (위탁/사입 상품이므로)
- 구매 의도가 담긴 키워드 우선 (예: "추천", "가성비", "인기")

JSON만 출력:
{"titles":["상품명1","상품명2","상품명3","상품명4","상품명5"],"topKeywords":["핵심키워드1","핵심키워드2","핵심키워드3"]}`;

            const res = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 600 }
                    })
                }
            );
            const data = await res.json();
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
            suggestions = parsed.titles || [];
            if (parsed.topKeywords?.length) T5.seoKeywords = parsed.topKeywords;
        } catch(e) {
            console.warn('SEO Title: AI generation failed');
        }
    }

    // Step 3: AI 없거나 실패 시 로컬 알고리즘
    if (!suggestions.length) {
        suggestions = t5LocalSEOTitles(baseName, keywordData);
    }

    // Step 4: 결과 렌더링
    t5RenderSEOTitleResult(suggestions, keywordData);
}

// 로컬 SEO 상품명 생성 (AI 없을 때)
function t5LocalSEOTitles(baseName, keywords) {
    const modifiers = ['인기', '추천', '가성비', '프리미엄', '베스트'];
    const suffixes = ['무료배송', '당일발송', '사은품증정', '특가', '최저가'];
    const kwNames = keywords.slice(0, 3).map(k => k.keyword);

    const titles = [];
    // 패턴 1: [수식어] + 핵심키워드 + 기본상품명 + [접미사]
    titles.push(`${modifiers[0]} ${kwNames[0] || ''} ${baseName} ${suffixes[0]}`.trim());
    titles.push(`${baseName} ${kwNames.slice(0, 2).join(' ')} ${modifiers[1]} ${suffixes[1]}`.trim());
    titles.push(`${kwNames[0] || baseName} ${modifiers[2]} ${baseName} ${suffixes[2]}`.trim());
    // 패턴 2: 키워드 나열형
    if (kwNames.length >= 2) {
        titles.push(`${kwNames[0]} ${kwNames[1]} ${baseName} ${modifiers[3]}`.trim());
    }
    titles.push(`${baseName} ${modifiers[4]} ${suffixes[4]} ${kwNames[0] || ''}`.trim());

    return titles.map(t => t.slice(0, 100));
}

function t5RenderSEOTitleResult(suggestions, keywordData) {
    const el = document.getElementById('t5-seo-title-result');
    if (!el) return;

    let html = `<div class="t5-section-header"><span>🎯 SEO 최적화 상품명</span><span class="t5-badge-new">NEW</span></div>`;

    // 키워드 분석 요약
    if (keywordData.length) {
        html += `<div class="t5-kw-summary">`;
        keywordData.slice(0, 5).forEach(kw => {
            const compColor = kw.competitionIdx === '낮음' ? '#10b981' : kw.competitionIdx === '중간' ? '#f59e0b' : '#ef4444';
            html += `<span class="t5-kw-chip">
                <span class="t5-kw-chip-name">${escapeHtml(kw.keyword)}</span>
                <span class="t5-kw-chip-vol">${fmt(kw.monthlyTotal)}</span>
                <span style="color:${compColor}">${kw.competitionIdx}</span>
            </span>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="t5-info-msg">💡 네이버 검색광고 API 키를 T7에 등록하면 검색량 기반 키워드 분석이 적용됩니다.</div>`;
    }

    // 상품명 후보 리스트
    html += `<div class="t5-title-suggestions">`;
    suggestions.forEach((title, i) => {
        const charCount = title.length;
        const charColor = charCount > 90 ? '#ef4444' : charCount > 70 ? '#f59e0b' : '#10b981';
        html += `<div class="t5-title-row" onclick="t5ApplySEOTitle('${escapeHtml(title).replace(/'/g, "\\'")}')">
            <span class="t5-title-num">${i + 1}</span>
            <span class="t5-title-text">${escapeHtml(title)}</span>
            <span class="t5-title-chars" style="color:${charColor}">${charCount}자</span>
            <button class="t5-mini-btn" onclick="event.stopPropagation();t5ApplySEOTitle('${escapeHtml(title).replace(/'/g, "\\'")}')">적용</button>
        </div>`;
    });
    html += `</div>`;

    el.innerHTML = html;
    el.style.display = 'block';
}

function t5ApplySEOTitle(title) {
    const nameEl = document.getElementById('t5-product-name');
    if (nameEl) {
        nameEl.value = title;
        t5UpdatePreview();
        showToast(`✅ SEO 상품명 적용: "${title.slice(0, 30)}..."`);
    }
}

// ═══════════════════════════════════════════════════════════════
// PART C: 마켓 등록 인터페이스 (T3-A/B)
// ═══════════════════════════════════════════════════════════════

async function t5RegisterToMarket(marketKey) {
    const inputs = t5GetInputs();
    if (!inputs.name) { showToast('상품명을 입력하세요'); return; }

    const spec = MARKET_SPECS[marketKey];
    if (!spec) { showToast('지원하지 않는 마켓입니다'); return; }

    showLoading(true, `${spec.icon} ${spec.name}에 상품 등록 중...`);

    try {
        const payload = {
            name: inputs.name,
            description: inputs.desc,
            price: inputs.price,
            images: inputs.images,
            features: inputs.features,
            html: T5.lastHTML,
            seoKeywords: T5.seoKeywords,
            market: marketKey,
        };

        const gasFunc = marketKey === 'coupang' ? 'registerToCoupang'
                      : marketKey === '11st' ? 'registerTo11st'
                      : marketKey === 'smartstore' ? 'registerToSmartstore'
                      : marketKey === 'gmarket' ? 'registerToGmarket'
                      : 'registerToMarket';

        const result = await fetchGas(gasFunc, payload);

        if (result?.success) {
            // 이력 저장
            t5SaveRegistrationHistory({
                market: marketKey,
                marketName: spec.name,
                productName: inputs.name,
                productId: result.productId || '',
                url: result.url || '',
                registeredAt: new Date().toISOString(),
                status: 'registered',
            });
            showToast(`✅ ${spec.name}에 상품 등록 완료!`, 'success');
        } else {
            showToast(`⚠️ ${spec.name} 등록 실패: ${result?.error || '알 수 없는 오류'}`, false);
        }
    } catch(e) {
        showToast(`❌ ${spec.name} 등록 오류: ${e.message}`, false);
    } finally {
        showLoading(false);
    }
}

// ═══ T3-C: 등록 이력 관리 ═══
function t5SaveRegistrationHistory(record) {
    const history = JSON.parse(localStorage.getItem('v7-reg-history') || '[]');
    history.unshift(record);
    localStorage.setItem('v7-reg-history', JSON.stringify(history.slice(0, 200)));
    t5RenderRegistrationHistory();
}

function t5RenderRegistrationHistory() {
    const el = document.getElementById('t5-reg-history');
    if (!el) return;

    const history = JSON.parse(localStorage.getItem('v7-reg-history') || '[]');
    if (!history.length) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    el.innerHTML = `
        <div class="t5-section-header"><span>📋 등록 이력</span><span class="t5-count">${history.length}건</span></div>
        <div style="max-height:200px;overflow-y:auto;">
            ${history.slice(0, 20).map(r => {
                const spec = MARKET_SPECS[r.market] || {};
                const date = (r.registeredAt || '').slice(0, 10);
                return `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;">
                    <span>${spec.icon || '📦'}</span>
                    <span style="flex:1;font-weight:500">${escapeHtml(r.productName || '')}</span>
                    <span style="color:#94a3b8">${spec.name || r.market}</span>
                    <span style="color:#64748b;font-size:10px">${date}</span>
                    ${r.url ? `<a href="${r.url}" target="_blank" style="color:#3b82f6;font-size:10px">🔗</a>` : ''}
                </div>`;
            }).join('')}
        </div>
    `;
}

// ═══ T3-D: 전환율 추적 ═══
function t5RenderConversionTracker() {
    const el = document.getElementById('t5-conversion-panel');
    if (!el) return;

    const history = JSON.parse(localStorage.getItem('v7-reg-history') || '[]');
    const orders = JSON.parse(localStorage.getItem('v7-orders') || '[]');

    if (!history.length) { el.style.display = 'none'; return; }

    // 마켓별 등록 수 vs 주문 수
    const stats = {};
    history.forEach(r => {
        if (!stats[r.market]) stats[r.market] = { registered: 0, sold: 0, revenue: 0 };
        stats[r.market].registered++;
    });

    orders.forEach(o => {
        const mkt = o.market || '';
        if (stats[mkt]) {
            stats[mkt].sold += o.quantity || 1;
            stats[mkt].revenue += o.salePrice || 0;
        }
    });

    el.style.display = 'block';
    el.innerHTML = `
        <div class="t5-section-header"><span>📊 마켓별 전환율</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;">
            ${Object.entries(stats).map(([mkt, s]) => {
                const spec = MARKET_SPECS[mkt] || {};
                const rate = s.registered > 0 ? ((s.sold / s.registered) * 100).toFixed(1) : 0;
                const rateColor = rate >= 10 ? '#10b981' : rate >= 3 ? '#f59e0b' : '#ef4444';
                return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);font-size:11px;">
                    <span>${spec.icon || '📦'}</span>
                    <span style="width:64px;font-weight:500">${spec.name || mkt}</span>
                    <span style="color:#94a3b8">등록 ${s.registered}</span>
                    <span style="color:#60a5fa">판매 ${s.sold}</span>
                    <span style="color:${rateColor};font-weight:700;margin-left:auto">${rate}%</span>
                    <span style="color:#10b981;font-size:10px">${fmtWon(s.revenue)}</span>
                </div>`;
            }).join('')}
        </div>
    `;
}

// ─── 초기화 실행 ───
document.addEventListener('DOMContentLoaded', t5Init);


// ═══════════════════════════════════════════════════════════════
// PART D: 마켓 대량 등록 큐 전송 (T3 -> T5 연동)
// ═══════════════════════════════════════════════════════════════

function t5SendToMarketRegister() {
    const queue = window.T5?.queue || [];
    const doneItems = queue.filter(q => q.status === 'done' && q.html);
    
    if (doneItems.length === 0) {
        showToast('⚠️ 마켓에 등록할 상세페이지가 없습니다. 먼저 [복사/다운로드] 위 목록에서 HTML 생성을 완료해주세요.', true);
        return;
    }
    
    // T5 마켓 자동 등록 탭(register)으로 이동
    if (typeof showTab === 'function') {
        showTab('register');
    }
    
    // 강제 렌더링 호출
    if (typeof t5RenderRegisterPanel === 'function') {
        t5RenderRegisterPanel();
    }
    showToast(`🚀 ${doneItems.length}개의 상품을 마켓 등록 대기열로 보냈습니다!`);
}

// 전역 노출
window.t5SendToMarketRegister = t5SendToMarketRegister;
window.t5SetTemplate = t5SetTemplate;
window.t5SetMarket = t5SetMarket;
window.t5UpdatePreview = t5UpdatePreview;
window.t5GenerateAICopy = t5GenerateAICopy;
window.t5CopyHTML = t5CopyHTML;
window.t5DownloadHTML = t5DownloadHTML;
window.t5ProcessQueue = t5ProcessQueue;
window.t5EditQueueItem = t5EditQueueItem;
window.t5PreviewQueueItem = t5PreviewQueueItem;
window.t5DownloadQueueItem = t5DownloadQueueItem;
window.t5DownloadAllQueue = t5DownloadAllQueue;
window.t5GenerateBanner = t5GenerateBanner;
window.t5GenerateAllBanners = t5GenerateAllBanners;
window.t5GenerateSEOTitle = t5GenerateSEOTitle;
window.t5ApplySEOTitle = t5ApplySEOTitle;
window.t5RegisterToMarket = t5RegisterToMarket;
window.t5RenderRegistrationHistory = t5RenderRegistrationHistory;
window.t5RenderConversionTracker = t5RenderConversionTracker;
window.T5 = T5;
