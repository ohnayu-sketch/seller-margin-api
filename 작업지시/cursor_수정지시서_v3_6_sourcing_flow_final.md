# Cursor 작업지시서 — v3.6 소싱 플로우 고도화

> 작성: 2026-03-01  
> 대상 파일: `seller-dashboard-v3.html`, `main.py`

---

## 먼저 확인할 버그 2개

### 🐛 버그 1 — 최고가 상품 카드 미표시

**현상:** 시중가 조회 후 최저가/평균가 근처 상품은 나오는데 최고가 근처 상품이 없음  
**원인:** `fetchMarketPrice()` 내부에서 `byMax` 정렬 및 렌더링 코드가 없음  
**위치:** `seller-dashboard-v3.html` 약 1477번째 줄

**수정 내용 (HTML):**

`id="mp-products-avg-label"` 아래에 최고가 섹션 추가:
```html
<!-- 기존 평균가 카드 다음에 추가 -->
<div class="mp-subtitle" id="mp-products-max-label" style="margin-top:12px">🛍️ 시중 최고가 근처 상품</div>
<div id="mp-product-cards-max" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;scrollbar-width:none"></div>
```

**수정 내용 (JS):** `fetchMarketPrice()` 내 카드 렌더링 블록에 추가:
```javascript
// 기존 byAvg 렌더링 다음에 추가
const byMax = topItems.slice().sort((a,b) => Math.abs((a.price||0)-maxP) - Math.abs((b.price||0)-maxP));
const maxLabel = document.getElementById('mp-products-max-label');
if (maxLabel) maxLabel.textContent = '🛍️ 시중 최고가 ' + fmt(maxP) + '원 근처 상품';
document.getElementById('mp-product-cards-max').innerHTML = byMax.slice(0,5).map(makeProductCard).join('');
```

CSS 추가 (기존 min/avg scrollbar 숨김 라인 옆에):
```css
#mp-product-cards-max::-webkit-scrollbar { display: none; }
```

---

### 🐛 버그 2 — 시중가 조회 상품이 3개밖에 안 나옴

**현상:** 상품 카드가 3~5개만 표시됨  
**원인 1 (main.py):** `/search` 엔드포인트에서 `top_items`를 `items[:10]`으로 슬라이싱  
**원인 2 (main.py):** 기본 `display=10` (네이버 API에 10개만 요청)

**수정 내용 (main.py `/search` 함수):**
```python
# 변경 전
async def search_product(query: str, display: int = 10):
    params = {"query": query, "display": min(display, 30), "sort": "sim"}
    ...
    top_items = [ ... for it in items[:10] ]

# 변경 후
async def search_product(query: str, display: int = 30, include_trend: bool = False):
    params = {"query": query, "display": min(display, 100), "sort": "sim"}
    ...
    top_items = [ ... for it in items ]  # 슬라이싱 제거, 전체 반환
```

> 네이버 쇼핑 API 최대 display=100까지 가능. 30으로 요청하면 최저/평균/최고가 카드 각 5개씩 충분히 채워짐.

---

## 신규 기능 1 — 연관검색어 자동완성 + 검색 흐름

### 개념 설명
"모자" 입력 시 → 버킷햇, 야구모자, 볼캡, 비니, 썬캡 등 연관 키워드 칩이 뜸  
→ 칩 클릭 시 해당 키워드로 시중가 조회 자동 실행

### 구현 위치: `seller-dashboard-v3.html` 계산 탭 상품명 입력란

**HTML 추가** (상품명 input 바로 아래):
```html
<!-- 연관검색어 칩 -->
<div id="related-keywords" style="display:none;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
```

**JS 함수 추가:**
```javascript
// 상품명 입력 후 연관검색어 칩 표시
async function fetchRelatedKeywords(keyword) {
  if (!keyword || keyword.length < 1) {
    document.getElementById('related-keywords').style.display = 'none';
    return;
  }
  const base = API_URL || localStorage.getItem('api-url') || '';
  if (!base) return;
  
  try {
    const res = await fetch(base + '/related?query=' + encodeURIComponent(keyword));
    const data = await res.json();
    if (!data.success || !data.keywords?.length) return;
    
    const el = document.getElementById('related-keywords');
    el.style.display = 'flex';
    el.innerHTML = data.keywords.map(kw =>
      `<button onclick="selectKeyword('${kw}')"
        style="padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);
               color:var(--text);font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap">
        🔍 ${kw}
      </button>`
    ).join('');
  } catch(e) {}
}

function selectKeyword(kw) {
  document.getElementById('productName').value = kw;
  document.getElementById('related-keywords').style.display = 'none';
  fetchMarketPrice(); // 바로 시중가 조회 실행
}
```

**상품명 input에 debounce 입력 이벤트 추가:**
```javascript
// productName input에 oninput 수정
// 기존: (없음)
// 변경: 500ms debounce로 연관검색어 호출
let _kwTimer;
document.getElementById('productName').addEventListener('input', function() {
  clearTimeout(_kwTimer);
  _kwTimer = setTimeout(() => fetchRelatedKeywords(this.value.trim()), 500);
});
```

### main.py에 추가할 엔드포인트 `/related`

```python
@app.get("/related")
async def get_related_keywords(query: str):
    """
    상품명 입력 시 연관검색어 반환.
    네이버 쇼핑 검색 결과의 category명 + 제목 키워드 조합으로 생성.
    """
    if not query:
        return {"success": False, "keywords": []}
    
    # 카테고리별 연관 키워드 사전 (하드코딩 + API 결과 조합)
    KEYWORD_MAP = {
        "모자": ["버킷햇", "야구모자", "볼캡", "비니", "썬캡", "페도라", "베레모", "등산모자", "캐주얼모자"],
        "가방": ["크로스백", "숄더백", "백팩", "토트백", "클러치", "에코백", "미니백", "패니팩"],
        "신발": ["운동화", "슬리퍼", "샌들", "부츠", "로퍼", "스니커즈", "구두", "아쿠아슈즈"],
        "옷": ["반팔티", "맨투맨", "후드집업", "청바지", "레깅스", "원피스", "자켓", "패딩"],
        "이어폰": ["무선이어폰", "블루투스이어폰", "노이즈캔슬링", "오픈형이어폰", "유선이어폰", "에어팟"],
        "충전기": ["고속충전기", "무선충전기", "멀티충전기", "C타입충전기", "차량용충전기"],
    }
    
    # 기본: 입력어 포함된 키워드 맵 탐색
    keywords = []
    for key, vals in KEYWORD_MAP.items():
        if key in query or query in key:
            keywords.extend(vals)
            break
    
    # 키워드 맵에 없으면 네이버 쇼핑 검색 결과 카테고리 기반으로 생성
    if not keywords:
        try:
            result = await search_product(query, display=10)
            if result.get("success") and result.get("top_items"):
                # top_items 제목에서 공통 키워드 추출
                titles = [it["title"] for it in result["top_items"][:5]]
                # 제목에서 자주 등장하는 단어 추출 (간단 구현)
                words = []
                for t in titles:
                    words.extend(t.split())
                from collections import Counter
                common = [w for w, c in Counter(words).most_common(10) if len(w) >= 2 and w != query]
                keywords = common[:8]
        except:
            pass
    
    # 없으면 fallback: 쿼리 + 일반 접미사
    if not keywords:
        keywords = [query + s for s in ["추천", "인기", "저렴한", "고급", "세트", "대용량", "미니"]]
    
    return {"success": True, "keywords": keywords[:8]}
```

---

## 신규 기능 2 — 도매사이트 연동 소싱 플로우

### 개념 설명
시중가 조회 후 → 연결된 도매사이트에서 같은/유사 상품 검색 → 이미지/가격 표시  
→ 마음에 드는 도매상품 선택 → 원가 자동 입력 → 마진율/플랫폼 선택 → 저장

### 구현 위치: 시중가 조회 결과 박스 하단에 새 섹션 추가

**HTML 추가** (market-price-box 닫는 태그 바로 앞):
```html
<!-- 도매 소싱 섹션 -->
<div id="wholesale-section" style="display:none;margin-top:16px">
  <div class="panel">
    <div class="panel-header">🏭 <span>도매 소싱 검색</span>
      <span style="font-size:11px;color:var(--text-muted);font-weight:400">네이버쇼핑 시중가 조회와 동일 키워드</span>
    </div>
    <div class="panel-body">
      <!-- 도매사이트 탭 선택 -->
      <div id="wholesale-site-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <button class="ws-tab active" onclick="selectWholesaleSite('naver_store', this)">🛒 도매꾹</button>
        <button class="ws-tab" onclick="selectWholesaleSite('kmall', this)">🏬 도매토피아</button>
        <button class="ws-tab" onclick="selectWholesaleSite('gmarket_wholesale', this)">📦 오너클랜</button>
      </div>
      <!-- 도매 상품 카드 -->
      <div id="wholesale-cards" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
        <div style="color:var(--text-muted);font-size:13px;padding:20px 0">
          시중가 조회 후 도매 상품이 표시됩니다
        </div>
      </div>
    </div>
  </div>
</div>
```

**CSS 추가:**
```css
.ws-tab {
  padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border);
  background: var(--surface2); color: var(--text-muted); font-size: 12px;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.ws-tab.active {
  background: var(--accent); color: #0d0f14; border-color: var(--accent); font-weight: 700;
}
.wholesale-card {
  flex: 0 0 110px; min-width: 110px; border: 1px solid var(--border);
  border-radius: 10px; overflow: hidden; background: var(--surface);
  cursor: pointer; transition: border-color 0.15s;
}
.wholesale-card:hover, .wholesale-card.selected {
  border-color: var(--accent); box-shadow: 0 0 0 2px rgba(74,222,128,0.2);
}
.wholesale-card img { width: 100%; height: 100px; object-fit: cover; display: block; }
.ws-price { font-size: 12px; font-weight: 700; color: var(--accent); padding: 5px 6px 2px; }
.ws-name { font-size: 10px; color: var(--text-muted); padding: 0 6px 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ws-min-qty { font-size: 10px; color: var(--text-muted); padding: 0 6px 5px; }
.ws-select-btn {
  width: 100%; padding: 5px; background: transparent; border: none; border-top: 1px solid var(--border);
  color: var(--accent); font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit;
}
```

**JS 함수 추가:**
```javascript
let _currentWholesaleSite = 'naver_store';
let _currentSearchKeyword = '';

// 도매사이트 탭 전환
function selectWholesaleSite(site, btn) {
  _currentWholesaleSite = site;
  document.querySelectorAll('.ws-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  fetchWholesaleProducts(_currentSearchKeyword, site);
}

// 도매 상품 검색 (main.py /wholesale 엔드포인트 호출)
async function fetchWholesaleProducts(keyword, site) {
  if (!keyword) return;
  const base = API_URL || localStorage.getItem('api-url') || '';
  if (!base) return;
  
  const cardsEl = document.getElementById('wholesale-cards');
  cardsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px">검색 중...</div>';
  
  try {
    const res = await fetch(`${base}/wholesale?query=${encodeURIComponent(keyword)}&site=${site}`);
    const data = await res.json();
    
    if (!data.success || !data.items?.length) {
      cardsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px 0">검색 결과가 없습니다</div>';
      return;
    }
    
    cardsEl.innerHTML = data.items.map((it, i) => `
      <div class="wholesale-card" id="ws-card-${i}" onclick="selectWholesaleProduct(${i}, ${it.price}, '${(it.name||'').replace(/'/g,'')}', '${it.link||''}')">
        <img src="${it.image||''}" alt="${it.name||''}" loading="lazy" onerror="this.style.display='none'">
        <div class="ws-price">${fmt(it.price)}원</div>
        <div class="ws-name">${(it.name||'').slice(0,16)}</div>
        <div class="ws-min-qty">최소 ${it.min_qty||1}개</div>
        <button class="ws-select-btn" onclick="event.stopPropagation();selectWholesaleProduct(${i}, ${it.price}, '${(it.name||'').replace(/'/g,'')}', '${it.link||''}')">원가 적용</button>
      </div>
    `).join('');
  } catch(e) {
    cardsEl.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:20px 0">도매 검색 오류</div>';
  }
}

// 도매 상품 선택 → 원가 자동 입력
function selectWholesaleProduct(idx, price, name, link) {
  // 이전 선택 해제
  document.querySelectorAll('.wholesale-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('ws-card-' + idx);
  if (card) card.classList.add('selected');
  
  // 원가 자동 입력
  document.getElementById('costPrice').value = price;
  
  // 토스트 안내
  showToast(`✅ 원가 ${fmt(price)}원 자동 입력됨`);
  
  // 실시간 마진 재계산
  recalcMargin();
  
  // 결과 영역으로 스크롤
  const resultsEl = document.getElementById('results-area');
  if (resultsEl) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

**fetchMarketPrice() 끝부분에 추가** (try-catch 내):
```javascript
// 도매 섹션 표시
_currentSearchKeyword = name;
const wsSection = document.getElementById('wholesale-section');
if (wsSection) {
  wsSection.style.display = 'block';
  fetchWholesaleProducts(name, _currentWholesaleSite);
}
```

### main.py에 추가할 엔드포인트 `/wholesale`

```python
@app.get("/wholesale")
async def wholesale_search(query: str, site: str = "naver_store"):
    """
    도매사이트 상품 검색.
    현재는 네이버 쇼핑 도매/대량구매 필터로 구현.
    추후 각 도매사이트 API 또는 크롤링으로 교체 가능.
    
    site 파라미터:
    - naver_store: 도매꾹 (네이버 쇼핑 채널 필터)
    - kmall: 도매토피아
    - gmarket_wholesale: 오너클랜
    """
    if not NAVER_CLIENT_ID:
        return {"success": False, "items": [], "error": "API 키 미설정"}
    
    # 현재 구현: 네이버 쇼핑에서 도매 키워드로 검색
    wholesale_query = f"{query} 도매" if site == "naver_store" else f"{query} 대량구매"
    
    url = "https://openapi.naver.com/v1/search/shop.json"
    params = {"query": wholesale_query, "display": 20, "sort": "asc"}  # 가격 오름차순
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=_naver_headers(), params=params)
        data = res.json()
    
    if "items" not in data:
        return {"success": False, "items": [], "error": "검색 실패"}
    
    def clean(t):
        return (t or "").replace("<b>", "").replace("</b>", "")
    
    items = [
        {
            "name": clean(it.get("title")),
            "price": int(it.get("lprice", 0)),
            "image": it.get("image", ""),
            "link": it.get("link", ""),
            "mall": it.get("mallName", ""),
            "min_qty": 1,  # 네이버 API에서는 최소수량 정보 없음, 추후 개선
        }
        for it in data["items"]
        if int(it.get("lprice", 0)) > 0
    ]
    
    # 도매사이트별 링크 오버라이드 (실제 도매사이트 검색 URL)
    site_links = {
        "naver_store": f"https://domeggook.com/search?keyword={query}",
        "kmall": f"https://www.domaepia.com/search/product?q={query}",
        "gmarket_wholesale": f"https://www.ownerclan.com/search?keyword={query}",
    }
    
    return {
        "success": True,
        "items": items[:15],
        "site_url": site_links.get(site, ""),
        "site_name": {"naver_store": "도매꾹", "kmall": "도매토피아", "gmarket_wholesale": "오너클랜"}.get(site, site),
    }
```

---

## 신규 기능 3 — 사입 섹션

### 개념 설명
현장(시장, 공장 등)에서 상품을 직접 보고 구매하는 사입의 경우:
- 현장에서 상품 사진 촬영
- 가격 정보 입력
- 메모 저장
- 나중에 사무실에서 마진 계산 연결

### 구현 방법 — 계산 탭에 "사입 모드" 토글 추가

**HTML 추가** (계산 탭 상단, 상품명 섹션 위):
```html
<!-- 소싱 방식 선택 -->
<div style="display:flex;gap:8px;margin-bottom:12px">
  <button class="sourcing-mode-btn active" id="mode-online" onclick="setSourcingMode('online', this)">
    🖥️ 온라인 소싱
  </button>
  <button class="sourcing-mode-btn" id="mode-direct" onclick="setSourcingMode('direct', this)">
    🏪 사입 (현장)
  </button>
</div>

<!-- 사입 전용 섹션 (기본 숨김) -->
<div id="direct-sourcing-section" style="display:none">
  <div class="panel" style="margin-bottom:12px">
    <div class="panel-header">🏪 <span>사입 정보 입력</span></div>
    <div class="panel-body">
      <!-- 사진 촬영/업로드 -->
      <div style="margin-bottom:12px">
        <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:6px">상품 사진</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label style="flex:1;min-width:120px;height:80px;border:2px dashed var(--border);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);font-size:12px">
            📷 사진 촬영 / 업로드
            <input type="file" id="direct-photo" accept="image/*" capture="environment" style="display:none" onchange="previewDirectPhoto(this)">
          </label>
          <div id="direct-photo-preview" style="display:none;flex:1;min-width:120px"></div>
        </div>
      </div>
      
      <!-- 구매처 -->
      <div class="form-group">
        <label>구매처 (시장/매장명)</label>
        <input type="text" id="direct-vendor" placeholder="예: 동대문 평화시장 A동 123호">
      </div>
      
      <!-- 단가 / 최소수량 -->
      <div class="input-row">
        <div class="form-group">
          <label>단가 (원)</label>
          <input type="number" id="direct-unit-price" placeholder="0" min="0" inputmode="numeric"
            oninput="document.getElementById('costPrice').value=this.value; recalcMargin()">
        </div>
        <div class="form-group">
          <label>최소 구매수량</label>
          <input type="number" id="direct-min-qty" placeholder="1" min="1" inputmode="numeric">
        </div>
      </div>
      
      <!-- 메모 -->
      <div class="form-group">
        <label>현장 메모</label>
        <input type="text" id="direct-memo" placeholder="색상, 사이즈, 특이사항 등">
      </div>
      
      <!-- 사입 정보 임시저장 버튼 -->
      <button class="calc-btn" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)" 
        onclick="saveDirectSourcingNote()">
        📝 현장 메모 임시저장
      </button>
    </div>
  </div>
  
  <!-- 임시저장된 사입 메모 목록 -->
  <div id="direct-notes-list" style="display:none">
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">📋 오늘 사입 목록</div>
    <div id="direct-notes-cards"></div>
  </div>
</div>
```

**CSS 추가:**
```css
.sourcing-mode-btn {
  flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--surface2); color: var(--text-muted); font-size: 13px;
  cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.15s;
}
.sourcing-mode-btn.active {
  background: var(--accent); color: #0d0f14; border-color: var(--accent);
}
```

**JS 함수 추가:**
```javascript
// 소싱 모드 전환
function setSourcingMode(mode, btn) {
  document.querySelectorAll('.sourcing-mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  const onlineEl = document.getElementById('btn-market-search').closest('.form-group') || 
                   document.getElementById('market-price-box');
  const directEl = document.getElementById('direct-sourcing-section');
  
  if (mode === 'direct') {
    if (directEl) directEl.style.display = 'block';
    renderDirectNotes();
  } else {
    if (directEl) directEl.style.display = 'none';
  }
  localStorage.setItem('sourcing-mode', mode);
}

// 사입 사진 미리보기
function previewDirectPhoto(input) {
  const preview = document.getElementById('direct-photo-preview');
  if (!input.files?.length) return;
  const file = input.files[0];
  const url = URL.createObjectURL(file);
  preview.style.display = 'block';
  preview.innerHTML = `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:10px">`;
  // base64로 변환해서 localStorage에 저장
  const reader = new FileReader();
  reader.onload = e => { preview.dataset.base64 = e.target.result; };
  reader.readAsDataURL(file);
}

// 사입 메모 임시저장 (localStorage)
const DIRECT_NOTES_KEY = 'direct-sourcing-notes';
function saveDirectSourcingNote() {
  const name = document.getElementById('productName').value.trim();
  const vendor = document.getElementById('direct-vendor').value.trim();
  const price = parseFloat(document.getElementById('direct-unit-price').value) || 0;
  const minQty = parseInt(document.getElementById('direct-min-qty').value) || 1;
  const memo = document.getElementById('direct-memo').value.trim();
  const preview = document.getElementById('direct-photo-preview');
  const photo = preview?.dataset?.base64 || '';
  
  if (!name && !price) { showToast('상품명 또는 단가를 입력하세요', true); return; }
  
  const notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
  notes.unshift({
    id: Date.now(),
    name: name || '미입력',
    vendor, price, minQty, memo, photo,
    at: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  });
  localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes.slice(0, 20)));
  showToast('✅ 사입 메모 저장됨');
  renderDirectNotes();
  
  // 폼 초기화
  ['direct-vendor','direct-unit-price','direct-min-qty','direct-memo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// 사입 메모 목록 렌더링
function renderDirectNotes() {
  const notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
  const listEl = document.getElementById('direct-notes-list');
  const cardsEl = document.getElementById('direct-notes-cards');
  if (!listEl || !cardsEl) return;
  
  // 오늘 메모만 필터
  const today = new Date().toLocaleDateString('ko-KR');
  const todayNotes = notes.filter(n => {
    const d = new Date(n.id).toLocaleDateString('ko-KR');
    return d === today;
  });
  
  if (!todayNotes.length) { listEl.style.display = 'none'; return; }
  listEl.style.display = 'block';
  cardsEl.innerHTML = todayNotes.map(n => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">
      ${n.photo ? `<img src="${n.photo}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">` : '<div style="width:56px;height:56px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">📦</div>'}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px">${n.name}</div>
        <div style="font-size:12px;color:var(--accent);font-weight:700">${fmt(n.price)}원 × 최소${n.minQty}개</div>
        ${n.vendor ? `<div style="font-size:11px;color:var(--text-muted)">${n.vendor}</div>` : ''}
        ${n.memo ? `<div style="font-size:11px;color:var(--text-muted)">${n.memo}</div>` : ''}
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${n.at}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button onclick="loadDirectNote(${n.id})" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-family:inherit">계산</button>
        <button onclick="deleteDirectNote(${n.id})" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:inherit">삭제</button>
      </div>
    </div>
  `).join('');
}

// 사입 메모 → 계산 탭에 자동 입력
function loadDirectNote(id) {
  const notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
  const n = notes.find(x => x.id === id);
  if (!n) return;
  document.getElementById('productName').value = n.name;
  document.getElementById('costPrice').value = n.price;
  recalcMargin();
  showToast(`${n.name} 원가 입력됨`);
  // 온라인 모드로 전환
  setSourcingMode('online', document.getElementById('mode-online'));
}

function deleteDirectNote(id) {
  let notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
  notes = notes.filter(n => n.id !== id);
  localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes));
  renderDirectNotes();
}
```

---

## 신규 기능 4 — 인기상품 섹션 (랭킹 뷰)

### 개념 설명
시중가 조회 결과 중 리뷰/판매량 기준 인기 상품 TOP5 표시

**HTML 추가** (최고가 카드 섹션 아래):
```html
<div class="mp-section" id="mp-popular-section" style="display:none">
  <div class="mp-subtitle">🔥 인기 상품 TOP5 (리뷰 많은 순)</div>
  <div id="mp-popular-list" style="display:flex;flex-direction:column;gap:8px;margin-top:8px"></div>
</div>
```

**JS 추가** (fetchMarketPrice 내부):
```javascript
// 인기 상품: review_count 기준 정렬 (현재 API에서 0이면 가격 기준)
const byPopular = topItems.slice().sort((a,b) => (b.review_count||0) - (a.review_count||0));
const popularSection = document.getElementById('mp-popular-section');
const popularList = document.getElementById('mp-popular-list');
if (popularSection && popularList && byPopular.length) {
  popularSection.style.display = 'block';
  popularList.innerHTML = byPopular.slice(0, 5).map((it, i) => {
    const link = (it.link||'').replace(/^http:/, 'https:');
    return `<a href="${link}" target="_blank" rel="noopener"
      style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;text-decoration:none">
      <div style="font-size:16px;font-weight:900;color:var(--accent);width:24px;text-align:center">${i+1}</div>
      <img src="${(it.image||'').replace(/^http:/, 'https:')}" style="width:44px;height:44px;object-fit:cover;border-radius:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${(it.title||'').slice(0,24)}</div>
        <div style="font-size:13px;font-weight:700;color:var(--accent)">${fmt(it.price||0)}원</div>
        <div style="font-size:11px;color:var(--text-muted)">${it.mall||''}</div>
      </div>
    </a>`;
  }).join('');
}
```

---

## 데이터 저장 — Google Drive 폴더 자동 생성

### Apps Script에 추가할 함수

```javascript
// ========== 구글 드라이브 폴더 자동 생성 ==========
var ROOT_FOLDER_NAME = '셀러마진';

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function organizeGoogleDrive() {
  var root = DriveApp.getRootFolder();
  var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
  
  var now = new Date();
  var year = now.getFullYear() + '년';
  var month = String(now.getMonth() + 1).padStart(2, '0') + '월';
  
  var yearFolder = getOrCreateFolder(rootFolder, year);
  var monthFolder = getOrCreateFolder(yearFolder, month);
  getOrCreateFolder(monthFolder, '영수증');
  getOrCreateFolder(rootFolder, '상품분석');
  getOrCreateFolder(rootFolder, '사입사진');  // ← 사입 관련 폴더 추가
  
  return {
    success: true,
    path: ROOT_FOLDER_NAME + '/' + year + '/' + month,
    rootFolderId: rootFolder.getId(),
    monthFolderId: monthFolder.getId()
  };
}

// 사입 사진 구글 드라이브에 저장 (base64 → Drive 파일)
function saveDirectSourcingPhoto(data) {
  // data: { photoBase64, productName, vendor, price, date }
  try {
    var result = organizeGoogleDrive();
    var root = DriveApp.getRootFolder();
    var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
    var photoFolder = getOrCreateFolder(rootFolder, '사입사진');
    
    var dateStr = data.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    var fileName = dateStr + '_' + (data.productName || '상품') + '_' + (data.price || 0) + '원.jpg';
    
    // base64 디코딩
    var base64 = data.photoBase64.replace(/^data:image\/\w+;base64,/, '');
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName);
    
    var file = photoFolder.createFile(blob);
    return { success: true, fileUrl: file.getUrl(), fileName: fileName };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
```

**doPost 핸들러에 추가:**
```javascript
else if (action === 'saveDirectSourcingPhoto') 
  response.setContent(JSON.stringify(saveDirectSourcingPhoto(body)));
else if (action === 'organizeGoogleDrive') 
  response.setContent(JSON.stringify(organizeGoogleDrive()));
```

**프론트엔드 사입 사진 저장 버튼 추가** (saveDirectSourcingNote 함수 내):
```javascript
// 사진이 있고 Script URL 설정된 경우 → 드라이브에 자동 저장
if (photo && SCRIPT_URL) {
  fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveDirectSourcingPhoto',
      photoBase64: photo,
      productName: name,
      vendor: vendor,
      price: price,
      date: new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')
    })
  }).then(r => r.json()).then(d => {
    if (d.success) showToast('📁 사진이 드라이브에 저장됨');
  }).catch(() => {});
}
```

---

## 신규 기능 5 — 사입 정보 + 사진 → 문서 자동 생성 및 연결

### 개념 설명

사입 메모 저장 시 → **구글 문서(Google Docs)** 1건 자동 생성  
문서 안에 상품사진 + 구매처 + 단가 + 메모 + 마진 분석 결과가 통합 기록됨  
→ 구글 시트 "상품목록"의 해당 행에 문서 링크가 자동으로 연결됨  
→ 나중에 시트에서 링크 클릭하면 해당 사입 문서 바로 열림

```
[사입 현장]                     [앱]                        [구글]
사진 촬영 → 정보 입력 → 저장 → Apps Script 호출 → Google Docs 문서 생성
                                                    ↓
                                              구글 시트 행에 문서 URL 연결
                                              사입사진 폴더에 이미지 저장
```

---

### Apps Script — 핵심 함수 `createDirectSourcingDoc()`

```javascript
// ========== 사입 문서 자동 생성 ==========
function createDirectSourcingDoc(data) {
  /*
  data 구조:
  {
    productName: "버킷햇",
    vendor: "동대문 평화시장 A동 123호",
    unitPrice: 5500,
    minQty: 10,
    memo: "흰색/검정색 2가지, 품질 양호",
    photoBase64: "data:image/jpeg;base64,...",  // 없으면 빈 문자열
    savedAt: "2026-03-01 15:30",
    // 마진 분석 (선택값, 계산 탭에서 넘길 경우)
    marketPrice: { min: 6000, avg: 24500, max: 67900 },
    marginResult: {
      smart:   { salePrice: 18000, profit: 8200, marginRate: 45.6 },
      coupang: { salePrice: 19000, profit: 8800, marginRate: 46.3 },
      open:    { salePrice: 22000, profit: 9500, marginRate: 43.2 }
    }
  }
  */
  try {
    // 1. 드라이브 폴더 준비
    var root = DriveApp.getRootFolder();
    var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
    var now = new Date();
    var year = now.getFullYear() + '년';
    var month = String(now.getMonth() + 1).padStart(2, '0') + '월';
    var yearFolder = getOrCreateFolder(rootFolder, year);
    var monthFolder = getOrCreateFolder(yearFolder, month);
    var docsFolder = getOrCreateFolder(monthFolder, '사입기록');
    var photoFolder = getOrCreateFolder(rootFolder, '사입사진');

    // 2. 사진을 드라이브에 저장 (있는 경우)
    var photoUrl = '';
    var photoFileId = '';
    if (data.photoBase64) {
      var base64 = data.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      var decoded = Utilities.base64Decode(base64);
      var dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd_HHmm');
      var photoName = dateStr + '_' + (data.productName || '상품') + '.jpg';
      var blob = Utilities.newBlob(decoded, 'image/jpeg', photoName);
      var photoFile = photoFolder.createFile(blob);
      photoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = photoFile.getUrl();
      photoFileId = photoFile.getId();
    }

    // 3. Google Docs 문서 생성
    var docTitle = '[사입] ' + (data.productName || '상품') + ' — ' +
                   Utilities.formatDate(now, 'Asia/Seoul', 'yyyy.MM.dd');
    var doc = DocumentApp.create(docTitle);
    var docFile = DriveApp.getFileById(doc.getId());
    docFile.moveTo(docsFolder);

    var body = doc.getBody();
    body.clear();

    // ── 헤더 ──
    var title = body.appendParagraph(docTitle);
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.editAsText().setFontSize(18).setBold(true);

    body.appendParagraph('저장일시: ' + (data.savedAt || Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')))
        .editAsText().setFontSize(11).setForegroundColor('#888888');

    body.appendHorizontalRule();

    // ── 사진 삽입 ──
    if (photoFileId) {
      body.appendParagraph('📷 상품 사진').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      try {
        var imgBlob = DriveApp.getFileById(photoFileId).getBlob();
        var inlineImg = body.appendImage(imgBlob);
        // 이미지 크기 조정 (최대 가로 400px)
        var w = inlineImg.getWidth();
        var h = inlineImg.getHeight();
        if (w > 400) {
          inlineImg.setWidth(400);
          inlineImg.setHeight(Math.round(h * 400 / w));
        }
      } catch(imgErr) {
        body.appendParagraph('(사진 삽입 실패: ' + photoUrl + ')');
      }
      body.appendParagraph('');
    }

    // ── 구매 정보 ──
    body.appendParagraph('🏪 구매 정보').setHeading(DocumentApp.ParagraphHeading.HEADING2);

    var infoTable = body.appendTable([
      ['상품명',   data.productName || '—'],
      ['구매처',   data.vendor      || '—'],
      ['단가',     (data.unitPrice  || 0).toLocaleString() + '원'],
      ['최소수량', (data.minQty     || 1) + '개'],
      ['최소 사입 총액', ((data.unitPrice||0) * (data.minQty||1)).toLocaleString() + '원'],
      ['메모',     data.memo        || '—'],
    ]);

    // 테이블 스타일
    for (var r = 0; r < infoTable.getNumRows(); r++) {
      infoTable.getCell(r, 0)
        .setBackgroundColor('#F0F0F0')
        .editAsText().setBold(true).setFontSize(11);
      infoTable.getCell(r, 1)
        .editAsText().setFontSize(11);
    }
    body.appendParagraph('');

    // ── 시중가 분석 (있는 경우) ──
    if (data.marketPrice && data.marketPrice.avg) {
      body.appendParagraph('📊 시중가 분석').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendTable([
        ['시중 최저가', data.marketPrice.min.toLocaleString() + '원'],
        ['시중 평균가', data.marketPrice.avg.toLocaleString() + '원 ← 추천'],
        ['시중 최고가', data.marketPrice.max.toLocaleString() + '원'],
      ]).getCell(0, 0);
      body.appendParagraph('');
    }

    // ── 마진 계산 결과 (있는 경우) ──
    if (data.marginResult) {
      body.appendParagraph('💰 마진 계산 결과').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var marginRows = [['마켓', '추천 판매가', '순이익', '마진율']];
      var marketNames = { smart: '스마트스토어', coupang: '쿠팡', open: '오픈마켓' };
      for (var mk in data.marginResult) {
        var mr = data.marginResult[mk];
        marginRows.push([
          marketNames[mk] || mk,
          (mr.salePrice || 0).toLocaleString() + '원',
          (mr.profit    || 0).toLocaleString() + '원',
          (mr.marginRate|| 0).toFixed(1) + '%'
        ]);
      }
      var marginTable = body.appendTable(marginRows);
      // 헤더 행 강조
      for (var c = 0; c < 4; c++) {
        marginTable.getCell(0, c)
          .setBackgroundColor('#4ADE80')
          .editAsText().setBold(true).setFontSize(11).setForegroundColor('#0d0f14');
      }
      body.appendParagraph('');
    }

    // ── 판단 메모 ──
    body.appendParagraph('✏️ 판단 및 결정').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('[ ] 소싱 진행   [ ] 보류   [ ] 제외');
    body.appendParagraph('');
    body.appendParagraph('판단 이유: ______________________________');
    body.appendParagraph('');
    body.appendParagraph('결정일: ______________________________');
    body.appendParagraph('');

    doc.saveAndClose();

    // 4. 문서 공유 설정 (링크 있는 사람 누구나 보기)
    docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var docUrl = doc.getUrl();

    // 5. 구글 시트 "사입기록" 시트에 행 추가
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var directSheet = ss.getSheetByName('사입기록');
    if (!directSheet) {
      directSheet = ss.insertSheet('사입기록');
      directSheet.getRange(1, 1, 1, 9).setValues([[
        '저장일시', '상품명', '구매처', '단가', '최소수량', '메모', '사진URL', '문서링크', '처리상태'
      ]]);
      directSheet.getRange(1, 1, 1, 9)
        .setBackground('#4ADE80')
        .setFontColor('#0d0f14')
        .setFontWeight('bold');
    }

    directSheet.appendRow([
      data.savedAt || Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
      data.productName || '',
      data.vendor      || '',
      data.unitPrice   || 0,
      data.minQty      || 1,
      data.memo        || '',
      photoUrl,
      docUrl,          // ← 여기에 문서 링크 자동 삽입
      '검토중'
    ]);

    // 문서 링크를 클릭 가능한 하이퍼링크로 설정
    var lastRow = directSheet.getLastRow();
    var linkCell = directSheet.getRange(lastRow, 8);
    linkCell.setFormula('=HYPERLINK("' + docUrl + '","📄 문서 열기")');

    return {
      success:  true,
      docUrl:   docUrl,
      photoUrl: photoUrl,
      message:  '문서 생성 완료: ' + docTitle
    };

  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
```

---

### doPost 핸들러 추가

```javascript
// 기존 doPost 내부 if-else 체인에 추가
else if (action === 'createDirectSourcingDoc')
  response.setContent(JSON.stringify(createDirectSourcingDoc(body)));
```

---

### 구글 시트 "사입기록" 시트 구조 (자동 생성됨)

| 열 | 내용 | 비고 |
|----|------|------|
| A | 저장일시 | 자동 |
| B | 상품명 | 입력값 |
| C | 구매처 | 입력값 |
| D | 단가 | 숫자 |
| E | 최소수량 | 숫자 |
| F | 메모 | 입력값 |
| G | 사진URL | 드라이브 링크 |
| H | 문서링크 | `=HYPERLINK(...)` 자동 삽입 |
| I | 처리상태 | "검토중" 기본값 → 수동으로 "진행/보류/제외" 변경 |

---

### 프론트엔드 — 사입 저장 시 문서 생성 호출

**`saveDirectSourcingNote()` 함수 내 대체 코드 (기존 단순 저장 → 문서 생성 연동으로 교체):**

```javascript
async function saveDirectSourcingNote() {
  const name     = document.getElementById('productName').value.trim();
  const vendor   = document.getElementById('direct-vendor').value.trim();
  const price    = parseFloat(document.getElementById('direct-unit-price').value) || 0;
  const minQty   = parseInt(document.getElementById('direct-min-qty').value) || 1;
  const memo     = document.getElementById('direct-memo').value.trim();
  const preview  = document.getElementById('direct-photo-preview');
  const photo    = preview?.dataset?.base64 || '';

  if (!name && !price) { showToast('상품명 또는 단가를 입력하세요', true); return; }

  // 1. localStorage에 임시 저장 (오프라인 대응)
  const notes = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
  const noteId = Date.now();
  const savedAt = new Date().toLocaleString('ko-KR', { hour12: false });
  notes.unshift({ id: noteId, name, vendor, price, minQty, memo, photo, at: savedAt.slice(11,16) });
  localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(notes.slice(0, 20)));
  showToast('✅ 임시 저장됨. 문서 생성 중...');
  renderDirectNotes();

  // 2. 현재 마진 계산 결과 수집 (계산이 되어 있는 경우)
  let marginResult = null;
  let marketPrice  = null;
  if (window._lastResult) {
    const lr = window._lastResult;
    const inp = lr.inp;
    marginResult = {};
    for (const mk of lr.activeMarkets) {
      const r = calcForMarket(inp.cost, inp.supShip, inp.mktShip, inp.fees[mk], inp.target);
      const sp = roundTo10(r.salePrice);
      const fee = Math.round(sp * inp.fees[mk] / 100);
      const profit = sp - fee - inp.mktShip - inp.cost - inp.supShip;
      marginResult[mk] = {
        salePrice:  sp,
        profit:     profit,
        marginRate: sp > 0 ? (profit / sp * 100) : 0
      };
    }
  }
  // 시중가 데이터 수집
  const mpMin = document.getElementById('mp-min')?.textContent?.replace(/[^0-9]/g,'');
  const mpAvg = document.getElementById('mp-avg')?.textContent?.replace(/[^0-9]/g,'');
  const mpMax = document.getElementById('mp-max')?.textContent?.replace(/[^0-9]/g,'');
  if (mpAvg && parseInt(mpAvg) > 0) {
    marketPrice = {
      min: parseInt(mpMin) || 0,
      avg: parseInt(mpAvg) || 0,
      max: parseInt(mpMax) || 0,
    };
  }

  // 3. Script URL 있으면 Apps Script 호출 → 문서 자동 생성
  if (!SCRIPT_URL) {
    showToast('설정에서 Script URL을 입력하면 문서 자동 생성됩니다', false);
    return;
  }

  try {
    const payload = {
      action:        'createDirectSourcingDoc',
      productName:   name,
      vendor,
      unitPrice:     price,
      minQty,
      memo,
      photoBase64:   photo,
      savedAt,
      marketPrice,
      marginResult,
    };

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      // localStorage 메모에 문서 URL 업데이트
      const ns = JSON.parse(localStorage.getItem(DIRECT_NOTES_KEY) || '[]');
      const target = ns.find(n => n.id === noteId);
      if (target) { target.docUrl = data.docUrl; }
      localStorage.setItem(DIRECT_NOTES_KEY, JSON.stringify(ns));

      showToast('📄 문서 생성 완료!');
      renderDirectNotes(); // 문서 링크 버튼 업데이트

      // 문서 바로 열기 버튼 표시
      if (data.docUrl) {
        const btn = document.createElement('button');
        btn.textContent = '📄 생성된 문서 열기';
        btn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:9999;padding:12px 16px;background:var(--accent);color:#0d0f14;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
        btn.onclick = () => { window.open(data.docUrl, '_blank'); document.body.removeChild(btn); };
        document.body.appendChild(btn);
        setTimeout(() => { if (btn.parentNode) document.body.removeChild(btn); }, 8000);
      }
    } else {
      showToast('문서 생성 실패: ' + (data.error || ''), true);
    }
  } catch(e) {
    showToast('네트워크 오류 — 로컬에만 저장됨', false);
  }

  // 폼 초기화
  ['direct-vendor','direct-unit-price','direct-min-qty','direct-memo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const preview2 = document.getElementById('direct-photo-preview');
  if (preview2) { preview2.style.display = 'none'; preview2.dataset.base64 = ''; }
}
```

---

### 사입 메모 목록에 "문서 열기" 버튼 추가

**`renderDirectNotes()` 함수 내 카드 HTML 수정:**

```javascript
// 기존 버튼 영역 교체
`<div style="display:flex;flex-direction:column;gap:4px">
  <button onclick="loadDirectNote(${n.id})"
    style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-family:inherit">
    📊 계산
  </button>
  ${n.docUrl ? `
  <button onclick="window.open('${n.docUrl}','_blank')"
    style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:inherit">
    📄 문서
  </button>` : `
  <button style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:default;font-family:inherit;opacity:0.5">
    ⏳ 생성중
  </button>`}
  <button onclick="deleteDirectNote(${n.id})"
    style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:inherit">
    🗑️ 삭제
  </button>
</div>`
```

---

### 생성되는 구글 문서 최종 구조

```
[사입] 버킷햇 — 2026.03.01
저장일시: 2026-03-01 15:30
─────────────────────────────

📷 상품 사진
[사진 이미지 400px]

🏪 구매 정보
┌──────────┬──────────────────────────────┐
│ 상품명   │ 버킷햇                       │
│ 구매처   │ 동대문 평화시장 A동 123호    │
│ 단가     │ 5,500원                      │
│ 최소수량 │ 10개                         │
│ 최소총액 │ 55,000원                     │
│ 메모     │ 흰색/검정색 2가지, 품질 양호 │
└──────────┴──────────────────────────────┘

📊 시중가 분석
┌──────────┬────────────┐
│ 최저가   │ 6,000원    │
│ 평균가   │ 24,500원 ← 추천 │
│ 최고가   │ 67,900원   │
└──────────┴────────────┘

💰 마진 계산 결과
┌────────────────┬────────────┬────────┬──────┐
│ 마켓           │ 추천 판매가 │ 순이익 │ 마진율│
│ 스마트스토어   │ 18,000원   │ 8,200원│ 45.6%│
│ 쿠팡           │ 19,000원   │ 8,800원│ 46.3%│
│ 오픈마켓       │ 22,000원   │ 9,500원│ 43.2%│
└────────────────┴────────────┴────────┴──────┘

✏️ 판단 및 결정
[ ] 소싱 진행   [ ] 보류   [ ] 제외

판단 이유: ______________________________

결정일: ______________________________
```

---

### 체크리스트 추가 항목

**Apps Script:**
- [ ] `createDirectSourcingDoc(data)` 함수 추가
- [ ] `doPost`에 `createDirectSourcingDoc` action 추가
- [ ] "사입기록" 시트 자동 생성 로직 포함 (첫 실행 시)

**seller-dashboard-v3.html:**
- [ ] `saveDirectSourcingNote()` — 문서 생성 호출 버전으로 전체 교체
- [ ] `renderDirectNotes()` — "📄 문서" 버튼 추가 (docUrl 있을 때)
- [ ] 생성 완료 후 플로팅 "문서 열기" 버튼 표시 (8초 후 자동 사라짐)

---

## 최종 구현 체크리스트

### main.py
- [ ] `/search` — `display` 기본값 30으로 변경, `top_items` 전체 반환
- [ ] `/related` — 연관검색어 반환 엔드포인트 신규 추가
- [ ] `/wholesale` — 도매 상품 검색 엔드포인트 신규 추가
- [ ] `/target` — 타겟층 추정 엔드포인트 신규 추가 (이전 지시서 참고)
- [ ] `/trend` 또는 `/search?include_trend=true` — 트렌드 신규 추가 (이전 지시서 참고)

### seller-dashboard-v3.html
- [ ] 🐛 최고가 카드 섹션 HTML + JS 추가
- [ ] 🐛 상품 카드 수 증가 (display=30 반영)
- [ ] 연관검색어 칩 (debounce 입력 → 칩 표시 → 클릭 시 자동 조회)
- [ ] 도매 소싱 섹션 (탭 3개 + 카드 + "원가 적용" 버튼)
- [ ] 인기상품 TOP5 리스트
- [ ] 소싱 모드 토글 (온라인/사입)
- [ ] 사입 섹션 (사진 촬영, 구매처, 단가, 최소수량, 메모)
- [ ] 사입 임시저장 + 목록 표시 + 계산 탭 연결

### Apps Script
- [ ] `organizeGoogleDrive()` 실제 구현 (placeholder → 동작 코드)
- [ ] `createDirectSourcingDoc(data)` 신규 추가 ← **핵심**
- [ ] `saveDirectSourcingPhoto()` → `createDirectSourcingDoc` 내부에 통합됨
- [ ] `doPost` 핸들러에 `createDirectSourcingDoc` action 추가
- [ ] "사입기록" 시트 자동 생성 (첫 실행 시) + H열에 `=HYPERLINK()` 문서링크 자동 삽입

---

## 절대 변경 금지
- 다크 테마 CSS 변수, CLIENT_ID, MARKET_INFO, calcForMarket(), recalcMargin(), 구글 시트 ID, localStorage key 구조

---

*이전 지시서: cursor_수정지시서_v3_5_login_realtime.md 참고*  
*시스템 전체 현황: SYSTEM_DESIGN_v2.md 참고*


---

## 신규 기능 6 — 상품 카드에 사진 연결 (소싱목록 + 판매관리)

### 개념 설명

사입 시 찍은 사진 또는 네이버 쇼핑 대표 이미지가  
소싱목록 카드 / 판매관리 카드에 함께 표시되는 구조

```
[사진 출처 2가지]
① 사입 사진  → 현장에서 직접 촬영 → 드라이브 업로드 → photoUrl 저장
② 시중가 이미지 → fetchMarketPrice() 결과 top_items[0].image → thumbnailUrl 저장

[연결 흐름]
saveProduct() 호출 시
  → photoUrl (사입사진 드라이브 링크) 또는
    thumbnailUrl (네이버 대표 이미지) 함께 전송
  → Apps Script: 상품목록 시트 T열(사진링크) 저장
  → loadProducts()로 불러올 때 photoUrl 포함
  → renderList()에서 카드 상단에 이미지 표시
```

---

### 1단계 — 상품목록 시트 컬럼 확장

**Apps Script `PRODUCT_HEADERS` 배열에 컬럼 2개 추가:**

```javascript
// 변경 전 (19개 컬럼)
var PRODUCT_HEADERS = [
  'ID','상품명','원가','도매배송비','마켓배송비','마켓','수수료(%)','판매가',
  '수수료금액','순이익','마진율(%)','저장일시','저장자',
  '카테고리','경쟁강도','시중최저가','시중평균가','판매결정','판매시작일'
];

// 변경 후 (21개 컬럼)
var PRODUCT_HEADERS = [
  'ID','상품명','원가','도매배송비','마켓배송비','마켓','수수료(%)','판매가',
  '수수료금액','순이익','마진율(%)','저장일시','저장자',
  '카테고리','경쟁강도','시중최저가','시중평균가','판매결정','판매시작일',
  '사진링크',      // T열 (20번째) — 드라이브 사입사진 또는 네이버 썸네일
  '사입문서링크'   // U열 (21번째) — Google Docs 사입 문서 URL
];
var PRODUCT_COLS = 21; // 기존 19 → 21로 변경
```

---

### 2단계 — Apps Script `saveProduct()` 함수 수정

```javascript
function saveProduct(data) {
  const sheet = initSheet();
  data.products.forEach(function (p) {
    const row = [
      p.id, p.name, p.cost, p.supShip, p.mktShip,
      p.market, p.fee, p.salePrice, p.feeAmt,
      p.profit, p.margin, p.savedAt, p.savedBy || '남편',
      p.category || '', p.competitionLevel || '',
      p.minMarketPrice || '', p.avgMarketPrice || '',
      p.sellDecision || 'N', p.sellStartDate || '',
      p.photoUrl    || '',   // ← 신규: T열 사진링크
      p.docUrl      || ''    // ← 신규: U열 사입문서링크
    ];
    sheet.appendRow(row);
    const rowNum = sheet.getLastRow();

    // 사진링크가 있으면 T열을 클릭 가능한 이미지 링크로 설정
    if (p.photoUrl) {
      sheet.getRange(rowNum, 20)
        .setFormula('=HYPERLINK("' + p.photoUrl + '","📷 사진")');
    }
    // 문서링크가 있으면 U열을 클릭 가능한 링크로 설정
    if (p.docUrl) {
      sheet.getRange(rowNum, 21)
        .setFormula('=HYPERLINK("' + p.docUrl + '","📄 문서")');
    }

    const bgColor = p.margin >= 20 ? '#c6efce' : p.margin >= 10 ? '#ffeb9c' : '#ffc7ce';
    sheet.getRange(rowNum, 1, 1, PRODUCT_COLS)
      .setBackground(bgColor).setFontColor('#1a1a1a');
  });
  return { success: true };
}
```

---

### 3단계 — 프론트엔드 `saveProduct()` 함수 수정

**`toSave` 배열 생성 부분에 photoUrl, docUrl 추가:**

```javascript
// window._lastSearch에 이미지 정보도 저장해야 함
// fetchMarketPrice() 끝부분에 추가:
window._lastSearch = {
  ...window._lastSearch,
  thumbnailUrl: search.top_items?.[0]?.image?.replace(/^http:/, 'https:') || '',
};

// saveProduct() 내 toSave 배열에 추가:
const toSave = activeMarkets.map(k => {
  // ... 기존 필드들 ...
  return {
    // 기존 필드 유지
    id: Date.now() + Math.random(),
    name: inp.name,
    // ... (생략) ...

    // ← 신규 추가
    photoUrl: window._lastSearch?.photoUrl      || // 사입 사진 (드라이브)
              window._lastSearch?.thumbnailUrl   || // 네이버 대표 이미지
              '',
    docUrl:   window._lastSearch?.docUrl        || '', // 사입 문서 링크
  };
});
```

**사입 모드에서 저장 완료 후 `_lastSearch`에 사진 정보 주입:**

```javascript
// saveDirectSourcingNote() 내 문서 생성 성공 후에 추가:
if (data.success) {
  // 기존 코드 ...

  // ← 추가: 이후 saveProduct() 호출 시 사진/문서 링크 자동 포함
  window._lastSearch = window._lastSearch || {};
  window._lastSearch.photoUrl = data.photoUrl || '';
  window._lastSearch.docUrl   = data.docUrl   || '';
}
```

---

### 4단계 — `loadProducts()` 응답에 photoUrl, docUrl 포함

**Apps Script `getProducts()` 함수 수정:**

```javascript
function getProducts() {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, products: [] };

  const colCount = Math.max(PRODUCT_COLS, sheet.getLastColumn());
  const rows = sheet.getRange(2, 1, last - 1, colCount).getValues();

  return {
    success: true,
    products: rows
      .filter(r => r[0])
      .map(r => ({
        id:               String(r[0]),
        name:             r[1]  || '',
        cost:             r[2]  || 0,
        supShip:          r[3]  || 0,
        mktShip:          r[4]  || 0,
        market:           r[5]  || '',
        fee:              r[6]  || 0,
        salePrice:        r[7]  || 0,
        feeAmt:           r[8]  || 0,
        profit:           r[9]  || 0,
        margin:           r[10] || 0,
        savedAt:          r[11] || '',
        savedBy:          r[12] || '',
        category:         r[13] || '',
        competitionLevel: r[14] || '',
        minMarketPrice:   r[15] || '',
        avgMarketPrice:   r[16] || '',
        sellDecision:     r[17] || 'N',
        sellStartDate:    r[18] || '',
        photoUrl:         String(r[19] || '').replace(/^=HYPERLINK\("([^"]+)".*/, '$1'), // ← 신규
        docUrl:           String(r[20] || '').replace(/^=HYPERLINK\("([^"]+)".*/, '$1'), // ← 신규
      }))
  };
}
```

> HYPERLINK 수식이 저장되어 있으므로 URL만 추출하는 정규식 처리 필요

---

### 5단계 — `renderList()` 카드에 이미지 표시

**소싱목록 카드 HTML 수정 (`renderList()` 내부):**

```javascript
cards.innerHTML = filtered.map(p => {
  const bc = p.margin >= 20 ? 'badge-good' : p.margin >= 10 ? 'badge-warn' : 'badge-bad';
  const mcClass = p.market === '스마트스토어' ? 'smart' : p.market === '쿠팡' ? 'coupang' : 'open';
  const compLabel = p.competitionLevel
    ? (p.competitionLevel === '낮음' ? '🟢' : p.competitionLevel === '높음' ? '🔴' : '🟡') + ' ' + p.competitionLevel
    : '';
  const startBtn = isSell(p)
    ? '<span style="font-size:11px;color:var(--accent)">✓ 판매중</span>'
    : `<button class="start-sell-btn" onclick="startSell('${p.id}')">판매 시작</button>`;

  // ← 신규: 사진 영역
  const photoSection = p.photoUrl
    ? `<div style="position:relative;width:100%;height:120px;margin-bottom:10px;border-radius:10px;overflow:hidden;background:var(--surface2)">
        <img src="${p.photoUrl}" alt="${p.name}"
          style="width:100%;height:100%;object-fit:cover"
          onerror="this.parentElement.style.display='none'">
        ${p.docUrl
          ? `<a href="${p.docUrl}" target="_blank" rel="noopener"
              style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.7);color:#fff;
                     font-size:11px;padding:3px 8px;border-radius:6px;text-decoration:none">
              📄 문서
            </a>`
          : ''}
        <div style="position:absolute;top:6px;left:6px;background:rgba(13,15,20,0.8);
                    color:var(--accent);font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px">
          ${p.photoUrl.includes('drive.google.com') ? '🏪 사입' : '🛒 온라인'}
        </div>
      </div>`
    : '';

  return `<div class="product-card">
    ${photoSection}
    <div class="pc-header">
      <div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-date">${p.savedAt || ''}</div>
        <div class="pc-by">저장: ${p.savedBy || ''} ${p.category ? ' · ' + p.category : ''} ${compLabel ? ' · ' + compLabel : ''}</div>
      </div>
      <span class="margin-badge ${bc}">${fmtPct(p.margin)}</span>
    </div>
    <div class="pc-grid">
      <div class="pc-item"><div class="pc-item-label">원가</div><div class="pc-item-val">${fmt(p.cost)}원</div></div>
      <div class="pc-item"><div class="pc-item-label">판매가</div><div class="pc-item-val">${fmt(p.salePrice)}원</div></div>
      <div class="pc-item"><div class="pc-item-label">순이익</div><div class="pc-item-val" style="color:${p.profit>=0?'var(--accent)':'var(--danger)'}">${fmt(p.profit)}원</div></div>
    </div>
    <div class="pc-footer">
      <span class="margin-badge" style="background:color-mix(in srgb,var(--${mcClass}) 15%,transparent);color:var(--${mcClass})">${p.market}</span>
      <div style="display:flex;align-items:center;gap:8px">${startBtn}<button class="del-btn" onclick="deleteProduct('${p.id}')">삭제</button></div>
    </div>
  </div>`;
}).join('');
```

**사진 있는 카드의 CSS 보완:**

```css
/* 사진 있는 카드는 이미지가 상단 전체 차지 */
.product-card { overflow: hidden; }
```

---

### 6단계 — 판매관리 탭 카드에도 동일하게 적용

**`loadSalesPage()` 내 카드 HTML에 동일한 `photoSection` 패턴 적용:**

```javascript
// 소싱목록과 동일한 photoSection 코드를 판매관리 카드에도 삽입
// p.photoUrl, p.docUrl 동일하게 사용 가능 (products 배열에서 불러오므로)
```

---

### 최종 데이터 흐름 전체 요약

```
[온라인 소싱]
시중가 조회
  → top_items[0].image → window._lastSearch.thumbnailUrl 저장
  → 저장 버튼 → photoUrl = thumbnailUrl → 시트 T열 + 카드 이미지

[사입 소싱]
현장 사진 촬영
  → base64 → Apps Script → 드라이브 사입사진 폴더 업로드 → photoUrl(드라이브 링크)
  → Google Docs 생성 → docUrl
  → window._lastSearch.photoUrl, docUrl 저장
  → 저장 버튼 → 시트 T열(사진링크), U열(문서링크) + 카드 이미지

[소싱목록 카드 표시]
loadProducts() → getProducts() → photoUrl, docUrl 파싱
  → renderList() → 카드 상단 이미지 120px
    - 드라이브 사진: "🏪 사입" 뱃지
    - 네이버 이미지: "🛒 온라인" 뱃지
    - 문서있으면: "📄 문서" 링크 버튼 (이미지 우하단)

[구글 시트 상품목록]
T열: =HYPERLINK("드라이브URL","📷 사진")  ← 클릭 시 사진 열림
U열: =HYPERLINK("docs URL","📄 문서")    ← 클릭 시 사입문서 열림
```

---

### 이 기능의 체크리스트

**Apps Script:**
- [ ] `PRODUCT_HEADERS` 배열에 `'사진링크'`, `'사입문서링크'` 추가 (T열, U열)
- [ ] `PRODUCT_COLS` 값 19 → 21로 변경
- [ ] `saveProduct()` — row 배열 끝에 `p.photoUrl`, `p.docUrl` 추가
- [ ] `saveProduct()` — T열/U열에 `=HYPERLINK()` 수식 삽입
- [ ] `getProducts()` — r[19], r[20] 파싱 + HYPERLINK 정규식 처리

**seller-dashboard-v3.html:**
- [ ] `fetchMarketPrice()` — `thumbnailUrl` 을 `window._lastSearch`에 저장
- [ ] `saveDirectSourcingNote()` — 완료 후 `window._lastSearch.photoUrl/docUrl` 세팅
- [ ] `saveProduct()` — `toSave` 배열에 `photoUrl`, `docUrl` 추가
- [ ] `renderList()` — `photoSection` HTML 삽입 (사진 + 뱃지 + 문서링크)
- [ ] `loadSalesPage()` — 동일한 `photoSection` 적용
