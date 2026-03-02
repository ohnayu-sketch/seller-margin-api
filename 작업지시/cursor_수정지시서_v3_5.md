# 커서 수정 지시서 v3_5
> 계산 탭 UX 전면 개선 — 탭 분리, 실시간 계산, URL 원가 추출, 역산 계산기, 배송비 프리셋, 히스토리

---

## 작업 대상
- `seller-dashboard-v3.html`
- `backend/main.py`

---

# 수정 1 — 계산 탭을 두 섹션으로 분리

## UI 구조

```
┌─────────────────────────────────────┐
│ 📦 마진 계산기                       │
│                                     │
│ [✏️ 직접 입력] [🔍 도매 검색]        │
│  ─────────────────────────────────  │
```

### 섹션 A — 직접 입력 (기존 방식)
```
상품명 [아기 옷걸이    ] [🔍 시중가 조회]

네이버쇼핑 실상품 카드 (좌우 스크롤, 5개)
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│이미지│ │이미지│ │이미지│ │이미지│ │이미지│
│380원│ │4200│ │5500│ │7800│ │9900│
│쿠팡 │ │스마트│ │G마켓│ │옥션 │ │11번가│
└────┘ └────┘ └────┘ └────┘ └────┘
(카드 탭 시 → 판매 페이지 새탭)

도매 소싱 링크 (선택)
[https://domeggook.com/...       ]
→ 도매꾹 URL 붙여넣으면 원가 자동 추출
→ 그 외 사이트: 수동 입력

도매 원가  [      원]
도매 배송비 [프리셋▼] [      원]
마켓 배송비 [프리셋▼] [      원]
```

### 섹션 B — 도매 검색 (도매꾹 API 키 설정 시 활성화)
```
[도매꾹 상품 검색               🔍]

도매꾹 결과 (5개 카드, 좌우 스크롤)
┌────────┐ ┌────────┐ ┌────────┐
│ [이미지] │ │ [이미지] │ │ [이미지] │
│  2,800원│ │  3,500원│ │  4,100원│
│ 재고 234│ │ 재고 89 │ │ 재고 12 │
│ [선택↓] │ │ [선택↓] │ │ [선택↓] │
└────────┘ └────────┘ └────────┘
(선택 시 → 원가 자동 입력 + 소싱링크 자동 입력)

도매꾹 API 키 미설정 시:
"🔑 설정 탭에서 도매꾹 API 키를 입력하면 사용 가능합니다"
```

---

# 수정 2 — 도매꾹 URL → 원가 자동 추출 (backend/main.py)

## URL 파싱 엔드포인트 추가

```python
@app.get("/parse-url")
async def parse_wholesale_url(url: str, request: Request):
    """
    도매꾹 상품 URL에서 원가 자동 추출
    지원: 도매꾹 (domeggook.com)
    미지원: 그 외 사이트 → 수동 입력 안내
    """
    if "domeggook.com" in url:
        # URL에서 상품 ID 추출
        # 예: https://domeggook.com/main/item/itemView.php?aid=12345
        import re
        match = re.search(r'aid=(\d+)', url)
        if not match:
            return {"success": False, "error": "상품 ID를 찾을 수 없습니다."}

        item_id = match.group(1)
        api_key = request.headers.get("X-Domeggook-Key", "")

        if not api_key:
            return {
                "success": False,
                "error": "도매꾹 API 키 미설정",
                "guide": "설정 탭에서 도매꾹 API 키를 입력해주세요."
            }

        # 도매꾹 상품 상세 API 호출
        params = {
            "ver": "6.1",
            "cmd": "getItem",
            "aid": api_key,
            "no": item_id,
            "out": "json"
        }
        async with httpx.AsyncClient() as client:
            res = await client.get("https://domeggook.com/ssl/api/", params=params)
            data = res.json()

        item = data.get("item", {})
        return {
            "success": True,
            "source": "도매꾹",
            "name": item.get("name", ""),
            "price": int(item.get("price", 0)),
            "stock": item.get("stock", 0),
            "image": item.get("img", ""),
            "link": url,
            "supplier": item.get("seller", ""),
        }

    else:
        return {
            "success": False,
            "supported": False,
            "message": "현재 도매꾹 URL만 자동 추출 지원됩니다. 원가를 직접 입력해주세요.",
        }
```

## 프론트엔드 — URL 입력 시 자동 조회

```javascript
// 도매 소싱 링크 입력란에 붙여넣기 이벤트
document.getElementById('sourcing-link').addEventListener('paste', async (e) => {
  setTimeout(async () => {
    const url = e.target.value.trim();
    if (!url.startsWith('http')) return;

    showToast('🔍 도매 정보 조회 중...');
    const result = await callApi('/parse-url', { url });

    if (result.success) {
      document.getElementById('cost-input').value = result.price;
      document.getElementById('product-name').value = result.name;
      showToast(`✅ 원가 자동 입력: ${result.price.toLocaleString()}원`);
      recalcMargin();
    } else if (result.supported === false) {
      showToast('⚠️ ' + result.message);
    }
  }, 100);
});
```

---

# 수정 3 — 실시간 마진 계산 (10원 단위 반올림)

## 마진 계산하기 버튼 제거
→ 결과 영역 항상 표시
→ 입력값 변경 즉시 자동 계산

## 10원 단위 반올림 적용
```javascript
function roundTo10(value) {
  return Math.round(value / 10) * 10;
}

function recalcMargin() {
  const cost = parseFloat(document.getElementById('cost-input').value) || 0;
  const supShip = parseFloat(document.getElementById('sup-ship-input').value) || 0;
  const mktShip = parseFloat(document.getElementById('mkt-ship-input').value) || 0;
  const feeRate = getCurrentFeeRate();
  const targetMargin = parseFloat(document.getElementById('margin-input').value) || 15;

  const totalCost = cost + supShip;

  // 목표 마진율 기준 권장 판매가 역산 (10원 단위)
  const rawSale = totalCost / (1 - feeRate / 100 - targetMargin / 100);
  const recommendedSale = roundTo10(rawSale);

  // 현재 판매가 (직접 수정 가능)
  const salePriceInput = document.getElementById('sale-price-input');
  if (!salePriceInput.dataset.manuallyEdited) {
    salePriceInput.value = recommendedSale;
  }
  const salePrice = parseFloat(salePriceInput.value) || recommendedSale;

  // 실제 마진 계산
  const fee = roundTo10(salePrice * feeRate / 100);
  const profit = roundTo10(salePrice - fee - mktShip - totalCost);
  const marginRate = salePrice > 0 ? (profit / salePrice * 100) : 0;

  // 결과 즉시 표시
  document.getElementById('result-sale').textContent = salePrice.toLocaleString() + '원';
  document.getElementById('result-fee').textContent = fee.toLocaleString() + '원';
  document.getElementById('result-profit').textContent = profit.toLocaleString() + '원';
  document.getElementById('result-margin').textContent = marginRate.toFixed(1) + '%';

  // 마진율 색상
  const marginEl = document.getElementById('result-margin');
  if (marginRate >= 20) marginEl.style.color = '#4ade80';
  else if (marginRate >= 10) marginEl.style.color = '#facc15';
  else marginEl.style.color = '#f87171';

  // 전체 마켓 비교도 실시간 업데이트
  updateMarketCompareTable(totalCost, mktShip, salePrice);
}

// 판매가 직접 수정 감지
document.getElementById('sale-price-input').addEventListener('input', function() {
  this.dataset.manuallyEdited = 'true';
  recalcMargin();
});

// 슬라이더, 퀵버튼, 원가, 배송비 변경 시 recalcMargin 호출
```

---

# 수정 4 — 판매가 역산 계산기

마진 결과 영역 아래에 추가:

```
┌─────────────────────────────────┐
│ 🔄 역산 계산기                   │
│                                 │
│ "시중 최저가보다 싸게 팔고 싶다면?" │
│                                 │
│ 목표 판매가 [    19,000   원]    │
│ ↓                               │
│ 이 가격으로 팔면:                 │
│ 마진율: 8.3% 🔴 (낮음)          │
│ 순이익: 1,580원                  │
│ 최소 원가: 13,200원 이하여야 함   │
└─────────────────────────────────┘
```

```javascript
document.getElementById('target-sale-input').addEventListener('input', function() {
  const targetSale = parseFloat(this.value) || 0;
  const mktShip = parseFloat(document.getElementById('mkt-ship-input').value) || 0;
  const feeRate = getCurrentFeeRate();
  const cost = parseFloat(document.getElementById('cost-input').value) || 0;
  const supShip = parseFloat(document.getElementById('sup-ship-input').value) || 0;

  const fee = targetSale * feeRate / 100;
  const profit = targetSale - fee - mktShip - (cost + supShip);
  const marginRate = targetSale > 0 ? (profit / targetSale * 100) : 0;

  // 이 가격에서 수익 내려면 최대 원가
  const maxCost = targetSale * (1 - feeRate / 100) - mktShip;

  document.getElementById('reverse-margin').textContent = marginRate.toFixed(1) + '%';
  document.getElementById('reverse-profit').textContent = roundTo10(profit).toLocaleString() + '원';
  document.getElementById('reverse-maxcost').textContent = roundTo10(maxCost).toLocaleString() + '원';
});
```

---

# 수정 5 — 배송비 프리셋

도매 배송비, 마켓 배송비 입력란 옆에 프리셋 버튼 추가.

```
도매 배송비
[무료] [2,500] [3,000] [5,000] [직접입력]

마켓 배송비
[무료] [2,500] [3,000] [직접입력]
```

```javascript
const SUP_SHIP_PRESETS = [0, 2500, 3000, 5000];
const MKT_SHIP_PRESETS = [0, 2500, 3000];

// 프리셋 클릭 시
function setShipPreset(type, value) {
  const inputId = type === 'sup' ? 'sup-ship-input' : 'mkt-ship-input';
  document.getElementById(inputId).value = value;
  recalcMargin();  // 즉시 재계산
}

// 자주 쓰는 프리셋 localStorage에 저장
function saveShipPreset(type, value) {
  localStorage.setItem(`${type}-ship-default`, value);
}
// 페이지 로드 시 저장된 기본값 자동 입력
```

---

# 수정 6 — 최근 조회 상품 히스토리

계산 탭 상단에 추가:

```
🕐 최근 조회
[아기 옷걸이] [블루투스이어폰] [무선충전기] [핫팩]
(탭 시 → 해당 상품 정보 자동 불러오기)
```

```javascript
// 시중가 조회 성공 시 히스토리 저장
function saveToHistory(productName, result) {
  let history = JSON.parse(localStorage.getItem('search-history') || '[]');
  // 중복 제거
  history = history.filter(h => h.name !== productName);
  // 최신 항목 앞에 추가
  history.unshift({
    name: productName,
    minPrice: result.min_price,
    avgPrice: result.avg_price,
    maxPrice: result.max_price,
    savedAt: new Date().toISOString(),
  });
  // 최대 10개 유지
  history = history.slice(0, 10);
  localStorage.setItem('search-history', JSON.stringify(history));
  renderHistory();
}

// 히스토리 항목 클릭 시 → 해당 상품 자동 불러오기
function loadFromHistory(item) {
  document.getElementById('product-name').value = item.name;
  // 저장된 가격 정보 복원
  renderPriceResult(item);
}
```

---

# 수정 7 — 도매사이트 확장 관리 (설정 탭)

## 개념
API 있는 사이트, API 없는 사이트 모두 사용자가 직접 추가/삭제 가능.
코드 수정 없이 설정 탭에서 관리.

## 설정 탭 UI

```
┌─────────────────────────────────────────┐
│ 🏪 도매사이트 관리                       │
├─────────────────────────────────────────┤
│ 등록된 사이트 (3개)                      │
│                                         │
│ ✅ 도매꾹      [API]  🟢 연결됨  [삭제] │
│ ✅ 온채널      [API]  🟢 연결됨  [삭제] │
│ ⬜ 오너클랜    [URL]  🔴 미연결  [삭제] │
│                                         │
│ [+ 도매사이트 추가]                      │
└─────────────────────────────────────────┘
```

## 사이트 추가 모달

```
┌─────────────────────────────────────────┐
│ 도매사이트 추가                          │
│                                         │
│ 사이트 이름  [                  ]        │
│ 사이트 URL  [https://           ]        │
│                                         │
│ 연동 방식:                              │
│ ● API 연동  → API Key [          ]      │
│ ○ URL 방식  → URL 붙여넣으면 자동 감지  │
│                                         │
│ [저장]  [취소]                          │
└─────────────────────────────────────────┘
```

## 저장 구조 (localStorage)

```javascript
const WHOLESALE_SITES_KEY = 'wholesale-sites';

// 기본 내장 사이트 (삭제 가능)
const defaultSites = [
  {
    id: 'domeggook',
    name: '도매꾹',
    url: 'https://domeggook.com',
    type: 'api',
    apiKey: '',
    enabled: true,
    urlPattern: 'domeggook.com',
  },
  {
    id: 'onchannel',
    name: '온채널',
    url: 'https://onchannel.co.kr',
    type: 'api',
    apiKey: '',
    enabled: true,
    urlPattern: 'onchannel.co.kr',
  },
];

function addWholesaleSite(site) {
  const sites = getWholesaleSites();
  site.id = Date.now().toString();
  sites.push(site);
  localStorage.setItem(WHOLESALE_SITES_KEY, JSON.stringify(sites));
  renderWholesaleSites();
}

function removeWholesaleSite(id) {
  const sites = getWholesaleSites().filter(s => s.id !== id);
  localStorage.setItem(WHOLESALE_SITES_KEY, JSON.stringify(sites));
  renderWholesaleSites();
}

function getWholesaleSites() {
  return JSON.parse(
    localStorage.getItem(WHOLESALE_SITES_KEY) || JSON.stringify(defaultSites)
  );
}
```

## URL 자동 감지

도매 소싱 링크 붙여넣기 시 등록된 사이트 자동 감지:

```javascript
async function detectAndParseUrl(url) {
  const sites = getWholesaleSites();
  const matched = sites.find(s => url.includes(s.urlPattern));

  if (!matched) {
    showToast('⚠️ 등록되지 않은 사이트. 원가를 직접 입력해주세요.');
    showToast('💡 설정 탭 → 도매사이트 관리에서 추가할 수 있습니다.');
    return;
  }

  if (matched.type === 'api' && matched.apiKey) {
    // API 방식: 백엔드 경유 원가 자동 조회
    const result = await callApi('/parse-url', { url, site: matched.id },
      { 'X-Site-Api-Key': matched.apiKey });
    if (result.success) {
      document.getElementById('cost-input').value = result.price;
      showToast(`✅ ${matched.name} 원가 자동 입력: ${result.price.toLocaleString()}원`);
      recalcMargin();
    }
  } else if (matched.type === 'url') {
    // URL 방식: 새 탭에서 직접 확인 유도
    showToast(`⚠️ ${matched.name}은 API 미지원. 페이지에서 가격 확인 후 직접 입력해주세요.`);
    window.open(url, '_blank');
  } else if (!matched.apiKey) {
    showToast(`🔑 설정 탭에서 ${matched.name} API 키를 입력해주세요.`);
  }
}
```

## 계산 탭 도매검색 섹션 — 사이트 탭

```
[도매꾹] [온채널] [오너클랜] [+ 추가]
─────────────────────────────────────
선택한 사이트 검색 결과 (최대 5개 카드)
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│이미지│ │이미지│ │이미지│ │이미지│ │이미지│
│2800│ │3500│ │4100│ │5200│ │6000│
│[선택]│ │[선택]│ │[선택]│ │[선택]│ │[선택]│
└────┘ └────┘ └────┘ └────┘ └────┘
선택 시 → 원가/링크 자동 입력 + 즉시 마진 계산
```

---

# 수정 8 — 손익분기점 계산

마진 결과 영역 아래에 추가:

```
┌─────────────────────────────────┐
│ 📉 손익분기점 계산               │
│                                 │
│ 이번달 목표 수익 [   300,000 원] │
│                                 │
│ 이 상품으로 달성하려면:          │
│ 최소 판매 수량: 19개             │
│ 총 매출 필요: 423,000원         │
│ 총 원가 필요: 123,000원         │
│                                 │
│ 하루 평균 판매: 0.6개            │
│ (30일 기준)                     │
└─────────────────────────────────┘
```

```javascript
function calcBreakEven() {
  const profit = parseFloat(
    document.getElementById('result-profit').textContent
  ) || 0;
  const monthlyTarget = parseFloat(
    document.getElementById('monthly-target').value
  ) || 0;

  if (profit <= 0 || monthlyTarget <= 0) {
    document.getElementById('breakeven-result').textContent = '원가와 판매가를 먼저 입력해주세요.';
    return;
  }

  const requiredQty = Math.ceil(monthlyTarget / profit);
  const salePrice = parseFloat(document.getElementById('sale-price-input').value) || 0;
  const cost = parseFloat(document.getElementById('cost-input').value) || 0;
  const supShip = parseFloat(document.getElementById('sup-ship-input').value) || 0;

  const totalSales = roundTo10(requiredQty * salePrice);
  const totalCost = roundTo10(requiredQty * (cost + supShip));
  const dailyQty = (requiredQty / 30).toFixed(1);

  document.getElementById('breakeven-qty').textContent = requiredQty + '개';
  document.getElementById('breakeven-sales').textContent = totalSales.toLocaleString() + '원';
  document.getElementById('breakeven-cost').textContent = totalCost.toLocaleString() + '원';
  document.getElementById('breakeven-daily').textContent = dailyQty + '개';
}

// 목표 수익 변경 시 자동 계산
document.getElementById('monthly-target').addEventListener('input', calcBreakEven);
// recalcMargin 호출 후에도 자동 갱신
```

---

## 절대 변경 금지
1. 구글 OAuth 로그인 로직
2. 구글 시트 연동 (script-url)
3. 다크 테마 (#0d0f14, #1a1d24, #4ade80)
4. 기존 저장 데이터 구조
5. 구글 시트 저장 버튼 (마진 계산하기 버튼만 제거, 저장 버튼은 유지)
