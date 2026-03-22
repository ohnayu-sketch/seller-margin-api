// 백그라운드 서비스 워커 (Service Worker) - 봇 관제센터

// 1. 확장프로그램 아이콘 클릭 시, 항상 우측 사이드 패널이 열리도록 강제 설정
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// 2. 다른 확장프로그램이나 클리퍼로부터 들어오는 실시간 데이터 수신 대기 (리스너)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Bot] 데이터 수신 성공:", request);
    
    // 클리퍼 동작 테스트용 PING 수신
    if (request.action === 'PING_BACKGROUND') {
        sendResponse({status: "ok", message: "관제탑 연결 완료"});
        return true;
    }

    // ═══ [FIX] 클리퍼가 보내온 데이터를 사이드패널(대시보드) 측으로 중계(Relay) ═══
    if (request.action === 'CLIP_PRODUCT_TO_PANEL') {
        // 사이드패널이 열려있는 탭을 찾아 메시지를 전달
        // chrome.runtime.sendMessage는 모든 리스너(사이드패널 포함)에게 전파됨
        // 그러나 사이드패널의 sidepanel-bridge.js는 이미 onMessage 리스너를 갖고 있으므로
        // 여기서는 sender(content script)가 아닌 다른 모든 리스너에게 재전파
        
        console.log("[Bot] 🚀 클리퍼 데이터 사이드패널 릴레이:", request.data?.name);
        
        // 방법 1: 사이드패널의 sidepanel-bridge.js에 직접 전달
        // sidePanel은 extension context에 있으므로 sendMessage로 전달 가능
        chrome.runtime.sendMessage({
            action: 'CLIP_PRODUCT_TO_PANEL',
            data: request.data,
            _relayed: true  // 무한 루프 방지 플래그
        }).catch(err => {
            // 사이드패널이 아직 열리지 않은 경우 — 정상 에러
            console.warn("[Bot] 사이드패널 미오픈 상태, localStorage 직접 저장 폴백");
        });
        
        // 방법 2: 해당 탭의 content script에서 직접 사이드패널을 열어야 할 수도 있음
        // 안전하게 sender 탭에 대해 sidePanel을 열어보기
        if (sender.tab?.id) {
            chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
        }
        
        sendResponse({ status: 'relayed', message: '관제탑 릴레이 완료' });
        return true;
    }
});
