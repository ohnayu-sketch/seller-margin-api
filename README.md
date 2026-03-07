# 셀러 마진 계산기 (소싱 프로그램)

위탁판매용 마진 계산·소싱목록·판매관리·간이과세 회계까지 한 번에 관리하는 시스템입니다.

## 📁 프로젝트 구조

```
소싱프로그램/
├── docs/
│   └── SYSTEM_DESIGN.md    # 전체 시스템 설계서 (크로드 개발지시서)
├── backend/                 # Python FastAPI (네이버쇼핑 API)
│   ├── main.py              # A-1 시중가 / A-2 product-stats / A-3 category
│   ├── requirements.txt
│   └── render.yaml          # Render.com 배포 설정
├── apps-script/             # 구글 시트 연동 스크립트
│   ├── Code.gs              # B-1~B-5 상품목록 확장, 판매기록, 매입매출, 월별통계
│   └── README.md
├── frontend/                # (확장용) 대시보드 작업 디렉터리
├── seller-dashboard-v3.html # 현재 배포 중인 대시보드 (Netlify)
├── .env.example             # API 키는 환경변수로 설정
└── README.md
```

## 🚀 로컬에서 백엔드 실행

```bash
cd backend
# 가상환경 권장
pip install -r requirements.txt
# .env 또는 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
uvicorn main:app --reload --port 8000
```

- `GET http://localhost:8000/` — 상태 확인
- `GET http://localhost:8000/search?query=블루투스이어폰` — 시중가 조회
- `GET http://localhost:8000/category?query=블루투스이어폰` — 카테고리 분류
- `GET http://localhost:8000/product-stats?query=블루투스이어폰` — 경쟁 강도 등

## 📋 설계서 기준 작업 순서

1. **작업 1** — Python 서버 완성 (main.py) ✅ 뼈대 완료
2. **작업 2** — Apps Script 확장 (B-1~B-5) ✅ 시트·액션 뼈대 완료 (일부 로직·트리거 미완료)
3. **작업 3** — 프론트엔드 확장 (C-1~C-5) ⚠️ C-1~C-4 핵심 완료, C-5·일부 UI 미완료
4. **작업 4** — 구글 드라이브 자동 정리 (D) ❌ 미구현

자세한 스펙은 `docs/SYSTEM_DESIGN.md` 를 참고하세요.

---

## ⏳ 아직 완료되지 않은 것 (README 기준)

### 작업 2 — Apps Script
| 항목 | 상태 |
|------|------|
| B-4 `generateMonthlyReport()` | 시트만 생성됨, **실제 월별 집계 로직** 미구현 |
| B-4 매월 1일 자동 집계 트리거 | **트리거 설정** 미구현 |
| B-5 `calculateSimplifiedVAT(year)` | **플레이스홀더** (실제 부가세 계산 없음) |
| B-5 `organizeGoogleDrive()` | **플레이스홀더** (드라이브 폴더 정리 없음) |

### 작업 3 — 프론트엔드
| 항목 | 상태 |
|------|------|
| C-1 카테고리 드롭다운 (수동 변경) | 시중가 조회로 표시만 됨, **드롭다운 선택·저장** 없음 |
| C-1 "판매 결정" 토글 (계산 탭) | **미구현** (소싱목록의 "판매 시작"만 있음) |
| C-2 각 카드 "시중가 대비 우리 판매가" | **미구현** |
| C-3 판매 성과 그래프 (바 차트) | **미구현** |
| C-3 하단 전체 요약 (마켓별/카테고리별 비중, 베스트 TOP3) | **미구현** |
| C-4 연간 부가세 계산기 (1기/2기, 납부 예상액) | **미구현** |
| C-5 통계 탭 개선 | **카테고리별 마진율, 월별 매출 추이 차트, 마켓별 성과, 판매 전환율** 전부 미구현 |

### 작업 4 — 구글 드라이브 (D)
| 항목 | 상태 |
|------|------|
| 드라이브 폴더 구조 (연도→월, 영수증 등) | **미구현** |
| 월별 리포트 PDF 자동 생성 | **미구현** |
| 매입매출 CSV 자동 내보내기 | **미구현** (대시보드에서 수동 CSV만 가능) |
| 매월 1일 / 매일 자정 트리거 | **미구현** |

## 배포

- **프론트**: `seller-dashboard-v3.html` → Netlify 드래그앤드롭
- **백엔드**: `backend/` → GitHub# 셀러 마진 계산기 (소싱 프로그램) V5

위탁판매 및 사입 비즈니스의 아이템 발굴, 마진 계산, 재고 관리, 재무 인사이트까지 한 번에 관리하는 다이내믹 대시보드 시스템입니다.

## 📁 프로젝트 구조 (V5)

```
소싱프로그램/
├── v5/                      # V5 개발 메인 디렉터리
│   ├── components/          # HTML 컴포넌트 (사이드바, 각 탭)
│   ├── js/                  # 비즈니스 로직 및 API 연동 스크립트
│   ├── css/                 # 스타일시트 (다크모드/모던 UI)
│   └── scripts/             # 빌드 및 유틸리티 파이썬 스크립트
├── backend/                 # Python FastAPI (네이버쇼핑/아이템스카우트 API 연동)
├── apps-script/             # 구글 시트 연동 스크립트 (Apps Script)
├── seller-dashboard-v5.html # 최종 빌드된 통합 대시보드 파일 (메인 실행 파일)
├── build_v5.py              # 컴포넌트를 하나로 합쳐주는 빌드 스크립트
└── README.md
```

## 🚀 핵심 기능 (V5 구현 완료)

### 1. 🔍 소싱 인텔리전스 (Sourcing Intelligence)
- **AI 소싱 기회 레이더**: 시장 데이터를 분석하여 소싱 적기 아이템 자동 추천.
- **시즌별 소싱 타이밍**: 카테고리별 검색 트렌드 분석을 통한 미리보기.

### 2. 🧮 통합 마진 및 사입 시뮬레이터 (Calculator)
- **실시간 마진 계산**: 1,000 단위 자동 콤마(,)와 증감 배지 버튼 지원.
- **Landed Cost 2.0**: 관세, 부가세, 물류비를 포함한 사입 단가 자동 계산.
- **역산 계산기**: 목표 마진율 달성을 위한 최적 판매가 역추적 기능.

### 3. 📦 재고 및 자산 관리 (Inventory & Ledger)
- **구글 시트 실시간 연동**: 소싱 목록과 재고 상태를 스프레드시트에 즉시 기록 및 동기화.
- **통합 상품 장부**: 위탁과 사입 상품을 한 눈에 관리하는 통합 대시보드.

### 4. 💰 재무 인사이트 (Finance Insights)
- **마진율 분석**: 마켓별, 상품별 실시간 수익성 분석 그래프 제공.
- **부가세 진단**: 간이/일반과세자 전환 임계치 도달 알림 및 절세 시뮬레이션.

## 🛠️ 개발 및 빌드 방식

V5부터는 유지보수 효율을 위해 **컴포넌트 기반 개발** 방식을 사용합니다.
`v5/components` 폴더에서 개별 파일을 수정한 후 아래 명령어를 실행하면 `seller-dashboard-v5.html`이 갱신됩니다.

```powershell
# 대시보드 통합 빌드 실행
python v5/scripts/build_v5.py
```

## 🌐 배포 및 동기화 (GitHub 기반)

기존 Netlify 수동 배포 방식에서 **GitHub 저장소 관리** 방식으로 전환되었습니다.

1. **프론트엔드**: `seller-dashboard-v5.html` 파일을 포함한 전 영역을 GitHub에 push하여 버전 관리 및 호스팅 진행.
2. **백엔드**: `backend/` 폴더의 FastAPI 서버를 GitHub 연동을 통해 배포 (Render.com 등 활용).
3. **Apps Script**: `apps-script/Code.gs` 내용을 구글 시트 내 Apps Script에 반영하여 시트 연동 활성화.

---
*최종 업데이트: 2026-03-06 (V5 정식 반영)*
