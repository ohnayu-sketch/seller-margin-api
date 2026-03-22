// sidepanel-bridge.js
// 크롬 확장프로그램의 강력한 CSP를 우회하기 위해, 네이티브 영역에 위치한 이 스크립트가 
// 백그라운드로부터 데이터를 대신 수신하여 로컬 서버(Iframe)로 안전하게 토스(postMessage) 합니다.

console.log('[SidePanel Bridge] 🌉 보안 껍데기 통신 중계소 가동 완료');

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // _relayed 플래그가 있으면 background에서 재전파된 메시지 → iframe으로 릴레이
        // _relayed가 없으면 content script에서 직접 온 메시지 → 역시 iframe으로 릴레이
        if (request.action === 'CLIP_PRODUCT_TO_PANEL') {
            const iframe = document.getElementById('dashboard-frame');
            if (iframe && iframe.contentWindow) {
                // Iframe 내부 컴포넌트(http://127.0.0.1:5500)로 클리퍼 데이터(Message) 릴레이
                iframe.contentWindow.postMessage({
                    type: 'EXT_CLIP',
                    payload: request.data
                }, '*');
                
                console.log('[SidePanel Bridge] 🚀 클리퍼 데이터 Iframe 우회 전송 완료', request.data?.name);
                sendResponse({ status: 'success', message: 'Iframe 우회 릴레이 성공' });
            } else {
                console.error('[SidePanel Bridge] ❌ Iframe DOM을 찾을 수 없음 — Iframe 로딩 대기 후 재시도');
                
                // Iframe이 아직 로드 안 된 경우 → 0.5초 후 재시도
                setTimeout(() => {
                    const retryIframe = document.getElementById('dashboard-frame');
                    if (retryIframe && retryIframe.contentWindow) {
                        retryIframe.contentWindow.postMessage({
                            type: 'EXT_CLIP',
                            payload: request.data
                        }, '*');
                        console.log('[SidePanel Bridge] 🔄 재시도 릴레이 성공');
                    }
                }, 500);
                
                sendResponse({ status: 'retry', message: 'Iframe 로딩 대기 후 재시도 예약' });
            }
        }
        return true; 
    });
}
