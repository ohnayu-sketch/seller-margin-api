# 커서 통합 작업 지시서 v2
> 이 문서를 프로젝트 폴더에 넣고 "이 지시서대로 전부 구현해줘. 작업 순서대로 진행해줘." 라고 하면 됩니다.

## 작업 대상 파일
- `seller-dashboard-v3.html` (프론트엔드, Netlify 배포)
- `backend/main.py` (백엔드, Render 배포)
- `backend/requirements.txt`
- `apps-script/Code.gs` (구글 시트 연동)

## 현재 배포 정보
- 프론트: https://ohnayu-sketch.github.io/seller-margin-api/
- 백엔드: https://seller-margin-api-georgia-5lro.onrender.com
- 구글 시트 ID: 1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg

---

# 작업 1 — 모바일 UI 개편 (최우선)

## 문제
아이폰에서 탭 스크롤 시 화면 밖으로 나가는 버그 발생.
탭이 상단에 있어서 콘텐츠 영역이 좁음.

## 해결 방법: 하단 고정 탭바로 전환

### 1-1. 상단 탭 → 하단 탭바 변경
```css
/* 하단 탭바 */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #1a1d24;
  border-top: 1px solid #2a2d35;
  display: flex;
  z-index: 100;
  /* 아이폰 홈 인디케이터 영역 확보 */
  padding-bottom: env(safe-area-inset-bottom);
}

/* 콘텐츠 영역 */
.content-area {
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
}
```

### 1-2. 탭 구성 (아이콘 + 텍스트)
```
[📊 계산] [📦 소싱] [🛒 판매] [💰 회계] [📈 통계] [⚙️ 설정]
```
탭이 6개라 아이콘만 표시하고 선택된 탭만 텍스트 표시.

### 1-3. 좌우 스와이프로 탭 전환
```javascript
// 터치 이벤트로 탭 전환
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) nextTab();
    else prevTab();
  }
});
```

### 1-4. 탭 전환 애니메이션
```css
.tab-content {
  transition: opacity 0.2s ease;
}
```

---

# 작업 2 — 설정 탭 API 키 관리 섹션 추가

## 2-1. UI 구성 (설정 탭 내 추가)
```
┌─────────────────────────────┐
│ 🔑 API 키 관리              │
├─────────────────────────────┤
│ 백엔드 서버 URL              │
│ [https://...onrender.com ] [저장] [테스트] │
│                             │
│ 네이버 쇼핑 (서버에서 관리됨) │
│ ✅ 연결됨                   │
│                             │
│ 도매꾹 API Key              │
│ [●●●●●●●●●●●●] [👁] [저장] │
│                             │
│ 도매매 API Key              │
│ [●●●●●●●●●●●●] [👁] [저장] │
│                             │
│ 온채널 API Key              │
│ [●●●●●●●●●●●●] [👁] [저장] │
└─────────────────────────────┘
```

## 2-2. 저장 방식
```javascript
// localStorage 키 이름
const API_KEYS = {
  backendUrl: 'seller-api-url',
  domeggook: 'domeggook-api-key',
  domemae: 'domemae-api-key',
  onchannel: 'onchannel-api-key',
};

// 저장 함수
function saveApiKey(type, value) {
  localStorage.setItem(API_KEYS[type], value.trim());
  showToast('✅ 저장됨');
}

// 로드 함수 (페이지 시작 시)
function loadApiKeys() {
  Object.entries(API_KEYS).forEach(([type, key]) => {
    const input = document.getElementById(`api-${type}`);
    if (input) input.value = localStorage.getItem(key) || '';
  });
}
```

## 2-3. 백엔드 URL 테스트 버튼
```javascript
async function testBackendUrl() {
  const url = localStorage.getItem('seller-api-url');
  if (!url) return showToast('❌ URL을 입력해주세요');
  try {
    const res = await fetch(url + '/');
    const data = await res.json();
    if (data.status === 'ok') showToast('✅ 서버 연결 성공!');
  } catch {
    showToast('❌ 서버 연결 실패. URL을 확인해주세요.');
  }
}
```

## 2-4. API 헬퍼 함수 (전역)
모든 API 호출 시 공통으로 사용:
```javascript
function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Domeggook-Key': localStorage.getItem('domeggook-api-key') || '',
    'X-Domemae-Key': localStorage.getItem('domemae-api-key') || '',
    'X-Onchannel-Key': localStorage.getItem('onchannel-api-key') || '',
  };
}

function getBackendUrl() {
  return localStorage.getItem('seller-api-url') || 'https://seller-margin-api-georgia-5lro.onrender.com';
}

async function callApi(endpoint, params = {}) {
  const url = new URL(getBackendUrl() + endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: getApiHeaders() });
  return res.json();
}
```

---

# 작업 3 — 마켓 수수료 세분화

## 3-1. 마켓 목록 확장
```javascript
const MARKET_FEES = {
  '스마트스토어': { fee: 6.6, color: '#03c75a' },
  '쿠팡': { fee: 8.0, color: '#ff6900' },
  '11번가': { fee: 8.0, color: '#ff0000' },
  'G마켓': { fee: 9.0, color: '#ff6600' },
  '옥션': { fee: 9.0, color: '#ff0000' },
  '위메프': { fee: 6.0, color: '#8b0085' },
  '티몬': { fee: 6.0, color: '#ff4500' },
  '카카오쇼핑': { fee: 5.5, color: '#fee500' },
};
```

## 3-2. 계산 탭 변경
- 기존 3개 탭(스마트/쿠팡/오픈) → 8개 마켓 드롭다운 선택으로 변경
- "전체 비교" 버튼 → 8개 마켓 마진율 한눈에 비교 테이블 표시
- 마진율 가장 높은 마켓 자동 추천 표시 (🏆 표시)

---

# 작업 4 — 시중가 자동 조회 (계산 탭 개선)

## 4-1. 계산 탭에 "시중가 조회" 버튼 추가
```
상품명 입력란 옆에 [🔍 시중가 조회] 버튼

클릭 시:
1. 로딩 스피너 표시
2. GET /search?query=상품명 호출
3. 결과 표시:
   ┌─────────────────────┐
   │ 📊 네이버쇼핑 시중가  │
   │ 최저 15,000원       │
   │ 평균 23,000원  ← 추천│
   │ 최고 45,000원       │
   │ 경쟁 셀러: 2,341개  │
   │                     │
   │ 📈 검색 트렌드       │
   │ 이번달 ████ 상승중   │
   │ 시즌: 🟢 성수기      │
   └─────────────────────┘
4. 판매가 입력란에 평균가 자동 입력 (수정 가능)
5. 카테고리 자동 분류 결과 표시
```

## 4-2. 카테고리 자동 분류 표시
```
조회 결과 아래:
카테고리: [생활용품 ▼]  (자동 선택, 수동 변경 가능)
리스크: 🟡 보통
주의: 없음
```

---

# 작업 5 — 네이버 데이터랩 시즌 트렌드 연동 (backend/main.py)

## 5-1. requirements.txt에 추가
```
# 기존 유지
fastapi==0.109.0
uvicorn==0.27.0
httpx==0.26.0
python-dotenv

# 추가 없음 (httpx로 처리 가능)
```

## 5-2. 데이터랩 API 엔드포인트 추가
```python
@app.get("/trend")
async def get_trend(query: str):
    """네이버 데이터랩으로 검색 트렌드 조회 (시즌 판단)"""
    import datetime
    
    today = datetime.date.today()
    start_date = (today - datetime.timedelta(days=365)).strftime("%Y-%m-%d")
    end_date = today.strftime("%Y-%m-%d")
    
    url = "https://openapi.naver.com/v1/datalab/search"
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        "Content-Type": "application/json"
    }
    body = {
        "startDate": start_date,
        "endDate": end_date,
        "timeUnit": "month",
        "keywordGroups": [{"groupName": query, "keywords": [query]}]
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=body)
        data = res.json()
    
    if "results" not in data:
        return {"success": False, "error": "트렌드 조회 실패"}
    
    ratios = [r["ratio"] for r in data["results"][0]["data"]]
    current_month = ratios[-1] if ratios else 0
    avg = sum(ratios) / len(ratios) if ratios else 0
    
    # 시즌 판단
    if current_month >= avg * 1.3:
        season = "성수기"
        season_icon = "🟢"
        season_desc = f"평균 대비 +{round((current_month/avg - 1) * 100)}%"
    elif current_month <= avg * 0.7:
        season = "비수기"
        season_icon = "🔴"
        season_desc = f"평균 대비 -{round((1 - current_month/avg) * 100)}%"
    else:
        season = "보통"
        season_icon = "🟡"
        season_desc = "평균 수준"
    
    return {
        "success": True,
        "query": query,
        "season": season,
        "season_icon": season_icon,
        "season_desc": season_desc,
        "current_ratio": current_month,
        "avg_ratio": round(avg, 1),
        "monthly_data": ratios,  # 차트용 12개월 데이터
    }
```

## 5-3. /search 엔드포인트에 트렌드 통합
```python
# 기존 /search 엔드포인트에서 트렌드도 함께 반환
# include_trend=true 파라미터 추가 시 데이터랩 호출 포함
@app.get("/search")
async def search_product(query: str, display: int = 10, include_trend: bool = False):
    # 기존 로직 유지...
    
    result = { ...기존 반환값... }
    
    if include_trend:
        trend = await get_trend(query)
        result["trend"] = trend
    
    return result
```

---

# 작업 6 — 도매꾹 API 연동 (backend/main.py)

## 6-1. 도매꾹 검색 엔드포인트
```python
@app.get("/domeggook/search")
async def domeggook_search(request: Request, query: str, page: int = 1):
    api_key = request.headers.get("X-Domeggook-Key", "")
    if not api_key:
        return {"success": False, "error": "도매꾹 API 키 미설정. 설정 탭에서 입력해주세요."}
    
    url = "https://domeggook.com/ssl/api/"
    params = {
        "ver": "6.1",
        "cmd": "getItemList",
        "aid": api_key,
        "keyword": query,
        "pageNum": page,
        "pageSize": 20,
        "out": "json"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params)
        data = res.json()
    
    # 응답 파싱 후 표준 형식으로 반환
    return {
        "success": True,
        "source": "도매꾹",
        "items": [
            {
                "id": item.get("no"),
                "name": item.get("name"),
                "price": int(item.get("price", 0)),
                "stock": item.get("stock"),
                "supplier": item.get("seller"),
                "image": item.get("img"),
                "link": f"https://domeggook.com/main/item/itemView.php?aid={item.get('no')}",
                "category": item.get("category"),
                "min_order": item.get("minQty", 1),
            }
            for item in data.get("list", [])
        ],
        "total": data.get("totalCount", 0)
    }
```

## 6-2. 도매꾹 + 네이버쇼핑 통합 비교 엔드포인트
```python
@app.get("/compare")
async def compare(request: Request, query: str, cost: float = 0,
                  sup_ship: float = 0, mkt_ship: float = 3000):
    """도매 원가 입력 or 도매꾹 조회 + 네이버 시중가 + 마진 계산 통합"""
    
    # 1. 네이버쇼핑 시중가 조회
    search = await search_product(query, display=20, include_trend=True)
    
    # 2. 마진 계산 (8개 마켓)
    FEES = {
        '스마트스토어': 6.6,
        '쿠팡': 8.0,
        '11번가': 8.0,
        'G마켓': 9.0,
        '옥션': 9.0,
        '위메프': 6.0,
        '티몬': 6.0,
        '카카오쇼핑': 5.5,
    }
    
    avg = search.get("avg_price", 0)
    
    def calc(sale, fee_rate):
        if sale <= 0: return {}
        total_cost = cost + sup_ship
        fee = sale * fee_rate / 100
        profit = sale - fee - mkt_ship - total_cost
        margin = (profit / sale * 100) if sale > 0 else 0
        return {
            "sale": sale,
            "fee": round(fee),
            "profit": round(profit),
            "margin": round(margin, 1),
        }
    
    margins = {market: calc(avg, fee) for market, fee in FEES.items()}
    best_market = max(margins, key=lambda m: margins[m].get("margin", -999))
    
    return {
        "success": True,
        "query": query,
        "cost": cost,
        "market_prices": {
            "min": search.get("min_price"),
            "avg": avg,
            "max": search.get("max_price"),
            "competitor_count": search.get("competitor_count"),
        },
        "trend": search.get("trend"),
        "margins": margins,
        "best_market": best_market,
        "top_items": search.get("top_items", [])[:5],
    }
```

---

# 작업 7 — 엑셀 업로드 기반 도매 상품 분석 (API 없는 사이트 대응)

## 7-1. 프론트엔드 — 소싱목록 탭에 엑셀 업로드 기능 추가
```
소싱목록 탭 상단에 추가:

┌─────────────────────────────────────┐
│ 📂 도매사이트 엑셀 일괄 분석        │
│                                     │
│ [엑셀 파일 선택 (.xlsx, .csv)]      │
│                                     │
│ 컬럼 매핑 (자동 감지, 수동 변경 가능)│
│ 상품명: [컬럼A ▼]                  │
│ 원가:   [컬럼C ▼]                  │
│ 배송비: [컬럼D ▼]                  │
│                                     │
│ [🚀 일괄 분석 시작]                 │
│                                     │
│ 분석 결과: 50개 상품 중             │
│ 🟢 마진 20%↑: 12개                 │
│ 🟡 마진 10~20%: 23개               │
│ 🔴 마진 10%↓: 15개                 │
│                                     │
│ [결과 보기] [구글 시트로 저장]       │
└─────────────────────────────────────┘
```

## 7-2. 엑셀 파싱 처리 (프론트엔드 JavaScript)
```javascript
// SheetJS 라이브러리 사용
// <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

async function analyzeExcel(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  
  // 컬럼 자동 감지 (상품명, 원가, 배송비)
  const columns = Object.keys(rows[0] || {});
  
  // 각 상품별 네이버쇼핑 시중가 조회 (순차적으로 호출, 과부하 방지)
  const results = [];
  for (const row of rows) {
    const name = row[nameCol];
    const cost = parseFloat(row[costCol]) || 0;
    
    // 0.5초 딜레이 (API 제한 방지)
    await new Promise(r => setTimeout(r, 500));
    
    const result = await callApi('/compare', { query: name, cost });
    results.push({ ...row, analysis: result });
  }
  
  // 마진율 순으로 정렬
  results.sort((a, b) => 
    (b.analysis?.margins?.스마트스토어?.margin || 0) - 
    (a.analysis?.margins?.스마트스토어?.margin || 0)
  );
  
  displayExcelResults(results);
}
```

## 7-3. 분석 결과 표시
```
마진율 20% 이상 상품만 필터해서 카드로 표시:

┌────────────────────────────────┐
│ 무선 블루투스 이어폰    🏆 23.4% │
│ 도매원가: 8,500원               │
│ 시중평균: 24,000원              │
│ 최적마켓: 스마트스토어           │
│ 트렌드: 🟢 성수기               │
│ [소싱목록 추가] [시중가 상세보기] │
└────────────────────────────────┘
```

---

# 작업 8 — 판매관리 탭 + 주문 수집 준비 (구조만 구현)

## 8-1. 판매관리 탭 UI 구현
```
┌─────────────────────────────┐
│ 🛒 판매관리                  │
├─────────────────────────────┤
│ 이번달 매출: 0원             │
│ 이번달 순이익: 0원           │
├─────────────────────────────┤
│ 판매 중인 상품 (0개)         │
│ (소싱목록에서 "판매 시작"     │
│  버튼 클릭 시 이곳에 표시)    │
│                             │
│ [+ 판매 기록 수동 추가]      │
├─────────────────────────────┤
│ 🔗 마켓 연동 (준비 중)       │
│ [ ] 스마트스토어 API 연결    │
│ [ ] 쿠팡 Wing API 연결      │
│ → 연결 시 주문 자동 수집     │
└─────────────────────────────┘
```

## 8-2. 수동 판매 기록 추가 모달
```
날짜: [2026-03-01]
상품명: [          ]
마켓: [스마트스토어 ▼]
판매수량: [1]
판매가: [      ]
원가: [      ] (자동 계산)
순이익: [      ] (자동 계산)
[저장 → 구글 시트 판매기록 시트]
```

---

# 작업 9 — 회계 탭 구현 (간이과세자)

## 9-1. 회계 탭 UI
```
┌─────────────────────────────────┐
│ 💰 회계 (간이과세자)             │
├──────────┬──────────┬───────────┤
│ 이번달    │ 이번달   │ 부가세     │
│ 매출합계  │ 매입합계 │ 예상납부   │
│ 0원      │ 0원      │ 0원       │
├─────────────────────────────────┤
│ + 거래 추가                      │
│                                 │
│ 날짜: [        ]                 │
│ 구분: [매입 ▼] [매출 ▼]          │
│ 거래처: [              ]         │
│ 품목: [                ]         │
│ 금액: [              ]           │
│ 증빙: [카드 ▼]                   │
│   카드 / 현금영수증 / 세금계산서   │
│   / 간이영수증 / 기타             │
│ 메모: [              ]           │
│ [저장]                           │
├─────────────────────────────────┤
│ 거래 목록 [이번달 ▼] [전체 ▼]    │
│ CSV 내보내기                     │
└─────────────────────────────────┘
```

## 9-2. 간이과세자 부가세 계산
```javascript
// 간이과세자: 연 매출 4,800만원 미만
// 업종별 부가가치율 × 10%
const VAT_RATES = {
  '소매업': 0.15,      // 부가가치율 15% × 세율 10% = 1.5%
  '음식업': 0.40,      // 4.0%
  '서비스업': 0.30,    // 3.0%
};

function calcSimplifiedVAT(annualSales, businessType = '소매업') {
  // 간이과세자 납부세액 = 매출 × 부가가치율 × 10%
  const rate = VAT_RATES[businessType] || 0.15;
  return Math.round(annualSales * rate * 0.1);
}
```

---

# 작업 10 — 통계 탭 개선

## 10-1. 추가할 차트/지표
```
기존 통계 유지 +

1. 월별 매출/순이익 추이 (라인 차트, Chart.js)
2. 마켓별 매출 비중 (도넛 차트)
3. 카테고리별 마진율 비교 (바 차트)
4. 소싱 → 판매 전환율 표시
   (소싱 등록 N개 중 판매 결정 M개 = 전환율 X%)
5. 베스트 상품 TOP 3 (순이익 기준)
```

---

# 절대 변경 금지 사항

1. 구글 OAuth 로그인 로직 (`CLIENT_ID`, `ALLOWED_EMAILS`, `sessionStorage` 인증)
2. 구글 시트 연동 (`localStorage['script-url']` → Apps Script 호출)
3. 다크 테마 색상: 배경 `#0d0f14`, 카드 `#1a1d24`, 초록 `#4ade80`
4. Noto Sans KR 폰트

---

# 작업 완료 후 배포 순서

```
1. backend/main.py 수정 → GitHub push → Render 자동 재배포
2. seller-dashboard-v3.html → Netlify 드래그앤드롭
3. apps-script/Code.gs → 구글 시트 Apps Script → 새 버전 재배포
```
