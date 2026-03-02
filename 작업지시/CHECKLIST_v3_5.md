# 기능 구현 체크리스트 — v3.5 (로그인 + 실시간 계산)

> 지시서: `cursor_수정지시서_v3_5_login_realtime.md`  
> 업데이트 시 이 체크리스트를 통해 누락/중복 없이 수정·보완하세요.

---

## 1. 실시간 마진 계산

- [x] `recalcMargin()` 함수 존재
- [x] `roundTo10()` (또는 `roundTo10`) — 10원 단위 반올림
- [x] `calculate()` 는 `recalcMargin()` 호출 래퍼로 유지
- [x] `costPrice`, `supplyShipping`, `marketShipping` 에 `oninput="recalcMargin()"`
- [x] `targetMargin`, `targetMarginSlider`, `fee-single` (또는 fee-smart/coupang/open) 에 `oninput="recalcMargin()"` 또는 연동
- [x] 결과 영역 항상 표시, 버튼 제거("마진 계산하기" 제거)

---

## 2. 배송비 프리셋

- [x] 도매 배송비 프리셋 버튼 (무료, 2,500, 3,000, 5,000)
- [x] 마켓 배송비 프리셋 버튼 (무료, 2,500, 3,000)
- [x] `setSupplyShipping(v)` / `setMarketShipping(v)` 또는 `setShip(type, val)` 로 값 설정 후 `recalcMargin()` 호출

---

## 3. 역산 계산기

- [x] `id="inverse-sale-input"` (목표 판매가)
- [x] `id="inverse-margin"`, `id="inverse-profit"`, `id="inverse-max-cost"` 표시
- [x] `calcInverse()` 함수 존재, 입력 시 호출

---

## 4. 손익분기점

- [x] `id="monthly-target"` (이번달 목표 수익)
- [x] `id="be-qty"`, `id="be-sales"`, `id="be-cost"`, `id="be-daily"` 표시
- [x] `calcBreakEven()` 함수 존재, `window._lastResult` 기반

---

## 5. 최근 조회 히스토리

- [x] `id="search-history-chips"` 요소
- [x] localStorage 저장 (최대 10개, name/min/avg/max/at)
- [x] `saveToSearchHistory` 또는 `saveToHistory` — 시중가 조회 성공 시 호출
- [x] `renderSearchHistory` 또는 `renderHistory` — 칩 렌더링
- [x] `loadFromSearchHistory(idx)` 또는 `loadFromHistory(idx)` — 클릭 시 상품명·참고가 복원 후 `recalcMargin()`

---

## 6. 시중가 조회·실상품 카드

- [x] `/search?query=...&include_trend=true` 호출
- [x] `top_items` 로 최저가/평균가 근처 상품 카드 (mp-product-cards-min, mp-product-cards-avg)
- [x] 타겟층 API `/target?query=...&category=...` 호출
- [x] 트렌드(시즌) 데이터 표시
- [x] 시중가 조회 후 `ref-price`(참고 판매가) 자동 입력

---

## 7. 구글 로그인

- [x] GSI 버튼: `id="google-btn-container"`, `google.accounts.id.renderButton()` 초기화
- [x] **GSI 실패 시 폴백**: `id="custom-google-btn"` 커스텀 버튼 표시
- [x] **리디렉트 로그인**: `startGoogleOAuth()` — OAuth 인증 URL로 이동, nonce 저장
- [x] **복귀 처리**: `processGoogleUser()` / `processGoogleUserFromHash()` — hash의 `id_token` 파싱, nonce 검증 후 로그인 처리
- [x] **CSRF**: `sessionStorage` 에 `oauth-nonce` 저장, 리디렉트 복귀 시 비교

---

## 8. Backend (main.py)

- [x] `GET /search` — `query`, `include_trend`
- [x] 응답에 `top_items` 배열
- [x] `include_trend=true` 시 `trend` 객체 (season, monthly_data 등)
- [x] `GET /target` — query, category
- [x] `GET /parse-url` — 도매꾹 URL 원가 추출 (선택)

---

## 9. 변경 금지 항목 (지시서 §7)

- [ ] `CLIENT_ID` 값 변경하지 않기
- [ ] 다크 테마 CSS 변수 유지
- [ ] `SCRIPT_URL` / Apps Script 연동 로직 유지
- [ ] `MARKET_INFO` / `calcForMarket()` 시그니처 유지
- [ ] localStorage 키 구조 기존과 호환 유지

---

**체크 방법**: 업데이트 후 이 파일을 열고 각 항목을 [x]로 표시.  
**미완료([ ])**: 다음 세션에서 우선 구현할 항목.
