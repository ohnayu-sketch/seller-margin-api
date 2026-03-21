const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'seller-dashboard-v6.html');
let c = fs.readFileSync(p, 'utf8');

// 초기 티커 renderDemandTicker() → loadDemandTickerFromDatalab()
const old = "        // 초기 티커 렌더링\r\n        window.renderDemandTicker();";
const replacement = "        // [V7] 초기 티커: 데이터랩 실데이터 로드 (실패 시 시즌 폴백)\r\n        if (typeof window.loadDemandTickerFromDatalab === 'function') {\r\n            window.loadDemandTickerFromDatalab();\r\n        } else {\r\n            window.renderDemandTicker();\r\n        }";

const idx = c.indexOf(old);
if (idx === -1) {
    // 한국어 인코딩 문제 대비: ASCII 부분만으로 검색
    const alt = "window.renderDemandTicker();";
    const altIdx = c.lastIndexOf(alt);
    if (altIdx === -1) { console.log('ERROR: not found at all'); process.exit(1); }
    // 이전 줄의 주석도 교체
    const lineStart = c.lastIndexOf('\n', altIdx) + 1;
    const lineEnd = altIdx + alt.length;
    c = c.slice(0, lineStart) + replacement + '\r\n' + c.slice(lineEnd + 2); // +2 for \r\n
    console.log('DONE (alt): replaced at', lineStart);
} else {
    c = c.slice(0, idx) + replacement + c.slice(idx + old.length);
    console.log('DONE: replaced at', idx);
}

fs.writeFileSync(p, c, 'utf8');
