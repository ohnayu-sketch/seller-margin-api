# 커서 수정 지시서 v3_2
> v3 작업 완료 후 추가 작업입니다.
> 회계 탭에 증빙서류 관리 기능을 추가합니다.

---

# 작업 — 증빙서류 관리 (회계 탭 내 추가)

## 작업 대상 파일
- `seller-dashboard-v3.html` (프론트엔드)
- `apps-script/Code.gs` (구글 시트 + 드라이브)

---

## 1. 증빙서류 업로드 UI

회계 탭 안에 "증빙서류 관리" 섹션 추가.
입력 흐름은 최대한 단순하게 — 4단계 순서대로 진행.

```
┌─────────────────────────────────────────┐
│ 📎 증빙서류 등록                         │
│                                         │
│ ① 서류 종류 선택 (가장 먼저, 크게 표시)  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │ 💳   │ │ 🧾   │ │ 📄   │ │ 📋   │   │
│ │카드  │ │현금  │ │세금  │ │간이  │   │
│ │영수증│ │영수증│ │계산서│ │영수증│   │
│ └──────┘ └──────┘ └──────┘ └──────┘   │
│ ┌──────┐ ┌──────┐                      │
│ │ 📑   │ │ 📂   │                      │
│ │거래  │ │기타  │                      │
│ │명세서│ │      │                      │
│ └──────┘ └──────┘                      │
│                                         │
│ ② 파일 첨부                             │
│ ┌───────────────────────────────────┐  │
│ │  📸 사진 찍기 / 파일 선택          │  │
│ │  (JPG, PNG, PDF 가능)             │  │
│ │  [미리보기 썸네일]                 │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ③ 내용 입력 (필수만)                    │
│ 날짜  [2026-03-01    ] ← 오늘 자동입력 │
│ 금액  [           원 ] ← 숫자만 입력   │
│ 거래처 [             ] ← 상호명        │
│                                         │
│ ④ 추가 정보 (선택, 접기/펼치기)        │
│ ▼ 더 입력하기                           │
│   구분  [매입 ▼] [매출 ▼]              │
│   품목  [                  ]           │
│   메모  [                  ]           │
│                                         │
│ [📁 저장 + 드라이브 업로드]             │
└─────────────────────────────────────────┘
```

---

## 2. 저장 시 자동 처리 (JavaScript)

```javascript
// 증빙 종류별 폴더명 매핑
const TYPE_FOLDER = {
  '카드영수증': '카드영수증',
  '현금영수증': '현금영수증',
  '세금계산서': '세금계산서',
  '간이영수증': '간이영수증',
  '거래명세서': '거래명세서',
  '기타': '기타증빙',
};

async function saveReceipt(type, file, date, amount, vendor, extra) {
  // 1. 파일명 자동 생성
  const ext = file.name.split('.').pop();
  const fileName = `${date.replace(/-/g,'')}__${vendor}__${TYPE_FOLDER[type]}__${amount}원.${ext}`;
  // 예: 20260301_BBQ치킨_카드영수증_32000원.jpg

  // 2. 드라이브 경로 자동 결정
  const year = date.substring(0, 4);
  const month = date.substring(5, 7);
  const folderPath = `셀러마진/${year}년/${month}월/${TYPE_FOLDER[type]}`;

  // 3. 파일 → base64 변환
  const base64File = await fileToBase64(file);

  // 4. Apps Script 호출 (업로드 + 시트 기록 동시)
  const res = await fetch(localStorage.getItem('script-url'), {
    method: 'POST',
    body: JSON.stringify({
      action: 'saveReceipt',
      fileName,
      folderPath,
      mimeType: file.type,
      fileData: base64File,
      sheetData: {
        date,
        type,
        vendor,
        amount: parseInt(amount),
        taxType: extra.taxType || '매입',
        item: extra.item || '',
        memo: extra.memo || '',
      }
    })
  });

  const result = await res.json();
  if (result.success) {
    showToast('✅ 저장 완료! 드라이브에 업로드됐습니다.');
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

---

## 3. Apps Script 추가 함수 (Code.gs)

```javascript
function saveReceipt(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // 1. 구글 드라이브 폴더 자동 생성
  const folder = getOrCreateFolder(data.folderPath);

  // 2. 파일 업로드
  const decoded = Utilities.base64Decode(data.fileData);
  const blob = Utilities.newBlob(decoded, data.mimeType, data.fileName);
  const file = folder.createFile(blob);
  const driveLink = file.getUrl();

  // 3. 매입매출 시트에 기록
  let sheet = ss.getSheetByName('매입매출');
  if (!sheet) sheet = ss.insertSheet('매입매출');

  // 헤더가 없으면 추가
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '날짜', '증빙종류', '거래처', '품목',
      '금액', '매입/매출', '메모', '파일링크', '등록일시'
    ]);
  }

  sheet.appendRow([
    data.sheetData.date,
    data.sheetData.type,
    data.sheetData.vendor,
    data.sheetData.item,
    data.sheetData.amount,
    data.sheetData.taxType,
    data.sheetData.memo,
    driveLink,
    new Date().toLocaleString('ko-KR')
  ]);

  return JSON.stringify({ success: true, driveLink });
}

// 폴더 경로 자동 생성 (없으면 만들기)
function getOrCreateFolder(path) {
  const parts = path.split('/').filter(Boolean);
  let folder = DriveApp.getRootFolder();
  for (const part of parts) {
    const found = folder.getFoldersByName(part);
    folder = found.hasNext() ? found.next() : folder.createFolder(part);
  }
  return folder;
}
```

---

## 4. 증빙서류 목록 화면

회계 탭 하단에 등록된 서류 목록 표시:

```
┌──────────────────────────────────────────────┐
│ 📂 등록된 증빙서류    [이번달 ▼] [종류 전체 ▼] │
├────────┬────────┬────────┬────────┬──────────┤
│ 날짜   │ 종류   │ 거래처 │ 금액   │ 파일     │
├────────┼────────┼────────┼────────┼──────────┤
│ 3/1    │ 💳카드 │ BBQ   │ 32,000 │ [🔗보기] │
│ 3/3    │ 📄세금 │ ○○도매│150,000 │ [🔗보기] │
│ 3/5    │ 🧾현금 │ 택배사 │  5,000 │ [🔗보기] │
└────────┴────────┴────────┴────────┴──────────┘
  합계: 매입 187,000원
  [📥 CSV 내보내기 (세무사 제출용)]
└──────────────────────────────────────────────┘
```

목록은 Apps Script에서 매입매출 시트 데이터를 읽어서 표시:
```javascript
// action: 'getReceipts' 로 조회
// 월 필터, 종류 필터 파라미터 전달
```

---

## 5. 모바일 최적화 필수 사항

```
- 서류 종류 버튼: 최소 70x70px, 손가락으로 탭하기 쉽게
- 날짜: 오늘 날짜 자동 입력 (수정 가능, type="date")
- 금액: 숫자 키패드 자동 표시 (inputmode="numeric")
- 파일 첨부 버튼:
  accept="image/*,application/pdf"
  capture="environment" (카메라 바로 실행)
- 저장 버튼: 화면 하단 고정, 크게
- 입력 중 실수로 뒤로가기 시 "저장하지 않고 나가시겠어요?" 확인 팝업
- 업로드 중 로딩 스피너 + "드라이브에 저장 중..." 메시지
```

---

## 절대 변경 금지
1. 구글 OAuth 로그인 로직
2. 기존 구글 시트 연동 (script-url)
3. 다크 테마 (#0d0f14, #1a1d24, #4ade80)
4. 기존 회계 탭 기능 (거래 입력, 부가세 계산)
