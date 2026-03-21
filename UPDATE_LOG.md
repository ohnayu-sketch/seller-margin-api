# Seller Dashboard UPDATE LOG

## [2026-03-22] 탭 상태 유지(Persistence) 및 SEO 상품명 생성기(T5) GAS 연동 완료

### 🚀 Phase 1: 탭 상태 유지(Persistence) 복구
- **문제**: 새로고침 시 항상 기본 탭(T1)으로 초기화되어 작업 컨텍스트가 날아가는 현상 발생.
- **해결**: `js/main-logic.js`에 `localStorage`를 활용하여 마지막 활성화된 탭 ID 저장 및 초기 로드 시 복원 로직 추가.
- 관련 워크플로우 문서 추가 (`.agents/workflows/tab-persistence.md`).

### 🚀 Phase 2: T5 Studio 연동 및 SEO 상품명 생성기 완성
- **모듈 통합**: V6 대시보드 구조에 맞춰 누락되었던 `js/t5-studio.js` 스크립트를 명시적으로 로드하도록 복원 (`seller-dashboard-v6.html`).
- **백엔드 프록시 (GAS)**: 네이버 검색광고 API를 안전하게 호출하기 위해 `apps-script-code.gs`에 `naverSearchAdProxy` 추가 (HMAC-SHA256 시그니처 + 캐싱 도입).
- **프록시 오타 교정**: `t5-studio.js`의 호출 엔드포인트를 `naverAdProxy`에서 `naverSearchAd`로 수정.
- **배포**: `$ npm run clasp deploy` (자동화 워크플로우 적용) 실행 및 정상 통신 `✅ 서버 연결 성공!` E2E 검증 완료.

### 📋 클리퍼(Clipper) 2-Track 분리 기획안 도출
- Track A (시장 리서치 & 위닝 아이템 발굴): 네이버 데이터랩 등 분석 지표 위주.
- Track B (도매 데이터 수집 & 정제): 도매 플랫폼 상품의 가격/이미지/정보 수집 위주.
- `implementation_plan.md` 내에 구조 템플릿 제안 완료.

---## [2026-03-11] T1 소싱 인텔리전스 V5.5 마스터 블루프린트 전면 개편 + 시스템 설정 보존 버그 수정 + Mock 전면 삭제

### 근거 지시서

CEO Phase 2: Peripheral Sync / V5.5 Master Blueprint Update

### 변경 요약

#### 🔧 T1 메인 검색 엔진 전면 교체 (`runIntegratedV5Search`)

- `Promise.all` → `Promise.allSettled` 전환 (API 1개 실패 시에도 정상 작동)
- **2단 Data Cleansing**: 지재권(브랜드 금지어) 필터 + 도배성 중복 이미지 제거
- **Price Tiering**: 30분위/70분위 기준 저가 방어형/중가 표준형/고가 프리미엄 자동 분류
- **빈집 보호 로직**: B2B 공급 데이터 없는 아이템은 마진 필터 우회하여 무조건 노출
- 네이버 검색 결과 display: 30 → 50으로 확대

#### ⚡ 4대 소싱 진입점 중앙 엔진 직결

- `triggerUnifiedSearch()` 배관 함수 신규 생성 → 4개 모듈이 중앙 엔진으로 통합
- `searchByCategory()` → `triggerUnifiedSearch` 호출로 변경
- `updateOpportunityRadar()` → `triggerUnifiedSearch` 연동
- `briefSearch()` → try-catch 방어 + 중앙 엔진 직결
- 검색 입력창 Enter 키 바인딩 추가

#### 🛡️ 시스템 설정 보존 버그 수정 (`safeClearCache`)

- **문제**: Rescue UI의 "캐시 초기화" 버튼이 `localStorage.clear()` → API 키 전부 삭제
- **해결**: `safeClearCache()` 함수 신규 생성 — 16개 보호 키 패턴을 백업 후 복원
- 보호 대상: API 키(6종), 프록시 URL, 마진 필터, 비밀번호, 시스템 설정, 브랜드 금지어, 허용 이메일

#### 🔒 DOM Null Reference 방어

- `recalcMargin()` 함수에 `if (!document.getElementById('costPrice')) return;` Safe Guard 추가

### 변경 파일

- `seller-dashboard-v5.html`: 메인 엔진 교체, 4대 트리거 연동, safeClearCache 추가, Safe Guard
- `js/main-logic.js`: triggerUnifiedSearch, searchByCategory, recalcMargin, updateOpportunityRadar 동기화

### 롤백 방법

- Git: `git checkout HEAD~1 -- seller-dashboard-v5.html js/main-logic.js`
- 백업: `_archive_legacy/v5_backups/` 내 최신 백업으로 교체

### 변경 금지 위반 여부

- ✅ CLIENT_ID: 미접촉
- ✅ 다크 테마 CSS: 미접촉
- ✅ SCRIPT_URL: 미접촉 (기존 fetchGas 패턴 유지)
- ✅ MARKET_INFO: 미접촉
- ✅ calcForMarket: 미접촉
- ✅ localStorage 키: 기존 키 변경 없음 (safeClearCache는 보호만 추가)

---
## [2026-03-07] 렌더링 마비 사태 긴급 핫픽스 및 V6.0 레이아웃 통폐합 (Phase 12 후속 조치)

### 🚨 트러블슈팅 - 탭 이동 전체 먹통/빈 화면 이슈 (UI 무결성 붕괴 복구)
- **이슈 사유:** `page-studio(T6)` 탭과 모바일/데스크톱 네비게이션 버튼을 추가했으나 `js` 영역의 `TAB_IDS` 변수 배열 아이템 개수와 순서를 HTML 마크업에 동기화하지 않음.
- **해결 내역:** `TAB_IDS = ['sourcing', 'inventory', 'ledger', 'finance', 'setup', 'studio']` 순서 정립. 상/하단 `<div class="tabs">` 및 `<nav class="tab-bar">` 순서를 T1 ➔ T6까지 V6.0 아키텍처에 완벽히 동기화.

### 🛠️ 구조 개편 내역
1. **[T2: 재고/소싱 관제 3단계 하위 구성 이식 & 시뮬레이터 탭 철거]**
   - 구 `page-simulator` (🧮) 맵과 탭을 삭제. 시뮬레이터 내부의 **직접 입력(마켓 연산) 기능 + 오프라인 현장공급처 위젯**을 T2 `page-inventory` 하위의 **🏬 현장 사입 관제 탭** (`t2-view-field`)으로 완전 이탈 및 이식.
   - **해외 직구 관세 환율 위젯**은 T2의 **✈️ 해외 직구 원가/관세 계산기** (`t2-view-global`)로 분리 이식.
2. **[T5: 시스템 설정 API Key Vault 3단계 구조화]**
   - 클릭 먹통 발생 원인이었던 DOM 순서를 복구
   - 저장되어 있던 API Key 관련 Form 요소들을 역할에 맞게 시각적으로 3단계 블록으로 구획.
   - 1단계: 백엔드 접속 및 통신(FastAPI)
   - 2단계: 소싱 및 발주(Naver, Itemscout, 1688 Open API 등)
   - 3단계: 미디어 및 그로스 마케팅(Cloud Vision, Gemini API 등)
3. **[UI 무결성 방어 4대 원칙 각인]**
   - `.cursor/rules/ui-integrity.md` 파일 생성 및 "DOM-JS 강제 동기화", "Hydration 격리 준수", "선 이식 후 철거", "지식 관리(SUMMARY/LOG) 기록 의무" 4원칙 기록 완료

### 🛠️ [2026-03-07 추가] 전면 구조조정: V6.0 파이프라인 복구 및 투트랙 UI 구축 완료
- **과업 1 (DOM 공간 격리):** T1에 방치된 하위 탭 호출 버튼 제거, `vendor-modal`의 `fixed` 속성 해제 및 T2 `t2-view-field` 내부로 완전 종속(Encapsulation) 완료.
- **과업 2 (미들웨어 및 EventBus 조립):** `StandardProductInfo` 미들웨어 객체 복원 및 `AppEventBus` 구현을 통해 T1에서 T2로 단일 규격 데이터 라우팅 파이프라인 연결 복구.
- **과업 3 (T1 투트랙 아키텍처 구현):** T1 화면을 상단(통합 검색창/연관 검색어)과 중하단(백그라운드 스크래핑용 30구역 고밀도 그리드)으로 분리하여 렌더링.

### 🧠 [2026-03-07 추가] 백엔드 MCP 마운트 및 지능형 시스템 실전 가동 (5대 과업 및 Phase 9, 10)
- **과업 1:** Data Oracle MCP(`mcp_server.py`) 및 재무 알고리즘(Tax/Miller-Orr)의 T1/T4 프론트엔드 실시간 연동 및 화면 렌더링 완료.
- **과업 2:** Phase 10에 따른 [AI 스튜디오/vision-clean] 상세페이지 생성 파이프라인을 T2 하단에 렌더링하는 기틀 마련.
- **과업 3:** Phase 9 통합 멀티마켓 뼈대(`tab_oms.html` 구조) 마운트 및 백엔드(스마트스토어/쿠팡 변환기) 통합 달성.

### [2026-03-08] V6.0+ 대수술 최종 완료: 데이터 파이프라인 시동 및 보안 인프라 정화
- **T1 핵심 로직 바인딩:** `Landed Cost` 기반 15% 이상 수익 상품 자동 하이라이트(`opp-highlight`) 기능과 `AI Sourcing Logs` 시각화 패널 주입 완료.
- **T7 시스템 컨트롤 타워 정교화:** 동적 플랫폼 무한 확장 UI, 4자리 PIN 2FA 이중 인증 체계, 동적 화이트리스트 접근 권한 관리 로직 활성화.
- **레거시 파일 대숙청(Purge):** 과거 V3, V4, V5 백업 파일 및 불필요한 Python 스크립트 50여 개를 `_archive_legacy` 폴더로 격리하여 코드베이스 정화.
- **보안 감사 및 강화:** `.env` 기반 민감 정보 격리 설계 및 `_archive_legacy`, `.cursor`, `*.json`(보안 키) 등이 포함된 철벽 `.gitignore` 환경 구축.
- **인프라 격상:** GitHub Actions 스크래핑 크론 주기를 1시간으로 격상하여 초광역 감시망 실시간성 확보.

**최종 요약:**
데이터 기반의 의사결정(T1), 강력한 인벤토리 통제(T2), 투명한 재무 가시성(T4), 그리고 철저한 보안 통제(T7)가 통합된 V6.0 아키텍처 수술을 성공적으로 종료함.

**배포 상태:** GitHub 동기화 및 V6.0 정식 릴리즈 완료.

---

## [2026-03-10] 장기 로드맵 Phase 1~4 구현 + 시스템 대정비

### 🚀 Phase 1: 통합 공급처 DB
- `js/supplier-db.js` (140줄) 신규 생성
- 5개 소스 (도매꾹/도매토피아/1688/알리익스프레스/타오바오) 비교 검색
- 12개 데모 상품 + 환율 변환 + 비교 테이블 + T2 시뮬레이터 연동
- T1 소싱 탭에 검색 패널 UI 삽입

### 🚀 Phase 2: 마켓 등록 파이프라인
- `js/market-register.js` (155줄) 신규 생성
- 등록 대기열 + 3개 마켓 (스마트/쿠팡/11번가) 수수료 시뮬레이션
- EventBus `PRODUCT_SOURCED` 이벤트 연동
- T6 OMS에 등록 파이프라인 패널 삽입

### 🚀 Phase 3: AI 에이전트 MVP
- `js/ai-agent.js` (130줄) 신규 생성
- 플로팅 🤖 채팅 위젯 (우하단 고정)
- 로컬 규칙 기반 응답 + Gemini API 연동 (키 있으면)
- 컨텍스트 인식 (현재 탭, 대기열 상태)

### 🚀 Phase 4: 직거래처 CRM DB
- `js/crm-db.js` (110줄) 신규 생성
- 거래처 등록/검색/삭제 + 3개 데모 거래처
- 거래 이력 (총 주문/금액/최근일) 표시
- T3 장부에 직거래처 관리 패널 삽입

### 🛠️ CSS/레이아웃 수정
- `.page` max-width: 1200px → **1400px** 전 탭 통일
- T5/T6 인라인 1200px → 1400px, T7 960px → 1400px
- `.tabs` sticky: `top:0` → `top:56px` (header 아래 고정) + `backdrop-filter:blur(12px)`
- `z-index: 99` → `100` (탭 가림 방지)

### 🛠️ Script 로드 수정
- `<script>` 태그 중첩 버그 수정 (인라인 안에 외부 src 배치 → 분리)
- 4개 외부 JS (`supplier-db`, `market-register`, `ai-agent`, `crm-db`) body 끝에 정상 로드

### 📋 문서 정비
- `task.md.resolved`: 2개 대화 이력 완전 통합 (핫픽스 7건 + Phase 1~4 + 미완료)
- `system_architecture.md.resolved`: 파이프라인 흐름도 + 모듈 + 파일 구조 갱신
- `ANTI_PATTERNS.md`: 금액 쉼표 규칙(#7) + script 중첩 금지(#8) 추가
- `.agent/` + `.agents/` 워크플로우 폴더 → `.agents/workflows/`로 통합
- `/anti-pattern-check` 워크플로우 신규 생성

### 🛠️ [2026-03-10 추가] T1 소싱 인텔리전스 점검 + 탭 UI/금액 포맷 수정
- **Script 태그 수정:** `seller-dashboard-v5.html` L7 Chart.js CDN `<script src>` 태그 닫힘 누락 → 분리 수정
- **T1 전체 점검:** 10개 모듈 브라우저 점검 완료 (시즌타이밍/인사이트허브/기회레이더/검색엔진/HTS스크리너 등)
- **Sticky 탭 수정 (`css/main.css`):**
  - `header` 배경 `var(--surface)` → `var(--bg)` (불투명) + `backdrop-filter: blur(12px)`
  - `.tabs` `top: 0` → `top: 56px` (header 높이 보정) + 불투명 배경
- **금액 쉼표 포맷 (`config.js`):** `CurrencyFormat` 유틸리티 추가 — 17개 금액 input 실시간 쉼표(1,000) 적용
- **쉼표-safe 파싱 (`js/main-logic.js`):** `getInputs()` 함수에 `_pf` 래퍼로 쉼표 포함 값 안전 파싱
- **발견 이슈:** 인사이트 허브 초기 로딩 시 "데이터 수집 대기 중" — Apps Script 미배포 시 외부 API 스킵

### 🚀 [2026-03-10 추가] Apps Script 배포 + CacheService 속도 최적화
- **Apps Script 배포:** `조지아마켓설정` 프로젝트에 V5 통합 코드 배포 (v4→v5)
  - CRUD 20개 action + 프록시 7개 (네이버/환율/도매꾹/TourAPI/기상청/관세청/KOTRA)
  - 스크립트 속성에 5개 API 키 등록 확인 (`NAVER_CLIENT_ID/SECRET`, `EXIM_KEY`, `DOMEGGOOK_KEY`, `DATA_GO_KR_KEY`)
- **CacheService 캐싱 적용:** `cachedProxy()` 래퍼 함수 추가 — 7개 프록시 action에 서버측 캐싱
  - TTL: 네이버/환율 1시간, 도매꾹 30분, TourAPI/관세청/KOTRA 24시간, 기상청 12시간
  - 캐시 키: action + body MD5 해시 기반 (동일 요청 식별)
- **localStorage API 키 복원:** 20개 항목 브라우저에 일괄 복원
