# 셀러 마진 계산기 — 전체 구축 가이드 + Cursor 통합 지시서

> 이 문서 하나로 모든 구축을 완료할 수 있습니다.  
> **순서대로** 실행하세요. 건너뛰면 뒤 단계가 작동하지 않습니다.

---

## 📋 구축 순서 한눈에 보기

```
STEP 1  GitHub 저장소 확인/정리
STEP 2  Google Cloud Console 설정     ← 직접 실행 (5분)
STEP 3  네이버 API 발급               ← 직접 실행 (3분)
STEP 4  Apps Script 설치              ← Cursor 작업 후 직접 배포
STEP 5  Render 백엔드 배포            ← Cursor 작업 후 직접 배포
STEP 6  Netlify 프론트 배포           ← Cursor 작업 후 직접 배포
STEP 7  앱에서 전체 초기화 실행       ← 앱 버튼 1번 클릭 (자동)
           ├ 구글 시트 탭 7개 자동 생성
           └ 구글 드라이브 폴더 구조 자동 생성
STEP 8  앱 설정 탭 나머지 입력        ← 직접 실행 (2분)
STEP 9  전체 연결 테스트              ← 직접 실행 (5분)
```

> ✅ 구글 시트 탭 / 드라이브 폴더는 앱 버튼으로 자동 생성됩니다. 수동 작업 불필요.

---

## STEP 1 — GitHub 저장소 확인

**현재 저장소:** https://github.com/filmkrcho-cyber/seller-margin-api

필요한 파일 2개가 있는지 확인:
- `seller-dashboard-v3.html` (프론트엔드)
- `main.py` (백엔드)

없으면 Cursor에게 아래 "Cursor 통합 지시서" 실행 후 파일 업로드.

---

## STEP 2 — Google Cloud Console 설정 ⭐ 직접 실행

**접속:** https://console.cloud.google.com

1. 왼쪽 메뉴 → `API 및 서비스` → `사용자 인증 정보`
2. OAuth 2.0 클라이언트 ID 클릭 (기존 것)
3. **승인된 JavaScript 원본** 에 추가:
   ```
   https://ohnayu-sketch.github.io/seller-margin-api/
   ```
4. **승인된 리디렉션 URI** 에 추가:
   ```
   https://ohnayu-sketch.github.io/seller-margin-api/
   https://ohnayu-sketch.github.io/seller-margin-api/
   ```
5. `저장` → **10분 대기**

---

## STEP 3 — 네이버 API 발급 ⭐ 직접 실행

**현재 발급된 키 (이미 있음):**
- Client ID: `U1mSVClo9bwFBunvuERp`
- Client Secret: `nk6YqwnDWI`

Render 환경변수에 아래 값 입력 (STEP 5 이후):
- `NAVER_CLIENT_ID` = `U1mSVClo9bwFBunvuERp`
- `NAVER_CLIENT_SECRET` = `nk6YqwnDWI`

---

## STEP 4 — Apps Script 설치 ⭐ Cursor 작업 후 직접 배포

### 4-1. Cursor에게 아래 "Cursor 통합 지시서" 전달하여 코드 생성

### 4-2. 생성된 Apps Script 코드 설치

1. 구글 시트 접속 (`1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg`)
2. 상단 메뉴 `확장 프로그램` → `Apps Script`
3. 기존 코드 전체 선택 후 삭제
4. Cursor가 생성한 코드 붙여넣기
5. 저장 (Ctrl+S)

### 4-3. 배포

1. `배포` → `새 배포`
2. 유형: `웹 앱`
3. 실행 계정: `나`
4. 액세스 권한: `모든 사람`
5. `배포` 클릭
6. **배포 URL 복사** → STEP 8에서 앱에 입력

---

## STEP 5 — Render 백엔드 배포

**접속:** https://render.com → 기존 서비스

환경변수 확인 (`Environment` 탭):
```
NAVER_CLIENT_ID     = U1mSVClo9bwFBunvuERp
NAVER_CLIENT_SECRET = nk6YqwnDWI
PORT                = 10000
```

Cursor가 `main.py` 수정 후 → GitHub push → Render 자동 배포

---

## STEP 6 — Netlify 프론트 배포

Cursor가 `seller-dashboard-v3.html` 수정 완료 후:
1. Netlify 접속 → 해당 사이트
2. `Deploys` 탭 → 파일 드래그 배포

---

## STEP 7 — 앱에서 전체 초기화 실행 ⭐ 버튼 1번 클릭

> 구글 시트 탭 생성, 드라이브 폴더 생성을 앱이 자동으로 처리합니다.

1. 앱 접속 → 구글 로그인
2. `⚙️ 설정` 탭 이동
3. Step 3 — Apps Script URL 입력 후 저장
4. **"🚀 전체 초기화 실행"** 버튼 클릭
5. 완료 화면 확인:

```
📊 구글 시트 탭 (자동 생성)
  ✅ 상품목록 (기존 유지)
  ✅ 판매기록 (기존 유지)
  ✅ 매입매출 (기존 유지)
  ✅ 월별통계 (기존 유지)
  🆕 사입기록 생성
  🆕 공급업체 생성
  ✅ 설정 (기존 유지)

📁 구글 드라이브 (자동 생성)
  🆕 셀러마진/ 생성
  🆕 셀러마진/사입사진/ 생성
  🆕 셀러마진/상품분석/ 생성
  🆕 셀러마진/2026년/03월/ 생성
  🆕 셀러마진/2026년/03월/영수증/ 생성
  🆕 셀러마진/2026년/03월/사입기록/ 생성
```

> ⚡ 이미 있는 시트/폴더는 건드리지 않습니다 (기존 데이터 보존)

---

## STEP 8 — 앱 설정 탭 나머지 입력 ⭐ 직접 실행

앱 → `⚙️ 설정` 탭:

| 항목 | 입력값 |
|------|--------|
| Script URL | Apps Script 배포 URL (STEP 4-3에서 복사) |
| API URL | `https://seller-margin-api-georgia.onrender.com` |
| 이메일 1 | 남편 구글 이메일 |
| 이메일 2 | 아내 구글 이메일 |

---

## STEP 9 — 전체 연결 테스트 ⭐ 직접 실행

아래 순서로 테스트:

```
□ 1. 로그인 정상 작동
□ 2. 계산 탭 → "모자" 입력 → 시중가 조회 → 상품 이미지 카드 표시
□ 3. 연관검색어 칩 표시 확인
□ 4. 도매 소싱 섹션 표시 확인
□ 5. 원가 입력 → 마진 실시간 계산
□ 6. 구글 시트에 저장 → 시트에 행 추가 확인
□ 7. 소싱목록 탭 → 저장된 상품 카드 표시
□ 8. 사입 모드 → 사진 촬영 → 저장 → 시트 확인
□ 9. 공급업체 등록 → 공급업체 시트 확인
□ 10. 위탁 등록 → 판매관리 탭 확인
```

---

---

# 🤖 Cursor 통합 지시서

> 아래 내용을 Cursor에 붙여넣고 "이 설계대로 전부 구현해줘"라고 하세요.

---

## 현재 환경 (변경 금지)

```
Frontend  : seller-dashboard-v3.html (Netlify)
            URL: https://ohnayu-sketch.github.io/seller-margin-api/
Backend   : main.py (Python FastAPI, Render)
            URL: https://seller-margin-api-georgia.onrender.com
GitHub    : https://github.com/filmkrcho-cyber/seller-margin-api
Sheet ID  : 1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg
Client ID : 985307778387-1v16a641sg34lsmsdbliamfcettauto6.apps.googleusercontent.com
Naver ID  : U1mSVClo9bwFBunvuERp
Naver PW  : nk6YqwnDWI
```

---

## 절대 변경 금지

- 다크 테마 CSS 변수 (`--accent: #4ade80`, `--surface`, `--border` 등)
- `CLIENT_ID` 값
- `SHEET_ID` 값
- `MARKET_INFO` 객체 (3개 마켓 수수료 구조)
- `calcForMarket()` 함수 시그니처
- `recalcMargin()` 함수
- localStorage key 구조 (`search-history-v2`, `direct-sourcing-notes` 등)
- 탭 ID (`page-calc`, `page-list`, `page-sales`, `page-accounting`, `page-stats`, `page-setup`)

---

## 구글 시트 탭 구조 (Apps Script에서 자동 초기화)

```
상품목록  — 26열 (기존 19 + 사진링크/문서링크/소싱유형/납기/결제조건/위탁가능/담당자)
판매기록  — 11열 (기존 유지)
매입매출  — 9열 (기존 유지)
월별통계  — 8열 (기존 유지)
설정      — 기존 유지
사입기록  — 19열 (신규)
공급업체  — 16열 (신규)
```

---

## [main.py] 추가/수정할 엔드포인트

### 1. `/search` 수정

```python
# 변경 전
async def search_product(query: str, display: int = 10):
    params = {"query": query, "display": min(display, 30), "sort": "sim"}
    top_items = [ ... for it in items[:10] ]

# 변경 후
async def search_product(query: str, display: int = 30, include_trend: bool = False):
    params = {"query": query, "display": min(display, 100), "sort": "sim"}
    top_items = [ ... for it in items ]  # 슬라이싱 제거
```

### 2. `/related` 신규 추가

```python
@app.get("/related")
async def get_related_keywords(query: str):
    """
    상품명 입력 시 연관검색어 반환.
    카테고리별 키워드 맵 + 네이버 검색결과 기반.
    반환: { "success": true, "keywords": ["버킷햇", "야구모자", ...] }
    """
    KEYWORD_MAP = {
        "모자": ["버킷햇", "야구모자", "볼캡", "비니", "썬캡", "페도라", "베레모", "등산모자"],
        "가방": ["크로스백", "숄더백", "백팩", "토트백", "클러치", "에코백", "미니백", "패니팩"],
        "신발": ["운동화", "슬리퍼", "샌들", "부츠", "로퍼", "스니커즈", "구두"],
        "옷": ["반팔티", "맨투맨", "후드집업", "청바지", "레깅스", "원피스", "자켓", "패딩"],
        "이어폰": ["무선이어폰", "블루투스이어폰", "노이즈캔슬링", "오픈형이어폰"],
        "충전기": ["고속충전기", "무선충전기", "멀티충전기", "C타입충전기"],
    }
    keywords = []
    for key, vals in KEYWORD_MAP.items():
        if key in query or query in key:
            keywords = vals[:8]
            break
    if not keywords:
        try:
            result = await search_product(query, display=10)
            if result.get("success") and result.get("top_items"):
                from collections import Counter
                words = []
                for it in result["top_items"][:5]:
                    words.extend(it["title"].split())
                keywords = [w for w, c in Counter(words).most_common(10) if len(w) >= 2 and w != query][:8]
        except:
            pass
    if not keywords:
        keywords = [query + s for s in ["추천", "인기", "저렴한", "고급", "세트"]]
    return {"success": True, "keywords": keywords[:8]}
```

### 3. `/wholesale` 신규 추가

```python
@app.get("/wholesale")
async def wholesale_search(query: str, site: str = "naver_store"):
    """
    도매 상품 검색.
    site: naver_store(도매꾹), kmall(도매토피아), gmarket_wholesale(오너클랜)
    반환: { "success": true, "items": [{name, price, image, link, mall, min_qty}], "site_url": "" }
    """
    wholesale_query = f"{query} 도매" if site == "naver_store" else f"{query} 대량구매"
    url = "https://openapi.naver.com/v1/search/shop.json"
    params = {"query": wholesale_query, "display": 20, "sort": "asc"}
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=_naver_headers(), params=params)
        data = res.json()
    if "items" not in data:
        return {"success": False, "items": []}
    def clean(t): return (t or "").replace("<b>", "").replace("</b>", "")
    items = [{"name": clean(it.get("title")), "price": int(it.get("lprice", 0)),
              "image": it.get("image", ""), "link": it.get("link", ""),
              "mall": it.get("mallName", ""), "min_qty": 1}
             for it in data["items"] if int(it.get("lprice", 0)) > 0]
    site_links = {
        "naver_store": f"https://domeggook.com/search?keyword={query}",
        "kmall": f"https://www.domaepia.com/search/product?q={query}",
        "gmarket_wholesale": f"https://www.ownerclan.com/search?keyword={query}",
    }
    return {"success": True, "items": items[:15], "site_url": site_links.get(site, "")}
```

### 4. `/target` 신규 추가

```python
@app.get("/target")
async def get_target_audience(query: str, category: str = ""):
    """
    카테고리 기반 타겟층 추정.
    반환: { "gender": {"female": 65, "male": 35}, "age_groups": {...}, "main_target": "20~30대 여성" }
    """
    cat = category or query
    TARGET_MAP = {
        "의류": {"female": 70, "male": 30, "ages": {"10대": 10, "20대": 45, "30대": 30, "40대": 15}, "main": "20~30대 여성"},
        "화장품": {"female": 85, "male": 15, "ages": {"10대": 15, "20대": 50, "30대": 30, "40대": 5}, "main": "20~30대 여성"},
        "가방": {"female": 65, "male": 35, "ages": {"20대": 40, "30대": 35, "40대": 25}, "main": "20~40대 여성"},
        "모자": {"female": 55, "male": 45, "ages": {"10대": 5, "20대": 41, "30대": 35, "40대": 14, "50대+": 5}, "main": "20~30대"},
        "신발": {"female": 50, "male": 50, "ages": {"10대": 10, "20대": 40, "30대": 35, "40대": 15}, "main": "20~30대"},
        "전자기기": {"female": 35, "male": 65, "ages": {"20대": 30, "30대": 40, "40대": 25, "50대+": 5}, "main": "30~40대 남성"},
        "식품": {"female": 60, "male": 40, "ages": {"20대": 20, "30대": 40, "40대": 30, "50대+": 10}, "main": "30~40대"},
        "생활용품": {"female": 65, "male": 35, "ages": {"20대": 15, "30대": 40, "40대": 35, "50대+": 10}, "main": "30~40대 여성"},
    }
    matched = next((v for k, v in TARGET_MAP.items() if k in cat), TARGET_MAP["생활용품"])
    return {
        "success": True,
        "gender": {"female": matched["female"], "male": matched["male"]},
        "age_groups": matched["ages"],
        "main_target": matched["main"]
    }
```

### 5. `/search` 에 트렌드 데이터 포함

```python
# /search 반환값에 include_trend=True 시 추가
if include_trend:
    now = datetime.now()
    month = now.month
    SEASON_MAP = {(3,4,5): ("봄","🌸","봄 시즌 수요 상승"), (6,7,8): ("여름","☀️","여름 성수기"),
                  (9,10,11): ("가을","🍂","가을 시즌"), (12,1,2): ("겨울","❄️","겨울 시즌")}
    season_info = next((v for k, v in SEASON_MAP.items() if month in k), ("봄","🌸","시즌"))
    # 월별 수요 지수 (카테고리별 다르게 — 여기선 기본값)
    monthly = [70,65,80,90,85,75,70,72,85,90,80,75]
    result["trend"] = {"success": True, "season": season_info[0], "season_icon": season_info[1],
                       "season_desc": season_info[2], "monthly_data": monthly}
```

---

## [seller-dashboard-v3.html] 추가/수정 기능 목록

### Apps Script 코드 섹션 수정

#### 1. 상수 추가

```javascript
const SHEET_DIRECT = '사입기록';
const SHEET_VENDOR = '공급업체';
const ROOT_FOLDER_NAME = '셀러마진';
const PRODUCT_COLS = 26;  // 기존 19 → 26
```

#### 2. PRODUCT_HEADERS 26개로 확장

```javascript
var PRODUCT_HEADERS = [
  'ID','상품명','원가','도매배송비','마켓배송비','마켓','수수료(%)','판매가',
  '수수료금액','순이익','마진율(%)','저장일시','저장자',
  '카테고리','경쟁강도','시중최저가','시중평균가','판매결정','판매시작일',
  '사진링크','사입문서링크','소싱유형','납기리드타임','결제조건','위탁가능','담당자연락처'
];
```

#### 3. initDirectSheet() 신규 추가

```javascript
// 사입기록 시트 초기화 (19열)
// 헤더: 저장일시/상품명/공급업체ID/공급업체명/단가/최소수량/최소사입총액/
//       납기리드타임/결제조건/위탁가능여부/메모/사진링크/소싱결과/
//       위탁등록일시/등록마켓/판매가/마진율/저장자/상품목록ID
// 색상: 헤더 배경 #0d0f14, 글자 #4ade80
// 컬럼 너비 개별 설정
// setFrozenRows(1)
```

#### 4. initVendorSheet() 신규 추가

```javascript
// 공급업체 시트 초기화 (16열)
// 헤더: 업체ID/업체명/대표자명/사업자등록번호/업종/주소/
//       전화번호/담당자명/담당자연락처/이메일/
//       주요취급카테고리/최소주문금액/결제조건/거래시작일/메모/마지막방문일
// 색상: 동일
// 업체ID 자동생성: VENDOR_001, VENDOR_002 ...
```

#### 5. saveDirectRecord() 신규 추가 (createDirectSourcingDoc 대체)

```javascript
// 역할: 사진 드라이브 저장 + 공급업체 자동매칭/신규등록 + 사입기록 시트 행추가
// 반환: { success, vendorId, photoUrl, rowNum }
// 사진링크는 =HYPERLINK("url","📷 사진") 수식으로 저장
// 소싱결과 초기값: "검토중"
// 행 배경색: 가능=연초록, 불가=연빨강, 미확인=연노랑
```

#### 6. updateDirectRecord() 신규 추가

```javascript
// 위탁등록 확정 시 사입기록 시트 해당 rowNum 업데이트
// M열: 진행, N열: 등록일시, O열: 마켓, P열: 판매가, Q열: 마진율, S열: 상품목록ID
// 행 배경색을 연초록(#c8e6c9)으로 변경
```

#### 7. getVendors() / saveVendor() / getDirectRecords() 신규 추가

#### 8. saveProduct() row 배열 26열로 확장

```javascript
// 기존 19열 뒤에 추가
// T: photoUrl (=HYPERLINK 수식)
// U: docUrl (=HYPERLINK 수식)  
// V: sourcingType (사입/온라인)
// W: leadTime
// X: paymentTerms
// Y: consignAvail
// Z: contact
```

#### 9. getProducts() 파싱에 r[19]~r[25] 추가

#### 10. doPost 핸들러 추가

```javascript
else if (action === 'saveDirectRecord')    // 신규
else if (action === 'updateDirectRecord')  // 신규
else if (action === 'getVendors')          // 신규
else if (action === 'saveVendor')          // 신규
else if (action === 'getDirectRecords')    // 신규
// 제거: createDirectSourcingDoc, saveDirectSourcingPhoto
```

---

### 프론트엔드 JS/HTML 수정

#### 버그 수정

**1. 최고가 상품 카드 미표시**
- `mp-product-cards-max` div 추가 (HTML)
- `byMax` 정렬 + 렌더링 코드 추가 (fetchMarketPrice 내)
- CSS: `#mp-product-cards-max::-webkit-scrollbar { display: none; }`

**2. 상품카드 3개만 표시**
- fetchMarketPrice에서 API 호출 시 `display=30` 파라미터 추가

#### 신규 기능 1 — 연관검색어 자동완성

```javascript
// productName input 아래에 #related-keywords div 추가
// productName에 500ms debounce oninput 추가
// fetchRelatedKeywords(keyword) 함수: /related API 호출 → 칩 렌더링
// selectKeyword(kw) 함수: productName에 값 입력 → fetchMarketPrice() 자동 실행
```

#### 신규 기능 2 — 도매 소싱 섹션

```javascript
// market-price-box 하단에 #wholesale-section 추가
// 사이트 탭 3개: 도매꾹/도매토피아/오너클랜
// fetchWholesaleProducts(keyword, site): /wholesale API 호출 → 카드 렌더링
// selectWholesaleProduct(idx, price, name): 원가 자동입력 + recalcMargin()
// fetchMarketPrice() 성공 후 fetchWholesaleProducts() 자동 호출
// CSS: .ws-tab, .wholesale-card, .ws-price, .ws-name, .ws-select-btn
```

#### 신규 기능 3 — 인기상품 TOP5

```javascript
// #mp-popular-section: review_count 기준 정렬 리스트
// byPopular.slice(0,5): 순위 번호 + 썸네일 + 가격 + 쇼핑몰명
// fetchMarketPrice() 내에서 렌더링
```

#### 신규 기능 4 — 소싱 모드 토글 (온라인/사입)

```html
<!-- 계산 탭 상단 -->
<button class="sourcing-mode-btn active" id="mode-online" onclick="setSourcingMode('online',this)">🖥️ 온라인 소싱</button>
<button class="sourcing-mode-btn" id="mode-direct" onclick="setSourcingMode('direct',this)">🏪 사입 (현장)</button>
```

```javascript
// setSourcingMode(mode, btn): 버튼 active 토글 + 사입섹션 show/hide
// CSS: .sourcing-mode-btn, .sourcing-mode-btn.active
```

#### 신규 기능 5 — 사입 섹션 (direct-sourcing-section)

**HTML (기본 display:none):**

```html
<div id="direct-sourcing-section" style="display:none">
  <!-- 사진 촬영/업로드 -->
  <!-- 공급업체 선택 드롭다운 + 신규 버튼 -->
  <!-- 단가, 최소수량 -->
  <!-- 납기·리드타임 -->
  <!-- 결제조건 select -->
  <!-- 위탁가능여부 라디오 3개: 가능/불가/미확인 -->
  <!-- 담당자 연락처 -->
  <!-- 메모 -->
  <!-- 현장 메모 저장 버튼 -->
  <!-- 오늘 사입 목록 (#direct-notes-list) -->
</div>
```

**JS 함수:**

```javascript
// previewDirectPhoto(input): 사진 미리보기 + base64 저장
// saveDirectSourcingNote(): 
//   1. localStorage 즉시 저장 (vendorId, rowNum 포함)
//   2. SCRIPT_URL 있으면 saveDirectRecord action 호출
//   3. 응답에서 photoUrl, vendorId, rowNum → localStorage 업데이트
//   4. 완료 후 renderDirectNotes()
// renderDirectNotes(): 오늘 사입 메모 카드 렌더링
//   - 사진 썸네일 (56x56)
//   - 상품명, 단가, 공급업체명, 납기, 위탁가능여부
//   - 버튼: 📊계산 / 🏷️위탁등록(가능시) / 🗑️삭제
// loadDirectNote(id): 해당 메모 원가 → costPrice 입력 + 온라인모드 전환
// deleteDirectNote(id): localStorage에서 삭제
// loadVendors(): getVendors action 호출 → _vendors 배열
// renderVendorSelect(): 드롭다운 옵션 렌더링
// onVendorSelect(sel): 업체 선택 → 결제조건/연락처 자동 채우기
```

#### 신규 기능 6 — 위탁 등록 플로우

```javascript
// registerAsConsignment(noteId): 사입 메모에서 위탁등록 시작
// showConsignmentModal(note, calcResult): 동적 모달 생성
//   - 상품 정보 + 사입 문서링크 표시
//   - 판매 플랫폼 선택 (3개 버튼)
//   - 판매가 입력 + 마진 실시간 계산
//   - 추천 판매가 자동입력 (calcResult 있으면)
// selectCMMarket(market, btn): 마켓 선택 + 수수료 자동변경
// updateCMMargin(): 판매가/수수료 입력 시 마진 미리보기 업데이트
// closeConsignmentModal()
// submitConsignment():
//   1. saveProduct action 호출 (sellDecision=Y, sourcingType=사입)
//   2. updateDirectRecord action 호출 (rowNum, market, salePrice, marginRate, productListId)
//   3. 완료 후 showTab('sales')
// CSS: .cm-mkt, .cm-mkt.active
```

#### 신규 기능 7 — 공급업체 등록 모달

```javascript
// showVendorForm(vendorId): 신규/수정 모달 표시
//   필드: 업체명/대표자/사업자번호/업종/주소/대표전화/담당자/연락처/이메일/카테고리/최소주문/결제조건/메모
// closeVendorModal()
// submitVendor(): saveVendor action → 완료 후 loadVendors() + 방금 업체 자동선택
```

#### 소싱목록 카드에 사진 표시 (renderList 수정)

```javascript
// photoSection: p.photoUrl 있으면 카드 상단 120px 이미지 표시
//   - 좌상단 뱃지: 🏪 사입 (drive.google.com) / 🛒 온라인
//   - 우하단: 📄 문서 링크 (p.docUrl 있을 때)
```

#### 판매관리 카드에 사입 정보 표시 (loadSalesPage 수정)

```javascript
// sourceTag: 🏪 사입 또는 🛒 온라인 뱃지
// 사진 100px 상단 표시 (p.photoUrl)
// docBtn: 📄 사입 문서 버튼 (p.docUrl 있을 때)
// leadTime 표시 (p.leadTime)
```

#### fetchMarketPrice() 수정사항

```javascript
// 1. thumbnailUrl 저장: window._lastSearch.thumbnailUrl = search.top_items?.[0]?.image
// 2. 연관검색어 자동 표시 추가
// 3. 도매 섹션 자동 표시: fetchWholesaleProducts(name, _currentWholesaleSite)
// 4. 최고가 카드 byMax 렌더링 추가
// 5. 인기상품 TOP5 렌더링 추가
// 6. /target API 호출 → 타겟층 표시
// 7. trend 데이터 처리 (include_trend=true 파라미터)
```

#### saveProduct() 수정사항

```javascript
// toSave 배열에 추가:
// photoUrl: window._lastSearch?.photoUrl || window._lastSearch?.thumbnailUrl || ''
// docUrl: window._lastSearch?.docUrl || ''
// sourcingType: '온라인' (기본)
// leadTime, paymentTerms, consignAvail, contact: '' (기본)
```

#### onAuthSuccess() 수정사항

```javascript
// 로그인 성공 후 loadVendors() 추가 호출
```

---

## 구글 드라이브 폴더 구조 (Apps Script에서 자동 생성)

```javascript
// ROOT_FOLDER_NAME = '셀러마진'
// 구조:
// 셀러마진/
// ├── 사입사진/          ← 현장 사진
// ├── 상품분석/
// └── {년도}/
//     └── {월}/
//         ├── 영수증/
//         └── 사입기록/
```

`organizeGoogleDrive()` 함수 구현:
```javascript
// 위 구조를 getOrCreateFolder()로 자동 생성
// 매월 1일 트리거로 실행
// 반환: { success, path, rootFolderId, monthFolderId }
```

---

## 구현 순서 (Cursor 권장 순서)

```
1. main.py 수정
   - /search display=30, include_trend 파라미터
   - /related 엔드포인트
   - /wholesale 엔드포인트
   - /target 엔드포인트
   - datetime import 추가

2. Apps Script 코드 수정 (seller-dashboard-v3.html 내부)
   - 상수 추가 (SHEET_DIRECT, SHEET_VENDOR, ROOT_FOLDER_NAME)
   - PRODUCT_COLS = 26, PRODUCT_HEADERS 26개
   - initDirectSheet(), initVendorSheet()
   - saveDirectRecord(), updateDirectRecord()
   - getVendors(), saveVendor(), getDirectRecords()
   - saveProduct() row 26열 확장
   - getProducts() 파싱 확장
   - organizeGoogleDrive() 실구현
   - doPost 핸들러 업데이트

3. 프론트엔드 수정 (seller-dashboard-v3.html)
   - 버그 수정 2개 (최고가 카드, display=30)
   - 연관검색어 섹션 + JS
   - 도매 소싱 섹션 + JS + CSS
   - 인기상품 TOP5
   - 소싱 모드 토글
   - 사입 섹션 전체 (HTML + JS)
   - 공급업체 모달 (JS 동적생성)
   - 위탁등록 모달 (JS 동적생성)
   - renderList() 사진카드 수정
   - loadSalesPage() 사입정보 표시
   - fetchMarketPrice() 7가지 수정
   - saveProduct() toSave 확장
   - onAuthSuccess() loadVendors 추가
```

---

## 완성 후 확인 체크리스트

**main.py (Render):**
- [ ] GET /search?query=모자&display=30 → top_items 15개 이상
- [ ] GET /search?query=모자&include_trend=true → trend 객체 포함
- [ ] GET /related?query=모자 → keywords 배열
- [ ] GET /wholesale?query=모자 → items 배열
- [ ] GET /target?query=모자 → gender, age_groups

**Apps Script (구글 시트):**
- [ ] 시트 탭 7개 자동 생성 (첫 저장 시)
- [ ] 사입기록 저장 → 사입기록 시트 행 추가
- [ ] 공급업체 저장 → 공급업체 시트 행 추가
- [ ] 위탁등록 → 상품목록 시트 행 추가 + 사입기록 시트 업데이트
- [ ] 드라이브 셀러마진 폴더 구조 자동 생성

**프론트엔드 (Netlify):**
- [ ] 연관검색어 칩 표시
- [ ] 도매 소싱 카드 표시 + "원가 적용" 클릭 → costPrice 자동 입력
- [ ] 최고가 근처 상품 카드 표시
- [ ] 인기상품 TOP5 표시
- [ ] 사입 모드 전환 정상
- [ ] 공급업체 드롭다운 로드
- [ ] 사입 저장 → localStorage + 시트 동시 저장
- [ ] 위탁등록 → 판매관리 탭 이동 + 카드 표시
- [ ] 소싱목록 카드 상단 사진 표시
