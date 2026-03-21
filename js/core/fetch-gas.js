/**
 * fetchGas — Apps Script Proxy 경유 API 호출
 * CORS 우회를 위해 Content-Type: text/plain 사용
 * Sacred Zone: 함수 시그니처 변경 금지
 */
window.fetchGas = async function(action, body) {
    const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
    
    // ★ 항상 V7-Backend URL 사용 (이전 프로젝트 URL 잔존 방지)
    let url = DEFAULT_GAS_URL;
    localStorage.setItem('proxyApiUrl', url);

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
