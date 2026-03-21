/**
 * fetchGas — Apps Script Proxy 경유 API 호출
 * CORS 우회를 위해 Content-Type: text/plain 사용
 * Sacred Zone: 함수 시그니처 변경 금지
 */
window.fetchGas = async function(action, body) {
    const url = localStorage.getItem('proxyApiUrl')
        || (typeof AppConfig !== 'undefined' && AppConfig.APPS_SCRIPT_URL)
        || localStorage.getItem('script-url');

    if (!url || url.includes('YOUR_SCRIPT_ID')) {
        throw new Error('API 연결 오류: Apps Script URL이 설정되지 않았습니다. T7 설정 탭에서 입력하세요.');
    }

    const payload = Object.assign({ action: action }, body || {});
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
    });

    if (!res.ok) throw new Error(`API 오류: ${res.status} ${res.statusText}`);
    return await res.json();
};

/**
 * 재시도 래퍼 — 네트워크 에러 시 최대 3회 재시도
 */
window.fetchGasRetry = async function(action, body, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await window.fetchGas(action, body);
        } catch(e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
};
