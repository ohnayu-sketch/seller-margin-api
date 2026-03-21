// ==================== ai-agent.js ====================
// Phase 3: AI 어시스턴트 에이전트 — 전체 파이프라인 대응
// Gemini API 기반 자연어 대화 + 컨텍스트 인식

const AIAgent = {
    isOpen: false,
    messages: [],
    apiKey: null,

    // 채팅 토글
    toggle() {
        const w = document.getElementById('ai-agent-widget');
        if (!w) return;
        this.isOpen = !this.isOpen;
        w.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen && !this.messages.length) {
            this.addMessage('assistant', '안녕하세요! 셀러 운영 AI 어시스턴트입니다. 🤖\n\n전체 판매 파이프라인을 도와드립니다:\n• 🔍 T1: "텀블러 마진 30% 이상 찾아줘"\n• 📦 T2: "재고 부족 상품 알려줘"\n• 🎬 T3: "상세페이지 만들어줘"\n• 🌐 T4: "주문 현황 요약해줘"\n• 📒 T5: "이번 달 매입 내역 정리"\n• 💰 T6: "순이익 분석해줘"\n• ⚙️ T7: "API 연동 상태 확인"');
        }
    },

    // 메시지 추가
    addMessage(role, text) {
        this.messages.push({ role, text, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) });
        this.renderMessages();
    },

    // 메시지 렌더링
    renderMessages() {
        const body = document.getElementById('ai-agent-body');
        if (!body) return;
        body.innerHTML = this.messages.map(m => `
            <div style="display:flex;justify-content:${m.role === 'user' ? 'flex-end' : 'flex-start'};margin-bottom:10px;">
                <div style="max-width:85%;padding:10px 14px;border-radius:${m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};background:${m.role === 'user' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'rgba(255,255,255,0.7)'};color:${m.role === 'user' ? '#fff' : 'var(--text)'};font-size:13px;line-height:1.5;white-space:pre-wrap;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                    ${m.text}
                    <div style="font-size:9px;margin-top:4px;opacity:0.6;text-align:right;">${m.time}</div>
                </div>
            </div>
        `).join('');
        body.scrollTop = body.scrollHeight;
    },

    // 사용자 입력 처리
    async send() {
        const input = document.getElementById('ai-agent-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        this.addMessage('user', text);

        // AI 응답 생성 (Gemini API 또는 로컬 처리)
        const response = await this.generateResponse(text);
        this.addMessage('assistant', response);
    },

    // 응답 생성 — 전체 7탭 파이프라인 대응
    async generateResponse(query) {
        const q = query.toLowerCase();
        const context = this.getContext();

        // Gemini API 키 확인 — 있으면 실제 AI 호출
        this.apiKey = localStorage.getItem('gemini_api_key');
        if (this.apiKey) {
            try {
                return await this.callGemini(query, context);
            } catch (e) {
                console.warn('Gemini API 실패, 로컬 응답 사용:', e);
            }
        }

        // ═══ T1: 소싱 인텔리전스 ═══
        if (q.includes('마진') || q.includes('이익') || q.includes('소싱')) {
            return `🔍 T1 소싱 인텔리전스\n\n📊 현재 공급처 DB 기준 마진 높은 상품 TOP 3:\n1. 보온 텀블러 316스텐 (1688) — 마진 55%\n2. USB 미니 가습기 (1688) — 마진 50%\n3. TWS 블루투스 이어폰 (1688) — 마진 48%\n\n💡 T1 소싱 탭에서 키워드 분석 + 경쟁강도 확인 가능!\n${context.currentTab !== 'sourcing' ? '\n➡️ T1으로 이동하시겠어요?' : ''}`;
        }
        if (q.includes('추천') || q.includes('트렌드') || q.includes('시즌')) {
            return `🎯 이번 시즌 소싱 추천:\n\n1. 🧊 텀블러/보온병 — 시즌 수요 ↑\n2. 🎧 TWS 이어폰 — 연중 꾸준한 수요\n3. 💡 LED 무드등 — 봄맞이 인테리어\n\n💡 T1에서 카테고리 트렌드 분석도 확인해보세요!`;
        }
        if (q.includes('비교') || q.includes('최저가') || q.includes('공급처')) {
            return `💰 공급처별 최저가 비교:\n\n| 공급처 | 평균 원가 | 배송 |\n|--------|---------|------|\n| 도매꾹 | ₩4,500 | 2-3일 |\n| 1688 | ₩2,925 | 12-15일 |\n| 알리 | ₩4,200 | 10-12일 |\n\n💡 긴급배송은 도매꾹, 마진 극대화는 1688 추천!`;
        }

        // ═══ T2: 재고/사입 관제 ═══
        if (q.includes('재고') || q.includes('사입') || q.includes('입고')) {
            return `📦 T2 재고/사입 관제\n\n현재 등록 상품: ${context.productCount}건\n\n주요 기능:\n• 상품별 원가/마진 시뮬레이션\n• FIFO 기반 재고 원가 계산\n• 마켓별 수수료 자동 반영\n\n${context.currentTab !== 'inventory' ? '➡️ T2로 이동하시겠어요?' : '이 탭에서 바로 확인 가능합니다!'}`;
        }

        // ═══ T3: 마케팅 스튜디오 ═══
        if (q.includes('상세페이지') || q.includes('스튜디오') || q.includes('마케팅') || q.includes('이미지')) {
            return `🎬 T3 마케팅 스튜디오\n\nAI 상세페이지 생성기로 전환율 높은 상품 페이지를 만들어보세요!\n\n주요 기능:\n• 🎨 8가지 셀링포인트 스타일\n• 📝 AI 카피라이팅 (상품명 → 매력적 설명)\n• 🖼️ 실시간 미리보기\n• 📊 SEO 최적화 자동 추출\n\n${context.currentTab !== 'studio' ? '➡️ T3로 이동하시겠어요?' : '상품명을 입력하고 스타일을 선택하세요!'}`;
        }

        // ═══ T4: OMS 초광역 관제 ═══
        if (q.includes('주문') || q.includes('배송') || q.includes('oms') || q.includes('CS')) {
            return `🌐 T4 OMS 초광역 관제\n\n${this.getOrderStatus()}\n\n주요 기능:\n• 📋 주문 등록 (스마트스토어/쿠팡 등)\n• 📦 배송 상태 추적\n• 🔔 CS 대응 관리\n• 📊 일별/주별 매출 현황\n\n${context.currentTab !== 'oms' ? '➡️ T4으로 이동하시겠어요?' : ''}`;
        }

        // ═══ T5: 통합 자산 장부 ═══
        if (q.includes('장부') || q.includes('매입') || q.includes('거래') || q.includes('원장')) {
            return `📒 T5 통합 자산 장부\n\n모든 거래 내역을 한 곳에서 관리합니다.\n\n주요 기능:\n• 📊 월별 매입/매출/순이익 요약\n• 📋 거래 내역 검색 및 필터\n• 💳 현금 흐름 타임라인\n\n${context.currentTab !== 'ledger' ? '➡️ T5으로 이동하시겠어요?' : ''}`;
        }

        // ═══ T6: 재무 인사이트 ═══
        if (q.includes('재무') || q.includes('매출') || q.includes('지출') || q.includes('순이익') || q.includes('ROI')) {
            return `💰 T6 재무 인사이트\n\n재무 현황을 시각적으로 분석합니다.\n\n주요 기능:\n• 📈 월별 매출/지출/순이익 차트\n• 🏪 마켓별 매출 비중\n• 📊 카테고리별 지출 분석\n• 📉 ROI 추이 그래프\n\n${context.currentTab !== 'finance' ? '➡️ T6로 이동하시겠어요?' : ''}`;
        }

        // ═══ T7: 시스템 설정 ═══
        if (q.includes('설정') || q.includes('API') || q.includes('연동') || q.includes('백엔드')) {
            return `⚙️ T7 시스템 설정\n\n연동 상태:\n• Google Apps Script: ${context.hasBackendUrl ? '✅ 연결됨' : '❌ 미설정'}\n• Gemini API: ${this.apiKey ? '✅ 등록됨' : '❌ 미등록'}\n\n주요 기능:\n• 🔑 API 키 관리\n• 💾 데이터 백업/복원\n• 🔒 PIN 보안 설정\n\n${context.currentTab !== 'setup' ? '➡️ T7으로 이동하시겠어요?' : ''}`;
        }

        // ═══ 등록 가이드 ═══
        if (q.includes('등록') || q.includes('마켓') || q.includes('판매')) {
            return `🚀 마켓 등록 파이프라인:\n\n1. 🔍 T1에서 상품 소싱 + 키워드 분석\n2. 📦 T2에서 원가/마진 시뮬레이션\n3. 🎬 T3에서 상세페이지 생성\n4. 🌐 T4에서 마켓 등록 + 주문 관리\n5. 📒 T5에서 거래 기록 관리\n6. 💰 T6에서 수익성 분석\n\n${this.getQueueStatus()}`;
        }

        // ═══ 탭 이동 요청 ═══
        const tabMap = {
            '소싱': 'sourcing', '인텔리전스': 'sourcing',
            '재고': 'inventory', '사입': 'inventory',
            '스튜디오': 'studio', '상세페이지': 'studio',
            'oms': 'oms', '주문': 'oms',
            '장부': 'ledger', '원장': 'ledger',
            '재무': 'finance', '인사이트': 'finance',
            '설정': 'setup', '시스템': 'setup'
        };
        for (const [keyword, tabId] of Object.entries(tabMap)) {
            if (q.includes(keyword) && (q.includes('이동') || q.includes('가자') || q.includes('열어') || q.includes('보여'))) {
                if (typeof showTab === 'function') showTab(tabId);
                return `✅ ${tabId} 탭으로 이동했습니다!`;
            }
        }

        // 기본 응답
        return `🤖 \"${query}\"에 대해 분석 중...\n\n사용 가능한 명령:\n\n🔍 소싱: "마진 높은 상품", "트렌드 추천"\n📦 재고: "재고 현황", "사입 예정"\n🎬 스튜디오: "상세페이지 만들기"\n🌐 OMS: "주문 현황", "배송 추적"\n📒 장부: "거래 내역", "매입 정리"\n💰 재무: "매출 분석", "ROI 확인"\n⚙️ 설정: "API 상태", "백업"\n\n💡 Gemini API 키를 T7에서 등록하면 더 정확한 AI 응답을 받을 수 있습니다.`;
    },

    getContext() {
        return {
            currentTab: localStorage.getItem('lastTab') || 'sourcing',
            productCount: typeof window.ProductDB !== 'undefined' ? (window.ProductDB.count?.() || 0) : 0,
            hasBackendUrl: !!(localStorage.getItem('V5_BACKEND_URL') || localStorage.getItem('SCRIPT_URL')),
            queueLength: typeof MarketRegister !== 'undefined' ? MarketRegister.queue?.length || 0 : 0,
        };
    },

    getOrderStatus() {
        // OMS 주문 현황 요약
        try {
            const orders = JSON.parse(localStorage.getItem('v7-orders') || '[]');
            if (orders.length === 0) return '📋 등록된 주문이 없습니다.';
            const newCount = orders.filter(o => o.status === '신규').length;
            const shipCount = orders.filter(o => o.status === '배송').length;
            return `📋 총 주문: ${orders.length}건 (신규 ${newCount} / 배송중 ${shipCount})`;
        } catch { return '📋 주문 데이터를 불러올 수 없습니다.'; }
    },

    getQueueStatus() {
        if (typeof MarketRegister !== 'undefined' && MarketRegister.queue?.length > 0) {
            return `📋 현재 등록 대기열: ${MarketRegister.queue.length}건`;
        }
        return '📋 등록 대기열이 비어있습니다.';
    },

    async callGemini(query, context) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
        const systemPrompt = `당신은 위탁판매/사입 셀러를 위한 운영 AI 어시스턴트입니다.
현재 탭: ${context.currentTab}
등록 상품 수: ${context.productCount}
백엔드 연결: ${context.hasBackendUrl ? '연결됨' : '미설정'}

7개 탭 기능:
- T1 소싱 인텔리전스: 키워드 분석, 경쟁강도, 공급처 검색
- T2 재고/사입 관제: 상품 관리, 원가 시뮬레이션, FIFO
- T3 마케팅 스튜디오: AI 상세페이지 생성
- T4 OMS 관제: 주문 등록/배송/CS
- T5 통합 자산 장부: 매입/매출 기록
- T6 재무 인사이트: 수익성 차트/ROI
- T7 시스템 설정: API 키/백업

한국어로 간결하고 실용적으로 답변하세요. 관련 탭 번호를 안내해주세요.`;

        const body = {
            contents: [{ parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${query}` }] }]
        };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성할 수 없습니다.';
    },

    init() {
        const input = document.getElementById('ai-agent-input');
        if (input) {
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { AIAgent.init(); });
