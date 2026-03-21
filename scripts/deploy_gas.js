/**
 * deploy_gas.js — Apps Script 자동 배포 스크립트
 * 
 * 실행: node scripts/deploy_gas.js
 * 
 * 1. apps-script-code.gs → .clasp_gas/Code.gs 복사
 * 1b. gas/v7-gas-functions.gs → .clasp_gas/v7.gs 복사
 * 2. clasp push (소스 업로드)
 * 3. clasp deploy (새 버전 배포)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAS_FILES = [
  { src: 'apps-script-code.gs', dest: 'Code.gs' },
  { src: path.join('gas', 'v7-gas-functions.gs'), dest: 'v7.gs' },
];
const CLASP_DIR = path.join(ROOT, '.clasp_gas');

console.log('🔄 [1/3] GAS 소스 파일 복사...');
let totalBytes = 0;
for (const f of GAS_FILES) {
  const srcPath = path.join(ROOT, f.src);
  const destPath = path.join(CLASP_DIR, f.dest);
  try {
    if (!fs.existsSync(srcPath)) {
      console.log(`   ⚠️  ${f.src} — 파일 없음, 건너뜀`);
      continue;
    }
    const code = fs.readFileSync(srcPath, 'utf8');
    fs.writeFileSync(destPath, code, 'utf8');
    totalBytes += code.length;
    console.log(`   ✅ ${f.src} → .clasp_gas/${f.dest} (${code.length.toLocaleString()} bytes)`);
  } catch (e) {
    console.error(`   ❌ ${f.src} 복사 실패:`, e.message);
    process.exit(1);
  }
}
console.log(`   📦 총 ${totalBytes.toLocaleString()} bytes 복사 완료`);

console.log('🔄 [2/3] clasp push (소스 업로드)...');
try {
  const pushOut = execSync('npx @google/clasp push --force', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('   ✅', pushOut.trim());
} catch (e) {
  console.error('   ❌ push 실패:', e.stderr || e.message);
  console.log('\n💡 clasp 로그인이 필요할 수 있습니다:');
  console.log('   npx @google/clasp login');
  process.exit(1);
}

console.log('🔄 [3/3] clasp deploy (기존 배포 업데이트)...');
try {
  // 기존 배포 ID 재사용 → URL 변경 없음
  const DEPLOY_ID = 'AKfycbwg2nVPfpvTHQz096sXPie0PfqMRH21iNGenyNePByUbLCTSdeh50i3kAgiw6Wg9QkgbA';
  const ver = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const desc = `v${ver} auto-deploy`;
  const deployOut = execSync(`npx @google/clasp deploy -i "${DEPLOY_ID}" -d "${desc}"`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('   ✅', deployOut.trim());
  console.log('\n🌐 기존 URL 유지 — 설정 변경 불필요');
} catch (e) {
  console.error('   ❌ deploy 실패:', e.stderr || e.message);
  process.exit(1);
}

console.log('\n✅ 배포 완료!');
