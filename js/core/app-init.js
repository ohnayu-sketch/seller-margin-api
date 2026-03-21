/* ═══ js/core/app-init.js ═══ */

// ★ 앱 초기화 시 AppConfig 로드
(async function() {
  if (window.AppConfig && typeof AppConfig.load === 'function') {
    await AppConfig.load();
  }
})();

// ★ 통합 소싱 분석 검색창 Enter 키 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    const v5Input = document.getElementById('v5-search-input');
    if (v5Input) {
        v5Input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                runIntegratedV5Search();
            }
        });
    }
});