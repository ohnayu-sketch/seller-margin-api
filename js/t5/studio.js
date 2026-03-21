/* ═══ js/t5/studio.js ═══ */
/* T5: AI 상세페이지 생성기 */

// ==================== T5: AI 상세페이지 생성기 ====================
let _detailTemplate = 'clean';

function setDetailTemplate(tpl) {
    _detailTemplate = tpl;
    document.querySelectorAll('.preset-btn[id^="tpl-"]').forEach(b => b.style.border = '2px solid var(--border)');
    const sel = document.getElementById('tpl-' + tpl);
    if (sel) sel.style.border = '2px solid var(--accent)';
    updateDetailPreview();
}

function getDetailInputs() {
    return {
        name: document.getElementById('studio-product-name')?.value || '상품명을 입력하세요',
        desc: document.getElementById('studio-product-desc')?.value || '',
        image: document.getElementById('studio-image-url')?.value || 'https://placehold.co/800x800/f8fafc/94a3b8?text=PRODUCT+IMAGE',
        features: (document.getElementById('studio-features')?.value || '').split('\n').filter(f => f.trim()),
        price: parseInt(document.getElementById('studio-price')?.value) || 0,
    };
}

function generateDetailHTML(inputs, template) {
    const { name, desc, image, features, price } = inputs;
    const priceStr = price > 0 ? price.toLocaleString() + '원' : '';
    const featureHTML = features.map(f => '<li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">' + f.trim() + '<\/li>').join('');
    if (template === 'premium') {
        return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;color:#fff;background:linear-gradient(180deg,#0f172a,#1e293b);max-width:860px;margin:0 auto}.hero{text-align:center;padding:50px 20px}.hero img{width:100%;max-width:550px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5)}.title{font-size:32px;font-weight:900;margin:30px 0 8px;background:linear-gradient(135deg,#e2e8f0,#f8fafc);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.price{font-size:28px;font-weight:800;color:#a78bfa;margin:12px 0}.desc{font-size:15px;color:#94a3b8;line-height:1.8;padding:0 30px}.features{padding:35px 40px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;margin:30px 20px;backdrop-filter:blur(12px)}.features h3{font-size:18px;margin-bottom:16px;color:#a78bfa}.features ul{list-style:none}.features li{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;color:#cbd5e1}.notice{text-align:center;padding:30px;font-size:11px;color:#475569}<\/style><\/head><body><div class="hero"><img src="' + image + '" alt="' + name + '"><div style="display:inline-block;padding:6px 16px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border-radius:20px;font-size:11px;font-weight:700;margin:16px 0">PREMIUM QUALITY<\/div><h1 class="title">' + name + '<\/h1>' + (priceStr ? '<div class="price">' + priceStr + '<\/div>' : '') + '<p class="desc">' + desc + '<\/p><\/div>' + (features.length ? '<div class="features"><h3>💎 프리미엄 포인트<\/h3><ul>' + featureHTML + '<\/ul><\/div>' : '') + '<div class="notice">PREMIUM SELLER | 정품 보증 | 안심 거래<\/div><\/body><\/html>';
    }
    if (template === 'trendy') {
        return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;color:#1e293b;background:#fffbf5;max-width:860px;margin:0 auto}.hero{text-align:center;padding:40px 20px}.hero img{width:100%;max-width:580px;border-radius:20px;border:3px solid #fbbf24;box-shadow:0 8px 30px rgba(251,191,36,.2)}.tag{display:inline-block;padding:6px 14px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;border-radius:20px;font-size:11px;font-weight:800;margin:20px 0;letter-spacing:1px}.title{font-size:26px;font-weight:900;margin:8px 0;color:#0f172a}.price{font-size:22px;font-weight:800;color:#ef4444;margin:8px 0}.desc{font-size:14px;color:#64748b;line-height:1.8;padding:0 20px}.features{padding:30px;margin:20px;background:linear-gradient(135deg,rgba(251,191,36,.05),rgba(239,68,68,.03));border-radius:16px;border:1px dashed #fbbf24}.features h3{font-size:16px;margin-bottom:12px;color:#f59e0b}.features ul{list-style:none}.features li{padding:8px 0;font-size:13px;border-bottom:1px dashed #fed7aa}.cta{text-align:center;padding:20px}.cta button{padding:14px 40px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;border:none;border-radius:30px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 4px 15px rgba(239,68,68,.3)}.notice{text-align:center;padding:20px;font-size:11px;color:#94a3b8}<\/style><\/head><body><div class="hero"><img src="' + image + '" alt="' + name + '"><div class="tag">🔥 HOT DEAL<\/div><h1 class="title">' + name + '<\/h1>' + (priceStr ? '<div class="price">' + priceStr + '<\/div>' : '') + '<p class="desc">' + desc + '<\/p><\/div>' + (features.length ? '<div class="features"><h3>🔥 이것만은 알고 가세요!<\/h3><ul>' + featureHTML + '<\/ul><\/div>' : '') + '<div class="cta"><button>🛒 지금 바로 구매하기<\/button><\/div><div class="notice">⏰ 한정 수량 | 빠른 배송 | 교환/반품 7일 보장<\/div><\/body><\/html>';
    }
    // clean (default)
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;color:#1e293b;background:#fff;max-width:860px;margin:0 auto}.hero{text-align:center;padding:40px 20px}.hero img{width:100%;max-width:600px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08)}.title{font-size:28px;font-weight:800;margin:24px 0 8px;color:#0f172a}.price{font-size:24px;font-weight:700;color:#ef4444;margin:8px 0 16px}.desc{font-size:15px;color:#64748b;line-height:1.8;padding:0 20px}.features{padding:30px 40px;background:#f8fafc;border-radius:16px;margin:20px}.features h3{font-size:18px;margin-bottom:16px;color:#0f172a}.features ul{list-style:none}.features li{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}.notice{text-align:center;padding:30px;font-size:12px;color:#94a3b8}<\/style><\/head><body><div class="hero"><img src="' + image + '" alt="' + name + '"><h1 class="title">' + name + '<\/h1>' + (priceStr ? '<div class="price">' + priceStr + '<\/div>' : '') + '<p class="desc">' + desc + '<\/p><\/div>' + (features.length ? '<div class="features"><h3>✨ 제품 특장점<\/h3><ul>' + featureHTML + '<\/ul><\/div>' : '') + '<div class="notice">본 상품은 정품이며, 교환/반품은 수령 후 7일 이내 가능합니다.<\/div><\/body><\/html>';
}

function updateDetailPreview() {
    const inputs = getDetailInputs();
    const html = generateDetailHTML(inputs, _detailTemplate);
    const frame = document.getElementById('detail-preview-frame');
    if (frame) { const doc = frame.contentDocument || frame.contentWindow.document; doc.open(); doc.write(html); doc.close(); }
    const counter = document.getElementById('studio-char-count');
    if (counter) counter.textContent = html.length + '자';
    window._lastDetailHTML = html;
}

function copyDetailHTML() {
    if (!window._lastDetailHTML) { showToast('먼저 상품 정보를 입력하세요'); return; }
    navigator.clipboard.writeText(window._lastDetailHTML).then(() => showToast('📋 상세페이지 HTML이 복사되었습니다!'));
}

function downloadDetailHTML() {
    if (!window._lastDetailHTML) { showToast('먼저 상품 정보를 입력하세요'); return; }
    const name = document.getElementById('studio-product-name')?.value || 'detail_page';
    const blob = new Blob([window._lastDetailHTML], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[^가-힣a-zA-Z0-9]/g, '_') + '_상세페이지.html'; a.click();
    showToast('💾 HTML 파일이 다운로드됩니다');
}

async function generateAICopy() {
    const nameEl = document.getElementById('studio-product-name');
    const descEl = document.getElementById('studio-product-desc');
    if (!nameEl?.value) { showToast('상품명을 입력하세요'); return; }
    showToast('🤖 AI가 매력적인 카피를 생성 중...');
    try {
        const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
        if (!apiKey) {
            descEl.value = '✨ ' + nameEl.value + '\n\n일상을 특별하게 만들어줄 ' + nameEl.value + '! 높은 품질과 세련된 디자인으로 당신의 라이프스타일을 업그레이드하세요. 지금 구매하시면 특별한 혜택이 함께합니다.';
            updateDetailPreview(); showToast('✅ 카피 생성 완료 (로컬 모드)'); return;
        }
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: '다음 상품의 온라인 쇼핑몰 상세페이지용 매력적인 판매 카피를 한국어 200자 내외로 작성. 카피만 출력:\n\n상품명: ' + nameEl.value + '\n설명: ' + (descEl?.value || '없음') }] }] })
        });
        const data = await res.json();
        const copy = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (copy) { descEl.value = copy; updateDetailPreview(); showToast('✅ AI 카피가 생성되었습니다!'); }
    } catch(e) { showToast('AI 호출 실패: ' + e.message); }
}
setTimeout(() => setDetailTemplate('clean'), 100);

