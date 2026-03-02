# Cursor 작업지시서 — seller-dashboard v3.5 (로그인 + 실시간 계산)

> 이 문서는 Claude가 직접 `seller-dashboard-v3.html` 에 적용한 변경사항을 Cursor가 인지하고,  
> 관련 파일(main.py, Apps Script 등)을 함께 업데이트하기 위한 기술 지시서입니다.

---

## 1. 현재 배포 환경

| 항목 | 값 |
|------|-----|
| Frontend | https://ohnayu-sketch.github.io/seller-margin-api/ |
| Backend API | https://seller-margin-api-georgia-5lro.onrender.com |
| 작업 파일 | `seller-dashboard-v3.html` (단일 파일 SPA) |

---

## 2. 이번 세션에서 변경된 내용 요약

### 2-1. 실시간 마진 계산 (recalcMargin)

**기존:** 계산 버튼을 눌러야만 결과 업데이트  
**변경:** 모든 입력값 변경 시 즉시 자동 재계산

#### 영향받는 input 요소 (모두 `oninput="recalcMargin()"` 추가됨)
```html
<input id="costPrice" oninput="recalcMargin()">
<input id="supplyShipping" oninput="recalcMargin()">
<input id="marketShipping" oninput="recalcMargin()">
<input id="fee-smart" oninput="recalcMargin()">
<input id="fee-coupang" oninput="recalcMargin()">
<input id="fee-open" oninput="recalcMargin()">
<input id="targetMargin" oninput="recalcMargin()">
```

#### 추가/변경된 JS 함수

```javascript
// 기존 calculate() → 아래로 교체 (calculate()는 recalcMargin() 호출 래퍼로만 남김)
function recalcMargin() { ... }          // 핵심 계산 + 결과 카드 + window._lastResult 저장
function setMargin(val, btn) { ... }     // 마진율 프리셋 버튼 — 기존 함수에 recalcMargin() 호출 추가
function toggleMarket(key, el) { ... }   // 마켓 토글 — 기존 함수에 recalcMargin() 호출 추가
function roundTo10(v) { ... }            // 10원 단위 반올림 (판매가 표시용)
function calculate() { recalcMargin(); } // 하위호환 유지
```

---

### 2-2. 배송비 프리셋 버튼

**추가된 HTML (계산 탭 배송비 입력란 아래):**
```html
<!-- 공급사 배송비 프리셋 -->
<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
  <button onclick="setShip('sup',0)">무료</button>
  <button onclick="setShip('sup',3000)">3,000</button>
  <button onclick="setShip('sup',5000)">5,000</button>
</div>

<!-- 마켓 배송비 프리셋 -->
<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
  <button onclick="setShip('mkt',0)">무료</button>
  <button onclick="setShip('mkt',2500)">2,500</button>
  <button onclick="setShip('mkt',3000)">3,000</button>
  <button onclick="setShip('mkt',5000)">5,000</button>
</div>
```

**추가된 JS 함수:**
```javascript
function setShip(type, val) {
  const id = type === 'sup' ? 'supplyShipping' : 'marketShipping';
  document.getElementById(id).value = val;
  recalcMargin();
}
```

---

### 2-3. 역산 계산기 패널

**추가된 HTML (results-area 내부):**
```html
<div id="inverse-calc-panel" style="...">
  <div>💡 역산 계산기</div>
  <input type="number" id="inverse-sale-input" placeholder="예: 25000" oninput="calcInverse()">
  <div>이 가격의 마진율: <strong id="inverse-margin">—</strong></div>
  <div>순이익: <strong id="inverse-profit">—</strong></div>
  <div>최대 원가 (수익 내려면): <strong id="inverse-max-cost">—</strong></div>
</div>
```

**추가된 JS 함수:**
```javascript
function calcInverse() {
  // inverse-sale-input 판매가 기준으로
  // 마진율, 순이익, 최대 원가 계산
  // 첫 번째 활성 마켓 수수료 기준
}
```

---

### 2-4. 손익분기점 패널

**추가된 HTML (results-area 내부):**
```html
<div id="breakeven-panel" style="...">
  <div>📊 손익분기점</div>
  <input type="number" id="monthly-target" placeholder="예: 1000000" oninput="calcBreakEven()">
  <div>필요 판매 수량: <strong id="be-qty">—</strong></div>
  <div>총 매출: <strong id="be-sales">—</strong></div>
  <div>총 원가: <strong id="be-cost">—</strong></div>
  <div>30일 기준 일평균: <strong id="be-daily">—</strong></div>
</div>
```

**추가된 JS 함수:**
```javascript
function calcBreakEven() {
  // window._lastResult 기반 (recalcMargin 이후 저장된 값)
  // 월 목표 수익 / 개당 순이익 = 필요 판매 수량
}
```

---

### 2-5. 최근 조회 히스토리

**추가된 HTML (계산 탭 상단):**
```html
<div id="search-history-chips" style="display:none;flex-wrap:wrap;gap:6px;..."></div>
```

**추가된 JS 함수 3개:**
```javascript
const SEARCH_HIST_KEY = 'search-history-v2';

function saveToSearchHistory(name, result) {
  // localStorage에 최대 10개 저장
  // 구조: { name, min, avg, max, at }
}

function renderSearchHistory() {
  // search-history-chips에 칩 버튼 렌더링
  // 🕐 아이콘 + 상품명 10자 제한
}

function loadFromSearchHistory(idx) {
  // 클릭 시 productName, ref-price 복원
  // recalcMargin() 자동 호출
}
```

**fetchMarketPrice() 내부에서 호출:**
```javascript
saveToSearchHistory(name, result);
```

---

### 2-6. 시중가 조회 후 실상품 이미지 카드

**fetchMarketPrice() 변경사항:**
- `include_trend=true` 파라미터 추가 (`/search?query=...&include_trend=true`)
- top_items 데이터 처리 추가:
  - `byMin`: 최저가 근처 정렬 (5개)
  - `byAvg`: 평균가 근처 정렬 (5개)
- 타겟층 API 호출: `GET /target?query=...&category=...`
- 트렌드 데이터 표시: season_desc, monthly_data 막대 미니차트

**추가된 HTML 구조 (market-price-box 내부):**
```html
<div class="mp-section">
  <div class="mp-subtitle">최저가 근처 상품</div>
  <div id="mp-product-cards-min" style="display:flex;gap:8px;overflow-x:auto;..."></div>
</div>
<div class="mp-section">
  <div class="mp-subtitle">평균가 근처 상품</div>
  <div id="mp-product-cards-avg" style="display:flex;gap:8px;overflow-x:auto;..."></div>
</div>
<div id="mp-target-section">...</div>  <!-- 타겟층 성별/연령대 -->
<div id="mp-trend-section">...</div>   <!-- 트렌드/시즌 -->
```

**추가된 CSS:**
```css
.mp-section { margin-bottom: 14px; }
.mp-subtitle { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.mp-product-card { flex: 0 0 90px; min-width: 90px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mp-product-card img { width: 100%; height: 90px; object-fit: cover; }
.mp-pc-price { font-size: 11px; font-weight: 700; color: var(--accent); padding: 4px; text-align: center; }
.mp-pc-mall { font-size: 10px; color: var(--text-muted); padding: 0 4px 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; }
```

---

### 2-7. 구글 로그인 개선 (진행 중 — 미완료)

> ⚠️ 현재 문제: iOS Safari 및 일부 환경에서 Google GSI 버튼이 렌더링되지 않음  
> "구글 로그인 버튼 불러오는 중..." 에서 멈추는 현상

**현재 적용된 변경:**
- 커스텀 구글 버튼 추가 (GSI 실패 시 표시): `id="custom-google-btn"`
- `startGoogleOAuth()` 함수: OAuth implicit flow 리디렉트 방식
- `processGoogleUser(email, name)` 함수: GSI 콜백과 리디렉트 콜백 통합 처리
- hash 기반 `id_token` 파싱 (리디렉트 후 복귀 시)

**근본 해결을 위해 필요한 작업 (Cursor가 할 것):**

#### Google Cloud Console 설정 확인
다음 도메인이 등록되어 있어야 함:
```
승인된 JavaScript 원본:
  https://ohnayu-sketch.github.io/seller-margin-api/

승인된 리디렉션 URI:
  https://ohnayu-sketch.github.io/seller-margin-api/
```

#### Cursor 추가 작업 — 로그인 안정화
현재 `showLoginScreen()` 로직:
```javascript
// 1. URL hash에 id_token 있으면 → processGoogleUser() 호출 (리디렉트 콜백)
// 2. GSI 스크립트 로딩 시도 (최대 5초, 100ms 간격)
//    성공 → google.accounts.id.renderButton() 실행, custom-google-btn 숨김
//    실패 → custom-google-btn 표시 유지
// 3. custom-google-btn 클릭 → startGoogleOAuth() → 구글 로그인 페이지 리디렉트
```

**Cursor가 추가로 개선할 것:**
```javascript
// startGoogleOAuth()에서 nonce를 sessionStorage에 저장하고
// 리디렉트 복귀 시 검증하는 CSRF 방어 추가
sessionStorage.setItem('oauth-nonce', nonce);
// 복귀 후 hash params의 nonce와 비교
```

---

## 3. onAuthSuccess() 변경사항

기존:
```javascript
function onAuthSuccess(email, name) {
  // ... 기존 로직
}
```

추가된 코드 (함수 끝):
```javascript
  // 추가됨
  const savedApiUrl = localStorage.getItem('api-url') || localStorage.getItem('seller-api-url') || '';
  const apiInput = document.getElementById('api-url-input');
  if (savedApiUrl && apiInput) apiInput.value = savedApiUrl;
  API_URL = savedApiUrl || API_URL;

  renderSearchHistory();  // 히스토리 칩 표시
  recalcMargin();         // 저장된 값 있으면 즉시 계산
```

---

## 4. Backend (main.py) — 확인 필요 항목

현재 백엔드에 존재해야 하는 엔드포인트:

| 엔드포인트 | 파라미터 | 역할 |
|-----------|---------|------|
| `GET /search` | `query`, `include_trend=true` | 시중가 + top_items + 트렌드 |
| `GET /target` | `query`, `category` | 타겟층 성별/연령대 |
| `GET /trend` | `query` | 트렌드/시즌 데이터 |

**Cursor 확인 사항:**
- `GET /search` 응답에 `top_items` 배열 포함 여부 확인
  ```json
  {
    "min": 12000,
    "avg": 18000,
    "max": 35000,
    "top_items": [
      { "name": "상품명", "price": 12500, "image": "https://...", "mall": "스마트스토어", "link": "https://..." }
    ]
  }
  ```
- `include_trend=true` 시 `trend` 객체 포함 여부:
  ```json
  {
    "trend": {
      "season": "봄",
      "season_icon": "🌸",
      "season_desc": "봄 시즌 수요 상승",
      "monthly_data": [65, 70, 80, 95, 100, 88, ...]
    }
  }
  ```
- `/target` 엔드포인트 응답 형식:
  ```json
  {
    "gender": { "female": 65, "male": 35 },
    "age_groups": { "20대": 40, "30대": 35, "40대": 25 },
    "main_target": "20~30대 여성"
  }
  ```

---

## 5. 현재 파일 상태 체크리스트

Cursor가 `seller-dashboard-v3.html` 열었을 때 확인할 것:

- [ ] `recalcMargin()` 함수 존재 여부
- [ ] `setShip(type, val)` 함수 존재 여부
- [ ] `calcInverse()` 함수 존재 여부
- [ ] `calcBreakEven()` 함수 존재 여부
- [ ] `saveToSearchHistory()`, `renderSearchHistory()`, `loadFromSearchHistory()` 함수 존재 여부
- [ ] `startGoogleOAuth()`, `processGoogleUser()` 함수 존재 여부
- [ ] `id="search-history-chips"` 요소 존재 여부
- [ ] `id="inverse-sale-input"`, `id="monthly-target"` 요소 존재 여부
- [ ] `id="custom-google-btn"` 요소 존재 여부
- [ ] `id="mp-product-cards-min"`, `id="mp-product-cards-avg"` 요소 존재 여부
- [ ] `costPrice`, `targetMargin`, `fee-smart/coupang/open` input에 `oninput="recalcMargin()"` 속성 여부

---

## 6. Cursor에게 요청하는 추가 작업

### 우선순위 HIGH
1. **구글 로그인 완전 복구**: iOS Safari에서도 작동하도록 GSI 로딩 실패 시 팝업 방식 OAuth 시도
2. **main.py top_items 반환 확인**: 네이버쇼핑 API top_items 필드 포함 여부 검증 및 추가

### 우선순위 MEDIUM
3. **ref-price 자동 입력**: 시중가 조회 후 참고 판매가(`id="ref-price"`) 에 평균가 자동 입력
4. **역산 계산기 마켓 선택**: 첫 번째 활성 마켓만 기준으로 계산하는 것을 → 선택 마켓 모두 표시로 개선

### 우선순위 LOW
5. **히스토리 삭제 기능**: 각 칩에 X 버튼 추가, 전체 삭제 버튼
6. **손익분기점 차트**: be-qty, be-daily 시각화 (미니 게이지)

---

## 7. 변경하면 안 되는 것

| 항목 | 이유 |
|------|------|
| 다크 테마 CSS 변수 (`--accent: #4ade80` 등) | 전체 디자인 기반 |
| `CLIENT_ID` 값 | Google Cloud Console 등록값 |
| `SCRIPT_URL` / Apps Script 연동 로직 | 구글 시트 저장 기능 |
| `MARKET_INFO` 객체 | 8개 마켓 수수료 구조 |
| `calcForMarket()` 함수 시그니처 | 모든 계산의 기반 |
| localStorage key 구조 | 기존 사용자 데이터 보존 |

---

*작성: Claude (Anthropic) — 2026년 3월 1일*  
*이전 지시서: cursor_수정지시서_v3_4.md, cursor_수정지시서_v3_5.md 참고*
