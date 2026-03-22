// [Self-Injection 방지] 대시보드 Iframe 내부이거나 대시보드 자체 URL인 경우 클리퍼 UI 생성을 원천 차단합니다.
if (window.location.href.includes('seller-dashboard-v6.html') || window.name === 'dashboard-frame') {
    console.log('[Clipper] 대시보드 내부(Iframe)이므로 클리퍼 봇 UI 주입을 생략합니다.');
} else if (!window.t1ClipperManualInitialized) {
  window.t1ClipperManualInitialized = true;

  // --- 플로팅 툴바 컨테이너 ---
  const toolbar = document.createElement('div');
  toolbar.id = "t1-float-toolbar";
  document.body.appendChild(toolbar);

  // 0.5 드래그 핸들 생성
  const dragHandle = document.createElement('div');
  dragHandle.className = "t1c-drag-handle";
  dragHandle.innerHTML = "● ● ●";
  dragHandle.title = "드래그하여 이동 (Clipper Toolbar)";
  toolbar.appendChild(dragHandle);

  // 0. 축소/확대 토글 버튼 생성
  const toggleBtn = document.createElement('div');
  toggleBtn.id = "t1-clipper-toggle";
  toggleBtn.className = "t1c-float-icon t1c-toggle-btn";
  toggleBtn.title = "클리퍼 숨기기/보이기";
  toggleBtn.innerHTML = `➖`;
  toggleBtn.onclick = () => {
      toolbar.classList.toggle('minimized');
      toggleBtn.innerHTML = toolbar.classList.contains('minimized') ? `➕` : `➖`;
  };
  toolbar.appendChild(toggleBtn);

  // 1. 트리거(열기) 버튼 생성
  const triggerBtn = document.createElement('div');
  triggerBtn.id = "t1-clipper-trigger";
  triggerBtn.className = "t1c-float-icon";
  triggerBtn.title = "[Clipper] 소싱/벤치마킹 데이터 선택기";
  triggerBtn.innerHTML = `🛒 <span style="font-size:10px;display:block;margin-top:2px;">수동 수집</span>`;
  toolbar.appendChild(triggerBtn);

  // 1-5. AI 시장 분석기 버튼
  const aiBtn = document.createElement('div');
  aiBtn.id = "t1-ai-analyzer-btn";
  aiBtn.className = "t1c-float-icon";
  aiBtn.title = "[AI Analysis] 현재 리스트 거시적 평균가 및 경쟁강도 스캔";
  aiBtn.innerHTML = `📊 <span style="font-size:10px;display:block;margin-top:2px;">시장 스캔</span>`;
  toolbar.appendChild(aiBtn);

  // 1-8. AI 전용 데이터 복사기 버튼
  const aiCopyBtn = document.createElement('div');
  aiCopyBtn.id = "t1-ai-copy-btn";
  aiCopyBtn.className = "t1c-float-icon";
  aiCopyBtn.title = "[AI Feed] AI에게 현재 화면의 은닉 메타데이터 복사하기";
  aiCopyBtn.innerHTML = `📋 <span style="font-size:10px;display:block;margin-top:2px;">AI 복사</span>`;
  toolbar.appendChild(aiCopyBtn);

  // 2. 모달 컨테이너 생성 (전체화면 오버레이 대신 팝업형 오버레이로 변경)
  const modalOverlay = document.createElement('div');
  modalOverlay.id = "t1-clipper-modal-overlay";
  modalOverlay.innerHTML = `
    <div id="t1-clipper-modal">
        <div class="t1c-header">
           <div class="t1c-title">🛒 소싱 클리퍼 (수동 다중 선택 모드)</div>
           <div class="t1c-close">✖</div>
        </div>
        <div class="t1c-body">
           <div class="t1c-form-group">
               <label>상품명 (직접 수정 가능)</label>
               <input type="text" id="t1c-input-title" placeholder="상품명을 입력하세요">
           </div>
           <div class="t1c-form-group">
               <label>판매가/원가 (숫자만)</label>
               <input type="number" id="t1c-input-price" placeholder="0">
           </div>
           
           <div class="t1c-section-title">✨ 추출된 이미지 (대표 1장 필수, 상세 N장 다중선택)</div>
           <p style="font-size:12px; color:#cbd5e1; margin-bottom:12px;">✅ 각 이미지 하단의 <b>[대표]</b> 버튼과 <b>[상세추가]</b> 버튼을 각각 눌러 지정할 수 있습니다.</p>
           <div class="t1c-grid" id="t1c-grid-unified"></div>
        </div>
        <div class="t1c-footer">
           <button class="t1c-btn-a" id="t1c-send-a">📊 Track A (시장조사/표적) 전송</button>
           <button class="t1c-btn-b" id="t1c-send-b">📦 Track B (도매소싱/마진) 전송</button>
        </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // 3. 토스트 알림창
  const toast = document.createElement('div');
  toast.id = "t1-clipper-toast";
  toast.innerHTML = `<div id="t1-toast-title"></div><div id="t1-toast-desc"></div>`;
  document.body.appendChild(toast);

  let state = {
      images: [],
      selectedThumb: null,
      selectedDetails: new Set(),
      platform: "unknown"
  };

  function showToast(title, desc, isError=false) {
      toast.querySelector('#t1-toast-title').innerText = title;
      toast.querySelector('#t1-toast-title').style.color = isError ? '#ef4444' : '#34d399';
      toast.querySelector('#t1-toast-desc').innerText = desc;
      toast.classList.add('t1-show');
      setTimeout(() => toast.classList.remove('t1-show'), 3000);
  }

  // --- Draggable 로직 (Toolbar & Modal) ---
  let tStartX, tStartY, tInitialX, tInitialY;
  dragHandle.addEventListener('mousedown', (e) => {
      tStartX = e.clientX;
      tStartY = e.clientY;
      const rect = toolbar.getBoundingClientRect();
      tInitialX = rect.left;
      tInitialY = rect.top;
      toolbar.style.right = 'auto';
      toolbar.style.bottom = 'auto';
      toolbar.style.left = `${tInitialX}px`;
      toolbar.style.top = `${tInitialY}px`;
      document.addEventListener('mousemove', onMouseMoveToolbar);
      document.addEventListener('mouseup', onMouseUpToolbar);
  });
  function onMouseMoveToolbar(e) {
      const dx = e.clientX - tStartX;
      const dy = e.clientY - tStartY;
      toolbar.style.left = `${tInitialX + dx}px`;
      toolbar.style.top = `${tInitialY + dy}px`;
  }
  function onMouseUpToolbar() {
      document.removeEventListener('mousemove', onMouseMoveToolbar);
      document.removeEventListener('mouseup', onMouseUpToolbar);
  }

  const modalHeader = modalOverlay.querySelector('.t1c-header');
  const modalBox = modalOverlay.querySelector('#t1-clipper-modal');
  let mStartX, mStartY, mInitialX, mInitialY;
  modalHeader.style.cursor = 'grab';
  modalHeader.addEventListener('mousedown', (e) => {
      if (e.target.closest('.t1c-close')) return;
      mStartX = e.clientX;
      mStartY = e.clientY;
      const rect = modalBox.getBoundingClientRect();
      mInitialX = rect.left;
      mInitialY = rect.top;
      modalBox.style.margin = '0';
      modalBox.style.position = 'fixed';
      modalBox.style.left = `${mInitialX}px`;
      modalBox.style.top = `${mInitialY}px`;
      modalBox.style.transform = 'none';
      modalHeader.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMouseMoveModal);
      document.addEventListener('mouseup', onMouseUpModal);
  });
  function onMouseMoveModal(e) {
      const dx = e.clientX - mStartX;
      const dy = e.clientY - mStartY;
      modalBox.style.left = `${mInitialX + dx}px`;
      modalBox.style.top = `${mInitialY + dy}px`;
  }
  function onMouseUpModal() {
      modalHeader.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMoveModal);
      document.removeEventListener('mouseup', onMouseUpModal);
  }

  // --- 스크래핑 로직 ---
  function extractPageData() {
      const url = window.location.href;
      let platform = 'unknown';
      let title = document.title;
      let price = 0;
      let extractStatus = { title: false, price: false, image: false };

      // 1. URL 기반 플랫폼 판별
      if (url.includes('smartstore.naver.com') || url.includes('brand.naver.com') || url.includes('shopping.naver.com')) platform = 'smartstore';
      else if (url.includes('coupang.com')) platform = 'coupang';
      else if (url.includes('1688.com')) platform = '1688';
      else if (url.includes('taobao.com')) platform = 'taobao';
      else if (url.includes('domeggook.com') || url.includes('domeme.com')) platform = 'domeggook';
      else if (url.includes('aliprice.com') || url.includes('aliexpress.com')) platform = 'aliprice';
      state.platform = platform;

      // 2. 제목 & 가격 플랫폼별 추출 (다중 셀렉터 Fallback 체인)
      if (platform === 'coupang') {
          title = document.querySelector('.prod-buy-header__title, h1.prod-buy-header__title, h2.prod-buy-header__title')?.textContent || document.title;
          const pEl = document.querySelector('.prod-sale-price .total-price strong, .total-price strong, .prod-sale-price, .prod-coupon-price .total-price strong');
          if (pEl) price = pEl.textContent.replace(/[^0-9]/g, '');

          // ★ [쿠팡 강화] 리뷰수 · 별점 · 로켓배송 · 판매량 추출
          let coupangReviews = 0, coupangRating = 0, coupangRocket = false, coupangSalesText = '';
          // 리뷰수: "(1,234)" 또는 "상품평 1,234건" 패턴
          const reviewEl = document.querySelector('.count, .prod-review__count, .sdp-review__count, [class*="review"] .count');
          if (reviewEl) { const m = reviewEl.textContent.match(/([0-9,]+)/); if (m) coupangReviews = parseInt(m[1].replace(/,/g, '')); }
          // 별점: "4.5" 등
          const ratingEl = document.querySelector('.rating-star-num, .prod-rating__number, .sdp-review__average__rating, [class*="StarRating"]');
          if (ratingEl) { const m = ratingEl.textContent.match(/([0-9.]+)/); if (m) coupangRating = parseFloat(m[1]); }
          if (!coupangRating) { const metaRating = document.querySelector('meta[itemprop="ratingValue"]'); if (metaRating) coupangRating = parseFloat(metaRating.content); }
          // 로켓배송 감지
          const rocketEl = document.querySelector('.prod-badge__rocket, img[alt*="로켓"], img[src*="rocket"], .badge--rocket, [class*="RocketBadge"], [class*="rocket-badge"]');
          if (rocketEl) coupangRocket = true;
          if (!coupangRocket && document.body.innerText.includes('로켓배송')) coupangRocket = true;
          // 판매량: "최근 30일 N건 구매", "N명이 구매" 등
          const salesMatch = document.body.innerText.match(/(?:최근\s*30일\s*)?([0-9,]+)\s*(?:건\s*구매|명이?\s*구매|개\s*구매)/);
          if (salesMatch) coupangSalesText = salesMatch[0];
          // 전역 상태에 저장 (sendData에서 payloadObj에 포함)
          window._coupangMeta = { reviews: coupangReviews, rating: coupangRating, isRocket: coupangRocket, salesText: coupangSalesText };
      } else if (platform === 'smartstore') {
          title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('._22kNQuEXmb, ._3oDl3bZOh5')?.textContent || document.title;
          const pEl = document.querySelector('._1LY7DqCnwR, strong span.number, ._2pgHN-ntx6 strong, meta[property="product:price:amount"]');
          if (pEl) {
              price = pEl.content || pEl.textContent;
              price = String(price).replace(/[^0-9]/g, '');
          }
      } else if (platform === '1688') {
          title = document.querySelector('.title-text, .offer-title, .d-title')?.textContent || document.title;
          const pEl = document.querySelector('.price-text, .offer-price, .price-original-sku, .sku-item-price');
          if (pEl) price = pEl.textContent.replace(/[^0-9.]/g, '');
      } else if (platform === 'taobao') {
          title = document.querySelector('.tb-main-title, .ItemHeader--mainTitle')?.textContent || document.title;
          const pEl = document.querySelector('.tb-rmb-num, .Price--priceText');
          if (pEl) price = pEl.textContent.replace(/[^0-9.]/g, '');
      } else if (platform === 'domeggook') {
          title = document.querySelector('#lInfoItemTitle, .item_name, h1')?.textContent || document.title;
          const pEl = document.querySelector('#lInfoItemPrice, .lInfoItemPrice, .item_price strong, .price_box .price');
          if (pEl) price = pEl.textContent.replace(/[^0-9]/g, '');
      } else if (platform === 'aliprice') {
          title = document.querySelector('.goods-title, .title, .product-title, h1')?.textContent || document.title;
          const pEl = document.querySelector('.price-value, .price, .money, .product-price-value');
          if (pEl) price = pEl.textContent.replace(/[^0-9.]/g, '');
      }

      // 3. Fallback 계층 A: OpenGraph 메타태그
      if (!price || price === '0') {
          const ogPrice = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
          if (ogPrice) price = ogPrice.content.replace(/[^0-9.]/g, '');
      }

      // 4. Fallback 계층 B: JSON-LD 검색 (SEO 메타데이터)
      if (!price || price === '0') {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          scripts.forEach(s => {
              try {
                  const data = JSON.parse(s.textContent);
                  if (data.offers && data.offers.price) price = parseInt(data.offers.price);
                  else if (data[0] && data[0].offers && data[0].offers.price) price = parseInt(data[0].offers.price);
                  // 배열 형태 LD+JSON
                  else if (data['@graph']) {
                      data['@graph'].forEach(g => {
                          if (g.offers && g.offers.price) price = parseInt(g.offers.price);
                      });
                  }
              } catch(e){}
          });
      }

      // 5. Fallback 계층 C: 일반 텍스트에서 휴리스틱 추출
      if (!price || price === '0') {
          let pMatch = document.body.innerText.match(/[0-9]{1,3}(,[0-9]{3})+원?/g);
          if (pMatch && pMatch.length > 0) price = pMatch[0].replace(/[^0-9]/g, '');
      }

      // 제목 정제 (SEO 잡음 제거)
      title = title.replace(/\s*[-|:]\s*(네이버|쿠팡|도매꾹|스마트스토어|brand|smartstore).*/gi, '').trim();
      if (title.length > 3) extractStatus.title = true;

      document.getElementById('t1c-input-title').value = title.trim();
      document.getElementById('t1c-input-price').value = parseInt(price || 0, 10);
      if (parseInt(price || 0) > 0) extractStatus.price = true;
      
      // 이미지 추출 로직 (화면 내 모든 img 요소 + 메타 이미지)
      let rawImgs = Array.from(document.querySelectorAll('img')).map(img => img.src);
      
      // 쿠팡, 알리 등 LazyLoad 및 Background 이미지 탐지 지원
      document.querySelectorAll('*').forEach(el => {
         let bg = window.getComputedStyle(el).backgroundImage;
         if (bg && bg !== 'none' && bg.includes('url(')) {
             let url = bg.slice(4, -1).replace(/["']/g, "");
             if(url && !url.startsWith('data:')) rawImgs.push(url);
         }
         // Data-src attribute (Lazy loading)
         let dataSrc = el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-lazy-src');
         if(dataSrc && !dataSrc.startsWith('data:')) {
             if(dataSrc.startsWith('//')) dataSrc = 'https:' + dataSrc;
             rawImgs.push(dataSrc);
         }
      });
      
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) rawImgs.unshift(ogImg.content); // 메인을 가장 앞에

      // 유니크화, 필터링 (아이콘/배지/픽셀 등 작은 이미지 제외)
      state.images = [...new Set(rawImgs)].filter(src => {
          if(!src || src.length < 10) return false;
          if(src.startsWith('data:image')) return false; // base64 무시
          const ignoreStr = ['icon', 'logo', 'button', 'badge', 'tracking', 'pixel', 'spinner', 'blank', 'spacer', 'empty', '1x1'];
          if(ignoreStr.some(ig => src.toLowerCase().includes(ig))) return false;
          return true;
      });
      if (state.images.length > 0) extractStatus.image = true;

      // ★ 추출 상태 뱃지 표시
      const statusParts = [];
      statusParts.push(extractStatus.title ? '✅제목' : '❌제목');
      statusParts.push(extractStatus.price ? '✅가격' : '⚠️가격(수동입력)');
      statusParts.push(extractStatus.image ? `✅이미지(${state.images.length}장)` : '⚠️이미지없음');
      
      const existingBadge = document.getElementById('t1c-extract-status');
      if (existingBadge) existingBadge.remove();
      const badgeEl = document.createElement('div');
      badgeEl.id = 't1c-extract-status';
      badgeEl.style.cssText = 'padding:8px 12px;margin:8px 0;border-radius:6px;font-size:11px;font-weight:600;text-align:center;' + 
          (extractStatus.price ? 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;' : 'background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);color:#f59e0b;');
      badgeEl.textContent = `📊 추출 결과: ${statusParts.join(' · ')}`;
      const bodyEl = document.querySelector('#t1-clipper-modal .t1c-body');
      if (bodyEl) bodyEl.insertBefore(badgeEl, bodyEl.firstChild);
  }

  function renderImageGrids() {
      const unifiedGrid = document.getElementById('t1c-grid-unified');
      
      unifiedGrid.innerHTML = '';
      state.selectedThumb = null;
      state.selectedDetails.clear();

      if (state.images.length > 0) state.selectedThumb = state.images[0];

      state.images.forEach((src, idx) => {
          const card = document.createElement('div');
          card.className = 't1c-img-card unified-card';
          card.style.backgroundImage = `url('${src}')`;
          
          const badge = document.createElement('div');
          badge.className = 't1c-img-badge';
          badge.innerText = '측정중...';
          card.appendChild(badge);

          // 하단 패널(버튼 컨테이너)
          const btnWrap = document.createElement('div');
          btnWrap.className = 't1c-img-btn-wrap';
          
          // 대표 썸네일 버튼
          const btnThumb = document.createElement('button');
          btnThumb.className = 't1c-card-btn t1-btn-thumb';
          btnThumb.innerText = '⭐ 대표';
          if(state.selectedThumb === src) btnThumb.classList.add('active');
          
          // 상세 이미지 토글 버튼
          const btnDetail = document.createElement('button');
          btnDetail.className = 't1c-card-btn t1-btn-detail';
          btnDetail.innerText = '➕ 상세추가';
          
          btnThumb.onclick = (e) => {
              e.stopPropagation();
              state.selectedThumb = src;
              unifiedGrid.querySelectorAll('.t1-btn-thumb').forEach(b => b.classList.remove('active'));
              btnThumb.classList.add('active');
          };
          
          btnDetail.onclick = (e) => {
              e.stopPropagation();
              if (state.selectedDetails.has(src)) {
                  state.selectedDetails.delete(src);
                  btnDetail.classList.remove('active');
                  card.classList.remove('selected-as-detail');
              } else {
                  state.selectedDetails.add(src);
                  btnDetail.classList.add('active');
                  card.classList.add('selected-as-detail');
              }
          };

          btnWrap.appendChild(btnThumb);
          btnWrap.appendChild(btnDetail);
          card.appendChild(btnWrap);
          
          // 카드 영역 전체 클릭 시 자동으로 상세 추가 토글 (편의성 유지)
          card.onclick = (e) => {
              if (e.target.closest('.t1c-card-btn')) return;
              btnDetail.click();
          };

          unifiedGrid.appendChild(card);
          
          let imgObj = new Image();
          imgObj.onload = function() {
              const w = this.width; const h = this.height;
              let txt = '', cls = 'normal';
              if (w < 350 || h < 350) { txt = `❌방해 (${w}x${h})`; cls = 'bad'; }
              else if (w > h * 2.5 || h > w * 3) { txt = `⚠광고 (${w}x${h})`; cls = 'warning'; }
              else if (w >= 800 && h >= 800) { txt = `✅A급 (${w}x${h})`; cls = 'good'; }
              else { txt = `일반 (${w}x${h})`; cls = 'normal'; }
              
              badge.className = `t1c-img-badge ${cls}`;
              badge.innerText = txt;
          };
          imgObj.src = src;
      });
  }

  // --- 이벤트 리스너 ---
  triggerBtn.addEventListener('click', () => {
      extractPageData();
      renderImageGrids();
      modalOverlay.classList.add('open');
  });

  aiBtn.addEventListener('click', () => {
      runAImarketAnalysis();
  });

  aiCopyBtn.addEventListener('click', () => {
      copyDataForAI();
  });

  modalOverlay.querySelector('.t1c-close').addEventListener('click', () => {
      modalOverlay.classList.remove('open');
  });

  // --- AI 수동 스크래핑 방패 우회 우회기 (클립보드 복사) ---
  function copyDataForAI() {
      showToast("⏳ 데이터 추출 중...", "AI에게 전달할 화면의 숨겨진 코드를 긁어모읍니다.");
      setTimeout(() => {
          let result = "=== Market List Data for AI (도매/시중 공통) ===\\nURL: " + window.location.href + "\\n\\n";
          result += "=== HIDDEN STATE DATA (API Response) ===\\n";
          
          const next = document.getElementById('__NEXT_DATA__') || document.querySelector('script#__NEXT_DATA__');
          if(next) result += next.textContent.slice(0, 5000) + "\\n\\n";
          
          const redux = document.getElementById('__PRELOADED_STATE__') || document.querySelector('script#initial-state');
          if(redux) result += redux.textContent.slice(0, 5000) + "\\n\\n";
          
          const coupangData = document.getElementById('searchOptionData');
          if(coupangData) result += coupangData.textContent.slice(0, 5000) + "\\n\\n";

          result += "=== 📐 Product Layout SKELETON (Design & Structure Script) ===\\n";
          // 네이버, 쿠팡, 알리, 도매꾹 등의 공통 상세페이지 클래스
          const detailArea = document.querySelector('.product-detail-content, .detail_area, .se-viewer, .detail_info, #s_item_detail, .sub-detail-wrap, .prod-description, .detail-content, #lItemDetail');
          if (detailArea) {
              let skeleton = [];
              detailArea.querySelectorAll('*').forEach(el => {
                  const tag = el.tagName.toUpperCase();
                  if (tag === 'IMG') {
                      const src = el.src || el.getAttribute('data-src');
                      if (src && !src.startsWith('data:')) skeleton.push(`[🖼️ IMG] ${src}`);
                  } else if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'STRONG', 'B', 'DIV'].includes(tag)) {
                      // DIV나 P 중 직접 텍스트 노드를 가지는 경우만
                      const text = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(' ');
                      if (text.length > 3) skeleton.push(`[📝 ${tag}] ${text}`);
                  } else if (tag === 'IFRAME' || tag === 'VIDEO') {
                      skeleton.push(`[🎥 VIDEO/GIF] ${el.src}`);
                  } else if (tag === 'TABLE') {
                      skeleton.push(`[📊 TABLE] 상품 스펙/정보 표`);
                  }
              });
              result += skeleton.join('\\n').slice(0, 7000) + "\\n\\n";
          }
          
          result += "=== 🏷️ Market List Layout SKELETON (For AI Scraping Training) ===\\n";
          const listCards = document.querySelectorAll('[class^="basicList_item"], [class^="product_item"], [class^="adProduct_item"], .search-product, .baby-product, .product-item, .prod-item, .offer-item, .item_box, .list_item, .prod_item');
          if (listCards.length > 0) {
              result += "Found " + listCards.length + " product cards.\\n";
              const sampleCard = listCards[0];
              let cardSkeleton = [];
              sampleCard.querySelectorAll('*').forEach(el => {
                 const tag = el.tagName.toUpperCase();
                 const cls = el.className || '';
                 const txt = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(' ');
                 if(txt.length > 1 || tag === 'IMG') {
                     cardSkeleton.push(`[${tag} class="${cls}"] ${tag === 'IMG' ? el.src : txt}`);
                 }
              });
              result += "=== [1st Card DOM Sample] ===\\n" + cardSkeleton.join('\\n').slice(0, 3000) + "\\n\\n";
          }

          result += "=== Raw List Text Extract (3000자) ===\\n";
          const text = document.body.innerText.replace(/\\s+/g, ' ');
          result += text.slice(0, 3000) + "\\n\\n...[생략]...";
          
          const el = document.createElement('textarea');
          el.value = result;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
          
          alert("✅ 📐 [AI 학습용 레이아웃/DOM/JSON 전체 스크립트] 복사 완료!\\n\\n현재 쇼핑몰의 사이트 뼈대 구조를 입체적으로 추출했습니다.\\n안티그래비티 대화창에 (Ctrl+V) 로 붙여넣어 '이 레이아웃을 학습해서 T3 템플릿으로 만들어줘' 라고 명령해보세요!");
      }, 300);
  }

  // --- AI Macro Scanner (단가 역산 및 도매 분석) 로직 ---
  function runAImarketAnalysis() {
      // B2B(도매처) vs B2C(소매처) 구분
      const isB2B = window.location.href.includes('domeggook.com') || window.location.href.includes('1688.com') || window.location.href.includes('domeme.com');
      
      showToast("⏳ AI 분석 중...", isB2B ? "[Track B] 도매처 평균원가 및 MOQ를 스캔합니다." : "[Track A] 소매처 경쟁강도 및 목표가를 스캔합니다.");
      
      setTimeout(() => {
          let prices = [];
          let totalReviewsOrMoq = 0;
          let validItems = 0;
          let extractedBulkItems = []; // [NEW] 대량 추출 파이프라인용 배열

          // 범용 상품 카드 추적
          const cards = document.querySelectorAll('[class^="basicList_item"], [class^="product_item"], [class^="adProduct_item"], .search-product, .baby-product, .product-item, .prod-item, .offer-item, .item_box, .list_item');
          
          cards.forEach(c => {
              const textInfo = c.innerText || "";
              
              // 소매처인 경우에만 광고(AD) 제외
              if (!isB2B && (textInfo.includes('광고') || textInfo.includes('Ad ') || c.classList.contains('adProduct_item__1zC9h'))) return;

              let priceNode = c.querySelector('.price_num__S2p_v, .price-value, strong, .tb-rmb-num, .price, .lInfoItemPrice, #lInfoItemPrice');
              let p = 0;
              if (priceNode) {
                  p = parseInt(priceNode.innerText.replace(/[^0-9]/g, ''));
              } else {
                  // 노드로 못 찾으면 텍스트에서 X,XXX원 찾기
                  let fallbackPrice = textInfo.match(/[0-9]{1,3}(,[0-9]{3})+원/);
                  if (fallbackPrice) p = parseInt(fallbackPrice[0].replace(/[^0-9]/g, ''));
              }

              if (p > 100 && p < 10000000) prices.push(p);

              if (isB2B) {
                  // 도매꾹 최소구매수량 (MOQ)
                  let moqMatch = textInfo.match(/최소\s*([0-9,]+)\s*개/);
                  if (moqMatch) {
                      totalReviewsOrMoq += parseInt(moqMatch[1].replace(/,/g, ''));
                      validItems++;
                  } else if (textInfo.includes('낱개구매가능') || textInfo.includes('낱개 구매')) {
                      totalReviewsOrMoq += 1;
                      validItems++;
                  }
              } else {
                  // ★ [강화] 소매처 리뷰 추출 — 쿠팡 전용 셀렉터 체인 강화
                  let reviewCount = 0;
                  // 쿠팡 전용: badge-rating 내 리뷰수
                  const coupangReviewNode = c.querySelector('.rating-total-count, [class*="rating"] .count, [class*="Review"] .count');
                  if (coupangReviewNode) {
                      const m = coupangReviewNode.textContent.match(/([0-9,]+)/);
                      if (m) reviewCount = parseInt(m[1].replace(/,/g, ''));
                  }
                  // 범용 폴백
                  if (!reviewCount) {
                      let reviewMatch = textInfo.match(/리뷰\s*([0-9,]+)/) || textInfo.match(/평가\s*([0-9,]+)/) || textInfo.match(/상품평\s*\(?([0-9,]+)\)?/);
                      if (!reviewMatch) reviewMatch = textInfo.match(/\(([0-9,]+)\)(?=\s*최대|$|\s*품절)/);
                      if (!reviewMatch) reviewMatch = textInfo.match(/구매\s*([0-9,]+)\s*건/);
                      if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
                  }
                  if (reviewCount > 0) {
                      totalReviewsOrMoq += reviewCount;
                      validItems++;
                  }
              }

              // [NEW] 대량 수집용 객체 생성
              if (p > 100) {
                  const title = c.getAttribute('title') || c.querySelector('.title, .name, .prod-name, dt, .adProduct_title__amInq, .basicList_title__VfX3c')?.innerText || c.innerText.split('\n')[0].trim().slice(0, 50);
                  const imgEl = c.querySelector('img');
                  const imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src')) : '';
                  const linkTag = c.querySelector('a');
                  const linkUrl = linkTag ? linkTag.href : window.location.href;
                  
                  extractedBulkItems.push({
                      name: title,
                      price: p,
                      image: imgUrl,
                      link: linkUrl,
                      source: isB2B ? '도매/클리퍼' : '소매/클리퍼',
                      origin: window.location.hostname
                  });
              }
          });

          // Fallback 전체 텍스트 스캔
          if (prices.length === 0) {
              let pMatches = document.body.innerText.match(/[0-9]{1,3}(,[0-9]{3})+원/g);
              if (pMatches) prices = pMatches.map(str => parseInt(str.replace(/[^0-9]/g, ''))).filter(p => p > 100);
          }

          if (prices.length < 3) return showToast("❌ 분석 실패", "분석할 수 있는 상품 표본이 3개 미만입니다.", true);

          prices.sort((a,b) => a-b);
          // 아웃라이어(상하위 10%) 절사평균
          let trimCount = Math.floor(prices.length * 0.1);
          let trimmed = prices.slice(trimCount, prices.length - trimCount);
          let avgPrice = trimmed.reduce((a,b)=>a+b, 0) / trimmed.length;
          
          let avgStat = validItems > 0 ? Math.floor(totalReviewsOrMoq / validItems) : 0;

          // [NEW] T1 대시보드 주입용 JSON 클립보드 복사
          if (extractedBulkItems.length > 0) {
              const bulkJson = JSON.stringify({
                  _type: 'T1_CLIPPER_BULK',
                  platform: window.location.hostname,
                  count: extractedBulkItems.length,
                  items: extractedBulkItems
              });
              const textArea = document.createElement('textarea');
              textArea.value = bulkJson;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
          }

          if (isB2B) {
              const b2bRpt = `🎯 [Track B: 도매/사입처 AI 분석]\n표본: ${prices.length}개 상품\n\n📌 평균 도매 매입원가: ${Math.floor(avgPrice).toLocaleString()}원\n📦 평균 최소주문수량(MOQ): ${avgStat.toLocaleString()}개\n\n💡 AI 진단 전략:\n👉 원가 대비 마진 시뮬레이터(Track B)에 [ ${Math.floor(avgPrice).toLocaleString()}원 ]을 원가로 입력하세요.\n\n✅ 대량 소싱 리스트(${extractedBulkItems.length}개)가 클립보드에 복사되었습니다!\n대시보드 T1 탭에서 [📋 클리퍼 데이터 붙여넣기]를 활용해보세요.`;
              alert(b2bRpt);
          } else {
              let targetSalePrice = avgPrice * 0.9;
              let maxCost = targetSalePrice * 0.6 - 3000;
              let estMonthlySales = Math.floor(avgStat * 15);
              const b2cRpt = `🎯 [Track A: 소매 시장 한계선 분석]\n표본: ${prices.length}개 상품 (광고 제외)\n\n📌 시장 지배 단가(AMP): ${Math.floor(avgPrice).toLocaleString()}원\n🔥 평균 리뷰(경쟁): ${avgStat.toLocaleString()}개\n🚀 월 예상 판매량(15배수): 최소 ${estMonthlySales.toLocaleString()}개\n\n💡 AI 승부 추천 전략:\n1. 목표 판매가: ${Math.floor(targetSalePrice).toLocaleString()}원\n2. 도매 매입 상한선: [ ${Math.floor(maxCost).toLocaleString()}원 ]\n\n✅ 대량 소싱 타겟 리스트(${extractedBulkItems.length}개)가 클립보드에 복사되었습니다!\n대시보드 T1 탭에서 [📋 클리퍼 데이터 붙여넣기]를 클릭하세요.`;
              alert(b2cRpt);
          }
      }, 800);
  }

  // --- 기존 Hover 기능 (퀵 클립) 복원 및 확장 메뉴 ---
  const hoverBtn = document.createElement('div');
  hoverBtn.className = 't1c-quick-clip-wrap';
  hoverBtn.innerHTML = `
    <div class="t1c-quick-clip-btn">⚡클립 Pick</div>
    <div class="t1c-quick-clip-menu">
       <div class="t1c-quick-menu-item track-b" data-track="B">📦 트랙 B (사입용)</div>
       <div class="t1c-quick-menu-item track-a" data-track="A">📊 트랙 A (경쟁사)</div>
    </div>
  `;
  hoverBtn.style.display = 'none'; // 명시적 숨김 초기화
  document.body.appendChild(hoverBtn);
  console.log("✅ T1 Clipper Content Script (v2.1 Hover Fix) Loaded.");

  let hoverDebounce;
  let currentCard = null;
  document.addEventListener('mousemove', (e) => {
      // 클립 버튼 위에 올라갓을 때 숨기지 않도록 방어 (중요: Timeout 클리어)
      if (e.target.closest('.t1c-quick-clip-wrap')) {
          clearTimeout(hoverDebounce);
          return;
      }
      
      // 모달/툴바 위 무시
      if (e.target.closest('#t1-clipper-modal-overlay') || e.target.closest('#t1-float-toolbar')) return;
      
      // 상단 헤더, 네비게이션바, 푸터 등 오작동(마이쿠팡 등) 방어
      if (e.target.closest('header, footer, nav, #header, #footer, .gnb, .menu, [class*="header"], [class*="nav"]')) return;

      // 도매꾹(.lItem), 1688(.offer-item), 스마트스토어/네이버/쿠팡 다수 커버 (동적 해시 클래스 지원)
      const selectors = [
          '[class^="basicList_item"]', '[class^="product_item"]', '[class^="adProduct_item"]',
          '.search-product', '.baby-product', '.search-product-wrap', '.product-item', '.prod-item',
          'li.lItem', 'div.lItem', '.item_box', '.list_item', '.offer-item',
          '.prod-image__items', '.prod-buy', '._23BqIfuAQJ',
          'li:has(img)', 'a:has(img)', 'div.thumbnail'
      ].join(', ');
      
      const targetCard = e.target.closest(selectors);

      if (targetCard) {
          clearTimeout(hoverDebounce);
          if (targetCard !== currentCard) {
              currentCard = targetCard;
              // 상품 카드의 영역을 실시간으로 가져옴
              const rect = currentCard.getBoundingClientRect();
              
              if(rect.width > 80 && rect.height > 80) {
                  // 화면 위치(scrollY) 보정
                  const top = rect.top + window.scrollY;
                  const left = rect.left + window.scrollX;
                  
                  hoverBtn.style.top = `${top + 10}px`;
                  hoverBtn.style.left = `${left + rect.width - 60}px`;
                  hoverBtn.style.display = 'flex';
              }
          }
      } else if (currentCard) {
          // 마우스가 떠났는지 여유를 두고 숨김
          hoverDebounce = setTimeout(() => {
              if (currentCard && !currentCard.contains(e.target) && !hoverBtn.contains(e.target)) {
                  hoverBtn.style.display = 'none';
                  currentCard = null;
              }
          }, 400); // 400ms로 약간 증가
      }
  });

  hoverBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const targetMenu = e.target.closest('.t1c-quick-menu-item');
      let track = 'B'; 
      if (targetMenu) {
          track = targetMenu.getAttribute('data-track') || 'B';
      } else if (e.target.closest('.t1c-quick-clip-btn')) {
          track = 'B'; // 기본 버튼 클릭 시 B 반환
      } else {
          return;
      }

      if (!currentCard) return;

      const mainBtn = hoverBtn.querySelector('.t1c-quick-clip-btn');
      mainBtn.innerHTML = '⏳';
      const textInfo = currentCard.innerText || "";
      const titleNode = currentCard.querySelector('.title, .name, .prod-name, dt, .adProduct_title__amInq, .basicList_title__VfX3c');
      let title = currentCard.getAttribute('title') || (titleNode ? titleNode.innerText : null) || textInfo.split('\\n')[0].trim().slice(0, 50) || '이름 없음';
      let priceNode = currentCard.querySelector('.price_num__S2p_v, .price-value, strong, .tb-rmb-num, .price');
      let p = 0;
      if (priceNode) p = parseInt((priceNode.innerText || "0").replace(/[^0-9]/g, '')) || 0;
      if (p < 100) {
          let fallbackPrice = textInfo.match(/[0-9]{1,3}(,[0-9]{3})+원/);
          if (fallbackPrice) p = parseInt(fallbackPrice[0].replace(/[^0-9]/g, '')) || 0;
      }
      let price = p.toString();
      let imgEl = currentCard.querySelector('img');
      let imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src')) : '';
      let link = currentCard.href || currentCard.querySelector('a')?.href || window.location.href;

      // ──────────────────────────────────────────────────────────
      // 🕵️‍♂️ [타사 확장프로그램 데이터 스크래핑 로직] (아이템스카우트, 판다랭크 등 우회 추출)
      // ──────────────────────────────────────────────────────────
      let thirdPartyData = { extSales: 0, extRevenue: 0, extCompetitiveness: '' };
      
      // 1. 예상 판매량 추출 (예: "30일 판매량 500", "예상판매: 1,200", "판매 300개")
      let salesMatch = textInfo.match(/(?:판매량|예상판매|판매|월판매)\s*[:]?\s*([0-9,]+)\s*(?:개|건)?/);
      if (salesMatch) thirdPartyData.extSales = parseInt(salesMatch[1].replace(/,/g, ''));
      
      // 2. 예상 매출액 추출 (예: "매출 150만원", "예상매출: 5,000,000")
      let revMatch = textInfo.match(/(?:매출|예상매출|매출액)\s*[:]?\s*([0-9,]+(?:\.[0-9]+)?)\s*(만)?\s*(?:원)?/);
      if (revMatch) {
          let revVal = parseFloat(revMatch[1].replace(/,/g, ''));
          if (revMatch[2] === '만') revVal *= 10000;
          thirdPartyData.extRevenue = revVal;
      }
      
      // 3. 묶음 배송 / 경쟁 강도 텍스트 확보
      let compMatch = textInfo.match(/(경쟁강도|경쟁률)\s*[:]?\s*([가-힣a-zA-Z0-9.]+)/);
      if (compMatch) thirdPartyData.extCompetitiveness = compMatch[2];

      // ★ [신규] 쿠팡 카드 내 로켓배송/리뷰수/별점 즉석 추출
      let cardCoupangMeta = { reviews: 0, rating: 0, isRocket: false, salesText: '' };
      if (window.location.hostname.includes('coupang')) {
          // 로켓배송 배지
          const rocketBadge = currentCard.querySelector('img[alt*="로켓"], img[src*="rocket"], [class*="rocket"], [class*="badge--rocket"]');
          cardCoupangMeta.isRocket = !!rocketBadge || textInfo.includes('로켓배송');
          // 리뷰수
          const rvNode = currentCard.querySelector('.rating-total-count, [class*="rating"] .count');
          if (rvNode) { const m = rvNode.textContent.match(/([0-9,]+)/); if (m) cardCoupangMeta.reviews = parseInt(m[1].replace(/,/g, '')); }
          // 별점
          const rtNode = currentCard.querySelector('.rating-star, [class*="StarRating"]');
          if (rtNode) { const m = rtNode.textContent.match(/([0-9.]+)/); if (m) cardCoupangMeta.rating = parseFloat(m[1]); }
      }

      const payloadObj = {
          id: 'CLP-HOVER-' + Date.now(),
          name: title.trim(),
          cost: track === 'A' ? 0 : parseInt(price || "0", 10),
          salePrice: track === 'A' ? parseInt(price || "0", 10) : 0,
          market: window.location.hostname.includes('coupang') ? 'coupang' : window.location.hostname.includes('naver') ? 'smartstore' : window.location.hostname.includes('1688') ? '1688' : window.location.hostname.includes('domeggook') ? 'domeggook' : window.location.hostname,
          savedBy: `T1 Auto Clipper (Tr.${track})`,
          savedAt: new Date().toISOString(),
          imageUrl: imgUrl,
          detailUrls: '',
          sourceText: textInfo.slice(0, 1500),
          link: link,
          category: track === 'A' ? '시장조사/벤치마킹 타겟 빠른수집' : '빠른 수집 대상',
          // 해킹된 타사 인텔리전스 데이터 오버라이딩 첨부
          thirdPartyIntel: thirdPartyData,
          // ★ [신규] 쿠팡 디테일 메타데이터
          coupangMeta: cardCoupangMeta
      };

      try {
          // 🚀 1. [사이드 패널 직접 통신 개통]
          chrome.runtime.sendMessage({
              action: 'CLIP_PRODUCT_TO_PANEL',
              data: payloadObj
          }, (response) => {
              if (chrome.runtime.lastError) {
                  console.warn("사이드 패널 미연결, 백그라운드 폴백 작동");
              }
              showToast(`✅ 위젯 장바구니 추가 성공!`, "우측 사이드 패널을 확인하세요.");
              mainBtn.innerHTML = '✔';
              setTimeout(() => { mainBtn.innerHTML='⚡클립 Pick'; hoverBtn.style.display='none'; }, 1000);
          });
          
          // 🚀 2. [오리지널 기능 복원] GAS (대량엑셀소싱 DB) 동시 전송
          chrome.storage.local.get(['t1GasUrl'], async (result) => {
              const gasUrl = result.t1GasUrl || 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
              try {
                  const res = await fetch(gasUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                      body: JSON.stringify({
                          action: 'saveProduct',
                          body: { products: [payloadObj] }
                      }),
                      redirect: 'follow'
                  });
                  if (res.ok) {
                      showToast(`💾 DB 자동 저장 완료! (Tr.${track})`, "목록 탭에도 정상적으로 반영되었습니다.");
                  }
              } catch (e) {
                  console.error('GAS Background Save Error:', e);
              }
          });
      } catch (err) {
          showToast("❌ 패널 통신 실패 (연결 끊김)", "현재 열려있는 창을 새로고침(F5) 해주세요!", true);
          mainBtn.innerHTML = '❌오류';
      }
  });

  async function sendData(track) {
      const title = document.getElementById('t1c-input-title').value.trim();
      const price = document.getElementById('t1c-input-price').value || "0";
      
      if (!title) { alert('상품명을 입력해주세요!'); return; }
      if (!state.selectedThumb) { alert('대표 썸네일을 1개 이상 선택해야 합니다!'); return; }

      // 전송 데이터 직렬화
      const payloadObj = {
          id: 'CLP-MANUAL-' + Date.now(),
          name: title,
          cost: track === 'A' ? 0 : price,
          salePrice: track === 'A' ? price : 0,
          market: state.platform,
          savedBy: `T1 Clipper (Tr.${track})`,
          savedAt: new Date().toISOString(),
          imageUrl: state.selectedThumb,
          detailUrls: Array.from(state.selectedDetails).join(','),
          sourceText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 3000),
          link: window.location.href,
          category: track === 'A' ? '시장조사/벤치마킹 타겟' : '도매소싱 후보',
          // ★ [신규] 쿠팡 상세페이지 메타 (리뷰수/별점/로켓배송/판매량)
          coupangMeta: window._coupangMeta || { reviews: 0, rating: 0, isRocket: false, salesText: '' }
      };

      try {
          // 🚀 1. [사이드 패널 직접 통신 개통]
          chrome.runtime.sendMessage({
              action: 'CLIP_PRODUCT_TO_PANEL',
              data: payloadObj
          }, (response) => {
              if (chrome.runtime.lastError) {
                  console.warn("사이드 패널 미연결, 백그라운드 폴백 작동");
              }
              showToast(`✅ 위젯 장바구니 추가 성공!`, "우측 사이드 패널을 확인하세요.");
              modalOverlay.classList.remove('open'); // 성공 시 모달 닫기
          });
          
          // 🚀 2. [오리지널 기능 복원] GAS (대량엑셀소싱 DB) 동시 전송
          chrome.storage.local.get(['t1GasUrl'], async (result) => {
              const gasUrl = result.t1GasUrl || 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
              showToast("🔄 DB에 전송 중...", `Track ${track}에 데이터를 추가로 저장합니다.`);
              try {
                  const res = await fetch(gasUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                      body: JSON.stringify({
                          action: 'saveProduct',
                          body: { products: [payloadObj] }
                      }),
                      redirect: 'follow'
                  });
                  if (res.ok) {
                      showToast(`💾 DB 자동 저장 완료! (Tr.${track})`, "목록 탭에도 수집이 완료되었습니다.");
                  } else {
                      showToast("❌ DB 자동 저장 실패", "서버 응답 오류가 발생했습니다.", true);
                  }
              } catch (e) {
                  console.error('GAS Background Save Error:', e);
                  showToast("❌ DB 자동 저장 실패", "네트워크/GAS 설정을 확인하세요.", true);
              }
          });
      } catch (err) {
          console.error(err);
          showToast("❌ 패널 통신 실패 (연결 끊김)", "현재 열려있는 창을 새로고침(F5) 해주세요!", true);
      }
  }

  document.getElementById('t1c-send-a').addEventListener('click', () => sendData('A'));
  document.getElementById('t1c-send-b').addEventListener('click', () => sendData('B'));

  // --- SPA 환경 대응 (MutationObserver 기반 DOM 재귀속) ---
  // 쿠팡 등 React 기반 SPA 구조에서 페이지 스크롤/카테고리 이동 시 클리퍼 UI가 날아가는 현상 방지
  if (!window.location.href.includes('seller-dashboard-v6.html') && window.name !== 'dashboard-frame') {
      const observer = new MutationObserver((mutations) => {
          // document.body 내부의 노드 삭제 이벤트를 감시
          let needsRestore = false;
          for (const m of mutations) {
              if (m.removedNodes.length > 0) {
                  needsRestore = true;
                  break;
              }
          }
          
          if (needsRestore && document.body) {
              if (!document.getElementById('t1-float-toolbar')) {
                  console.log('[Clipper] SPA 화면 전환 감지: 툴바 UI 신속 복원');
                  document.body.appendChild(toolbar);
              }
              if (!document.getElementById('t1-clipper-modal-overlay')) {
                  // 모달은 열려있었을 경우를 대비해 복원, 닫혀있다면 그대로 닫힌 상태 유지
                  document.body.appendChild(modalOverlay);
              }
              if (!document.getElementById('t1-clipper-toast')) {
                  document.body.appendChild(toast);
              }
              if (!document.querySelector('.t1c-quick-clip-wrap') && hoverBtn) {
                  document.body.appendChild(hoverBtn);
              }
          }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      console.log('[Clipper] SPA MutationObserver 가동 시작');
  }
}
