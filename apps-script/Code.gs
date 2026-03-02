/**
 * 셀러 마진 계산기 — 구글 Apps Script (SYSTEM_DESIGN.md [B] 기준)
 * 시트: 상품목록(확장) | 판매기록 | 매입매출 | 월별통계 | 설정
 * ※ seller-dashboard-v3 / v4 프론트 공통 — 같은 배포 URL 사용, 별도 업데이트 불필요
 */
const SHEET_ID = '1D6IlJquibWJfUkmIrKSz-PF4JYSa10dJd_GQdwtSSSg';
const SHEET_NAME = '상품목록';
const SHEET_SALES = '판매기록';
const SHEET_ACCOUNTING = '매입매출';
const SHEET_RECEIPTS = '증빙서류';
const SHEET_MONTHLY = '월별통계';
const CONFIG_SHEET = '설정';

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  try {
    const action = e.parameter.action || (e.postData ? JSON.parse(e.postData.contents).action : null);
    const body = e.postData ? JSON.parse(e.postData.contents) : {};
    const params = e.parameter || {};
    if (action === 'getProducts') response.setContent(JSON.stringify(getProducts()));
    else if (action === 'saveProduct') response.setContent(JSON.stringify(saveProduct(body)));
    else if (action === 'updateProduct') response.setContent(JSON.stringify(updateProduct(body)));
    else if (action === 'deleteProduct') response.setContent(JSON.stringify(deleteProduct(body.id)));
    else if (action === 'clearAll') response.setContent(JSON.stringify(clearAll()));
    else if (action === 'getConfig') response.setContent(JSON.stringify(getConfig()));
    else if (action === 'saveConfig') response.setContent(JSON.stringify(saveConfig(body)));
    else if (action === 'saveSalesRecord') response.setContent(JSON.stringify(saveSalesRecord(body)));
    else if (action === 'saveAccountingRecord') response.setContent(JSON.stringify(saveAccountingRecord(body)));
    else if (action === 'getSalesRecords') response.setContent(JSON.stringify(getSalesRecords(body.month ? body : params)));
    else if (action === 'getAccountingRecords') response.setContent(JSON.stringify(getAccountingRecords(body.month ? body : params)));
    else if (action === 'saveReceipt') response.setContent(JSON.stringify(saveReceipt(body)));
    else if (action === 'getReceipts') response.setContent(JSON.stringify(getReceipts(params)));
    else if (action === 'generateMonthlyReport') response.setContent(JSON.stringify(generateMonthlyReport()));
    else if (action === 'calculateSimplifiedVAT') response.setContent(JSON.stringify(calculateSimplifiedVAT(parseInt(params.year || body.year || new Date().getFullYear(), 10))));
    else if (action === 'organizeGoogleDrive') response.setContent(JSON.stringify(organizeGoogleDrive()));
    else if (action === 'saveDirectRecord') response.setContent(JSON.stringify(saveDirectRecord(body)));
    else if (action === 'updateDirectRecord') response.setContent(JSON.stringify(updateDirectRecord(body)));
    else if (action === 'getVendors') response.setContent(JSON.stringify(getVendors()));
    else if (action === 'saveVendor') response.setContent(JSON.stringify(saveVendor(body)));
    else if (action === 'getDirectRecords') response.setContent(JSON.stringify(getDirectRecords(body)));
    else if (action === 'runFullInit') response.setContent(JSON.stringify(runFullInit()));
    else response.setContent(JSON.stringify({ success: false, error: 'unknown action' }));
  } catch (err) {
    response.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }
  return response;
}

// ==================== 설정 시트 ====================
function initConfigSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([['키', '값']]);
    sheet.getRange(1, 1, 1, 2).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.appendRow(['email1', '']);
    sheet.appendRow(['email2', '']);
  }
  return sheet;
}

function getConfig() {
  const sheet = initConfigSheet();
  const data = sheet.getDataRange().getValues();
  const config = {};
  data.slice(1).forEach(function (row) { if (row[0]) config[row[0]] = row[1]; });
  return { success: true, config: config };
}

function saveConfig(data) {
  const sheet = initConfigSheet();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'email1') sheet.getRange(i + 1, 2).setValue(data.email1 || '');
    if (rows[i][0] === 'email2') sheet.getRange(i + 1, 2).setValue(data.email2 || '');
  }
  return { success: true };
}

// ==================== 구글 드라이브 폴더 / 사입 문서 ====================
var ROOT_FOLDER_NAME = '셀러마진';
const SHEET_DIRECT = '사입기록';
const SHEET_VENDOR = '공급업체';

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function organizeGoogleDrive() {
  var root = DriveApp.getRootFolder();
  var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
  var now = new Date();
  var year = now.getFullYear() + '년';
  var month = String(now.getMonth() + 1).padStart(2, '0') + '월';
  var yearFolder = getOrCreateFolder(rootFolder, year);
  var monthFolder = getOrCreateFolder(yearFolder, month);
  getOrCreateFolder(monthFolder, '영수증');
  getOrCreateFolder(rootFolder, '상품분석');
  getOrCreateFolder(rootFolder, '사입사진');
  getOrCreateFolder(monthFolder, '사입기록');
  return {
    success: true,
    path: ROOT_FOLDER_NAME + '/' + year + '/' + month,
    rootFolderId: rootFolder.getId(),
    monthFolderId: monthFolder.getId()
  };
}

function saveDirectSourcingPhoto(data) {
  try {
    var root = DriveApp.getRootFolder();
    var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
    var photoFolder = getOrCreateFolder(rootFolder, '사입사진');
    var dateStr = data.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    var fileName = dateStr + '_' + (data.productName || '상품') + '_' + (data.price || 0) + '원.jpg';
    var base64 = (data.photoBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName);
    var file = photoFolder.createFile(blob);
    return { success: true, fileUrl: file.getUrl(), fileName: fileName };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function createDirectSourcingDoc(data) {
  try {
    var root = DriveApp.getRootFolder();
    var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
    var now = new Date();
    var year = now.getFullYear() + '년';
    var month = String(now.getMonth() + 1).padStart(2, '0') + '월';
    var yearFolder = getOrCreateFolder(rootFolder, year);
    var monthFolder = getOrCreateFolder(yearFolder, month);
    var docsFolder = getOrCreateFolder(monthFolder, '사입기록');
    var photoFolder = getOrCreateFolder(rootFolder, '사입사진');

    var photoUrl = '';
    var photoFileId = '';
    if (data.photoBase64) {
      var base64 = (data.photoBase64 || '').replace(/^data:image\/\w+;base64,/, '');
      var decoded = Utilities.base64Decode(base64);
      var dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd_HHmm');
      var photoName = dateStr + '_' + (data.productName || '상품') + '.jpg';
      var blob = Utilities.newBlob(decoded, 'image/jpeg', photoName);
      var photoFile = photoFolder.createFile(blob);
      photoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = photoFile.getUrl();
      photoFileId = photoFile.getId();
    }

    var docTitle = '[사입] ' + (data.productName || '상품') + ' — ' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyy.MM.dd');
    var doc = DocumentApp.create(docTitle);
    var docFile = DriveApp.getFileById(doc.getId());
    docFile.moveTo(docsFolder);

    var body = doc.getBody();
    body.clear();
    body.appendParagraph(docTitle).setHeading(DocumentApp.ParagraphHeading.HEADING1).editAsText().setFontSize(18).setBold(true);
    body.appendParagraph('저장일시: ' + (data.savedAt || Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'))).editAsText().setFontSize(11).setForegroundColor('#888888');
    body.appendHorizontalRule();

    if (photoFileId) {
      body.appendParagraph('상품 사진').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      try {
        var imgBlob = DriveApp.getFileById(photoFileId).getBlob();
        var inlineImg = body.appendImage(imgBlob);
        var w = inlineImg.getWidth();
        var h = inlineImg.getHeight();
        if (w > 400) {
          inlineImg.setWidth(400);
          inlineImg.setHeight(Math.round(h * 400 / w));
        }
      } catch (imgErr) {
        body.appendParagraph('(사진 삽입 실패: ' + photoUrl + ')');
      }
      body.appendParagraph('');
    }

    body.appendParagraph('구매 정보').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var unitPrice = data.unitPrice || 0;
    var minQty = data.minQty || 1;
    var infoTable = body.appendTable([
      ['상품명', data.productName || '—'],
      ['구매처', data.vendor || '—'],
      ['단가', unitPrice.toLocaleString() + '원'],
      ['최소수량', minQty + '개'],
      ['최소 사입 총액', (unitPrice * minQty).toLocaleString() + '원'],
      ['메모', data.memo || '—']
    ]);
    for (var r = 0; r < infoTable.getNumRows(); r++) {
      infoTable.getCell(r, 0).setBackgroundColor('#F0F0F0').editAsText().setBold(true).setFontSize(11);
      infoTable.getCell(r, 1).editAsText().setFontSize(11);
    }
    body.appendParagraph('');

    if (data.marketPrice && data.marketPrice.avg) {
      body.appendParagraph('시중가 분석').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendTable([
        ['시중 최저가', (data.marketPrice.min || 0).toLocaleString() + '원'],
        ['시중 평균가', (data.marketPrice.avg || 0).toLocaleString() + '원'],
        ['시중 최고가', (data.marketPrice.max || 0).toLocaleString() + '원']
      ]);
      body.appendParagraph('');
    }

    if (data.marginResult) {
      body.appendParagraph('마진 계산 결과').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var marginRows = [['마켓', '추천 판매가', '순이익', '마진율']];
      var marketNames = { smart: '스마트스토어', coupang: '쿠팡', open: '오픈마켓' };
      for (var mk in data.marginResult) {
        var mr = data.marginResult[mk];
        marginRows.push([
          marketNames[mk] || mk,
          (mr.salePrice || 0).toLocaleString() + '원',
          (mr.profit || 0).toLocaleString() + '원',
          (mr.marginRate || 0).toFixed(1) + '%'
        ]);
      }
      var marginTable = body.appendTable(marginRows);
      for (var c = 0; c < 4; c++) {
        marginTable.getCell(0, c).setBackgroundColor('#4ADE80').editAsText().setBold(true).setFontSize(11).setForegroundColor('#0d0f14');
      }
      body.appendParagraph('');
    }

    body.appendParagraph('판단 및 결정').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('[ ] 소싱 진행   [ ] 보류   [ ] 제외');
    body.appendParagraph('판단 이유: ______________________________');
    body.appendParagraph('결정일: ______________________________');

    doc.saveAndClose();
    docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var docUrl = doc.getUrl();

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var directSheet = ss.getSheetByName('사입기록');
    if (!directSheet) {
      directSheet = ss.insertSheet('사입기록');
      directSheet.getRange(1, 1, 1, 9).setValues([['저장일시', '상품명', '구매처', '단가', '최소수량', '메모', '사진URL', '문서링크', '처리상태']]);
      directSheet.getRange(1, 1, 1, 9).setBackground('#4ADE80').setFontColor('#0d0f14').setFontWeight('bold');
    }
    directSheet.appendRow([
      data.savedAt || Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
      data.productName || '',
      data.vendor || '',
      data.unitPrice || 0,
      data.minQty || 1,
      data.memo || '',
      photoUrl,
      docUrl,
      '검토중'
    ]);
    var lastRow = directSheet.getLastRow();
    directSheet.getRange(lastRow, 8).setFormula('=HYPERLINK("' + docUrl.replace(/"/g, '""') + '","문서 열기")');

    return { success: true, docUrl: docUrl, photoUrl: photoUrl, message: '문서 생성 완료: ' + docTitle };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==================== 사입기록 시트 (19열) ====================
var DIRECT_HEADERS = ['저장일시', '상품명', '공급업체ID', '공급업체명', '단가', '최소수량', '최소사입총액', '납기리드타임', '결제조건', '위탁가능여부', '메모', '사진링크', '소싱결과', '위탁등록일시', '등록마켓', '판매가', '마진율', '저장자', '상품목록ID'];

function initDirectSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_DIRECT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DIRECT);
    sheet.getRange(1, 1, 1, DIRECT_HEADERS.length).setValues([DIRECT_HEADERS]);
    sheet.getRange(1, 1, 1, DIRECT_HEADERS.length).setBackground('#0d0f14').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ==================== 공급업체 시트 (16열) ====================
var VENDOR_HEADERS = ['업체ID', '업체명', '대표자명', '사업자등록번호', '업종', '주소', '전화번호', '담당자명', '담당자연락처', '이메일', '주요취급카테고리', '최소주문금액', '결제조건', '거래시작일', '메모', '마지막방문일'];

function initVendorSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_VENDOR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_VENDOR);
    sheet.getRange(1, 1, 1, VENDOR_HEADERS.length).setValues([VENDOR_HEADERS]);
    sheet.getRange(1, 1, 1, VENDOR_HEADERS.length).setBackground('#0d0f14').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getNextVendorId() {
  var sheet = initVendorSheet();
  var last = sheet.getLastRow();
  if (last <= 1) return 'VENDOR_001';
  var ids = sheet.getRange(2, 1, last, 1).getValues().map(function (r) { return String(r[0]); });
  var max = 0;
  ids.forEach(function (id) {
    var m = id.match(/VENDOR_(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'VENDOR_' + String(max + 1).padStart(3, '0');
}

function saveDirectRecord(data) {
  try {
    organizeGoogleDrive();
    var root = DriveApp.getRootFolder();
    var rootFolder = getOrCreateFolder(root, ROOT_FOLDER_NAME);
    var photoFolder = getOrCreateFolder(rootFolder, '사입사진');
    var photoUrl = '';
    if (data.photoBase64) {
      var base64 = (data.photoBase64 || '').replace(/^data:image\/\w+;base64,/, '');
      var decoded = Utilities.base64Decode(base64);
      var now = new Date();
      var dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd_HHmm');
      var photoName = dateStr + '_' + (data.productName || '상품') + '.jpg';
      var blob = Utilities.newBlob(decoded, 'image/jpeg', photoName);
      var file = photoFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = file.getUrl();
    }
    var vendorId = data.vendorId || '';
    var vendorName = data.vendorName || '';
    if (!vendorId && data.vendorName) {
      var vendors = getVendors();
      if (vendors.success && vendors.vendors) {
        var v = vendors.vendors.find(function (x) { return x.name === data.vendorName; });
        if (v) { vendorId = v.id; vendorName = v.name; }
      }
    }
    var unitPrice = data.unitPrice || 0;
    var minQty = data.minQty || 1;
    var minTotal = unitPrice * minQty;
    var savedAt = data.savedAt || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    var sheet = initDirectSheet();
    sheet.appendRow([
      savedAt, data.productName || '', vendorId, vendorName,
      unitPrice, minQty, minTotal,
      data.leadTime || '', data.paymentTerms || '', data.consignAvail || '미확인',
      data.memo || '', photoUrl, '검토중', '', '', '', '', data.savedBy || '남편', ''
    ]);
    var rowNum = sheet.getLastRow();
    if (photoUrl) {
      sheet.getRange(rowNum, 12).setFormula('=HYPERLINK("' + photoUrl.replace(/"/g, '""') + '","📷 사진")');
    }
    var bg = (data.consignAvail || '') === '가능' ? '#c8e6c9' : (data.consignAvail || '') === '불가' ? '#ffcdd2' : '#fff9c4';
    sheet.getRange(rowNum, 1, 1, DIRECT_HEADERS.length).setBackground(bg).setFontColor('#1a1a1a');
    return { success: true, vendorId: vendorId, photoUrl: photoUrl, rowNum: rowNum };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function updateDirectRecord(data) {
  try {
    var sheet = initDirectSheet();
    var rowNum = data.rowNum;
    if (!rowNum || rowNum < 2) return { success: false, error: 'rowNum required' };
    sheet.getRange(rowNum, 13).setValue(data.sourcingResult || '진행');
    if (data.registeredAt !== undefined) sheet.getRange(rowNum, 14).setValue(data.registeredAt);
    if (data.market !== undefined) sheet.getRange(rowNum, 15).setValue(data.market);
    if (data.salePrice !== undefined) sheet.getRange(rowNum, 16).setValue(data.salePrice);
    if (data.marginRate !== undefined) sheet.getRange(rowNum, 17).setValue(data.marginRate);
    if (data.productListId !== undefined) sheet.getRange(rowNum, 19).setValue(data.productListId);
    sheet.getRange(rowNum, 1, 1, DIRECT_HEADERS.length).setBackground('#c8e6c9').setFontColor('#1a1a1a');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getDirectRecords(params) {
  var sheet = initDirectSheet();
  var last = sheet.getLastRow();
  if (last <= 1) return { success: true, records: [] };
  var data = sheet.getRange(2, 1, last, DIRECT_HEADERS.length).getValues();
  var list = data.map(function (r, i) {
    return {
      rowNum: i + 2,
      savedAt: r[0], productName: r[1], vendorId: r[2], vendorName: r[3],
      unitPrice: r[4], minQty: r[5], minTotal: r[6], leadTime: r[7], paymentTerms: r[8],
      consignAvail: r[9], memo: r[10], photoUrl: r[11], sourcingResult: r[12],
      registeredAt: r[13], market: r[14], salePrice: r[15], marginRate: r[16], savedBy: r[17], productListId: r[18]
    };
  });
  if (params && params.todayOnly) {
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    list = list.filter(function (r) { return String(r.savedAt).slice(0, 10) === today; });
  }
  return { success: true, records: list };
}

function getVendors() {
  var sheet = initVendorSheet();
  var last = sheet.getLastRow();
  if (last <= 1) return { success: true, vendors: [] };
  var data = sheet.getRange(2, 1, last, VENDOR_HEADERS.length).getValues();
  var vendors = data.map(function (r) {
    return {
      id: r[0], name: r[1], repName: r[2], bizNo: r[3], industry: r[4], address: r[5],
      phone: r[6], contactName: r[7], contactPhone: r[8], email: r[9],
      categories: r[10], minOrder: r[11], paymentTerms: r[12], startDate: r[13], memo: r[14], lastVisit: r[15]
    };
  }).filter(function (v) { return v.id !== ''; });
  return { success: true, vendors: vendors };
}

function saveVendor(data) {
  var sheet = initVendorSheet();
  var v = data.vendor || data;
  var id = v.id || getNextVendorId();
  var row = [
    id, v.name || '', v.repName || '', v.bizNo || '', v.industry || '', v.address || '',
    v.phone || '', v.contactName || '', v.contactPhone || '', v.email || '',
    v.categories || '', v.minOrder != null ? v.minOrder : '', v.paymentTerms || '', v.startDate || '', v.memo || '', v.lastVisit || ''
  ];
  if (v.id && v.id.indexOf('VENDOR_') === 0) {
    var last = sheet.getLastRow();
    var rows = sheet.getRange(2, 1, last, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(v.id)) {
        sheet.getRange(i + 2, 1, i + 2, VENDOR_HEADERS.length).setValues([row]);
        return { success: true, vendorId: id };
      }
    }
  }
  sheet.appendRow(row);
  sheet.getRange(sheet.getLastRow(), 1, sheet.getLastRow(), VENDOR_HEADERS.length).setBackground('#e8f5e9').setFontColor('#1a1a1a');
  return { success: true, vendorId: id };
}

// ==================== 상품 시트 (B-1: 확장 컬럼 지원) ====================
// 기존 1~31 + 소싱유형, 납기리드타임, 결제조건, 위탁가능, 담당자연락처
var PRODUCT_HEADERS = ['ID', '상품명', '원가', '도매배송비', '마켓배송비', '마켓', '수수료(%)', '판매가', '수수료금액', '순이익', '마진율(%)', '저장일시', '저장자', '카테고리', '경쟁강도', '시중최저가', '시중평균가', '판매결정', '판매시작일', '도매소싱링크', '시중최고가', '타겟성별', '타겟연령', '검색트렌드시즌', '데이터수집일', '주요타겟', '가격추적', '알림기준가', '최종조회일', '사진링크', '사입문서링크', '소싱유형', '납기리드타임', '결제조건', '위탁가능', '담당자연락처'];
var PRODUCT_COLS = 36;

function initSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, PRODUCT_COLS).setValues([PRODUCT_HEADERS]);
    sheet.getRange(1, 1, 1, PRODUCT_COLS).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < PRODUCT_COLS) {
    var startCol = sheet.getLastColumn() + 1;
    var newHeaders = PRODUCT_HEADERS.slice(startCol - 1, PRODUCT_COLS);
    if (newHeaders.length) {
      sheet.getRange(1, startCol, 1, startCol + newHeaders.length - 1).setValues([newHeaders]);
      sheet.getRange(1, startCol, 1, startCol + newHeaders.length - 1).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    }
  }
  return sheet;
}

/** 기존 상품목록 시트에 14~19열 헤더가 없을 때 한 번만 실행. N~S열에 카테고리·경쟁강도·시중가·판매결정·판매시작일 헤더를 넣습니다. */
function setProductListHeaders() {
  const sheet = initSheet();
  const headers = ['카테고리', '경쟁강도', '시중최저가', '시중평균가', '판매결정', '판매시작일'];
  const numCols = headers.length;
  // getRange(row, column, numRows, numColumns) — 3·4번째 인자는 행/열 개수
  const range = sheet.getRange(1, 14, 1, numCols);
  range.setValues([headers]);
  range.setBackground('#1a1a2e');
  range.setFontColor('#4ade80');
  range.setFontWeight('bold');
  Logger.log('상품목록 14~19열 헤더 적용 완료.');
}

function _extractHyperlinkUrl(formulaStr) {
  if (!formulaStr || typeof formulaStr !== 'string') return '';
  var m = formulaStr.match(/=HYPERLINK\("([^"]+)"/);
  return m ? m[1] : '';
}

function getProducts() {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, products: [] };
  const colCount = Math.max(PRODUCT_COLS, sheet.getLastColumn());
  const data = sheet.getRange(2, 1, last, colCount).getValues();
  var formulas = (colCount >= 31) ? sheet.getRange(2, 30, last, 31).getFormulas() : [];
  return {
    success: true,
    products: data.map(function (r, i) {
      if (r[0] === '') return null;
      var photoUrl = '';
      var docUrl = '';
      if (formulas[i]) {
        photoUrl = _extractHyperlinkUrl(formulas[i][0]) || (r[29] || '');
        docUrl = _extractHyperlinkUrl(formulas[i][1]) || (r[30] || '');
      } else {
        photoUrl = r[29] || '';
        docUrl = r[30] || '';
      }
      return {
        id: r[0], name: r[1], cost: r[2], supShip: r[3], mktShip: r[4],
        market: r[5], fee: r[6], salePrice: r[7], feeAmt: r[8],
        profit: r[9], margin: r[10], savedAt: r[11], savedBy: r[12],
        category: r[13], competitionLevel: r[14], minMarketPrice: r[15], avgMarketPrice: r[16],
        sellDecision: r[17], sellStartDate: r[18],
        sourcingLink: r[19] || '', maxMarketPrice: r[20] || '',
        targetGender: r[21] || '', targetAge: r[22] || '', trendSeason: r[23] || '', collectedAt: r[24] || '',
        mainTarget: r[25] || '',
        priceTrack: r[26] || '', alertPrice: r[27] != null ? r[27] : '', lastPriceCheck: r[28] || '',
        photoUrl: photoUrl, docUrl: docUrl,
        sourcingType: r[31] || '', leadTime: r[32] || '', paymentTerms: r[33] || '', consignAvail: r[34] || '', contact: r[35] || ''
      };
    }).filter(function (x) { return x !== null; })
  };
}

function saveProduct(data) {
  const sheet = initSheet();
  data.products.forEach(function (p) {
    const row = [
      p.id, p.name, p.cost, p.supShip, p.mktShip,
      p.market, p.fee, p.salePrice, p.feeAmt,
      p.profit, p.margin, p.savedAt, p.savedBy || '남편',
      p.category || '', p.competitionLevel || '', p.minMarketPrice || '', p.avgMarketPrice || '',
      p.sellDecision || 'N', p.sellStartDate || '',
      p.sourcingLink || '', p.maxMarketPrice || '',
      p.targetGender || '', p.targetAge || '', p.trendSeason || '', p.collectedAt || '',
      p.mainTarget || '',
      p.priceTrack || 'N', p.alertPrice != null ? p.alertPrice : '', p.lastPriceCheck || '',
      p.photoUrl || '', p.docUrl || '',
      p.sourcingType || '', p.leadTime || '', p.paymentTerms || '', p.consignAvail || '', p.contact || ''
    ];
    sheet.appendRow(row);
    const rowNum = sheet.getLastRow();
    if (p.photoUrl) {
      sheet.getRange(rowNum, 30).setFormula('=HYPERLINK("' + String(p.photoUrl).replace(/"/g, '""') + '","사진")');
    }
    if (p.docUrl) {
      sheet.getRange(rowNum, 31).setFormula('=HYPERLINK("' + String(p.docUrl).replace(/"/g, '""') + '","문서")');
    }
    const bgColor = p.margin >= 20 ? '#c6efce' : p.margin >= 10 ? '#ffeb9c' : '#ffc7ce';
    sheet.getRange(rowNum, 1, 1, PRODUCT_COLS).setBackground(bgColor).setFontColor('#1a1a1a');
  });
  return { success: true };
}

function updateProduct(data) {
  const id = data.id;
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: false };
  const colCount = Math.max(PRODUCT_COLS, sheet.getLastColumn());
  const rows = sheet.getRange(2, 1, last, colCount).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      const rowIdx = i + 2;
      if (data.sellDecision !== undefined) sheet.getRange(rowIdx, 18).setValue(data.sellDecision);
      if (data.sellStartDate !== undefined) sheet.getRange(rowIdx, 19).setValue(data.sellStartDate);
      if (data.priceTrack !== undefined) sheet.getRange(rowIdx, 27).setValue(data.priceTrack);
      if (data.alertPrice !== undefined) sheet.getRange(rowIdx, 28).setValue(data.alertPrice);
      return { success: true };
    }
  }
  return { success: false };
}

function deleteProduct(id) {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: false };
  const data = sheet.getRange(2, 1, last, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }
  return { success: false };
}

function clearAll() {
  const sheet = initSheet();
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  return { success: true };
}

// ==================== B-2: 판매기록 시트 ====================
// 날짜 | 상품ID | 상품명 | 마켓 | 판매수량 | 판매가 | 매출 | 원가합계 | 순이익 | 마진율 | 저장자
function initSalesSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SALES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SALES);
    sheet.getRange(1, 1, 1, 11).setValues([['날짜', '상품ID', '상품명', '마켓', '판매수량', '판매가', '매출', '원가합계', '순이익', '마진율', '저장자']]);
    sheet.getRange(1, 1, 1, 11).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveSalesRecord(data) {
  const sheet = initSalesSheet();
  const r = data.record || data;
  const revenue = (r.salePrice || 0) * (r.quantity || 0);
  const costSum = r.costSum || 0;
  const vatAmt = revenue * 1.5 / 100;
  const profit = revenue - costSum - (r.feeAmt || 0) - vatAmt;
  const marginPct = revenue > 0 ? Math.round(profit / revenue * 1000) / 10 : 0;
  sheet.appendRow([
    r.date || new Date().toISOString().slice(0, 10),
    r.productId || '', r.productName || '', r.market || '',
    r.quantity || 0, r.salePrice || 0, revenue, costSum, profit, marginPct,
    r.savedBy || '남편'
  ]);
  return { success: true };
}

function getSalesRecords(params) {
  const sheet = initSalesSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, records: [] };
  const data = sheet.getRange(2, 1, last, 11).getValues();
  let list = data.map(function (r) {
    return { date: r[0], productId: r[1], productName: r[2], market: r[3], quantity: r[4], salePrice: r[5], revenue: r[6], costSum: r[7], profit: r[8], margin: r[9], savedBy: r[10] };
  });
  if (params && params.month) {
    const yyyymm = String(params.month);
    list = list.filter(function (r) { return String(r.date).slice(0, 7) === yyyymm; });
  }
  return { success: true, records: list };
}

// ==================== B-3: 매입매출 시트 (간이과세자용) ====================
// 날짜 | 구분(매입/매출) | 거래처 | 품목 | 공급가액 | 세액 | 합계 | 증빙유형 | 메모
function initAccountingSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_ACCOUNTING);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ACCOUNTING);
    sheet.getRange(1, 1, 1, 9).setValues([['날짜', '구분', '거래처', '품목', '공급가액', '세액', '합계', '증빙유형', '메모']]);
    sheet.getRange(1, 1, 1, 9).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveAccountingRecord(data) {
  const sheet = initAccountingSheet();
  const r = data.record || data;
  const amount = r.amount || r.공급가액 || 0;
  const tax = r.tax || r.세액 || 0;
  const total = amount + tax;
  sheet.appendRow([
    r.date || new Date().toISOString().slice(0, 10),
    r.type || r.구분 || '매출',  // 매입 | 매출
    r.partner || r.거래처 || '',
    r.item || r.품목 || '',
    amount, tax, total,
    r.evidenceType || r.증빙유형 || '기타',  // 세금계산서/카드/현금영수증/기타
    r.memo || r.메모 || ''
  ]);
  return { success: true };
}

function getAccountingRecords(params) {
  const sheet = initAccountingSheet();
  const last = sheet.getLastRow();
  if (last <= 1) return { success: true, records: [] };
  const data = sheet.getRange(2, 1, last, 9).getValues();
  let list = data.map(function (r) {
    return { date: r[0], type: r[1], partner: r[2], item: r[3], amount: r[4], tax: r[5], total: r[6], evidenceType: r[7], memo: r[8] };
  });
  if (params && params.month) {
    const yyyymm = String(params.month);
    list = list.filter(function (r) { return String(r.date).slice(0, 7) === yyyymm; });
  }
  if (params && params.type) list = list.filter(function (r) { return r.type === params.type; });
  return { success: true, records: list };
}

// ==================== 증빙서류 (드라이브 업로드 + 시트 기록) ====================
// 시트 컬럼: 날짜, 증빙종류, 거래처, 품목, 금액, 매입/매출, 메모, 파일링크, 등록일시
function initReceiptSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_RECEIPTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RECEIPTS);
    sheet.getRange(1, 1, 1, 9).setValues([['날짜', '증빙종류', '거래처', '품목', '금액', '매입/매출', '메모', '파일링크', '등록일시']]);
    sheet.getRange(1, 1, 1, 9).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateFolderByPath(path) {
  var parts = path.split('/').filter(function (p) { return p; });
  var folder = DriveApp.getRootFolder();
  for (var i = 0; i < parts.length; i++) {
    var it = folder.getFoldersByName(parts[i]);
    folder = it.hasNext() ? it.next() : folder.createFolder(parts[i]);
  }
  return folder;
}

function saveReceipt(data) {
  try {
    var folderPath = data.folderPath;
    var fileData = data.fileData; // base64
    var mimeType = data.mimeType || 'image/jpeg';
    var fileName = data.fileName;
    var sheetData = data.sheetData || {};
    var decoded = Utilities.base64Decode(fileData, Utilities.Charset.UTF_8);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var folder = getOrCreateFolderByPath(folderPath);
    var file = folder.createFile(blob);
    var driveLink = file.getUrl();
    var now = new Date();
    var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };
    var registeredAt = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    var sheet = initReceiptSheet();
    sheet.appendRow([
      sheetData.date || '',
      sheetData.type || '',
      sheetData.vendor || '',
      sheetData.item || '',
      sheetData.amount || 0,
      sheetData.taxType || '매입',
      sheetData.memo || '',
      driveLink,
      registeredAt
    ]);
    return { success: true, driveLink: driveLink };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getReceipts(params) {
  var sheet = initReceiptSheet();
  var last = sheet.getLastRow();
  if (last <= 1) return { success: true, receipts: [] };
  var data = sheet.getRange(2, 1, last, 9).getValues();
  var list = data.map(function (r) {
    return { date: r[0], type: r[1], vendor: r[2], item: r[3], amount: r[4], taxType: r[5], memo: r[6], driveLink: r[7], registeredAt: r[8] };
  });
  if (params && params.month) {
    var yyyymm = String(params.month);
    list = list.filter(function (r) { return String(r.date).slice(0, 7) === yyyymm; });
  }
  if (params && params.type) list = list.filter(function (r) { return r.type === params.type; });
  return { success: true, receipts: list };
}

// ==================== B-4: 월별통계 시트 (자동 집계용) ====================
function initMonthlySheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_MONTHLY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MONTHLY);
    sheet.getRange(1, 1, 1, 8).setValues([['연월', '총매출', '총매입', '순이익', '마진율', '카테고리별매출', '마켓별매출', '부가세예상']]);
    sheet.getRange(1, 1, 1, 8).setBackground('#1a1a2e').setFontColor('#4ade80').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateMonthlyReport() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const monthlySheet = initMonthlySheet();
  const now = new Date();
  const ym = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM');

  // 판매기록 시트: 해당 월 매출·순이익 합계 및 마켓별 매출
  let totalRevenue = 0;
  let totalProfit = 0;
  const marketRevenue = {};
  const salesSheet = ss.getSheetByName(SHEET_SALES);
  if (salesSheet && salesSheet.getLastRow() > 1) {
    const salesData = salesSheet.getRange(2, 1, salesSheet.getLastRow(), 11).getValues();
    salesData.forEach(function (r) {
      const dateStr = String(r[0]).slice(0, 7);
      if (dateStr !== ym) return;
      const rev = Number(r[6]) || 0;
      const profit = Number(r[8]) || 0;
      const market = String(r[3] || '').trim() || '기타';
      totalRevenue += rev;
      totalProfit += profit;
      marketRevenue[market] = (marketRevenue[market] || 0) + rev;
    });
  }

  // 매입매출 시트: 해당 월 매입 합계 (구분=매입)
  let totalPurchase = 0;
  const accSheet = ss.getSheetByName(SHEET_ACCOUNTING);
  if (accSheet && accSheet.getLastRow() > 1) {
    const accData = accSheet.getRange(2, 1, accSheet.getLastRow(), 9).getValues();
    accData.forEach(function (r) {
      const dateStr = String(r[0]).slice(0, 7);
      if (dateStr !== ym) return;
      if (String(r[1]).trim() !== '매입') return;
      totalPurchase += Number(r[6]) || 0; // 합계 컬럼
    });
  }

  const netProfit = totalRevenue - totalPurchase;
  const marginPct = totalRevenue > 0 ? Math.round(netProfit / totalRevenue * 1000) / 10 : 0;
  const vatEst = Math.round(totalRevenue * 0.03); // 간이과세 3%
  const categorySummary = ''; // 판매기록에 카테고리 없음
  const marketSummary = JSON.stringify(marketRevenue);

  // 기존 동일 연월 행 있으면 업데이트, 없으면 추가
  const last = monthlySheet.getLastRow();
  let found = false;
  for (var i = 2; i <= last; i++) {
    if (monthlySheet.getRange(i, 1).getValue() === ym) {
      monthlySheet.getRange(i, 2, i, 8).setValues([[totalRevenue, totalPurchase, netProfit, marginPct, categorySummary, marketSummary, vatEst]]);
      found = true;
      break;
    }
  }
  if (!found) {
    monthlySheet.appendRow([ym, totalRevenue, totalPurchase, netProfit, marginPct, categorySummary, marketSummary, vatEst]);
  }
  return { success: true, ym: ym, totalRevenue: totalRevenue, totalPurchase: totalPurchase, netProfit: netProfit };
}

function calculateSimplifiedVAT(year) {
  // 간이과세자: 연 매출 4,800만원 미만. 업종별 부가가치율 소매업 15%, 납부세액 = 공급대가×부가가치율×10%
  // 1기(1~6월) 예정신고 7/25, 2기(7~12월) 확정신고 다음해 1/25
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const monthlySheet = ss.getSheetByName(SHEET_MONTHLY);
  const yStr = String(year);
  let supply1 = 0; // 1~6월 공급대가
  let supply2 = 0; // 7~12월 공급대가
  if (monthlySheet && monthlySheet.getLastRow() > 1) {
    const data = monthlySheet.getRange(2, 1, monthlySheet.getLastRow(), 2).getValues();
    data.forEach(function (r) {
      const ym = String(r[0]);
      if (ym.slice(0, 4) !== yStr) return;
      const m = parseInt(ym.slice(5, 7), 10);
      const rev = Number(r[1]) || 0;
      if (m <= 6) supply1 += rev; else supply2 += rev;
    });
  }
  const retailRate = 0.15; // 소매업 부가가치율 15%
  const vatRate = 0.1;     // 10%
  const tax1 = Math.round(supply1 * retailRate * vatRate);
  const tax2 = Math.round(supply2 * retailRate * vatRate);
  const totalSupply = supply1 + supply2;
  const isSimple = totalSupply < 48000000; // 4800만 미만 간이과세
  return {
    success: true,
    year: year,
    period1: { supply: supply1, tax: tax1, deadline: year + '-07-25', label: '1기(1~6월) 예정신고' },
    period2: { supply: supply2, tax: tax2, deadline: (year + 1) + '-01-25', label: '2기(7~12월) 확정신고' },
    totalSupply: totalSupply,
    totalVAT: tax1 + tax2,
    isSimplified: isSimple,
    note: isSimple ? '간이과세 대상(연 매출 4,800만원 미만)' : '연 매출 4,800만원 이상 시 일반과세자 전환 검토'
  };
}

// ==================== 가격 추적 (트리거: 매일 오전 9시) ====================
function trackPrices() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var nameIdx = headers.indexOf('상품명');
  var avgPriceIdx = headers.indexOf('시중평균가');
  var trackIdx = headers.indexOf('가격추적');
  var alertPriceIdx = headers.indexOf('알림기준가');
  var lastCheckIdx = headers.indexOf('최종조회일');
  if (nameIdx < 0 || avgPriceIdx < 0 || trackIdx < 0) return;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[trackIdx] !== 'Y') continue;
    var productName = row[nameIdx];
    var savedAvgPrice = Number(row[avgPriceIdx]) || 0;
    var alertPrice = Number(row[alertPriceIdx]) || savedAvgPrice;
    var currentPrice = fetchCurrentPrice(productName);
    if (!currentPrice) continue;
    var changeRate = savedAvgPrice > 0 ? ((currentPrice - savedAvgPrice) / savedAvgPrice * 100) : 0;
    if (Math.abs(changeRate) >= 5) {
      var direction = changeRate > 0 ? '📈 상승' : '📉 하락';
      var msg = '[셀러마진 가격알림]\n상품: ' + productName + '\n' + direction + ' ' + Math.abs(changeRate).toFixed(1) + '%\n기존: ' + (savedAvgPrice.toLocaleString()) + '원\n현재: ' + (currentPrice.toLocaleString()) + '원';
      sendKakaoMessage(msg);
      sheet.getRange(i + 1, avgPriceIdx + 1).setValue(currentPrice);
      if (lastCheckIdx >= 0) sheet.getRange(i + 1, lastCheckIdx + 1).setValue(new Date().toLocaleDateString('ko-KR'));
    }
  }
}

function fetchCurrentPrice(query) {
  var clientId = PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_ID');
  var clientSecret = PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  var url = 'https://openapi.naver.com/v1/search/shop.json?query=' + encodeURIComponent(query) + '&display=10';
  var options = {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret
    },
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(res.getContentText());
    if (!data.items || !data.items.length) return null;
    var prices = data.items.map(function (i) { return parseInt(i.lprice, 10); }).filter(function (p) { return p; });
    if (!prices.length) return null;
    var sum = prices.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / prices.length);
  } catch (e) {
    return null;
  }
}

function sendKakaoMessage(message) {
  var token = PropertiesService.getScriptProperties().getProperty('KAKAO_TOKEN');
  if (!token) return;
  try {
    UrlFetchApp.fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: {
        template_object: JSON.stringify({
          object_type: 'text',
          text: message,
          link: { web_url: 'https://ohnayu-sketch.github.io/seller-margin-api/' }
        })
      },
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('trackPrices').timeBased().everyDays(1).atHour(9).create();
  ScriptApp.newTrigger('generateMonthlyReport').timeBased().onMonthDay(1).atHour(8).create();
}

/**
 * 전체 초기화: 구글 시트 탭 7개 생성 + 구글 드라이브 폴더 구조 생성.
 * 이미 있는 시트/폴더는 건드리지 않음.
 */
function runFullInit() {
  try {
    var sheetsCreated = [];
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheetNames = [SHEET_NAME, SHEET_SALES, SHEET_ACCOUNTING, SHEET_MONTHLY, CONFIG_SHEET, SHEET_DIRECT, SHEET_VENDOR, SHEET_RECEIPTS];
    for (var i = 0; i < sheetNames.length; i++) {
      var name = sheetNames[i];
      if (!ss.getSheetByName(name)) {
        ss.insertSheet(name);
        sheetsCreated.push(name);
      }
    }
    initSheet();
    initDirectSheet();
    initVendorSheet();
    initConfigSheet();
    initSalesSheet();
    initAccountingSheet();
    initReceiptSheet();
    initMonthlySheet();
    var driveResult = organizeGoogleDrive();
    return {
      success: true,
      message: '전체 초기화 완료',
      sheets: sheetsCreated,
      drive: driveResult
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
