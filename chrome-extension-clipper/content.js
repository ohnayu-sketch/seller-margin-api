if (!window.t1ClipperInitialized) {
  window.t1ClipperInitialized = true;

  // 1. 호버 위젯 생성
  const hoverWidget = document.createElement('div');
  hoverWidget.id = "t1-clipper-hover-widget";
  hoverWidget.innerHTML = "🚀 T1 Clip";
  document.body.appendChild(hoverWidget);
  
  // 2. 토스트 알림창 생성
  const toast = document.createElement('div');
  toast.id = "t1-clipper-toast";
  toast.innerHTML = `<div id="t1-toast-title">✅ 클리핑 완료!</div><div id="t1-toast-desc">상품 데이터가 추출되었습니다.</div>`;
  document.body.appendChild(toast);
  
  let currentTargetImg = null;

  // 3. 마우스 호버 감지 로직
  document.addEventListener('mouseover', (e) => {
      // 위젯 자체에 호버한 경우 무시
      if (e.target === hoverWidget || hoverWidget.contains(e.target)) return;
      
      // 타겟이 이미지가 아니더라도, 버튼투명막/A태그 오버레이일 수 있으므로 1차로 img를 탐색
      let imgTarget = null;
      
      const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag === 'img') {
          imgTarget = e.target;
      } else {
          // 네이버, 쿠팡 등은 A 태그나 DIV 투명막을 이미지 위에 덮어씌우는 경우가 많음
          const imgs = e.target.querySelectorAll ? e.target.querySelectorAll('img') : [];
          if (imgs.length > 0) {
              imgTarget = imgs[0]; // 투명막 아래에 숨겨진 이미지 발견
          }
      }

      if (imgTarget) {
          // 크기가 너무 작은 아이콘 이미지는 무시 (가로세로 90px 이상만 상품 이미지로 간주)
          if (imgTarget.width > 90 && imgTarget.height > 90) {
              currentTargetImg = imgTarget;
              const rect = imgTarget.getBoundingClientRect();
              
              hoverWidget.style.top = (window.scrollY + rect.top + 8) + 'px';
              // 이미지 우측 상단 배치 (버튼 너비 약 90px 고려)
              let leftPos = window.scrollX + rect.right - 90; 
              hoverWidget.style.left = leftPos + 'px';
              hoverWidget.style.display = 'flex';
          }
      } else {
          // 마우스가 완전히 다른 곳으로 벗어나면 숨김 처리 (옵션)
          // 여기서는 hoverWidget.style.display = 'none'; 등 구현할 수 있으나 UX상 버튼 위로 갈 시간이 필요하므로 유지.
      }
  });

  // 4. 클릭 시 데이터 추출 및 전송 액션
  hoverWidget.addEventListener('click', (e) => {
       e.preventDefault();
       e.stopPropagation();
       
       if(!currentTargetImg) return;

       // 애니메이션 재생
       hoverWidget.classList.add('t1-clicked');
       setTimeout(() => hoverWidget.classList.remove('t1-clicked'), 200);
       
       // DOM 텍스트 컨텍스트 분석하여 제목/가격 유추
       // 단순히 a 요소에서 멈추면 이미지 전용 a 태그일 경우 텍스트가 없음. 
       // 따라서 상위 DOM 구조(최대 6단계)를 탐색하며 유효한 정보를 찾음
       let node = currentTargetImg.closest('li') || currentTargetImg.closest('.product-item') || currentTargetImg.closest('[class*="item"]') || currentTargetImg.closest('td');
       
       if (!node) {
           let parent = currentTargetImg.parentElement;
           let depth = 0;
           while (parent && depth < 6) {
               // 유효한 텍스트 블록(가격 등)이 들어있는지 확인
               if (parent.innerText && parent.innerText.trim().length > 10 && parent.innerText.match(/[0-9]/)) {
                   node = parent;
                   if (['DIV', 'LI', 'ARTICLE', 'TD'].includes(parent.tagName)) break;
               }
               parent = parent.parentElement;
               depth++;
           }
           if (!node) node = currentTargetImg.closest('a') || currentTargetImg.closest('div');
       }

       let linkEl = currentTargetImg.closest('a');
       // node 안에서 a 태그를 다시 찾아 가장 유력한 상품 링크를 추출
       if (!linkEl && node) {
           linkEl = node.querySelector('a');
       }
       let link = linkEl && linkEl.href ? linkEl.href : window.location.href;
       
       let titleBlock = currentTargetImg.alt || document.title;
       let priceStr = "0";
       
       if (node && node.innerText) {
            let texts = node.innerText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
            
            // 제외할 쓸모없는 단어들 (배송, 적립, 할인 등)
            const excludeWords = ["KRW", "¥", "원", "할인", "무료배송", "적립", "리뷰", "평점", "도매", "장바구니", "찜", "구매", "판매"];
            
            let foundTitle = texts.find(t => t.length > 6 && !excludeWords.some(w => t.includes(w)));
            if (foundTitle) titleBlock = foundTitle;
            
            // 가격 탐색 로직 강화 (숫자와 콤마만 포함된 문자열을 우선적으로 가격으로 산정)
            // ex: "12,000", "12,000원", "15000", "50원"
            let priceBlock = texts.find(t => t.replace(/[^0-9]/g, '').length >= 2 && t.length < 15 && (t.includes('원') || t.match(/^[0-9,]+$/) || t.includes('₩')));
            if (!priceBlock) {
                // 두 번째 패스: 숫자가 있는 짧은 블록
                priceBlock = texts.find(t => t.match(/[0-9,.]+/));
            }

            if (priceBlock) {
                let priceVal = priceBlock.match(/[0-9,.]+/);
                if (priceVal) priceStr = priceVal[0].replace(/,/g, '');
            }
       }
       
       let platformId = "unknown";
       let targetUrl = link || window.location.href;
       if (targetUrl.includes("taobao")) platformId = "taobao";
       else if (targetUrl.includes("1688")) platformId = "1688";
       else if (targetUrl.includes("domeggook") || targetUrl.includes("domeme")) platformId = "domeggook";
       else if (targetUrl.includes("naver")) platformId = "naver";
       else if (targetUrl.includes("coupang")) platformId = "coupang";

       let extractedData = {
            type: "hover_single",
            title: titleBlock,
            price: priceStr,
            imageUrl: currentTargetImg.src,
            link: link,
            platform: platformId
       };
       
       console.log("🚀 [T1 Hover Clip Captured] :", extractedData);
       
       // 토스트 알림 (진행 중)
       toast.querySelector('#t1-toast-title').innerText = "🔄 DB 전송 중...";
       toast.querySelector('#t1-toast-desc').innerText = `[${extractedData.platform}] 데이터 저장 중입니다.`;
       toast.classList.add('t1-show');
       
       // GAS 웹앱 URL로 실제 POST 전송
       chrome.storage.local.get(['t1GasUrl'], (result) => {
           let DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
           
           if (result.t1GasUrl) {
               DEFAULT_GAS_URL = result.t1GasUrl;
           }

           const payload = {
               action: 'saveProduct',
               body: {
                   products: [{
                       id: 'CLP-HOVER-' + Date.now() + Math.floor(Math.random()*1000),
                       name: extractedData.title,
                       cost: extractedData.price,
                       market: extractedData.platform,
                       savedBy: 'T1 Hover Clipper',
                       savedAt: new Date().toISOString(),
                       imageUrl: extractedData.imageUrl,
                       link: extractedData.link
                   }]
               }
           };

           fetch(DEFAULT_GAS_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: JSON.stringify(payload),
               redirect: 'follow'
           }).then(res => {
               if(res.ok) {
                   toast.querySelector('#t1-toast-title').innerText = "✅ 클리핑 완료!";
                   toast.querySelector('#t1-toast-desc').innerText = `성공적으로 DB에 저장되었습니다.`;
               } else {
                   toast.querySelector('#t1-toast-title').innerText = "❌ 저장 실패";
                   toast.querySelector('#t1-toast-desc').innerText = `네트워크 오류가 발생했습니다.`;
               }
               setTimeout(() => toast.classList.remove('t1-show'), 2500);
           }).catch(e => {
               console.error(e);
               toast.querySelector('#t1-toast-title').innerText = "❌ 저장 실패";
               toast.querySelector('#t1-toast-desc').innerText = `스크립트 연결 오류.`;
               setTimeout(() => toast.classList.remove('t1-show'), 2500);
           });
       });
  });
}

// ==========================================
// 기존 벌크 및 팝업창 전용 IIFE 파싱 로직
// ==========================================
(() => {
  // 현재 보고 있는 웹페이지 URL
  const url = window.location.href;
  
  // 빈 데이터 포맷
  let data = {
    url: url,
    title: document.title,
    price: "0",
    imageUrl: "",
    platform: "unknown"
  };

  try {
    // 1. 도매매 / 도매꾹 사이트인 경우
    if (url.includes("domeggook.com") || url.includes("domemedb.domeggook.com")) {
      data.platform = "domeggook";
      
      // 가격 추출 시도 (최신 도매꾹/도매매 구조 반영)
      const priceEl = document.querySelector('#lBaseAmtVal') || document.querySelector('.lPrice') || document.querySelector('.p_price_num') || document.querySelector('#sdbItemPrice') || document.querySelector('.price_num');
      if (priceEl) data.price = priceEl.innerText.replace(/[^0-9]/g, '');
      
      // 제목 추출 시도
      const titleEl = document.querySelector('.lTitle') || document.querySelector('.p_tit') || document.querySelector('.marketItemTitle') || document.querySelector('.tit');
      if (titleEl) {
        data.title = titleEl.innerText.trim();
      } else {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) data.title = ogTitle.content.replace(/도매꾹|도매매|B2B|배송대행/g, '').trim();
      }
      
      // 썸네일 추출 시도 (og:image가 가장 확실함)
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        data.imageUrl = ogImage.content;
      } else {
        const imgEl = document.querySelector('.lImg img') || document.querySelector('#thumbArea img') || document.querySelector('#idItemImage0') || document.querySelector('.img_thumb img');
        if (imgEl) data.imageUrl = imgEl.src;
      }

    } 
    // 2. 네이버 스마트스토어/쇼핑인 경우
    else if (url.includes("smartstore.naver.com") || url.includes("shopping.naver.com")) {
      data.platform = "naver";
      
      const titleEl = document.querySelector('h3._3oSmGL2HFR') || document.querySelector('h2');
      if (titleEl) {
        data.title = titleEl.innerText.trim();
      } else {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) data.title = ogTitle.content;
      }
      
      const priceEl = document.querySelector('strong._1LY7DqCnwR') || document.querySelector('strong.price_num__S2p_v');
      if (priceEl) data.price = priceEl.innerText.replace(/[^0-9]/g, '');
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        data.imageUrl = ogImage.content;
      } else {
        const imgEl = document.querySelector('._3o3q1dJ8pE img') || document.querySelector('.image_thumb__b1fyy img') || document.querySelector('.bd_2f398 img');
        if (imgEl) data.imageUrl = imgEl.src;
      }
    } 
    // 3. 쿠팡인 경우
    else if (url.includes("coupang.com")) {
      data.platform = "coupang";
      
      const titleEl = document.querySelector('.prod-buy-header__title');
      if (titleEl) data.title = titleEl.innerText.trim();
      
      const priceEl = document.querySelector('.total-price strong');
      if (priceEl) data.price = priceEl.innerText.replace(/[^0-9]/g, '');
      
      const imgEl = document.querySelector('.prod-image__items img') || document.querySelector('.prod-image__detail img');
      if (imgEl) data.imageUrl = "https:" + imgEl.getAttribute('src');
    }
    // 4. 1688 (알리바바 중국) - 외부 이미지 검색툴로 열린 페이지용
    else if (url.includes("1688.com")) {
      data.platform = "1688";
      
      const titleEl = document.querySelector('.title-text') || document.querySelector('.title-info');
      if (titleEl) data.title = titleEl.innerText.trim();
      else {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) data.title = ogTitle.content.replace(/1688|알리바바/g, '').trim();
      }
      
      const priceEl = document.querySelector('.price-text') || document.querySelector('.price-now');
      if (priceEl) data.price = priceEl.innerText.replace(/[^0-9.]/g, '');
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        data.imageUrl = ogImage.content;
      } else {
        const imgEl = document.querySelector('.detail-gallery-img') || document.querySelector('.main-img');
        if (imgEl) data.imageUrl = imgEl.src;
      }
    }
    // 5. 타오바오(Taobao) - 외부 이미지 검색툴로 열린 페이지용
    else if (url.includes("taobao.com")) {
      data.platform = "taobao";
      
      const titleEl = document.querySelector('.tb-main-title');
      if (titleEl) data.title = titleEl.innerText.trim();
      else {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) data.title = ogTitle.content.replace(/taobao|타오바오/g, '').trim();
      }
      
      const priceEl = document.querySelector('.tb-rmb-num');
      if (priceEl) data.price = priceEl.innerText.replace(/[^0-9.]/g, '');
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        data.imageUrl = ogImage.content;
      } else {
        const imgEl = document.querySelector('#J_ImgBooth');
        if (imgEl) data.imageUrl = imgEl.src;
      }
    }
    // 6. AliPrice 기생 파이프라인 (대량 벌크 스크래핑)
    else if (url.includes("aliprice.com") || document.querySelector('div[class*="aliprice"]')) {
      data.type = "bulk"; // 단일 객체가 아닌 여러 상품 배열임을 명시
      data.items = [];
      data.platform = "aliprice_bulk";
      
      // 주로 a 태그 안에 상품 정보가 담겨있는 구조를 범용적으로 순회 탐색
      const itemNodes = document.querySelectorAll('a[href*="detail.1688.com"], a[href*="item.taobao.com"], .product-item, .gallery-item, .item-wrap, [class*="aliprice-item"]');
      
      const uniqueUrls = new Set(); // 중복 방지
      
      itemNodes.forEach(node => {
        let imgEl = node.querySelector('img');
        if (!imgEl || !imgEl.src) return;
        
        let link = node.href || node.getAttribute('data-href') || "";
        if (link && uniqueUrls.has(link)) return;
        if (link) uniqueUrls.add(link);
        
        // 텍스트에서 가격과 타이틀 유추
        let texts = node.innerText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
        let titleBlock = texts.find(t => t.length > 5 && !t.includes("KRW") && !t.includes("¥")) || imgEl.alt || "1688/Taobao 파트너 상품";
        
        let priceBlock = texts.find(t => t.match(/[0-9,.]+/)) || "0";
        let priceVal = priceBlock.match(/[0-9,.]+/);
        let priceStr = priceVal ? priceVal[0].replace(/,/g, '') : "0";
        
        data.items.push({
            title: titleBlock,
            price: priceStr,
            imageUrl: imgEl.src,
            link: link,
            platform: link.includes("taobao") ? "taobao" : "1688"
        });
      });
      
      // 만약 배열이 비어있다면 에러 방지용 임시 데이터 삽입(안전 장치)
      if (data.items.length === 0) {
        data.items = document.querySelectorAll('img').length > 0 ? [{title: "AliPrice 캡처 대기중", price:0, imageUrl:"", platform:"1688"}] : [];
      }
    }
  } catch(e) {
    console.error("Sourcing Clipper 파싱 오류: ", e);
  }
  
  console.log("Sourcing Clipper 획득 데이터: ", data);
  // 이 결과값이 popup.js의 results[0].result 로 반환됨.
  return data;
})();
