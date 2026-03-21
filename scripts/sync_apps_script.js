const fs = require('fs');
const path = require('path');

const gsPath = path.join(__dirname, '../apps-script-code.gs');
const gsCode = fs.readFileSync(gsPath, 'utf8');

const targetFiles = [
  path.join(__dirname, '../seller-dashboard-v6.html'),
  path.join(__dirname, '../seller-dashboard-v5-modular.html')
];

targetFiles.forEach(file => {
  if (fs.existsSync(file)) {
    try {
      let html = fs.readFileSync(file, 'utf8');
      const regex = /(<script id="embedded-apps-script" type="text\/plain">\n)([\s\S]*?)(\n<\/script>)/;
      // 교체 시 달러 기호($)가 특수문자로 파싱되지 않도록 이스케이프해야 함
      html = html.replace(regex, `$1${gsCode.replace(/\$/g, '$$$$')}$3`);
      fs.writeFileSync(file, html, 'utf8');
      console.log(`✅ 내장 스크립트 동기화 완료: ${path.basename(file)}`);
    } catch(e) {
      console.error(`❌ 동기화 실패: ${path.basename(file)}`, e.message);
    }
  }
});
