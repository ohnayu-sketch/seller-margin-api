// ═══════════════════════════════════════════════════════════════
//  T3 상세페이지 이미지 빌더 — 빌더 UI + 미리보기 + PNG 변환
//  html2canvas 기반 이미지 변환, 드래그&드롭 섹션 순서 변경
// ═══════════════════════════════════════════════════════════════

'use strict';

(function() {

// ─── 상태 ───
let currentPresetKey = 'clean';
let activeSections = [];    // [{key, data}]
let editingIndex = -1;      // 현재 편집 중인 섹션 인덱스

// ─── 초기화 ───
window.t3BuilderInit = function() {
    const container = document.getElementById('t3-builder-container');
    if (!container) return;

    // 기본 카테고리 프리셋으로 섹션 로드
    t3LoadPreset(currentPresetKey);
    t3RenderSectionList();
    t3RenderPreview();
};

// ─── 카테고리 프리셋 로드 ───
window.t3LoadPreset = function(key) {
    currentPresetKey = key;
    const order = (typeof DefaultSectionOrder !== 'undefined' && DefaultSectionOrder[key]) 
        || ['hero', 'socialProof', 'features', 'productImg', 'comparison', 'specTable', 'howTo', 'bottomInfo'];
    
    activeSections = order.map(sKey => ({ key: sKey, data: {} }));
    
    // 카테고리 버튼 활성화 갱신
    document.querySelectorAll('.t3b-cat-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === key);
    });
    
    t3RenderSectionList();
    t3RenderPreview();
};

// ─── 섹션 리스트 렌더링 (아코디언 인라인 편집) ───
function t3RenderSectionList() {
    const list = document.getElementById('t3b-section-list');
    if (!list) return;

    if (activeSections.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#64748b;font-size:12px;">섹션을 추가해주세요</div>';
        return;
    }

    list.innerHTML = activeSections.map((s, i) => {
        const sec = (typeof DetailSections !== 'undefined') ? DetailSections[s.key] : null;
        const name = sec ? sec.name : s.key;
        const icon = sec ? sec.icon : '📄';
        const isEditing = (i === editingIndex);
        
        let html = `<div class="t3b-section-wrapper" data-idx="${i}">`;
        html += `
        <div class="t3b-section-item ${isEditing ? 'editing' : ''}" draggable="true"
             ondragstart="t3DragStart(event,${i})" ondragover="t3DragOver(event)" ondrop="t3Drop(event,${i})">
            <span class="t3b-drag-handle" title="드래그하여 순서 변경">⋮⋮</span>
            <span class="t3b-sec-icon">${icon}</span>
            <span class="t3b-sec-name">${name}</span>
            <div class="t3b-sec-actions">
                <button onclick="t3EditSection(${i})" title="편집" class="t3b-sm-btn">${isEditing ? '▲' : '✏️'}</button>
                <button onclick="t3RemoveSection(${i})" title="삭제" class="t3b-sm-btn t3b-sm-btn-danger">🗑️</button>
            </div>
        </div>`;
        
        // 아코디언: 편집 중인 섹션만 폼 표시
        if (isEditing) {
            html += `<div class="t3b-accordion-body">${t3BuildFormHTML(i, s)}</div>`;
        }
        html += '</div>';
        return html;
    }).join('');
}

// ─── 섹션 추가 ───
window.t3AddSection = function(key) {
    activeSections.push({ key, data: {} });
    t3RenderSectionList();
    t3RenderPreview();
    // 추가된 섹션 바로 편집
    t3EditSection(activeSections.length - 1);
};

// ─── 섹션 삭제 ───
window.t3RemoveSection = function(idx) {
    activeSections.splice(idx, 1);
    if (editingIndex === idx) editingIndex = -1;
    else if (editingIndex > idx) editingIndex--;
    t3RenderSectionList();
    t3RenderPreview();
};

// ─── 섹션 편집 (아코디언 토글) ───
window.t3EditSection = function(idx) {
    // 같은 섹션 다시 클릭 → 접기 / 다른 섹션 → 전환
    editingIndex = (editingIndex === idx) ? -1 : idx;
    t3RenderSectionList();
};

// ─── 섹션별 편집 폼 HTML 생성 ───
function t3BuildFormHTML(idx, s) {
    const sec = (typeof DetailSections !== 'undefined') ? DetailSections[s.key] : null;
    let formHTML = '';
    switch (s.key) {
        case 'hero':
            formHTML = `
                <div class="t3b-field"><label>배지 문구</label><input type="text" value="${s.data.badge||''}" onchange="t3UpdateData(${idx},'badge',this.value)" placeholder="예: ⭐ BEST SELLER"></div>
                <div class="t3b-field"><label>제목 (메인 카피)</label><input type="text" value="${s.data.title||''}" onchange="t3UpdateData(${idx},'title',this.value)" placeholder="예: 프리미엄 스테인리스 텀블러"></div>
                <div class="t3b-field"><label>서브 카피</label><input type="text" value="${s.data.subtitle||''}" onchange="t3UpdateData(${idx},'subtitle',this.value)" placeholder="예: 보온 12시간, 매일이 특별해지는 순간"></div>
                <div class="t3b-field"><label>히어로 이미지 URL</label><input type="text" value="${s.data.heroImage||''}" onchange="t3UpdateData(${idx},'heroImage',this.value)" placeholder="https://..."></div>`;
            break;
        case 'socialProof':
            formHTML = `
                <div class="t3b-field"><label>섹션 타이틀</label><input type="text" value="${s.data.proofTitle||''}" onchange="t3UpdateData(${idx},'proofTitle',this.value)" placeholder="숫자가 증명하는 품질"></div>
                <div class="t3b-field"><label>서브 라벨</label><input type="text" value="${s.data.proofLabel||''}" onchange="t3UpdateData(${idx},'proofLabel',this.value)" placeholder="고객이 직접 증명합니다"></div>
                <div style="font-size:10px;color:#94a3b8;margin:8px 0 4px;">💡 항목은 기본 3개(평점/리뷰/판매수)로 자동 채워집니다</div>`;
            break;
        case 'features':
            const feat = s.data.features || [
                { icon: '✅', title: '', desc: '' },
                { icon: '🛡️', title: '', desc: '' },
                { icon: '💎', title: '', desc: '' },
            ];
            formHTML = `
                <div class="t3b-field"><label>섹션 타이틀</label><input type="text" value="${s.data.featureTitle||''}" onchange="t3UpdateData(${idx},'featureTitle',this.value)" placeholder="이 제품만의 특별함"></div>
                <div style="font-size:10px;color:#94a3b8;margin:8px 0 4px;">특장점 카드 (최대 4개)</div>
                ${feat.map((f, fi) => `
                    <div style="display:grid;grid-template-columns:50px 1fr 1fr;gap:6px;margin-bottom:6px;">
                        <input type="text" value="${f.icon}" onchange="t3UpdateFeature(${idx},${fi},'icon',this.value)" placeholder="아이콘" style="text-align:center;">
                        <input type="text" value="${f.title}" onchange="t3UpdateFeature(${idx},${fi},'title',this.value)" placeholder="제목">
                        <input type="text" value="${f.desc}" onchange="t3UpdateFeature(${idx},${fi},'desc',this.value)" placeholder="설명">
                    </div>
                `).join('')}
                <button onclick="t3AddFeatureRow(${idx})" class="t3b-sm-btn" style="width:100%;margin-top:4px;">+ 특장점 추가</button>`;
            break;
        case 'comparison':
            const rows = s.data.compareRows || [
                { label: '', before: '', after: '' },
                { label: '', before: '', after: '' },
                { label: '', before: '', after: '' },
            ];
            formHTML = `
                <div class="t3b-field"><label>비교 제목</label><input type="text" value="${s.data.compareTitle||''}" onchange="t3UpdateData(${idx},'compareTitle',this.value)" placeholder="차이가 확실합니다"></div>
                <div style="font-size:10px;color:#94a3b8;margin:8px 0 4px;">비교 항목 (항목명 / 기존 / 우리)</div>
                ${rows.map((r, ri) => `
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px;">
                        <input type="text" value="${r.label}" onchange="t3UpdateCompareRow(${idx},${ri},'label',this.value)" placeholder="항목명">
                        <input type="text" value="${r.before}" onchange="t3UpdateCompareRow(${idx},${ri},'before',this.value)" placeholder="기존 제품">
                        <input type="text" value="${r.after}" onchange="t3UpdateCompareRow(${idx},${ri},'after',this.value)" placeholder="우리 제품">
                    </div>
                `).join('')}
                <button onclick="t3AddCompareRow(${idx})" class="t3b-sm-btn" style="width:100%;margin-top:4px;">+ 비교 행 추가</button>`;
            break;
        case 'productImg':
            formHTML = `
                <div class="t3b-field"><label>이미지 레이아웃</label>
                    <select onchange="t3UpdateData(${idx},'imageLayout',this.value)">
                        <option value="full" ${s.data.imageLayout==='full'?'selected':''}>풀폭 (1열)</option>
                        <option value="grid2" ${s.data.imageLayout==='grid2'?'selected':''}>2열 그리드</option>
                    </select>
                </div>
                <div class="t3b-field"><label>이미지 URL (줄바꿈 구분)</label>
                    <textarea rows="3" onchange="t3UpdateProductImages(${idx},this.value)" placeholder="https://이미지1.jpg&#10;https://이미지2.jpg">${(s.data.productImages||[]).map(img=>img.url).join('\n')}</textarea>
                </div>`;
            break;
        case 'specTable':
            const specs = s.data.specs || [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }];
            formHTML = `
                <div class="t3b-field"><label>섹션 타이틀</label><input type="text" value="${s.data.specTitle||''}" onchange="t3UpdateData(${idx},'specTitle',this.value)" placeholder="📋 상세 스펙"></div>
                <div style="font-size:10px;color:#94a3b8;margin:8px 0 4px;">스펙 항목 (라벨 / 값)</div>
                ${specs.map((sp, si) => `
                    <div style="display:grid;grid-template-columns:1fr 2fr;gap:6px;margin-bottom:6px;">
                        <input type="text" value="${sp.label}" onchange="t3UpdateSpec(${idx},${si},'label',this.value)" placeholder="항목명">
                        <input type="text" value="${sp.value}" onchange="t3UpdateSpec(${idx},${si},'value',this.value)" placeholder="값">
                    </div>
                `).join('')}
                <button onclick="t3AddSpecRow(${idx})" class="t3b-sm-btn" style="width:100%;margin-top:4px;">+ 스펙 행 추가</button>`;
            break;
        case 'howTo':
            const steps = s.data.howToSteps || [{ step: 1, title: '', desc: '' }, { step: 2, title: '', desc: '' }];
            formHTML = `
                <div class="t3b-field"><label>섹션 타이틀</label><input type="text" value="${s.data.howToTitle||''}" onchange="t3UpdateData(${idx},'howToTitle',this.value)" placeholder="💡 이렇게 사용하세요"></div>
                <div style="font-size:10px;color:#94a3b8;margin:8px 0 4px;">사용 단계</div>
                ${steps.map((st, si) => `
                    <div style="display:grid;grid-template-columns:40px 1fr 1fr;gap:6px;margin-bottom:6px;">
                        <input type="text" value="${st.step}" readonly style="text-align:center;background:rgba(59,130,246,0.1);color:#3b82f6;font-weight:700;">
                        <input type="text" value="${st.title}" onchange="t3UpdateStep(${idx},${si},'title',this.value)" placeholder="단계 제목">
                        <input type="text" value="${st.desc}" onchange="t3UpdateStep(${idx},${si},'desc',this.value)" placeholder="설명">
                    </div>
                `).join('')}
                <button onclick="t3AddStepRow(${idx})" class="t3b-sm-btn" style="width:100%;margin-top:4px;">+ 단계 추가</button>`;
            break;
        case 'bottomInfo':
            formHTML = `<div style="font-size:11px;color:#94a3b8;padding:8px 0;">배송/교환/주의사항은 기본 템플릿이 자동 적용됩니다.</div>`;
            break;
        default:
            formHTML = `<div style="color:#94a3b8;font-size:12px;">이 섹션의 편집기는 준비 중입니다.</div>`;
    }
    return formHTML + `<button onclick="t3RenderPreview()" class="t3b-apply-btn">🔄 미리보기 갱신</button>`;
}

// ─── 데이터 업데이트 헬퍼들 ───
window.t3UpdateData = function(idx, field, value) {
    activeSections[idx].data[field] = value;
    t3RenderPreview();
};

window.t3UpdateFeature = function(idx, fi, field, value) {
    if (!activeSections[idx].data.features) {
        activeSections[idx].data.features = [
            { icon: '✅', title: '', desc: '' },
            { icon: '🛡️', title: '', desc: '' },
            { icon: '💎', title: '', desc: '' },
        ];
    }
    activeSections[idx].data.features[fi][field] = value;
    t3RenderPreview();
};

window.t3AddFeatureRow = function(idx) {
    if (!activeSections[idx].data.features) {
        activeSections[idx].data.features = [
            { icon: '✅', title: '', desc: '' },
            { icon: '🛡️', title: '', desc: '' },
            { icon: '💎', title: '', desc: '' },
        ];
    }
    if (activeSections[idx].data.features.length < 4) {
        activeSections[idx].data.features.push({ icon: '🔥', title: '', desc: '' });
        t3EditSection(idx);
    }
};

window.t3UpdateCompareRow = function(idx, ri, field, value) {
    if (!activeSections[idx].data.compareRows) {
        activeSections[idx].data.compareRows = [
            { label: '', before: '', after: '' },
            { label: '', before: '', after: '' },
            { label: '', before: '', after: '' },
        ];
    }
    activeSections[idx].data.compareRows[ri][field] = value;
    t3RenderPreview();
};

window.t3AddCompareRow = function(idx) {
    if (!activeSections[idx].data.compareRows) {
        activeSections[idx].data.compareRows = [{ label: '', before: '', after: '' }];
    }
    activeSections[idx].data.compareRows.push({ label: '', before: '', after: '' });
    t3EditSection(idx);
};

window.t3UpdateProductImages = function(idx, text) {
    const urls = text.split('\n').filter(u => u.trim());
    activeSections[idx].data.productImages = urls.map(url => ({ url: url.trim(), caption: '' }));
    t3RenderPreview();
};

window.t3UpdateSpec = function(idx, si, field, value) {
    if (!activeSections[idx].data.specs) {
        activeSections[idx].data.specs = [{ label: '', value: '' }];
    }
    activeSections[idx].data.specs[si][field] = value;
    t3RenderPreview();
};

window.t3AddSpecRow = function(idx) {
    if (!activeSections[idx].data.specs) activeSections[idx].data.specs = [];
    activeSections[idx].data.specs.push({ label: '', value: '' });
    t3EditSection(idx);
};

window.t3UpdateStep = function(idx, si, field, value) {
    if (!activeSections[idx].data.howToSteps) {
        activeSections[idx].data.howToSteps = [{ step: 1, title: '', desc: '' }];
    }
    activeSections[idx].data.howToSteps[si][field] = value;
    t3RenderPreview();
};

window.t3AddStepRow = function(idx) {
    if (!activeSections[idx].data.howToSteps) activeSections[idx].data.howToSteps = [];
    const nextStep = activeSections[idx].data.howToSteps.length + 1;
    activeSections[idx].data.howToSteps.push({ step: nextStep, title: '', desc: '' });
    t3EditSection(idx);
};

// ─── 드래그 & 드롭 ───
let dragIdx = -1;
window.t3DragStart = function(e, idx) {
    dragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
};
window.t3DragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};
window.t3Drop = function(e, dropIdx) {
    e.preventDefault();
    if (dragIdx < 0 || dragIdx === dropIdx) return;
    const item = activeSections.splice(dragIdx, 1)[0];
    activeSections.splice(dropIdx, 0, item);
    
    if (editingIndex === dragIdx) editingIndex = dropIdx;
    else if (editingIndex > dragIdx && editingIndex <= dropIdx) editingIndex--;
    else if (editingIndex < dragIdx && editingIndex >= dropIdx) editingIndex++;
    
    dragIdx = -1;
    t3RenderSectionList();
    t3RenderPreview();
};

// ─── 미리보기 렌더링 (iframe) ───
window.t3RenderPreview = function() {
    const iframe = document.getElementById('t3b-preview-frame');
    if (!iframe) return;

    if (typeof generateDetailPageHTML !== 'function') {
        console.warn('[T3 Builder] generateDetailPageHTML not loaded');
        return;
    }

    const sectionOrder = activeSections.map(s => s.key);
    const sectionDataMap = {};
    activeSections.forEach(s => { sectionDataMap[s.key] = s.data; });

    const html = generateDetailPageHTML(sectionOrder, sectionDataMap, currentPresetKey);
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    
    // 이전 blob URL 정리
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

// ─── PNG 다운로드 (html2canvas) ───
window.t3DownloadPNG = async function() {
    const iframe = document.getElementById('t3b-preview-frame');
    if (!iframe || !iframe.contentDocument) {
        alert('미리보기가 로드되지 않았습니다. 잠시 후 다시 시도하세요.');
        return;
    }

    if (typeof html2canvas === 'undefined') {
        alert('html2canvas 라이브러리가 로드되지 않았습니다.');
        return;
    }

    const statusEl = document.getElementById('t3b-download-status');
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '⏳ PNG 변환 중...'; }

    try {
        const body = iframe.contentDocument.body;
        const canvas = await html2canvas(body, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#e2e8f0',
            width: 860,
            windowWidth: 860,
        });

        const link = document.createElement('a');
        link.download = `detail-page-${currentPresetKey}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        if (statusEl) { statusEl.textContent = '✅ PNG 다운로드 완료!'; setTimeout(() => statusEl.style.display = 'none', 3000); }
    } catch (err) {
        console.error('[T3 Builder] PNG error:', err);
        if (statusEl) { statusEl.textContent = '❌ 변환 실패: ' + err.message; }
    }
};

// ─── 전체 HTML 다운로드 ───
window.t3DownloadHTML = function() {
    if (typeof generateDetailPageHTML !== 'function') return;
    
    const sectionOrder = activeSections.map(s => s.key);
    const sectionDataMap = {};
    activeSections.forEach(s => { sectionDataMap[s.key] = s.data; });
    const html = generateDetailPageHTML(sectionOrder, sectionDataMap, currentPresetKey);

    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    link.download = `detail-page-${currentPresetKey}-${Date.now()}.html`;
    link.href = URL.createObjectURL(blob);
    link.click();
};

// ─── 섹션 추가 드롭다운 토글 ───
window.t3ToggleAddMenu = function() {
    const menu = document.getElementById('t3b-add-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

// ─── T2 데이터 자동 주입 ───
window.t3ImportFromT2 = function() {
    // T2 시뮬레이터에서 상품 데이터 가져오기
    const name = document.getElementById('t2-product-name')?.value || '';
    const price = document.getElementById('t2-sale-price')?.value || document.getElementById('t2-cost')?.value || '';
    
    if (!name && !price) {
        alert('T2 시뮬레이터에 상품 정보가 없습니다. 먼저 T2에서 마진 계산을 해주세요.');
        return;
    }
    
    // 히어로 배너에 상품명 자동 채우기
    const heroIdx = activeSections.findIndex(s => s.key === 'hero');
    if (heroIdx >= 0) {
        activeSections[heroIdx].data.title = name;
        activeSections[heroIdx].data.subtitle = price ? `${Number(price).toLocaleString()}원` : '';
    }
    
    t3RenderSectionList();
    t3RenderPreview();
    if (heroIdx >= 0) t3EditSection(heroIdx);
};

// ─── T3 빌더 서브탭 전환 ───
window.t3SwitchBuilderTab = function(tab) {
    const aiPanel = document.getElementById('t3-ai-panel');
    const builderPanel = document.getElementById('t3-builder-panel');
    
    if (aiPanel) aiPanel.style.display = tab === 'ai' ? 'block' : 'none';
    if (builderPanel) builderPanel.style.display = tab === 'builder' ? 'block' : 'none';
    
    document.querySelectorAll('.t3-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    if (tab === 'builder') {
        t3BuilderInit();
    }
};

})(); // IIFE end
