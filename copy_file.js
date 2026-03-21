const fs = require('fs');
fs.copyFileSync('apps-script-code.gs', '.clasp_gas/Code.gs');
console.log('Force Copied apps-script-code.gs to .clasp_gas/Code.gs!');
