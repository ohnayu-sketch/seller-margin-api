# 업데이트 기록 (Update Log)

> 문제 발생 시 이전 버전으로 롤백할 때 참고하세요.

## 롤백 방법

1. **특정 파일만 되돌리기**: Git 사용 시 해당 날짜 커밋으로 복원
2. **백업 활용**: 큰 수정 전에 `seller-dashboard-v3.html` 등을 `seller-dashboard-v3_backup_YYYYMMDD.html` 로 복사
3. **체크리스트**: `CHECKLIST_v3_5.md` 에서 해당 버전 체크 상태 확인 후 필요한 기능만 재적용

## 기록 (최신순)

### 2026-03-01 — SYSTEM_DESIGN_v2 미비 사항 반영

**근거**: `SYSTEM_DESIGN_v2.md` Cursor 우선순위별 작업 목록

**변경 요약**
- **Apps Script** `generateMonthlyReport()`: 판매기록·매입매출 시트에서 해당 월 집계 후 월별통계 시트에 행 추가/업데이트 (총매출, 총매입, 순이익, 마진율, 부가세예상 3%, 마켓별매출).
- **Apps Script** `calculateSimplifiedVAT(year)`: 1기(1~6월)/2기(7~12월) 공급대가·납부세액·신고기한 반환, 간이과세 4,800만원 기준.
- **handleRequest**에 `generateMonthlyReport`, `calculateSimplifiedVAT` 액션 추가.
- **SYSTEM_DESIGN_v2.md**: A-5/A-6 ✅, B-5 generateMonthlyReport/calculateSimplifiedVAT ✅, 우선순위 1·2·4·5 완료 반영, 회계 탭 부가세 항목 🔶로 갱신.

**변경 파일**: `apps-script/Code.gs`, `SYSTEM_DESIGN_v2.md`

**롤백**: 위 두 파일을 이전 버전으로 복원.

### 2026-02-28 — v3.5 구글 로그인 폴백 (GSI 실패 시 리디렉트)

**근거 지시서**: `cursor_수정지시서_v3_5_login_realtime.md` §2-7, §6

**변경 요약**
- 로그인 화면: GSI 로딩 재시도(약 8초), 실패 시 `custom-google-btn` 표시
- `startGoogleOAuth()`: OAuth 리디렉트 URL 이동, nonce를 sessionStorage에 저장
- `processGoogleUserFromHash()`: hash의 id_token 파싱, nonce 검증 후 `processGoogleUser()` 호출
- `processGoogleUser(email, name)`: GSI 콜백과 리디렉트 콜백 통합 처리
- `setShip(type, val)` 래퍼 추가 (지시서 호환)

**변경 파일**: `seller-dashboard-v3.html`

**롤백**: 해당 파일을 이전 커밋/백업으로 복원. Google Cloud Console에 `승인된 리디렉션 URI`에 배포 URL 등록 필요.

### 2026-02-28 — v3.5 로그인·실시간 계산 지침 및 인프라

**근거 지시서**: `cursor_수정지시서_v3_5_login_realtime.md`

**추가된 문서/설정**
- `작업지시/UPDATE_LOG.md` (이 파일)
- `작업지시/CHECKLIST_v3_5.md`
- `.cursor/rules/update-rollback.mdc`

**변경 파일**: 없음 (신규 문서만). **롤백**: 위 3개 파일 삭제.

### 2026-02-28 — v3.5 실시간 마진·역산·손익분기·히스토리

**근거 지시서**: `cursor_수정지시서_v3_5.md`

**주요 변경**: recalcMargin, 배송비 프리셋, 역산/손익분기점, 최근 조회 히스토리, parse-url, 계산 탭 A/B.

**변경 파일**: `seller-dashboard-v3.html`, `backend/main.py`

---

*새 업데이트 시 상단(기록 아래)에 새 섹션 추가.*
