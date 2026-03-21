/* ═══ js/core/eventbus-legacy.js ═══ */

class EventBus {
    constructor() { this.events = {}; }
    on(event, listener) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
    }
    emit(event, data) {
        if (this.events[event]) this.events[event].forEach(l => l(data));
    }
}
// [V5.5] AppEventBus 이중 선언 방지: L13의 SSOT 버스 객체를 그대로 사용
// (삭제됨) window.AppEventBus = new EventBus();
if (!window.AppEventBus) window.AppEventBus = new EventBus();

// [Phase 4] T1 -> T2 EventBus 연동
window.AppEventBus.on('onSalesConfirmed', (data) => {
    console.log('[EventBus] T1 -> T2 Transfer Received.', data);
    // T3로 화면 전환 후, State B로 전개 및 데이터 바인딩 시퀀스
    if(typeof showTab === 'function') showTab('inventory'); // T2로 포커스
    if(window.t2State) window.t2State.setState('B'); // T2를 B상태(타임라인)로 전환
    if(window.t3State) window.t3State.setState('A'); // T3는 준비상태 유지

    // T2 계산기 패널 실제 DOM에 데이터 바인딩
    const targetInput = document.getElementById('costPrice');
    if(targetInput) targetInput.value = data.price || 0;

    const nameInput = document.getElementById('productName');
    if(nameInput) nameInput.value = data.name || '';

    // 글로벌 해외 소싱 섹션에도 가격 기입
    const globalInput = document.getElementById('global-cny-price');
    if(globalInput && targetInput.value && !globalInput.value) {
        // 임시: 위안화 역산 (단순 마킹 배율 195). V6에선 별도 매개변수 사용 가능
        globalInput.value = Math.round(Number(data.price) / 195);
    }

    // 마진 자동 재계산 트리거
    if(typeof recalcMargin === 'function') recalcMargin();
});

// T1 상태 머신
class T1StateManager {
    constructor() {
        this.state = 'A'; // 'A': 대기(숨김), 'B': 전개
    }
    setState(newState) {
        if(this.state === newState) return;
        this.state = newState;
        this.render();
    }
    render() {
        const gridArea = document.getElementById('sourcing-grid-area');
        const top10Area = document.getElementById('sourcing-top10-area');
        const calcArea = document.getElementById('calc-left-pane');
        const aiWaitCard = document.getElementById('ai-wait-card');

        if(this.state === 'A') {
            if(gridArea) gridArea.style.display = 'none';
            if(top10Area) top10Area.style.display = 'none';
            if(aiWaitCard) aiWaitCard.style.display = 'block';
            // CalcArea reset or hide depending on design, preserving structure
        } else if(this.state === 'B') {
            if(gridArea) gridArea.style.display = 'grid'; // .opportunity-list
            if(top10Area) top10Area.style.display = 'block';
            if(aiWaitCard) aiWaitCard.style.display = 'none';
        }
    }
}
window.t1State = new T1StateManager();