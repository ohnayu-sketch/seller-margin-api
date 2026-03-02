# Apps Script 코드

- **Code.gs** — 구글 시트 확장용 메인 스크립트 (B-1~B-5)
- **seller-dashboard-v3.html / seller-dashboard-v4.html** 둘 다 이 스크립트의 배포 URL을 사용합니다. **v4로 바꿔도 Apps Script는 그대로 쓰면 됩니다.**
- 구글 시트에서 **확장 프로그램 → Apps Script** 열고, 이 폴더의 `Code.gs` 내용을 붙여넣은 뒤 배포하세요.
- 시트 ID: `1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg` (Code.gs 상단에서 변경 가능)

## 시트 구성 (설계서 B-1~B-4)

| 시트명   | 용도           |
|----------|----------------|
| 상품목록 | 소싱 상품 (확장 컬럼 포함) |
| 판매기록 | 판매 이력      |
| 매입매출 | 간이과세 회계  |
| 월별통계 | 자동 집계      |
| 설정     | 키/값 설정     |
