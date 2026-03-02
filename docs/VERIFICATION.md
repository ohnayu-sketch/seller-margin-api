# 시스템 동작 확인 체크리스트

SYSTEM_DESIGN.md 기준으로 각 부분이 제대로 작동하는지 확인하는 방법입니다.

---

## 1. 백엔드 API (Python / Render)

### 로컬에서 확인

```bash
cd backend
pip install -r requirements.txt
# .env에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 입력 후
uvicorn main:app --reload --port 8000
```

브라우저 또는 터미널에서 아래 주소 호출:

| 확인 항목 | URL / 방법 | 기대 결과 |
|-----------|------------|-----------|
| 서버 살아있음 | `http://localhost:8000/` | `{"status":"ok","service":"셀러마진 API"}` |
| A-1 시중가 조회 | `http://localhost:8000/search?query=블루투스이어폰` | `success: true`, `min_price`, `avg_price`, `max_price`, `top_items` 있음 |
| A-2 경쟁강도 | `http://localhost:8000/product-stats?query=블루투스이어폰` | `success: true`, `competition_score` (0~100) |
| A-3 카테고리 | `http://localhost:8000/category?query=블루투스이어폰` | `success: true`, `category`, `risk_level`, `fee_rate` |

### Render 배포 후 확인

- 배포 URL: `https://seller-margin-api-georgia-5lro.onrender.com`
  - `https://seller-margin-api-georgia-5lro.onrender.com/` → 위와 같은 JSON
  - `https://seller-margin-api-georgia-5lro.onrender.com/search?query=이어폰` → 시중가 JSON

**실패 시:** 환경 변수(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)가 Render에 설정됐는지, `.env`(로컬)에 값이 있는지 확인.

---

## 2. 구글 Apps Script (시트 연동)

### 배포 확인

1. 구글 시트(ID: `1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg`) 열기
2. **확장 프로그램 → Apps Script** → `apps-script/Code.gs` 내용 붙여넣기 → **배포 → 새 배포 → 웹 앱** (액세스: 모든 사용자)
3. 배포된 **URL 복사** (예: `https://script.google.com/macros/s/.../exec`)

### 동작 확인 (브라우저 또는 curl)

| 확인 항목 | 방법 | 기대 결과 |
|-----------|------|-----------|
| 상품 목록 조회 | `GET` 배포URL`?action=getProducts` | `{"success":true,"products":[...]}` |
| 상품 저장 | `POST` 배포URL, body: `{"action":"saveProduct","products":[...]}` | `{"success":true}` |
| 판매 기록 저장 | `POST` body: `{"action":"saveSalesRecord","record":{...}}` | `{"success":true}` |
| 매입매출 저장 | `POST` body: `{"action":"saveAccountingRecord","record":{...}}` | `{"success":true}` |
| 판매결정 업데이트 | `POST` body: `{"action":"updateProduct","id":"...","sellDecision":"Y","sellStartDate":"2026-02-28"}` | `{"success":true}` |

시트에서 직접 확인:

- **상품목록**: 저장 시 새 행 추가, 컬럼에 카테고리/경쟁강도/시중가/판매결정 등 있음
- **판매기록**: 판매 기록 추가 시 새 시트 또는 행 생성
- **매입매출**: 거래 저장 시 새 시트 또는 행 생성

---

## 3. 프론트엔드 (대시보드)

### 설정

1. **설정** 탭에서 **Apps Script 배포 URL** 입력 → 저장
2. **백엔드 API URL** 입력: `https://seller-margin-api-georgia-5lro.onrender.com` → 저장
3. 허용 이메일 2개 입력 후 로그인

### 탭별 확인

| 탭 | 확인 내용 |
|----|-----------|
| **계산** | 상품명 입력 → **시중가 조회** 클릭 → 최저/평균/최고가·카테고리·경쟁강도(🟢🟡🔴) 표시되는지 |
| **계산** | 원가·마진율 입력 → **마진 계산하기** → **구글 시트에 저장** → 성공 토스트 |
| **소싱목록** | 저장한 상품 목록 표시, 카테고리/경쟁강도 필터 동작, **판매 시작** 클릭 시 판매중으로 바뀌는지 |
| **판매관리** | 판매결정=Y 상품만 보이는지, **판매 기록 추가** → 날짜/수량/판매가 입력 → 저장 후 누적 판매량·매출·순이익 갱신되는지 |
| **회계** | 매입/매출 입력 후 저장, 이번 달 매출/매입/순이익/부가세 예상 카드 표시, 월별 필터·CSV 내보내기 동작 |
| **통계** | 저장 상품 수·평균 마진율·TOP5·마켓별 현황 표시 |

---

## 4. 한 번에 점검하는 순서 (권장)

1. **백엔드**: `/` 와 `/search?query=테스트` 호출 → 200 + JSON
2. **Apps Script**: `?action=getProducts` 호출 → 200 + `success:true`
3. **대시보드**: 로그인 → 설정에 두 URL 저장 → 계산 탭에서 시중가 조회 → 상품 저장 → 소싱목록에 보이는지 → 판매 시작 → 판매관리에서 판매 기록 추가 → 회계에서 거래 한 건 입력

위 순서대로 되면 설계서 기준으로 **핵심 흐름이 정상 동작**하는 것입니다.

---

## 5. 자주 나오는 문제

| 증상 | 확인할 것 |
|------|------------|
| 시중가 조회 시 "API 키 미설정" / 024 에러 | 백엔드 환경 변수(또는 `.env`)에 네이버 Client ID/Secret 설정 여부 |
| 시중가 조회 시 "연결 실패" | 대시보드 설정의 API URL이 맞는지, Render 서비스가 깨웠는지(무료 플랜은 슬립 가능) |
| 저장/목록 안 나옴 | 설정의 Apps Script URL이 **배포된 웹 앱 URL**인지, 시트 ID가 맞는지 |
| 판매 기록/매입매출 저장 실패 | Apps Script에 `saveSalesRecord`, `saveAccountingRecord` 등이 들어 있는 최신 `Code.gs` 배포 여부 |

이 체크리스트대로 확인하면 SYSTEM_DESIGN.md 대로 동작하는지 판단할 수 있습니다.
