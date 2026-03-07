# Seller Dashboard V6.0 Core Architecture & Knowledge Base

본 문서는 안티그래비티(Anti-Gravity) AI 에이전트가 다음 작업 세션 진입 시 컨텍스트 상실을 방지하기 위해 기록된 핵심 아키텍처 및 탭 구조(DOM 레이아웃) 영구 지식 저장소입니다.

## 📌 [1] 네비게이션 및 탭 스크립트 구조 (TAB_IDS)
현재 앱은 V6.0 기반의 7개 메인 탭(T1~T7) 구조로 확립되어 있습니다. JS의 `TAB_IDS` 배열 길이는 데스크톱/모바일 네비게이션 버튼 수와 정확히 1:1로 일치해야 합니다(`showTab` 로직 무결성 원칙).

**정확한 순서 및 DOM ID:**
1. **T1 🔍: 소싱 인텔리전스** (`id="page-sourcing"`)
2. **T2 📦: 재고/소싱 관제** (`id="page-inventory"`) - 구버전 시뮬레이터 탭 흡수통합
3. **T3 📒: 통합 자산 장부** (`id="page-ledger"`)
4. **T4 💰: 재무 인사이트** (`id="page-finance"`)
5. **T5 ⚙️: 시스템 설정** (`id="page-setup-old"`) - T7으로 기능 이관 및 ID 변경
6. **T6 🎬: 마켓 스튜디오** (`id="page-studio"`) - 미디어 및 자동화(Phase 12)
7. **T7 🛡️: 컨트롤 타워** (`id="page-setup"`) - 권한/플랫폼/보안 중심 (T5 기능 흡수 및 격상)

## 📌 [2] 주요 탭별 핵심 구성요소
- **[T2 재고/소싱 관제 하위 탭 분리]**
  - 앱 내 `window.showT2SubTab('tracking' | 'field' | 'global')` JS 함수를 통해 분리 렌더링
  - `t2-view-tracking`: 🚚 사입/물류 관제 타임라인
  - `t2-view-field`: 🏬 현장 사입 관제 및 마진 계산 (구 시뮬레이터 마이그레이션 적용)
  - `t2-view-global`: ✈️ 해외 직구 원가/관세 계산기 전용 뷰
- **[T7 컨트롤 타워 - 보안 및 확장]**
  - **Dynamic Platforms**: 무한 확장 가능한 도매처/마켓 커스텀 플랫폼 관리
  - **Access Control**: 동적 화이트리스트 기반 Google OAuth 접근 권한 제어
  - **Security Vault**: 4자리 PIN 2FA 이중 인증 체계 및 API Key 암호화 보관
- **[T6 마케팅 스튜디오]**
  - 좌측: 타겟 상품/미디어/톤앤매너 폰 컨트롤러 및 AI 스크립트 (TTS 포함) 에디터
  - 우측: 결과물 렌더링/미리보기 DOM
  - 🚨 컴플라이언스(HITL) 모달: 하단 전역 오버레이 `<div id="compliance-modal-overlay">` 로드

---
**※ 경고**: 본 파일에 기재된 탭 순서 구조 및 하위 컨트롤러 구성은 변경 부작용 방지(UI 무결성 지침)를 위해 어떠한 경우에도 임의로 조작하거나 파괴해서는 안 되며, 확장 시 본 문서를 필히 함께 업데이트해야 합니다.
