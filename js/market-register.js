// ==================== market-register.js ====================
// 소싱→마켓 원클릭 등록 파이프라인
// Phase 2: 등록 대기열 + 마켓별 양식 + 시뮬레이션

const MarketRegister = {
    queue: [],  // 등록 대기열

    markets: [
        { key: 'smartstore', name: '스마트스토어', icon: '🟢', color: '#03c75a', fee: 5.5 },
        { key: 'coupang', name: '쿠팡', icon: '🟠', color: '#ff6900', fee: 10.8 },
        { key: '11st', name: '11번가', icon: '🔴', color: '#ff0038', fee: 8.0 },
    ],

    // 대기열에 상품 추가
    addToQueue(product) {
        const id = Date.now().toString(36);
        const item = {
            id,
            name: product.name || '미정',
            cost: product.wholesale_price || product.cost || 0,
            sellingPrice: Math.round((product.wholesale_price || product.cost || 10000) * 1.5),
            category: product.category || '생활용품',
            source: product.source_type || 'manual',
            status: 'draft',   // draft → editing → ready → registered
            markets: ['smartstore'],  // 기본 스마트스토어
            options: [],
            description: '',
            addedAt: new Date().toISOString()
        };
        this.queue.push(item);
        this.renderQueue();
        if (typeof showToast === 'function') showToast(`📋 "${item.name}" 등록 대기열에 추가`);
        return item;
    },

    // 대기열 렌더링
    renderQueue() {
        const el = document.getElementById('market-register-queue');
        if (!el) return;

        if (!this.queue.length) {
            el.innerHTML = `
                <div style="text-align:center;padding:40px;color:var(--text-muted);">
                    <div style="font-size:32px;margin-bottom:8px;">📋</div>
                    <div>등록 대기열이 비어있습니다</div>
                    <div style="font-size:11px;margin-top:4px;">T1 공급처 검색에서 「→ 시뮬레이터」를 클릭하세요</div>
                </div>`;
            return;
        }

        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:700;font-size:14px;">📋 대기열 (${this.queue.length}건)</span>
                <button onclick="MarketRegister.registerAll()" style="padding:6px 16px;background:linear-gradient(135deg,#03c75a,#10b981);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">🚀 전체 등록 시뮬레이션</button>
            </div>
            ${this.queue.map(item => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.5);border-radius:10px;border:1px solid var(--border);">
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:13px;">${item.name}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">원가 ₩${item.cost.toLocaleString()} → 판매가 ₩${item.sellingPrice.toLocaleString()}</div>
                    </div>
                    <div style="display:flex;gap:4px;">
                        ${this.markets.map(m => `
                            <span style="padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;${item.markets.includes(m.key) ? `background:${m.color}22;color:${m.color};border:1px solid ${m.color}44;` : 'background:rgba(0,0,0,0.04);color:var(--text-muted);border:1px solid transparent;'}" onclick="MarketRegister.toggleMarket('${item.id}','${m.key}')">${m.icon} ${m.name}</span>
                        `).join('')}
                    </div>
                    <span style="padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;${this.getStatusStyle(item.status)}">${this.getStatusLabel(item.status)}</span>
                    <button onclick="MarketRegister.removeFromQueue('${item.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:#ef4444;" title="삭제">✕</button>
                </div>
            `).join('')}
        `;
    },

    getStatusLabel(s) {
        return { draft: '초안', editing: '편집중', ready: '준비완료', registered: '✅ 등록됨' }[s] || s;
    },
    getStatusStyle(s) {
        const map = {
            draft: 'background:#94a3b822;color:#94a3b8;',
            editing: 'background:#f59e0b22;color:#f59e0b;',
            ready: 'background:#3b82f622;color:#3b82f6;',
            registered: 'background:#10b98122;color:#10b981;'
        };
        return map[s] || '';
    },

    toggleMarket(itemId, marketKey) {
        const item = this.queue.find(q => q.id === itemId);
        if (!item) return;
        const idx = item.markets.indexOf(marketKey);
        if (idx >= 0) item.markets.splice(idx, 1);
        else item.markets.push(marketKey);
        this.renderQueue();
    },

    removeFromQueue(itemId) {
        this.queue = this.queue.filter(q => q.id !== itemId);
        this.renderQueue();
    },

    // 전체 등록 시뮬레이션
    registerAll() {
        if (!this.queue.length) return;
        let totalFee = 0;
        let summary = [];

        this.queue.forEach(item => {
            item.status = 'registered';
            item.markets.forEach(mk => {
                const market = this.markets.find(m => m.key === mk);
                const fee = item.sellingPrice * (market.fee / 100);
                const profit = item.sellingPrice - item.cost - fee;
                totalFee += fee;
                summary.push({ name: item.name, market: market.name, fee: Math.round(fee), profit: Math.round(profit) });
            });
        });

        this.renderQueue();

        // 시뮬레이션 결과 표시
        const resultEl = document.getElementById('market-register-result');
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="panel" style="margin-top:12px;background:linear-gradient(135deg,rgba(16,185,129,0.05),rgba(59,130,246,0.05));border:1px solid rgba(16,185,129,0.2);">
                    <div style="padding:16px;">
                        <div style="font-weight:700;font-size:14px;margin-bottom:12px;">🎉 등록 시뮬레이션 완료</div>
                        <table style="width:100%;font-size:12px;border-collapse:collapse;">
                            <tr style="border-bottom:1px solid var(--border);">
                                <th style="padding:6px;text-align:left;">상품</th>
                                <th style="padding:6px;text-align:left;">마켓</th>
                                <th style="padding:6px;text-align:right;">수수료</th>
                                <th style="padding:6px;text-align:right;">예상 이익</th>
                            </tr>
                            ${summary.map(s => `
                                <tr>
                                    <td style="padding:6px;">${s.name}</td>
                                    <td style="padding:6px;">${s.market}</td>
                                    <td style="padding:6px;text-align:right;color:#ef4444;">-₩${s.fee.toLocaleString()}</td>
                                    <td style="padding:6px;text-align:right;font-weight:700;color:${s.profit > 0 ? '#10b981' : '#ef4444'};">₩${s.profit.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </table>
                        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">※ 실제 등록은 T7에서 마켓 API 키 등록 후 가능합니다</div>
                    </div>
                </div>`;
        }
        if (typeof showToast === 'function') showToast(`🚀 ${summary.length}건 등록 시뮬레이션 완료!`);
    },

    // 데모 상품 추가
    loadDemo() {
        const demos = [
            { name: '스텐레스 텀블러 500ml', wholesale_price: 4500, category: '주방/생활', source_type: 'domeggook' },
            { name: 'TWS 블루투스 이어폰', wholesale_price: 5460, category: '전자/IT', source_type: '1688' },
            { name: 'LED 무드등 터치형', wholesale_price: 5500, category: '인테리어', source_type: 'dometopia' },
        ];
        demos.forEach(d => this.addToQueue(d));
    },

    // EventBus 연동
    init() {
        if (typeof AppEventBus !== 'undefined') {
            AppEventBus.on('PRODUCT_SOURCED', (data) => this.addToQueue(data));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { MarketRegister.init(); });
