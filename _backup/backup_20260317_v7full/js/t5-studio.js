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

    t5UpdatePreview();

    // 자동 AI 카피 트리거
    if (data.name) setTimeout(() => t5GenerateAICopy(), 500);
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

// ─── HTML 생성 엔진 ───
function t5GenerateHTML(inputs, templateKey, marketKey) {
    const tpl = TEMPLATES[templateKey || T5.template];
    const spec = MARKET_SPECS[marketKey || T5.market];
    const { name, desc, images, features, price, badge } = inputs;
    const priceStr = price > 0 ? price.toLocaleString() + '원' : '';
    const mainImage = images[0] || 'https://placehold.co/800x800/f8fafc/94a3b8?text=PRODUCT+IMAGE';
    const isDark = ['premium', 'tech'].includes(templateKey || T5.template);

    // 특장점 HTML
    const featureHTML = features.map(f => {
        const trimmed = f.trim();
        return `<li style="padding:10px 0;border-bottom:1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'};font-size:14px;line-height:1.6;color:${isDark ? '#cbd5e1' : '#475569'};">${trimmed}</li>`;
    }).join('');

    // 추가 이미지 (2번째부터)
    const extraImages = images.slice(1).map(url =>
        `<div style="text-align:center;margin:20px 0;"><img src="${url}" alt="${name}" style="width:100%;max-width:${spec.width - 40}px;border-radius:8px;"></div>`
    ).join('');

    // 뱃지
    const badgeHTML = badge ? `<div style="display:inline-block;padding:6px 16px;background:${tpl.accent};color:${isDark ? '#fff' : '#fff'};border-radius:20px;font-size:11px;font-weight:700;margin:16px 0;letter-spacing:1px;">${badge}</div>` : '';

    // CTA 버튼 (trendy, food, kids에만)
    const ctaTemplates = ['trendy', 'food', 'kids'];
    const ctaHTML = ctaTemplates.includes(templateKey || T5.template) ? `<div style="text-align:center;padding:24px;"><button style="padding:14px 48px;background:${tpl.accent};color:#fff;border:none;border-radius:30px;font-size:16px;font-weight:800;cursor:pointer;">🛒 지금 바로 구매하기</button></div>` : '';

    // SEO 키워드 메타
    const seoMeta = T5.seoKeywords.length ? `<meta name="keywords" content="${T5.seoKeywords.join(',')}">` : '';

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${seoMeta}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Malgun Gothic','맑은 고딕',sans-serif;color:${tpl.text};background:${tpl.bg};max-width:${spec.width}px;margin:0 auto;word-break:keep-all}
.hero{text-align:center;padding:40px 20px}
.hero img{width:100%;max-width:${Math.round(spec.width * 0.75)}px;border-radius:12px;${isDark ? 'box-shadow:0 20px 60px rgba(0,0,0,0.5)' : 'box-shadow:0 4px 20px rgba(0,0,0,0.08)'}}
.title{font-size:28px;font-weight:900;margin:24px 0 8px;color:${isDark ? '#f8fafc' : tpl.text}}
.price{font-size:24px;font-weight:800;color:${tpl.accent};margin:8px 0 16px}
.desc{font-size:15px;color:${isDark ? '#94a3b8' : '#64748b'};line-height:1.8;padding:0 20px}
.features{padding:30px 40px;background:${tpl.featureBg};border-radius:16px;margin:30px 20px;${isDark ? 'border:1px solid rgba(255,255,255,0.1)' : ''}}
.features h3{font-size:18px;margin-bottom:16px;color:${tpl.accent};font-weight:700}
.features ul{list-style:none}
.notice{text-align:center;padding:30px;font-size:12px;color:${isDark ? '#475569' : '#94a3b8'}}
</style>
</head>
<body>
<div class="hero">
<img src="${mainImage}" alt="${name}">
${badgeHTML}
<h1 class="title">${name}</h1>
${priceStr ? `<div class="price">${priceStr}</div>` : ''}
<p class="desc">${desc}</p>
</div>
${extraImages}
${features.length ? `<div class="features"><h3>${getFeatureTitle(templateKey || T5.template)}</h3><ul>${featureHTML}</ul></div>` : ''}
${ctaHTML}
<div class="notice">${getNoticeText(templateKey || T5.template)}</div>
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

    const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';

    if (!apiKey) {
        // 로컬 폴백
        descEl.value = t5LocalCopy(nameEl.value);
        if (!featuresEl.value) {
            featuresEl.value = t5LocalFeatures(nameEl.value);
        }
        t5UpdatePreview();
        showToast('✅ 카피 생성 (로컬 모드 — Gemini 키 등록 시 AI 카피 가능)');
        return;
    }

    showToast('🤖 AI가 매력적인 카피를 생성 중...');

    try {
        const prompt = `당신은 한국 오픈마켓 상세페이지 전문 카피라이터입니다.

상품명: ${nameEl.value}
기존 설명: ${descEl?.value || '없음'}
기존 특장점: ${featuresEl?.value || '없음'}

다음을 JSON으로 출력하세요 (JSON만, 다른 텍스트 없이):
{
  "headline": "주목도 높은 한줄 헤드카피 (15자 내외)",
  "description": "구매 욕구를 자극하는 상품 설명 (200자 내외, 이모지 포함)",
  "features": ["특장점1 (고객 혜택 중심)", "특장점2", "특장점3", "특장점4", "특장점5"],
  "keywords": ["SEO키워드1", "SEO키워드2", "SEO키워드3"],
  "badge": "뱃지 문구 (예: BEST SELLER, 오늘만 특가, 무료배송)"
}

규칙:
- 과장/허위 금지
- 고객 혜택 중심 (기능이 아니라 "이걸 쓰면 어떻게 좋은지")
- 네이버 쇼핑 검색 노출에 유리한 키워드 자연스럽게 포함`;

        const res = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                })
            }
        );
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed.description) descEl.value = parsed.description;
        if (parsed.features?.length) featuresEl.value = parsed.features.join('\n');
        if (parsed.badge) {
            const badgeEl = document.getElementById('t5-badge');
            if (badgeEl) badgeEl.value = parsed.badge;
        }
        if (parsed.keywords?.length) {
            T5.seoKeywords = parsed.keywords;
            const seoEl = document.getElementById('t5-seo-keywords');
            if (seoEl) seoEl.textContent = parsed.keywords.join(' · ');
        }

        t5UpdatePreview();
        showToast('✅ AI 카피 + SEO 키워드 생성 완료!');

    } catch(e) {
        console.error('AI Copy Error:', e);
        descEl.value = t5LocalCopy(nameEl.value);
        t5UpdatePreview();
        showToast('⚠️ AI 호출 실패, 로컬 카피로 대체');
    }
}

function t5LocalCopy(name) {
    const templates = [
        `✨ ${name}\n\n일상을 특별하게 만들어줄 ${name}! 높은 품질과 세련된 디자인으로 당신의 라이프스타일을 업그레이드하세요.`,
        `🎯 ${name}\n\n지금 이 가격에 이 품질? 믿을 수 없는 가성비! ${name}으로 현명한 소비를 경험하세요.`,
        `💫 ${name}\n\n수많은 리뷰가 증명하는 만족도! ${name}과 함께하는 매일이 달라집니다.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function t5LocalFeatures(name) {
    return `프리미엄 소재로 오래 사용 가능\n세련된 디자인으로 어디서든 활용\n가성비 최고 — 합리적인 가격\n빠른 배송 — 주문 후 1~2일 내 도착\n안심 교환/반품 7일 보장`;
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

        // AI 카피 시도 (있으면)
        const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
        if (apiKey) {
            try {
                const res = await fetch(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: `상품 "${item.name}"의 쇼핑몰 상세페이지 카피를 JSON으로:\n{"description":"200자 설명","features":["특장점1","특장점2","특장점3"],"badge":"뱃지문구"}\nJSON만 출력.` }] }],
                            generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
                        })
                    }
                );
                const data = await res.json();
                const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
                if (parsed.description) inputs.desc = parsed.description;
                if (parsed.features) inputs.features = parsed.features;
                if (parsed.badge) inputs.badge = parsed.badge;
            } catch(e) {
                inputs.desc = t5LocalCopy(item.name);
            }
        } else {
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
        const result = await fetchGas('naverAdProxy', { keyword: baseName });
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

// 전역 노출
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
