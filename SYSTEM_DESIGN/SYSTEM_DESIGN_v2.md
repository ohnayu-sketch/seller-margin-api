# 셀러 마진 계산기 — 전체 시스템 설계 문서 v2.0
> 최종 업데이트: 2026-02-28 (Cursor 통합 지시서 반영)  
> ✅ 구현 완료 / 🔶 부분 구현 / ❌ 미구현 / 🆕 설계서에 없던 신규 기능

---

## 현재 배포 환경 (변경 금지)

| 항목 | 값 |
|------|-----|
| Frontend | https://ohnayu-sketch.github.io/seller-margin-api/ |
| Backend API | https://seller-margin-api-georgia.onrender.com |
| GitHub | https://github.com/filmkrcho-cyber/seller-margin-api |
| Google Sheets ID | 1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg |
| Google OAuth Client ID | 985307778387-1v16a641sg34lsmsdbliamfcettauto6.apps.googleusercontent.com |
| Naver Client ID | U1mSVClo9bwFBunvuERp |
| Naver Client Secret | nk6YqwnDWI |

---

## 탭 구조 현황 (절대 변경 금지: 탭 ID)

```
✅ 계산 탭       (page-calc)
✅ 소싱목록 탭   (page-list)
✅ 판매관리 탭   (page-sales)
✅ 회계 탭       (page-accounting)
✅ 통계 탭       (page-stats)
✅ 시즌 탭       (page-season)
✅ 설정 탭       (page-setup)
```

## 구글 시트 탭 구조 (Apps Script 자동 초기화)

```
상품목록  — 36열 (기존 19 + 도매소싱링크·시중최고가·타겟·가격추적·사진링크·사입문서링크·소싱유형·납기·결제조건·위탁가능·담당자)
판매기록  — 11열
매입매출  — 9열
월별통계  — 8열
설정      — 기존 유지
사입기록  — 19열 (저장일시/상품명/공급업체ID·명/단가/최소수량/최소사입총액/납기/결제조건/위탁가능/메모/사진/소싱결과/위탁등록일시/마켓/판매가/마진율/저장자/상품목록ID)
공급업체  — 16열
```

---

## [A] Python 서버 (main.py) 구현 현황

### A-1. ✅ 네이버쇼핑 시중가 조회
```
GET /search?query=상품명&display=30&include_trend=true
→ display 기본 30, 상한 100. top_items 전체 반환 (슬라이싱 없음).
   include_trend=true 시 result.trend 에 season, season_icon, season_desc, monthly_data 포함.
   top_items: [{ title, price, mall, review_count, rating, link, image }]
```

### A-2. ✅ 리뷰/판매량 수집
```
GET /product-stats?query=상품명
→ 구현 완료 (top_items 기반 경쟁강도 계산)
```

### A-3. ✅ 카테고리 자동 분류
```
GET /category?query=상품명
→ category, fee_rate, risk_level, special_notes 반환 완료
```

### A-4. ✅ 통합 분석
```
GET /analyze?query=상품명&cost=원가&sup_ship=...
→ 구현 완료
```

### A-5. ✅ 타겟층 분석 — main.py 구현 완료
```
GET /target?query=상품명&category=카테고리
→ gender, age_groups, main_target 반환 (네이버 데이터랩 쇼핑인사이트/폴백 추정)
```

### A-6. ✅ 트렌드/시즌 분석 — main.py 구현 완료
```
GET /trend?query=상품명
GET /search?query=상품명&include_trend=true  → result.trend 에 season, season_icon, season_desc, monthly_data 포함
→ 네이버 데이터랩 API 기반 시즌 판단
```

### A-7. ✅ 연관검색어 — main.py 구현 완료
```
GET /related?query=상품명
→ KEYWORD_MAP(모자/가방/신발/옷/이어폰/충전기 등) + 검색 결과 기반. keywords 최대 8개.
```

### A-8. ✅ 도매 소싱 — main.py 구현 완료
```
GET /wholesale?query=상품명&site=naver_store|kmall|gmarket_wholesale
→ site별 쿼리(도매/대량구매), items 배열, site_url(도매꾹/도매토피아/오너클랜 링크) 반환
```

---

## [B] Google Apps Script 구현 현황

### B-1. ✅ 시트 구조 확장
```
"상품목록" 시트: 36열 (확장됨)
  기존 19 + 도매소싱링크/시중최고가/타겟성별·연령·트렌드·데이터수집일·주요타겟/가격추적·알림기준가·최종조회일/
  사진링크·사입문서링크(HYPERLINK)/소싱유형·납기리드타임·결제조건·위탁가능·담당자연락처
"사입기록" 시트: 19열 (저장일시/상품명/공급업체ID·명/단가/최소수량/최소사입총액/납기/결제조건/위탁가능/메모/사진/소싱결과/위탁등록일시/마켓/판매가/마진율/저장자/상품목록ID)
"공급업체" 시트: 16열 (업체ID/업체명/대표자/사업자번호/업종/주소/전화/담당자·연락처/이메일/카테고리/최소주문/결제조건/거래시작일/메모/마지막방문일)
```

### B-2. ✅ "판매기록" 시트 생성
```
날짜 | 상품ID | 상품명 | 마켓 | 판매수량 | 판매가 | 매출 | 원가합계 | 순이익 | 마진율 | 저장자
→ saveSalesRecord() 함수 구현 완료
```

### B-3. ✅ "매입매출" 시트 생성
```
날짜 | 구분 | 거래처 | 품목 | 공급가액 | 세액 | 합계 | 증빙유형 | 메모
→ saveAccountingRecord() 함수 구현 완료
```

### B-4. ✅ "월별통계" 시트 구조 생성
```
연월 | 총매출 | 총매입 | 순이익 | 마진율 | 카테고리별매출 | 마켓별매출 | 부가세예상
```

### B-5. ✅ Apps Script 함수 구현 현황

| 함수 | 상태 | 비고 |
|------|------|------|
| `saveSalesRecord(data)` | ✅ 완료 | 판매기록 시트에 저장 |
| `saveAccountingRecord(data)` | ✅ 완료 | 매입매출 시트에 저장 |
| `generateMonthlyReport()` | ✅ 완료 | 판매기록·매입매출 집계 → 월별통계 시트 반영 |
| `calculateSimplifiedVAT(year)` | ✅ 완료 | 1기/2기 공급대가·납부세액·신고기한 반환 |
| `organizeGoogleDrive()` | ✅ 완료 | 셀러마진/년/월/영수증·사입기록, 사입사진, 상품분석 폴더 생성 |
| `saveDirectRecord(data)` | ✅ 완료 | 사진 드라이브 저장 + 사입기록 시트 행 추가, 반환: vendorId, photoUrl, rowNum |
| `updateDirectRecord(data)` | ✅ 완료 | 위탁등록 시 rowNum 기준 소싱결과/마켓/판매가/마진율/상품목록ID 업데이트 |
| `getVendors()` / `saveVendor(data)` | ✅ 완료 | 공급업체 시트 CRUD |
| `getDirectRecords(params)` | ✅ 완료 | 사입기록 목록 (todayOnly 옵션) |

- **generateMonthlyReport**: 총매출(판매기록), 총매입(매입매출), 순이익, 마진율, 부가세예상(3%), 마켓별매출 JSON.
- **calculateSimplifiedVAT**: `action=calculateSimplifiedVAT&year=2026` 호출 가능. period1/period2, totalSupply, totalVAT, isSimplified 반환.

---

## [C] 프론트엔드 구현 현황

### C-1. ✅ 계산 탭 (모든 기능 구현 완료)

| 기능 | 상태 |
|------|------|
| 시중가 조회 버튼 | ✅ |
| 시중 최저/평균/최고가 표시 | ✅ |
| 경쟁강도 표시 (🟢🟡🔴) | ✅ |
| 리뷰 수 / 평점 표시 | ✅ |
| 카테고리 자동 분류 | ✅ |
| 3개 마켓 마진 계산 | ✅ |
| 실시간 마진 계산 (oninput) | 🆕✅ |
| 배송비 프리셋 버튼 | 🆕✅ |
| 역산 계산기 | 🆕✅ |
| 손익분기점 계산 | 🆕✅ |
| 최근 조회 히스토리 칩 | 🆕✅ |
| 실상품 이미지 카드 (top_items) | 🆕✅ |
| 타겟층 표시 (성별/연령대) | 🆕✅ /target 연동 완료 |
| 트렌드/시즌 표시 + 미니차트 | 🆕✅ /search?include_trend=true, /trend 연동 완료 |
| 참고 판매가 자동 입력 | 🆕✅ |
| 연관검색어 칩 + /related | ✅ |
| 도매 소싱 섹션 (도매꾹/도매토피아/오너클랜) + /wholesale | ✅ |
| 최고가 근처 상품 카드 (byMax) + display=30 | ✅ |
| 인기상품 TOP5 (review_count 기준) | ✅ |
| 소싱 모드 토글 (온라인/사입) | ✅ |
| 사입 섹션 (사진/공급업체/단가/납기/결제조건/위탁가능/담당자) + saveDirectRecord | ✅ |
| 위탁등록 모달 (플랫폼 선택/판매가/마진) + submitConsignment | ✅ |
| 공급업체 등록 모달 + saveVendor | ✅ |
| 판매 결정 토글 | ❌ 미구현 |

### C-2. ✅ 소싱목록 탭

| 기능 | 상태 |
|------|------|
| 상품 목록 표시 | ✅ |
| 상품명 검색 필터 | ✅ |
| 마진율 필터 | ✅ |
| 마켓 필터 | ✅ |
| 카테고리 필터 | ✅ |
| 경쟁강도 필터 | ✅ |
| "판매 시작" 버튼 | ✅ |
| 시중가 대비 판매가 표시 | 🔶 시중가 데이터 있을 때만 표시 |

### C-3. 🔶 판매관리 탭

| 기능 | 상태 |
|------|------|
| 판매 중인 상품 목록 | ✅ |
| 판매기록 추가 모달 | ✅ |
| 누적 판매량/매출/순이익 | ✅ |
| 카드 상단 사진(photoUrl) + 🏪사입/🛒온라인 뱃지 + 📄문서 링크 + 납기(leadTime) | ✅ |
| 이번 달 총매출/순이익 요약 | ✅ (표시됨) |
| 마켓별 매출 비중 | ❌ 미구현 |
| 카테고리별 매출 비중 | ❌ 미구현 |
| 베스트 상품 TOP3 | ❌ 미구현 |
| 판매 성과 그래프 | ❌ 미구현 |

### C-4. ✅ 회계 탭

| 기능 | 상태 |
|------|------|
| 이번 달 매출/매입/순이익/부가세 요약 | ✅ |
| 거래 입력 폼 | ✅ |
| 날짜/구분/거래처/품목/금액/증빙/메모 | ✅ |
| 거래 목록 (월별/유형 필터) | ✅ |
| CSV 내보내기 | ✅ |
| 연간 부가세 계산기 | 🔶 Apps Script `calculateSimplifiedVAT` 구현됨, 프론트 호출 UI 연동 시 완료 |
| 간이과세자 기준 자동 계산 | 🔶 위 함수 응답에 isSimplified 포함 |
| 1기/2기 구분 표시 | 🔶 위 함수 응답에 period1/period2, deadline 포함 |

### C-5. 🔶 통계 탭

| 기능 | 상태 |
|------|------|
| 전체 상품 수 | ✅ |
| 평균 마진율 | ✅ |
| 최고 마진율 / 최고 순이익 | ✅ |
| 마진율 TOP5 | ✅ |
| 마켓별 저장 현황 | ✅ |
| 카테고리별 마진율 비교 | ❌ 미구현 |
| 월별 매출/이익 추이 차트 | ❌ 미구현 |
| 소싱 → 판매 전환율 | ❌ 미구현 |
| 판매기록 기반 베스트 TOP3 | ❌ 미구현 |

---

## [D] 구글 드라이브 자동 정리

| 기능 | 상태 |
|------|------|
| 폴더 구조 설계 | ✅ (설계만) |
| 월별 폴더 자동 생성 | ❌ placeholder |
| 월별 리포트 PDF 자동 생성 | ❌ 미구현 |
| CSV 자동 내보내기 | ❌ 미구현 |
| 매일 자정 백업 트리거 | ❌ 미구현 |

---

## [E] 구글 로그인 현황 (진행 중)

| 항목 | 상태 |
|------|------|
| Google GSI 버튼 렌더링 | 🔶 일부 환경(iOS Safari)에서 미작동 |
| 커스텀 구글 버튼 (GSI 실패 시 폴백) | 🆕✅ 추가됨 |
| OAuth implicit flow 리디렉트 | 🆕✅ startGoogleOAuth() 구현 |
| id_token hash 파싱 (복귀 처리) | 🆕✅ 구현됨 |
| 근본 해결: Google Cloud Console 도메인 등록 | ❌ 미등록 상태로 추정 |

**⚠️ 근본 해결 필요:**
```
Google Cloud Console → OAuth 2.0 클라이언트 설정에서
승인된 JavaScript 원본 + 리디렉션 URI에 추가:
https://ohnayu-sketch.github.io/seller-margin-api/
```

---

## Cursor 우선순위별 작업 목록

### 🔴 즉시 처리 (앱 사용에 영향)

**1. main.py — /target** → ✅ 구현 완료 (이미 존재)

**2. main.py — /trend, /search?include_trend=true** → ✅ 구현 완료 (이미 존재)

**3. Google Cloud Console 도메인 등록** (개발자가 직접 해야 함)
```
승인된 JavaScript 원본: https://ohnayu-sketch.github.io/seller-margin-api/
승인된 리디렉션 URI: https://ohnayu-sketch.github.io/seller-margin-api/
```

---

### 🟡 단기 처리 (기능 완성도)

**4. Apps Script — generateMonthlyReport()** → ✅ 구현 완료

**5. Apps Script — calculateSimplifiedVAT()** → ✅ 구현 완료 (action=calculateSimplifiedVAT&year=YYYY)

**6. 판매관리 탭 — 하단 요약 추가**
- 이번 달 총매출 / 총순이익
- 마켓별/카테고리별 매출 비중 (원형 또는 바 차트)
- 베스트 상품 TOP3

**7. 통계 탭 — 고도화**
- 월별 매출/이익 추이 (판매기록 시트 기반)
- 카테고리별 마진율 비교
- 소싱 → 판매 전환율

---

### 🟢 장기 처리 (있으면 좋음)

**8. 회계 탭 — 연간 부가세 계산기 추가**

**9. 구글 드라이브 자동 정리 — organizeGoogleDrive() 실제 구현**
```
📁 셀러마진 (루트)
└── 📁 2026년 / 📁 03월 / 📄 월별리포트.csv, 📁 영수증
```

**10. 판매 결정 토글 — 계산 탭에 추가**
- 소싱 상품을 판매 상품으로 전환하는 토글
- 저장 시 판매결정=Y, 판매시작일=오늘 자동 기록

---

## 절대 변경 금지 항목

| 항목 | 이유 |
|------|------|
| 다크 테마 CSS 변수 (`--accent: #4ade80`) | 전체 디자인 기반 |
| `CLIENT_ID` 값 | Google Cloud Console 등록값 |
| `SCRIPT_URL` / Apps Script 연동 로직 | 구글 시트 저장 기능 |
| `MARKET_INFO` 객체 | 3개 마켓 수수료 구조 |
| `calcForMarket()` 함수 시그니처 | 모든 계산의 기반 |
| `recalcMargin()` 함수 | 실시간 계산 핵심 |
| localStorage key 구조 | 기존 사용자 데이터 보존 |
| 구글 시트 ID | 데이터 보존 |
| 탭 ID 이름 (`page-calc`, `page-list` 등) | JS 전체에서 참조 |

---

## 기술 스택 (최종)

```
프론트엔드: HTML/CSS/JavaScript (단일 파일 SPA)
  호스팅: Netlify (무료)
  인증: Google OAuth 2.0 (GSI + implicit flow 폴백)
  폰트: Noto Sans KR
  저장: localStorage (히스토리, 설정), Google Sheets (상품/판매/회계)

백엔드 API: Python FastAPI
  호스팅: Render.com (무료, 슬립 있음)
  연동: 네이버쇼핑 API (검색 + 통계 + 카테고리)
  /target, /trend, /search?include_trend 구현 완료

데이터베이스: Google Sheets (시트 4개)
  상품목록 / 판매기록 / 매입매출 / 월별통계
  CRUD: Apps Script (doPost/doGet)

파일 저장: Google Drive
  자동 정리: organizeGoogleDrive() (미구현)
```

---

## 변경 이력

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.0 | 초기 | 계산 탭, 구글 시트 연동 |
| v2.0 | ~ | 5개 탭 구조, 회계/판매관리 추가 |
| v3.0 | ~ | 시중가 조회, 경쟁강도 |
| v3.4 | ~ | 카테고리 필터, 소싱목록 개선 |
| v3.5 | 2026-03-01 | 실시간 계산, 역산 계산기, 손익분기점, 히스토리, 이미지 카드, 타겟층 UI, 트렌드 UI, OAuth 폴백 |
| v2.0 doc | 2026-03-01 | 설계서 정리: A-5/A-6 백엔드 구현 완료 반영, B-5 구현 완료, 우선순위 목록 갱신 |
| Cursor 통합 | 2026-02-28 | 전체_구축가이드_Cursor통합지시서 반영: /related KEYWORD_MAP·8개, /wholesale site·site_url, 프론트 display=30·photoUrl·leadTime·최고가카드 CSS, 시트 구조·사입기록·공급업체·organizeGoogleDrive 정리 |
