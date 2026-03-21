/* ═══ js/t6/oms.js ═══ */
/* T6: OMS 주문 관제 */

// ==================== T6: OMS 관제 ====================
let _omsOrders = [];
let _omsFilter = 'all';

const OMS_DEMO_ORDERS = [
    { ch: '스마트스토어', id: 'SS240310001', item: '프리미엄 텀블러 500ml', buyer: '김*수', price: 29900, status: 'new', date: '2026-03-10' },
    { ch: '스마트스토어', id: 'SS240310002', item: '무선 충전 패드 15W', buyer: '이*영', price: 19900, status: 'shipping', date: '2026-03-10' },
    { ch: '쿠팡', id: 'CP240309003', item: '실리콘 주방 장갑 세트', buyer: '박*진', price: 12900, status: 'done', date: '2026-03-09' },
    { ch: '쿠팡', id: 'CP240309004', item: 'LED 무드등 터치형', buyer: '최*아', price: 24900, status: 'shipping', date: '2026-03-09' },
    { ch: '11번가', id: '11ST240308005', item: '핸드크림 세트 6종', buyer: '정*호', price: 15900, status: 'done', date: '2026-03-08' },
    { ch: '스마트스토어', id: 'SS240308006', item: '접이식 우산 경량형', buyer: '한*라', price: 18900, status: 'new', date: '2026-03-08' },
    { ch: '쿠팡', id: 'CP240307007', item: '미니 가습기 USB', buyer: '강*민', price: 22900, status: 'return', date: '2026-03-07' },
    { ch: '11번가', id: '11ST240307008', item: '에코백 캔버스 대형', buyer: '윤*서', price: 9900, status: 'done', date: '2026-03-07' },
    { ch: '스마트스토어', id: 'SS240306009', item: '보조배터리 10000mAh', buyer: '서*준', price: 25900, status: 'shipping', date: '2026-03-06' },
    { ch: '쿠팡', id: 'CP240306010', item: '스마트폰 거치대 차량용', buyer: '조*은', price: 14900, status: 'done', date: '2026-03-06' },
    { ch: '11번가', id: '11ST240305011', item: '블루투스 이어폰 TWS', buyer: '임*석', price: 34900, status: 'new', date: '2026-03-05' },
    { ch: '스마트스토어', id: 'SS240305012', item: '데스크 오거나이저', buyer: '신*비', price: 16900, status: 'done', date: '2026-03-05' },
];

function loadDemoOmsOrders() {
    _omsOrders = JSON.parse(JSON.stringify(OMS_DEMO_ORDERS));
    renderOmsOrders();
    showToast('📋 데모 주문 ' + _omsOrders.length + '건이 로드되었습니다');
}

function renderOmsOrders() {
    const tbody = document.getElementById('oms-order-tbody');
    if (!tbody) return;
    const q = (document.getElementById('oms-search')?.value || '').toLowerCase();
    const filtered = _omsOrders.filter(o => {
        if (_omsFilter !== 'all' && o.status !== _omsFilter) return false;
        if (q && !(o.id.toLowerCase().includes(q) || o.item.toLowerCase().includes(q) || o.buyer.includes(q))) return false;
        return true;
    });

    const statusMap = { new: ['🆕 신규', '#3b82f6'], shipping: ['🚚 배송중', '#f59e0b'], done: ['✅ 완료', '#10b981'], return: ['↩️ 반품', '#ef4444'] };
    const chColor = { '스마트스토어': 'var(--smart)', '쿠팡': 'var(--coupang)', '11번가': 'var(--open)' };

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--text-muted);">조건에 맞는 주문이 없습니다</td></tr>';
    } else {
        tbody.innerHTML = filtered.map(o => {
            const [sLabel, sColor] = statusMap[o.status] || ['?', '#888'];
            return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">' +
                '<td style="padding:8px 12px;"><span style="color:' + (chColor[o.ch]||'#fff') + ';font-weight:700;font-size:11px;">' + o.ch + '</span></td>' +
                '<td style="padding:8px 12px;font-family:monospace;font-size:11px;">' + o.id + '</td>' +
                '<td style="padding:8px 12px;">' + o.item + '</td>' +
                '<td style="padding:8px 12px;">' + o.buyer + '</td>' +
                '<td style="padding:8px 12px;font-weight:700;">' + o.price.toLocaleString() + '원</td>' +
                '<td style="padding:8px 12px;"><span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:' + sColor + '22;color:' + sColor + ';">' + sLabel + '</span></td>' +
                '<td style="padding:8px 12px;color:var(--text-muted);font-size:11px;">' + o.date + '</td></tr>';
        }).join('');
    }
    updateOmsStats();
}

function filterOmsOrders(status, btn) {
    _omsFilter = status;
    document.querySelectorAll('.oms-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderOmsOrders();
}

function searchOmsOrders() { renderOmsOrders(); }

function refreshOmsOrders() {
    showToast('🔄 마켓 주문 동기화 중...');
    setTimeout(() => {
        if (!_omsOrders.length) loadDemoOmsOrders();
        else { renderOmsOrders(); showToast('✅ 동기화 완료'); }
    }, 1000);
}

function updateOmsStats() {
    const counts = { new: 0, shipping: 0, done: 0, return: 0 };
    const chCounts = { '스마트스토어': 0, '쿠팡': 0, '11번가': 0 };
    const chNew = { '스마트스토어': 0, '쿠팡': 0, '11번가': 0 };
    const chShip = { '스마트스토어': 0, '쿠팡': 0, '11번가': 0 };
    let totalRev = 0;

    _omsOrders.forEach(o => {
        counts[o.status] = (counts[o.status] || 0) + 1;
        chCounts[o.ch] = (chCounts[o.ch] || 0) + 1;
        if (o.status === 'new') chNew[o.ch]++;
        if (o.status === 'shipping') chShip[o.ch]++;
        totalRev += o.price;
    });

    const total = _omsOrders.length || 1;
    const el = id => document.getElementById(id);
    el('oms-stat-ready')  && (el('oms-stat-ready').textContent = counts.new || 0);
    el('oms-stat-shipping') && (el('oms-stat-shipping').textContent = counts.shipping || 0);
    el('oms-stat-done')   && (el('oms-stat-done').textContent = counts.done || 0);
    el('oms-stat-return') && (el('oms-stat-return').textContent = counts.return || 0);

    el('oms-smart-new')   && (el('oms-smart-new').textContent = chNew['스마트스토어']);
    el('oms-smart-ship')  && (el('oms-smart-ship').textContent = chShip['스마트스토어']);
    el('oms-coupang-new') && (el('oms-coupang-new').textContent = chNew['쿠팡']);
    el('oms-coupang-ship') && (el('oms-coupang-ship').textContent = chShip['쿠팡']);
    el('oms-11st-new')    && (el('oms-11st-new').textContent = chNew['11번가']);
    el('oms-11st-ship')   && (el('oms-11st-ship').textContent = chShip['11번가']);

    ['스마트스토어','쿠팡','11번가'].forEach(ch => {
        const key = ch === '스마트스토어' ? 'smart' : ch === '쿠팡' ? 'coupang' : '11st';
        const pct = Math.round((chCounts[ch] / total) * 100);
        el('oms-bar-' + key) && (el('oms-bar-' + key).style.width = pct + '%');
        el('oms-pct-' + key) && (el('oms-pct-' + key).textContent = pct + '%');
    });

    el('oms-total-orders')  && (el('oms-total-orders').textContent = _omsOrders.length + '건');
    el('oms-total-revenue') && (el('oms-total-revenue').textContent = totalRev.toLocaleString() + '원');

    // 배송 리스트
    const dlEl = el('oms-delivery-list');
    if (dlEl) {
        const ships = _omsOrders.filter(o => o.status === 'shipping');
        dlEl.innerHTML = ships.length ? ships.map(o =>
            '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);"><span>' + o.item + '</span><span style="color:var(--warn);">🚚 배송중</span></div>'
        ).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px;">배송 중인 주문이 없습니다</div>';
    }

    // 채널 연동 상태
    ['smart','coupang','11st'].forEach(k => {
        const stEl = el('oms-' + k + '-status');
        if (stEl && _omsOrders.length > 0) stEl.textContent = '연동됨 (데모)';
    });
}

