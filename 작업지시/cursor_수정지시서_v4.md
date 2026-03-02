# 커서 수정 지시서 v4
> 소싱 자동화 / 가격 변동 추적 / 판매채널 연동 뼈대 / 상품별 성과 분석 / 시즌 캘린더 / 카카오톡 알림

---

## 작업 대상 파일
- `seller-dashboard-v3.html`
- `backend/main.py`
- `apps-script/Code.gs`

---

# 작업 1 — 카카오톡 알림 연동 (나에게 보내기)

## 1-1. 설정 탭에 카카오 API 키 입력란 추가

```
🔔 알림 설정 섹션 추가

카카오 REST API Key
[●●●●●●●●●●●●] [👁] [저장]

[테스트 알림 보내기] 버튼
→ 클릭 시 카카오톡으로 "✅ 셀러마진 알림 연결 완료!" 전송
→ 성공하면 "✅ 카카오톡 연결됨" 표시
→ 실패하면 "❌ API 키를 확인하세요" 표시

저장: localStorage 'kakao-api-key'
```

## 1-2. 카카오 API 키 발급 방법 안내 (설정 탭 내)

```
💡 카카오 API 키 발급 방법:
1. developers.kakao.com 접속
2. 내 애플리케이션 → 애플리케이션 추가
3. 앱 이름: "셀러마진알림"
4. 앱 설정 → 요약 정보 → REST API 키 복사
5. 위 입력란에 붙여넣기

※ 두 분 각자 발급해서 각자 기기에 저장하면
   각자 카카오톡으로 알림을 받을 수 있습니다.
```

## 1-3. 카카오 알림 전송 함수 (JavaScript)

```javascript
async function sendKakaoAlert(message) {
  const apiKey = localStorage.getItem('kakao-api-key');
  if (!apiKey) return;  // 키 없으면 조용히 넘어감

  // 카카오 토큰 발급 (나에게 보내기는 별도 인증 필요)
  // → 카카오 OAuth 토큰이 필요하므로 백엔드 경유
  await callApi('/kakao/send', { message });
}

// 알림 발생 시점:
// - 가격 변동 감지
// - 재고 소진 경고
// - 주문 발생 (마켓 연동 후)
// - 매출 목표 달성
```

## 1-4. 백엔드 카카오 알림 엔드포인트 (main.py)

```python
@app.post("/kakao/send")
async def send_kakao(request: Request, message: str):
    """카카오 나에게 보내기 API"""
    # 카카오 OAuth 토큰은 프론트에서 발급 후 헤더로 전달
    # X-Kakao-Token 헤더 수신
    kakao_token = request.headers.get("X-Kakao-Token", "")
    if not kakao_token:
        return {"success": False, "error": "카카오 토큰 없음"}

    url = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
    headers = {"Authorization": f"Bearer {kakao_token}"}
    body = {
        "template_object": json.dumps({
            "object_type": "text",
            "text": message,
            "link": {
                "web_url": "https://ohnayu-sketch.github.io/seller-margin-api/",
                "mobile_web_url": "https://ohnayu-sketch.github.io/seller-margin-api/"
            }
        })
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, data=body)
        data = res.json()

    return {"success": data.get("result_code") == 0}
```

---

# 작업 2 — 가격 변동 추적

## 2-1. 소싱목록 상품에 "가격 추적" 토글 추가

```
소싱목록 카드에 추가:
[🔔 가격 추적 ON/OFF 토글]

ON 시:
→ 구글 시트 상품목록에 "추적여부: Y" 저장
→ Apps Script 트리거가 매일 가격 조회
→ 변동 감지 시 카카오톡 알림
```

## 2-2. Apps Script 가격 추적 함수 (Code.gs)

```javascript
// 매일 오전 9시 실행 트리거 설정
function trackPrices() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('상품목록');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 컬럼 인덱스 찾기
  const nameIdx = headers.indexOf('상품명');
  const avgPriceIdx = headers.indexOf('시중평균가');
  const trackIdx = headers.indexOf('가격추적');
  const alertPriceIdx = headers.indexOf('알림기준가');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[trackIdx] !== 'Y') continue;

    const productName = row[nameIdx];
    const savedAvgPrice = row[avgPriceIdx];
    const alertPrice = row[alertPriceIdx] || savedAvgPrice;

    // 네이버쇼핑 현재가 조회
    const currentPrice = fetchCurrentPrice(productName);
    if (!currentPrice) continue;

    // 변동률 계산
    const changeRate = ((currentPrice - savedAvgPrice) / savedAvgPrice * 100).toFixed(1);

    // 5% 이상 변동 시 알림
    if (Math.abs(changeRate) >= 5) {
      const direction = changeRate > 0 ? '📈 상승' : '📉 하락';
      const msg = `[셀러마진 가격알림]\n상품: ${productName}\n${direction} ${Math.abs(changeRate)}%\n기존: ${savedAvgPrice.toLocaleString()}원\n현재: ${currentPrice.toLocaleString()}원`;
      sendKakaoMessage(msg);

      // 시트에 현재가 업데이트
      sheet.getRange(i + 1, avgPriceIdx + 1).setValue(currentPrice);
      sheet.getRange(i + 1, headers.indexOf('최종조회일') + 1).setValue(
        new Date().toLocaleDateString('ko-KR')
      );
    }
  }
}

// 네이버쇼핑 API 호출 (Apps Script 내부)
function fetchCurrentPrice(query) {
  const clientId = PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_ID');
  const clientSecret = PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_SECRET');

  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10`;
  const options = {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret
    }
  };

  const res = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(res.getContentText());

  if (!data.items || !data.items.length) return null;
  const prices = data.items.map(i => parseInt(i.lprice)).filter(Boolean);
  return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
}

// 카카오 나에게 보내기
function sendKakaoMessage(message) {
  const token = PropertiesService.getScriptProperties().getProperty('KAKAO_TOKEN');
  if (!token) return;

  UrlFetchApp.fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'post',
    headers: { 'Authorization': `Bearer ${token}` },
    payload: {
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: { web_url: 'https://ohnayu-sketch.github.io/seller-margin-api/' }
      })
    }
  });
}

// 트리거 등록 함수 (최초 1회 실행)
function setupTriggers() {
  // 기존 트리거 삭제
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // 매일 오전 9시 가격 추적
  ScriptApp.newTrigger('trackPrices')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  // 매월 1일 월별 리포트 생성
  ScriptApp.newTrigger('generateMonthlyReport')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
}
```

## 2-3. Apps Script 속성 설정 안내 (설정 탭 내)

```
Apps Script에 아래 속성을 설정해야 가격 추적이 작동합니다:

구글 시트 → 확장 프로그램 → Apps Script
→ 프로젝트 설정 → 스크립트 속성 추가:

NAVER_CLIENT_ID: U1mSVClo9bwFBunvuERp
NAVER_CLIENT_SECRET: nk6YqwnDWI
KAKAO_TOKEN: (카카오 액세스 토큰)

설정 후 setupTriggers() 함수 1회 실행
```

---

# 작업 3 — 시즌 캘린더

## 3-1. 새 탭 추가: 📅 시즌

하단 탭바에 시즌 탭 추가 (통계 탭 옆).

## 3-2. 시즌 캘린더 UI

```
┌─────────────────────────────────────────┐
│ 📅 시즌 캘린더          [2026년 ▼]      │
├─────────────────────────────────────────┤
│ 이번달 (3월) 추천 카테고리               │
│                                         │
│ 🟢 성수기                               │
│ ┌──────────┐ ┌──────────┐              │
│ │ 🌸 봄청소 │ │ 🌱 텃밭  │              │
│ │ 용품      │ │ 가드닝   │              │
│ │ 검색 +45% │ │ 검색 +38%│              │
│ └──────────┘ └──────────┘              │
│                                         │
│ 🟡 보통                                 │
│ ┌──────────┐ ┌──────────┐              │
│ │ 🎒 가방  │ │ 👟 신발  │              │
│ │          │ │          │              │
│ └──────────┘ └──────────┘              │
│                                         │
│ 🔴 비수기                               │
│ ┌──────────┐                           │
│ │ 🧤 방한  │                           │
│ │ 용품     │                           │
│ └──────────┘                           │
├─────────────────────────────────────────┤
│ 📆 연간 시즌 달력                        │
│    1  2  3  4  5  6  7  8  9 10 11 12  │
│ 핫팩 ░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓░   │
│ 선풍기 ░░░░░░▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░   │
│ 우산 ░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░   │
└─────────────────────────────────────────┘
```

## 3-3. 백엔드 시즌 캘린더 API (main.py)

```python
# 카테고리별 대표 키워드 (시즌 분석용)
SEASON_KEYWORDS = {
    "1월": ["핫팩", "방한용품", "가습기", "새해선물"],
    "2월": ["발렌타인", "핫팩", "봄옷"],
    "3월": ["봄청소용품", "텃밭가드닝", "황사마스크", "미세먼지"],
    "4월": ["봄나들이", "캠핑", "자전거", "봄옷"],
    "5월": ["어버이날선물", "스승의날", "선풍기", "캠핑"],
    "6월": ["여름용품", "수영복", "선크림", "모기장"],
    "7월": ["선풍기", "에어컨", "여름간식", "물놀이"],
    "8월": ["여름용품", "개학준비", "학용품"],
    "9월": ["추석선물", "가을옷", "등산용품"],
    "10월": ["핼러윈", "가을패션", "난방용품"],
    "11월": ["수능선물", "핫팩", "크리스마스선물"],
    "12월": ["크리스마스", "연말선물", "핫팩", "방한용품"],
}

@app.get("/season")
async def get_season_calendar(month: int = None):
    """이번달 + 다음달 시즌 트렌드 조회"""
    import datetime
    today = datetime.date.today()
    target_month = month or today.month

    keywords = SEASON_KEYWORDS.get(f"{target_month}월", [])

    results = []
    for keyword in keywords:
        trend = await get_trend(keyword)
        if trend.get("success"):
            results.append({
                "keyword": keyword,
                "season": trend["season"],
                "season_icon": trend["season_icon"],
                "current_ratio": trend["current_ratio"],
                "avg_ratio": trend["avg_ratio"],
                "change_pct": round(
                    (trend["current_ratio"] / trend["avg_ratio"] - 1) * 100
                    if trend["avg_ratio"] > 0 else 0, 1
                )
            })

    # 성수기 → 보통 → 비수기 순 정렬
    results.sort(key=lambda x: x["current_ratio"] / max(x["avg_ratio"], 1), reverse=True)

    return {
        "success": True,
        "month": target_month,
        "keywords": results
    }
```

---

# 작업 4 — 소싱 자동화 뼈대

도매꾹 API 키 발급 후 바로 연결할 수 있도록 뼈대만 구현.

## 4-1. 소싱 탭에 "자동 소싱" 섹션 추가

```
┌─────────────────────────────────────────┐
│ 🤖 자동 소싱                             │
│                                         │
│ 카테고리: [생활용품 ▼]                   │
│ 최소 마진율: [──●──────] 20%            │
│ 최대 원가: [        원]                  │
│                                         │
│ [🔍 조건에 맞는 상품 찾기]               │
│                                         │
│ ※ 도매꾹 API 키 설정 후 사용 가능       │
│   설정 탭 → API 키 관리에서 입력         │
└─────────────────────────────────────────┘
```

## 4-2. 자동 소싱 로직 (JavaScript)

```javascript
async function autoSourcing(category, minMargin, maxCost) {
  const apiKey = localStorage.getItem('domeggook-api-key');
  if (!apiKey) {
    showToast('⚠️ 도매꾹 API 키를 설정 탭에서 입력해주세요.');
    return;
  }

  showLoading('도매꾹에서 상품 검색 중...');

  // 1. 도매꾹에서 카테고리 상품 검색
  const items = await callApi('/domeggook/search', { query: category });

  showLoading('시중가 분석 중...');

  // 2. 각 상품 마진 계산
  const analyzed = [];
  for (const item of items.items || []) {
    if (item.price > maxCost) continue;

    const compare = await callApi('/compare', {
      query: item.name,
      cost: item.price
    });

    if (!compare.success) continue;

    const bestMargin = Math.max(
      ...Object.values(compare.margins || {}).map(m => m.margin || 0)
    );

    if (bestMargin >= minMargin) {
      analyzed.push({
        ...item,
        marketPrices: compare.market_prices,
        margins: compare.margins,
        bestMargin,
        bestMarket: compare.best_market,
        trend: compare.trend,
      });
    }

    // API 과부하 방지
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. 마진 높은 순 정렬 후 표시
  analyzed.sort((a, b) => b.bestMargin - a.bestMargin);
  displayAutoSourcingResults(analyzed);
}
```

---

# 작업 5 — 판매채널 연동 뼈대

마켓 API 키 발급 후 즉시 연결할 수 있도록 구조만 구현.

## 5-1. 판매관리 탭에 마켓 연동 상태 표시

```
┌─────────────────────────────────────────┐
│ 🔗 마켓 연동 현황                        │
│                                         │
│ 스마트스토어  ○ 미연결   [연결하기]      │
│ 쿠팡          ○ 미연결   [연결하기]      │
│ 11번가        ○ 미연결   [연결하기]      │
│                                         │
│ 연결된 마켓이 없습니다.                  │
│ 연결 시 주문이 자동으로 수집됩니다.      │
└─────────────────────────────────────────┘
```

## 5-2. 설정 탭에 마켓 API 키 입력란 추가

```
🛒 마켓 API 키 섹션 추가

스마트스토어
  Client ID:     [               ] [저장]
  Client Secret: [               ] [저장]

쿠팡 Wing
  Access Key:    [               ] [저장]
  Secret Key:    [               ] [저장]

11번가
  API Key:       [               ] [저장]
```

## 5-3. 백엔드 마켓 주문 수집 엔드포인트 (main.py, 뼈대만)

```python
@app.get("/orders/smartstore")
async def get_smartstore_orders(request: Request, date_from: str = None):
    """스마트스토어 주문 수집 - API 키 발급 후 구현"""
    client_id = request.headers.get("X-Smartstore-Client-Id", "")
    client_secret = request.headers.get("X-Smartstore-Client-Secret", "")

    if not client_id or not client_secret:
        return {
            "success": False,
            "error": "스마트스토어 API 키 미설정",
            "guide": "설정 탭 → 마켓 API 키에서 입력해주세요."
        }

    # TODO: 스마트스토어 커머스 API 연동
    # https://apicenter.commerce.naver.com
    return {"success": False, "error": "준비 중"}


@app.get("/orders/coupang")
async def get_coupang_orders(request: Request, date_from: str = None):
    """쿠팡 Wing 주문 수집 - API 키 발급 후 구현"""
    access_key = request.headers.get("X-Coupang-Access-Key", "")
    secret_key = request.headers.get("X-Coupang-Secret-Key", "")

    if not access_key or not secret_key:
        return {
            "success": False,
            "error": "쿠팡 API 키 미설정",
            "guide": "설정 탭 → 마켓 API 키에서 입력해주세요."
        }

    # TODO: 쿠팡 Wing API 연동
    # https://developers.coupangcorp.com
    return {"success": False, "error": "준비 중"}
```

---

# 작업 6 — 상품별 성과 분석 탭 개선

## 6-1. 통계 탭에 상품별 성과 분석 섹션 추가

```
┌─────────────────────────────────────────┐
│ 📊 상품별 성과 분석      [이번달 ▼]      │
├─────────────────────────────────────────┤
│ 정렬: [순이익 높은순 ▼]                  │
│                                         │
│ 🏆 TOP 상품                             │
│ 1위 블루투스이어폰  순이익 45,200원      │
│    판매 12개 / 마진율 22.3%             │
│    마켓: 스마트스토어 / 카테고리: 전자   │
│                                         │
│ 2위 무선충전기      순이익 38,100원      │
│    판매 9개 / 마진율 19.8%              │
│    마켓: 쿠팡 / 카테고리: 전자          │
│                                         │
│ ─────────────────────────────────────  │
│ 📉 부진 상품 (마진율 5% 미만)           │
│ • 폰케이스 (마진율 3.2%) → 재검토 필요  │
├─────────────────────────────────────────┤
│ 마켓별 수익성 비교                       │
│ 스마트스토어 ████████ 22.3% 평균        │
│ 쿠팡         ██████   18.1% 평균        │
│ G마켓        ████     12.4% 평균        │
├─────────────────────────────────────────┤
│ 카테고리별 마진율                        │
│ 전자기기  ████████ 21.4%               │
│ 생활용품  ██████   17.2%               │
│ 패션      ████     13.1%               │
└─────────────────────────────────────────┘
```

## 6-2. 소싱 → 판매 전환율

```
소싱목록 등록: 45개
판매 결정: 12개
실제 판매 발생: 8개

소싱 전환율: 26.7%
판매 전환율: 66.7%
```

---

# 절대 변경 금지
1. 구글 OAuth 로그인 로직
2. 구글 시트 연동 (script-url)
3. 다크 테마 (#0d0f14, #1a1d24, #4ade80)
4. 기존 저장 데이터 구조

---

# 작업 완료 후 해야 할 것

```
1. Apps Script → 프로젝트 설정 → 스크립트 속성에 추가:
   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET / KAKAO_TOKEN

2. Apps Script에서 setupTriggers() 함수 1회 수동 실행
   → 매일 오전 9시 가격 추적 자동 시작

3. 카카오 개발자 설정:
   developers.kakao.com → 앱 생성 → REST API 키 복사
   → 앱 설정 탭에 입력 → 테스트 알림 전송 확인
```
