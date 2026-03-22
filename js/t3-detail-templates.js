// ═══════════════════════════════════════════════════════════════
//  T3 상세페이지 이미지 빌더 — 섹션 템플릿 정의
//  실제 상위 셀러 디자인 패턴 기반 (주방수납/뷰티/패션 분석)
// ═══════════════════════════════════════════════════════════════

'use strict';

// ─── 통일 테마 (AI탭 TEMPLATES 8종과 동일 키 체계) ───
const DetailPresets = {
    clean: {
        name: '✨ 깔끔',
        hero: { bg: '#ffffff', text: '#1e293b', accent: '#0f172a' },
        body:  { bg: '#f8fafc', text: '#1e293b', accent: '#0f172a' },
        highlight: '#e2e8f0',
        fonts: { title: "'Pretendard', sans-serif", accent: "'Pretendard', sans-serif" },
    },
    premium: {
        name: '💎 프리미엄',
        hero: { bg: '#0f172a', text: '#ffffff', accent: '#a78bfa' },
        body:  { bg: '#1e293b', text: '#f1f5f9', accent: '#a78bfa' },
        highlight: '#e9d5ff',
        fonts: { title: "'Pretendard', sans-serif", accent: "'GmarketSansMedium', sans-serif" },
    },
    trendy: {
        name: '🔥 트렌디',
        hero: { bg: '#fffbf5', text: '#1e293b', accent: '#f59e0b' },
        body:  { bg: '#fffbf5', text: '#1e293b', accent: '#f59e0b' },
        highlight: '#fde68a',
        fonts: { title: "'Pretendard', sans-serif", accent: "'GmarketSansMedium', sans-serif" },
    },
    minimal: {
        name: '🤍 미니멀',
        hero: { bg: '#fafaf9', text: '#292524', accent: '#78716c' },
        body:  { bg: '#f5f5f4', text: '#292524', accent: '#78716c' },
        highlight: '#e7e5e4',
        fonts: { title: "'Pretendard', sans-serif", accent: "'Pretendard', sans-serif" },
    },
    tech: {
        name: '💻 테크',
        hero: { bg: '#020617', text: '#e2e8f0', accent: '#3b82f6' },
        body:  { bg: '#0f172a', text: '#e2e8f0', accent: '#3b82f6' },
        highlight: '#bfdbfe',
        fonts: { title: "'SUIT', sans-serif", accent: "'GmarketSansMedium', sans-serif" },
    },
    nature: {
        name: '🌿 내추럴',
        hero: { bg: '#f0fdf4', text: '#14532d', accent: '#16a34a' },
        body:  { bg: '#f0fdf4', text: '#14532d', accent: '#16a34a' },
        highlight: '#bbf7d0',
        fonts: { title: "'Pretendard', sans-serif", accent: "'Pretendard', sans-serif" },
    },
    kids: {
        name: '🧸 키즈',
        hero: { bg: '#fef7ff', text: '#581c87', accent: '#a855f7' },
        body:  { bg: '#fef7ff', text: '#581c87', accent: '#a855f7' },
        highlight: '#f0abfc',
        fonts: { title: "'Pretendard', sans-serif", accent: "'Cafe24Ssurround', sans-serif" },
    },
    food: {
        name: '🍽️ 푸드',
        hero: { bg: '#fffbeb', text: '#78350f', accent: '#d97706' },
        body:  { bg: '#fffbeb', text: '#3f3f46', accent: '#d97706' },
        highlight: '#fde68a',
        fonts: { title: "'Pretendard', sans-serif", accent: "'Cafe24Ssurround', sans-serif" },
    },
};

// ─── 공통 베이스 CSS (모든 섹션에 적용) ───
function getBaseCSS() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; -webkit-font-smoothing: antialiased; }
        .section { width: 860px; padding: 0; position: relative; overflow: hidden; }
        .section img { max-width: 100%; height: auto; display: block; }
        mark { background: linear-gradient(transparent 50%, var(--highlight) 50%); padding: 0 4px; font-style: normal; }
        .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; }
    `;
}

// ═══════════════════════════════════════════════
// 섹션 ① 히어로 배너
// 분석 근거: 비욘드앤홈 — 다크배경+골드 "숫자가 증명하는 1위"
// ═══════════════════════════════════════════════
function sectionHeroBanner(data, preset) {
    const p = preset.hero;
    return `
    <div class="section" style="
        background: ${p.bg};
        color: ${p.text};
        text-align: center;
        padding: 80px 60px;
        min-height: 480px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    ">
        ${data.badge ? `<div class="badge" style="background:${p.accent}; color:#fff; margin-bottom: 24px; font-size: 14px; letter-spacing: 1px;">${data.badge}</div>` : ''}
        <h1 style="
            font-family: ${preset.fonts.accent};
            font-size: 42px;
            font-weight: 800;
            line-height: 1.3;
            margin-bottom: 20px;
            color: ${p.text};
            letter-spacing: -1px;
        ">${data.title || '상품명을 입력하세요'}</h1>
        <p style="
            font-size: 18px;
            font-weight: 300;
            color: ${p.text};
            opacity: 0.85;
            line-height: 1.6;
            max-width: 600px;
        ">${data.subtitle || ''}</p>
        ${data.heroImage ? `<img src="${data.heroImage}" style="max-width: 400px; margin-top: 40px; border-radius: 12px;" alt=""/>` : ''}
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ② 소셜프루프 배지
// 분석 근거: "누적 리뷰수 20,448개 돌파!" + ★4.88/5
// ═══════════════════════════════════════════════
function sectionSocialProof(data, preset) {
    const items = data.proofItems || [
        { icon: '⭐', value: '4.88', label: '평균 평점', suffix: '/5' },
        { icon: '💬', value: '20,448', label: '누적 리뷰', suffix: '개' },
        { icon: '📦', value: '50,000', label: '누적 판매', suffix: '+' },
    ];
    const highlight = preset.highlight;

    return `
    <div class="section" style="
        background: #ffffff;
        padding: 60px 40px;
        text-align: center;
    ">
        <p style="font-size: 16px; color: #94a3b8; font-weight: 500; margin-bottom: 8px;">
            ${data.proofLabel || '고객이 직접 증명합니다'}
        </p>
        <h2 style="
            font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 40px;
        ">${data.proofTitle || '<mark style="background:linear-gradient(transparent 50%, ' + highlight + ' 50%)">숫자</mark>가 증명하는 품질'}</h2>
        <div style="
            display: flex;
            justify-content: center;
            gap: 40px;
            flex-wrap: wrap;
        ">
            ${items.map(item => `
                <div style="
                    background: #f8fafc;
                    border-radius: 16px;
                    padding: 32px 28px;
                    min-width: 180px;
                    flex: 1;
                    max-width: 220px;
                ">
                    <div style="font-size: 36px; margin-bottom: 8px;">${item.icon}</div>
                    <div style="
                        font-size: 38px; font-weight: 800; color: ${preset.body.accent};
                        font-family: ${preset.fonts.accent};
                        line-height: 1.1;
                    ">${item.value}<span style="font-size: 16px; font-weight: 400; color: #94a3b8;">${item.suffix || ''}</span></div>
                    <div style="font-size: 14px; color: #64748b; margin-top: 8px; font-weight: 500;">${item.label}</div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ③ 특장점 카드 (2~4칸 그리드)
// 분석 근거: 아이소이 — 아이콘 + 핵심키워드 + 설명
// ═══════════════════════════════════════════════
function sectionFeatureCards(data, preset) {
    const features = data.features || [
        { icon: '✅', title: '특장점 1', desc: '상품의 핵심 장점을 설명합니다' },
        { icon: '🛡️', title: '특장점 2', desc: '차별화 포인트를 강조합니다' },
        { icon: '💎', title: '특장점 3', desc: '고객에게 제공하는 가치입니다' },
    ];
    const cols = features.length <= 3 ? features.length : Math.min(features.length, 4);

    return `
    <div class="section" style="
        background: ${preset.body.bg};
        padding: 60px 40px;
    ">
        ${data.featureTitle ? `<h2 style="text-align:center; font-size:26px; font-weight:700; color:#1e293b; margin-bottom:40px;">${data.featureTitle}</h2>` : ''}
        <div style="
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: 20px;
        ">
            ${features.map(f => `
                <div style="
                    background: #ffffff;
                    border-radius: 16px;
                    padding: 32px 24px;
                    text-align: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                    border: 1px solid #f1f5f9;
                ">
                    <div style="font-size: 40px; margin-bottom: 16px;">${f.icon}</div>
                    <h3 style="
                        font-size: 18px; font-weight: 700; color: #1e293b;
                        margin-bottom: 10px;
                    ">${f.title}</h3>
                    <p style="font-size: 14px; color: #64748b; line-height: 1.6;">${f.desc}</p>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ④ 비교표 (기존 vs 우리)
// 분석 근거: 비욘드앤홈 — "1세대 선반 → 이제 세대교체"
// ═══════════════════════════════════════════════
function sectionComparison(data, preset) {
    const rows = data.compareRows || [
        { label: '소재', before: '일반 플라스틱', after: '프리미엄 ABS' },
        { label: '내구성', before: '1~2년', after: '5년 이상' },
        { label: '디자인', before: '구식', after: '모던 미니멀' },
    ];

    return `
    <div class="section" style="
        background: ${preset.body.bg};
        padding: 60px 40px;
        text-align: center;
    ">
        <h2 style="font-size: 26px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">
            ${data.compareTitle || '<mark style="background:linear-gradient(transparent 50%, ' + preset.highlight + ' 50%)">차이</mark>가 확실합니다'}
        </h2>
        <p style="font-size: 15px; color: #94a3b8; margin-bottom: 32px;">${data.compareSubtitle || '기존 제품과 비교해 보세요'}</p>
        <table style="
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        ">
            <thead>
                <tr>
                    <th style="background:#e2e8f0; padding:16px; font-size:14px; color:#64748b; width:25%;"></th>
                    <th style="background:#fee2e2; padding:16px; font-size:15px; color:#ef4444; font-weight:700; width:37.5%;">
                        ${data.beforeLabel || '❌ 기존 제품'}
                    </th>
                    <th style="background:#dcfce7; padding:16px; font-size:15px; color:#16a34a; font-weight:700; width:37.5%;">
                        ${data.afterLabel || '✅ 이 제품'}
                    </th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#fff' : '#f8fafc'}">
                        <td style="padding:14px 16px; font-weight:600; color:#475569; font-size:14px; border-bottom:1px solid #f1f5f9;">${row.label}</td>
                        <td style="padding:14px 16px; color:#94a3b8; font-size:14px; border-bottom:1px solid #f1f5f9; text-decoration: line-through;">${row.before}</td>
                        <td style="padding:14px 16px; color:#1e293b; font-size:14px; font-weight:600; border-bottom:1px solid #f1f5f9;">${row.after}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ⑤ 상품 이미지 + 캡션
// 분석 근거: 블루트 — 풀폭 이미지 + 간결 캡션
// ═══════════════════════════════════════════════
function sectionProductImage(data, preset) {
    const images = data.productImages || [];
    const layout = data.imageLayout || 'full'; // 'full' | 'grid2'

    if (images.length === 0) {
        return `
        <div class="section" style="background:#f1f5f9; padding:60px 40px; text-align:center;">
            <div style="border:2px dashed #cbd5e1; border-radius:12px; padding:60px; color:#94a3b8; font-size:16px;">
                📷 상품 이미지를 추가해주세요<br>
                <span style="font-size:13px;">도매처에서 제공받은 실제 상품 사진을 사용합니다</span>
            </div>
        </div>`;
    }

    if (layout === 'grid2' && images.length >= 2) {
        return `
        <div class="section" style="background:#fff; padding:40px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                ${images.slice(0, 4).map(img => `
                    <div style="border-radius:12px; overflow:hidden;">
                        <img src="${img.url}" alt="${img.caption || ''}" style="width:100%; height:auto;"/>
                        ${img.caption ? `<p style="padding:12px 0; font-size:14px; color:#64748b; text-align:center;">${img.caption}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    return `
    <div class="section" style="background:#fff; padding:0;">
        ${images.map(img => `
            <div style="position:relative;">
                <img src="${img.url}" alt="${img.caption || ''}" style="width:100%; display:block;"/>
                ${img.caption ? `
                    <div style="padding:16px 40px; text-align:center;">
                        <p style="font-size:15px; color:#64748b; line-height:1.6;">${img.caption}</p>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ⑥ 스펙/사이즈표
// 분석 근거: 블루트 — 도식화 + 사이즈 테이블
// ═══════════════════════════════════════════════
function sectionSpecTable(data, preset) {
    const specs = data.specs || [
        { label: '사이즈', value: 'FREE (55~77)' },
        { label: '소재', value: '면 100%' },
        { label: '무게', value: '약 350g' },
        { label: '원산지', value: '대한민국' },
    ];

    return `
    <div class="section" style="
        background: #ffffff;
        padding: 60px 40px;
    ">
        <h2 style="text-align:center; font-size:22px; font-weight:700; color:#1e293b; margin-bottom:8px;">
            ${data.specTitle || '📋 상세 스펙'}
        </h2>
        <p style="text-align:center; font-size:14px; color:#94a3b8; margin-bottom:32px;">
            ${data.specSubtitle || '정확한 수치로 확인하세요'}
        </p>
        <div style="
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
        ">
            ${specs.map((spec, i) => `
                <div style="
                    display: flex;
                    padding: 16px 24px;
                    background: ${i % 2 === 0 ? '#f8fafc' : '#fff'};
                    border-bottom: ${i < specs.length - 1 ? '1px solid #f1f5f9' : 'none'};
                ">
                    <span style="
                        font-size: 14px; font-weight: 600; color: #64748b;
                        min-width: 120px;
                    ">${spec.label}</span>
                    <span style="
                        font-size: 14px; color: #1e293b; font-weight: 500;
                    ">${spec.value}</span>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ⑦ 사용법/팁 (단계별 리스트)
// 분석 근거: 아이소이 — 사용 순서 + 팁
// ═══════════════════════════════════════════════
function sectionHowToUse(data, preset) {
    const steps = data.howToSteps || [
        { step: 1, title: '사용법 1단계', desc: '상세 설명을 입력하세요' },
        { step: 2, title: '사용법 2단계', desc: '상세 설명을 입력하세요' },
        { step: 3, title: '사용법 3단계', desc: '상세 설명을 입력하세요' },
    ];

    return `
    <div class="section" style="
        background: ${preset.body.bg};
        padding: 60px 40px;
    ">
        <h2 style="text-align:center; font-size:24px; font-weight:700; color:#1e293b; margin-bottom:40px;">
            ${data.howToTitle || '💡 이렇게 사용하세요'}
        </h2>
        <div style="max-width: 600px; margin: 0 auto;">
            ${steps.map((s, i) => `
                <div style="
                    display: flex;
                    gap: 20px;
                    align-items: flex-start;
                    margin-bottom: ${i < steps.length - 1 ? '32px' : '0'};
                    position: relative;
                ">
                    <div style="
                        width: 44px; height: 44px;
                        background: ${preset.body.accent};
                        color: #fff;
                        border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        font-weight: 800; font-size: 18px;
                        flex-shrink: 0;
                    ">${s.step}</div>
                    ${i < steps.length - 1 ? `<div style="position:absolute; left:21px; top:44px; width:2px; height:calc(100% + 12px); background:#e2e8f0;"></div>` : ''}
                    <div style="padding-top: 4px;">
                        <h3 style="font-size:16px; font-weight:700; color:#1e293b; margin-bottom:6px;">${s.title}</h3>
                        <p style="font-size:14px; color:#64748b; line-height:1.6;">${s.desc}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// 섹션 ⑧ 하단 정보 (배송/교환/주의사항)
// ═══════════════════════════════════════════════
function sectionBottomInfo(data, preset) {
    const infos = data.bottomInfos || [
        { title: '📦 배송 안내', items: ['ooo택배 (1~3 영업일 이내 발송)', '도서산간 지역 추가 배송비 발생'] },
        { title: '🔄 교환/반품', items: ['수령 후 7일 이내 교환/반품 가능', '고객 변심 시 왕복 배송비 부담'] },
        { title: '⚠️ 주의사항', items: ['모니터에 따라 실제 색상과 차이가 있을 수 있습니다', '세탁 시 라벨 표기를 확인해주세요'] },
    ];

    return `
    <div class="section" style="
        background: #f8fafc;
        padding: 48px 40px;
        border-top: 1px solid #e2e8f0;
    ">
        ${infos.map(info => `
            <div style="margin-bottom: 28px;">
                <h3 style="font-size:15px; font-weight:700; color:#475569; margin-bottom:10px;">${info.title}</h3>
                <ul style="list-style:none; padding:0;">
                    ${info.items.map(item => `
                        <li style="
                            font-size:13px; color:#94a3b8; line-height:1.8;
                            padding-left:16px; position:relative;
                        ">
                            <span style="position:absolute; left:0;">·</span>
                            ${item}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('')}
    </div>`;
}

// ─── 섹션 레지스트리 ───
const DetailSections = {
    hero:        { name: '① 히어로 배너', render: sectionHeroBanner, icon: '🎯' },
    socialProof: { name: '② 소셜프루프', render: sectionSocialProof, icon: '⭐' },
    features:    { name: '③ 특장점 카드', render: sectionFeatureCards, icon: '✨' },
    comparison:  { name: '④ 비교표', render: sectionComparison, icon: '⚖️' },
    productImg:  { name: '⑤ 상품 이미지', render: sectionProductImage, icon: '📷' },
    specTable:   { name: '⑥ 스펙/사이즈', render: sectionSpecTable, icon: '📋' },
    howTo:       { name: '⑦ 사용법', render: sectionHowToUse, icon: '💡' },
    bottomInfo:  { name: '⑧ 하단 정보', render: sectionBottomInfo, icon: '📦' },
};

// ─── 기본 섹션 순서 (테마별 추천) ───
const DefaultSectionOrder = {
    clean:   ['hero', 'socialProof', 'features', 'productImg', 'comparison', 'specTable', 'howTo', 'bottomInfo'],
    premium: ['hero', 'features', 'productImg', 'comparison', 'socialProof', 'specTable', 'howTo', 'bottomInfo'],
    trendy:  ['hero', 'productImg', 'features', 'socialProof', 'comparison', 'specTable', 'howTo', 'bottomInfo'],
    minimal: ['hero', 'productImg', 'features', 'specTable', 'comparison', 'socialProof', 'howTo', 'bottomInfo'],
    tech:    ['hero', 'features', 'specTable', 'comparison', 'productImg', 'socialProof', 'howTo', 'bottomInfo'],
    nature:  ['hero', 'socialProof', 'features', 'productImg', 'specTable', 'howTo', 'comparison', 'bottomInfo'],
    kids:    ['hero', 'socialProof', 'features', 'productImg', 'specTable', 'howTo', 'bottomInfo'],
    food:    ['hero', 'socialProof', 'features', 'productImg', 'specTable', 'howTo', 'bottomInfo'],
};

// ─── 전체 상세페이지 HTML 생성 ───
function generateDetailPageHTML(sectionOrder, sectionDataMap, presetKey) {
    const preset = DetailPresets[presetKey] || DetailPresets.clean;
    let html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="preconnect" href="https://cdn.jsdelivr.net"/>
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" rel="stylesheet"/>
        <style>${getBaseCSS()} :root { --highlight: ${preset.highlight}; }</style>
    </head><body style="margin:0; display:flex; flex-direction:column; align-items:center; background:#e2e8f0;">`;

    sectionOrder.forEach(key => {
        const section = DetailSections[key];
        if (section) {
            const data = sectionDataMap[key] || {};
            html += section.render(data, preset);
        }
    });

    html += `</body></html>`;
    return html;
}

// Export
if (typeof window !== 'undefined') {
    window.DetailPresets = DetailPresets;
    window.DetailSections = DetailSections;
    window.DefaultSectionOrder = DefaultSectionOrder;
    window.generateDetailPageHTML = generateDetailPageHTML;
    window.getBaseCSS = getBaseCSS;
}
