let currentProductData = null;

// 초기 URL 로드
chrome.storage.local.get(['t1GasUrl'], (result) => {
    if (result.t1GasUrl) {
        document.getElementById('gas-url-input').value = result.t1GasUrl;
    }
});

// URL 저장 버튼 이벤트
document.getElementById('saveUrlBtn').addEventListener('click', () => {
    const url = document.getElementById('gas-url-input').value.trim();
    if (!url) return;
    chrome.storage.local.set({ t1GasUrl: url }, () => {
        const btn = document.getElementById('saveUrlBtn');
        const oldText = btn.innerText;
        btn.innerText = "저장 완료!";
        btn.style.background = "#10b981";
        setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = "#475569";
        }, 2000);
    });
});

document.getElementById('clipBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = document.getElementById('status');
  
  if (!tab) {
    status.innerText = "활성 탭을 찾을 수 없습니다.";
    return;
  }

  status.innerText = "상품 데이터를 추출하는 중...";
  
  // content.js 실행 주입 (AliPrice 등 iframe 내부까지 접근 위해 allFrames: true)
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['content.js']
  }, (results) => {
    if (chrome.runtime.lastError || !results || results.length === 0) {
      status.innerText = "추출 실패: 지원하지 않는 사이트이거나 오류가 발생했습니다.";
      return;
    }
    
    // 여러 프레임 결과 중 유효한 데이터가 있는 프레임 탐색
    currentProductData = null;
    for (let r of results) {
        if (r.result && (r.result.title || (r.result.items && r.result.items.length > 0))) {
            currentProductData = r.result;
            break;
        }
    }
    
    if (!currentProductData) {
      status.innerText = "이 페이지나 팝업에서 상품 정보를 찾을 수 없습니다.";
      return;
    }

    // Bulk(대량) 수집인 경우 (AliPrice 기생 파이프라인)
    if (currentProductData.type === 'bulk') {
      document.getElementById('product-card').style.display = 'block';
      let html = `<div style="font-size:14px; font-weight:bold; color:#f43f5e; margin-bottom:8px;">🔥 대시보드 융합(Parasitic) 발동!</div>`;
      html += `<div>AliPrice 등에서 <b>${currentProductData.items.length}</b>개의 1688/타오바오 대체 상품을 파싱했습니다.</div>`;
      document.getElementById('product-card').innerHTML = html;
      status.innerText = "벌크 추출 성공! 한 번에 대시보드로 복사합니다.";
    } else {
      // 일반 단일 수집인 경우
      document.getElementById('product-card').style.display = 'block';
      document.getElementById('p-title').innerText = currentProductData.title;
      document.getElementById('p-price').innerText = Number(currentProductData.price).toLocaleString() + "원";
      if(currentProductData.imageUrl) {
          document.getElementById('p-img').src = currentProductData.imageUrl;
      }
      status.innerText = "단일 추출 성공! 대시보드로 보낼 수 있습니다.";
    }

    status.innerText = "데이터 추출 성공! 대시보드로 보낼 수 있습니다.";
    
    // 버튼 전환
    document.getElementById('clipBtn').style.display = 'none';
    document.getElementById('sendBtn').style.display = 'block';
  });
});

document.getElementById('sendBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "대시보드 DB로 전송 중...";
    
    chrome.storage.local.get(['t1GasUrl'], async (result) => {
        try {
            const DEFAULT_GAS_URL = result.t1GasUrl || 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
            
            if (!result.t1GasUrl) {
                status.innerHTML = `<span style='color:#ef4444'>⚠️ 주의: 배포된 GAS URL이 설정되지 않았습니다. 기본 URL을 사용합니다.</span>`;
            }

            let payloadItems = [];
            if (currentProductData.type === 'bulk' && currentProductData.items) {
               payloadItems = currentProductData.items.map(p => ({
                   id: 'CLP-' + Date.now() + Math.floor(Math.random()*1000),
                   name: p.title, cost: p.price, market: p.platform,
                   savedBy: 'T1 Bulk Clipper', savedAt: new Date().toISOString(),
                   imageUrl: p.imageUrl, link: p.link
               }));
            } else {
               payloadItems = [{
                   id: 'CLP-' + Date.now() + Math.floor(Math.random()*1000),
                   name: currentProductData.title, cost: currentProductData.price, market: currentProductData.platform,
                   savedBy: 'T1 Clipper', savedAt: new Date().toISOString(),
                   imageUrl: currentProductData.imageUrl, link: currentProductData.url
               }];
            }
            
            const payload = {
                action: 'saveProduct',
                body: { products: payloadItems }
            };

            const res = await fetch(DEFAULT_GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload),
                redirect: 'follow'
            });

            if (!res.ok) throw new Error("Network Error");
            
            status.innerHTML = `<span style='color:#4ade80'>✅ 총 ${payloadItems.length}개 상품이 소싱 DB에 성공적으로 저장되었습니다!</span>`;
            document.getElementById('sendBtn').innerText = "DB 전송 완료";
            document.getElementById('sendBtn').style.background = "#64748b";
            document.getElementById('sendBtn').disabled = true;
        } catch (e) {
            status.innerText = "전송 실패: 네트워크 오류이거나 GAS 접근 불가.";
            console.error(e);
        }
    });
});
