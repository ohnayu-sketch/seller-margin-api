let currentTrack = 'A';
let currentProductDataA = null;
let currentProductDataB = null;

// UI 초기 설정
window.addEventListener('DOMContentLoaded', async () => {
    // 저장된 GAS 배포 URL 로드
    chrome.storage.local.get(['t1GasUrl'], (result) => {
        if (result.t1GasUrl) {
            document.getElementById('gas-url-input').value = result.t1GasUrl;
        }
    });

    // 현재 탭 URL 기반 트랙 자동 설정
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
        if (tab.url.includes("smartstore.naver.com") || tab.url.includes("shopping.naver.com") || tab.url.includes("datalab.naver.com")) {
            switchTrack('A');
        } else if (tab.url.includes("domeggook.com") || tab.url.includes("domemedb.domeggook.com") || tab.url.includes("1688.com") || tab.url.includes("taobao.com")) {
            switchTrack('B');
        }
    }
});

// URL 저장 버튼
document.getElementById('saveUrlBtn').addEventListener('click', () => {
    const url = document.getElementById('gas-url-input').value.trim();
    if (!url) return;
    chrome.storage.local.set({ t1GasUrl: url }, () => {
        const btn = document.getElementById('saveUrlBtn');
        const oldText = btn.innerText;
        btn.innerText = "저장 완료!";
        btn.style.background = "#10b981";
        setTimeout(() => { btn.innerText = oldText; btn.style.background = "#475569"; }, 2000);
    });
});

// 탭 스위칭 로직
document.getElementById('tab-trackA').addEventListener('click', () => switchTrack('A'));
document.getElementById('tab-trackB').addEventListener('click', () => switchTrack('B'));

function switchTrack(trackName) {
    currentTrack = trackName;
    if (trackName === 'A') {
        document.getElementById('tab-trackA').classList.add('active');
        document.getElementById('tab-trackB').classList.remove('active');
        document.getElementById('tab-trackA').style.color = "#fff";
        document.getElementById('tab-trackB').style.color = "#94a3b8";
        document.getElementById('panel-trackA').style.display = 'block';
        document.getElementById('panel-trackB').style.display = 'none';
        document.getElementById('status').innerText = "네이버 쇼핑/데이터랩에서 시장 지표를 분석하세요.";
    } else {
        document.getElementById('tab-trackB').classList.add('active');
        document.getElementById('tab-trackA').classList.remove('active');
        document.getElementById('tab-trackB').style.color = "#fff";
        document.getElementById('tab-trackA').style.color = "#94a3b8";
        document.getElementById('panel-trackB').style.display = 'block';
        document.getElementById('panel-trackA').style.display = 'none';
        document.getElementById('status').innerText = "도매처 상품 스펙과 마진율 정보를 가져옵니다.";
    }
}

// Track A 스크래핑
document.getElementById('clipBtn_A').addEventListener('click', async () => {
    executeScraping('A');
});

// Track B 스크래핑
document.getElementById('clipBtn_B').addEventListener('click', async () => {
    executeScraping('B');
});

async function executeScraping(track) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const status = document.getElementById('status');
    if (!tab) { status.innerText = "활성 탭을 찾을 수 없습니다."; return; }
    
    status.innerText = "데이터 추출 중...";
    
    // content.js가 URL에 따라 trackA/trackB 데이터를 각기 파싱하는 IIFE를 가졌다고 가정하고, 동일 스크립트 1회 호출
    chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
    }, (results) => {
        if (chrome.runtime.lastError || !results || results.length === 0) {
            status.innerText = "추출 실패: 오류 발생"; return;
        }
        
        let extracted = null;
        for (let r of results) {
            if (r.result && (r.result.title || r.result.items)) { extracted = r.result; break; }
        }
        if (!extracted) { status.innerText = "상품 정보를 찾을 수 없습니다."; return; }

        if (track === 'A') {
            currentProductDataA = extracted;
            document.getElementById('a-card').style.display = 'block';
            document.getElementById('a-title').innerText = extracted.title || "제목 없음";
            if (extracted.imageUrl) document.getElementById('a-img').src = extracted.imageUrl;
            
            // Track A 특화 영역 표시
            document.getElementById('a-velocity').innerText = extracted.reviews ? `🔥 최근 3일간 리뷰 ${extracted.reviews}개 증가` : "🔥 리뷰 급상승: 정보 없음";
            document.getElementById('a-weakness-box').innerHTML = extracted.weakness_keywords 
                ? `[AI 역제안 공략 포인트]<br/><span style="color:#ef4444">${extracted.weakness_keywords.join(', ')}</span> 주의 요망` 
                : "[AI 분석 결과]<br/>해당 상품에 대한 유의미한 취약점 키워드 부족";
                
            document.getElementById('clipBtn_A').style.display = 'none';
            document.getElementById('sendBtn_A').style.display = 'block';
            status.innerText = "시장 분석 성공!";
        } else {
            currentProductDataB = extracted;
            document.getElementById('b-card').style.display = 'block';
            document.getElementById('b-title').innerText = extracted.title || "제목 없음";
            document.getElementById('b-price').innerText = Number(extracted.price || 0).toLocaleString() + "원";
            if (extracted.imageUrl) document.getElementById('b-img').src = extracted.imageUrl;
            
            // Track B 마진율 경고 표시 (10% 수수료, 3000원 배송비 기준)
            const price = Number(extracted.price || 0);
            const expectedSellingPrice = price * 1.3; // 대략적인 권장 소비자가 산정
            const netMargin = expectedSellingPrice - price - (expectedSellingPrice * 0.1) - 3000;
            const marginRatio = (netMargin / expectedSellingPrice) * 100;
            
            const warningEl = document.getElementById('b-margin-warning');
            if (price > 0 && marginRatio < 15) {
                warningEl.style.display = 'block';
                warningEl.innerText = `⚠️ 예상 마진율 ${marginRatio.toFixed(1)}%: 수익성 위험 (30% 마크업 기준)`;
            } else {
                warningEl.style.display = 'none';
            }

            document.getElementById('clipBtn_B').style.display = 'none';
            document.getElementById('sendBtn_B').style.display = 'block';
            status.innerText = "도매 정보 추출 완료!";
        }
    });
}

// 전송 로직 분리 (A/B 공통 모듈화)
document.getElementById('sendBtn_A').addEventListener('click', () => sendToDashboard('A', currentProductDataA));
document.getElementById('sendBtn_B').addEventListener('click', () => sendToDashboard('B', currentProductDataB));

async function sendToDashboard(track, productData) {
    const status = document.getElementById('status');
    status.innerText = "대시보드 DB로 전송 중...";
    
    chrome.storage.local.get(['t1GasUrl'], async (result) => {
        try {
            const DEFAULT_GAS_URL = result.t1GasUrl || 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
            
            let payloadItems = [];
            // Bulk 처리 등 예외 처리 (임시)
            if (productData.type === 'bulk' && productData.items) {
               payloadItems = productData.items.map(p => ({
                   id: 'CLP-' + Date.now() + Math.random().toString().substr(2, 4),
                   name: p.title, cost: p.price, market: p.platform,
                   savedBy: `T1 Bulk (Track ${track})`, savedAt: new Date().toISOString(),
                   imageUrl: p.imageUrl, link: p.link
               }));
            } else {
               let customInfo = track === 'A' ? `리뷰가속도:${productData.reviews||0}` : `DeepSourced`;
               payloadItems = [{
                   id: 'CLP-' + Date.now() + Math.random().toString().substr(2, 4),
                   name: productData.title, cost: productData.price, market: productData.platform,
                   savedBy: `T1 Clipper (Tr.${track})`, savedAt: new Date().toISOString(),
                   imageUrl: productData.imageUrl, link: productData.url,
                   memo: customInfo
               }];
            }
            
            const payload = { action: 'saveProduct', body: { products: payloadItems } };

            const res = await fetch(DEFAULT_GAS_URL, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload), redirect: 'follow'
            });

            if (!res.ok) throw new Error("Network Error");
            
            status.innerHTML = `<span style='color:#4ade80'>✅ 성공적으로 저장되었습니다!</span>`;
            document.getElementById(`sendBtn_${track}`).innerText = "DB 전송 완료";
            document.getElementById(`sendBtn_${track}`).style.background = "#64748b";
            document.getElementById(`sendBtn_${track}`).disabled = true;
        } catch (e) {
            status.innerText = "전송 실패: 네트워크 오류.";
            console.error(e);
        }
    });
}
