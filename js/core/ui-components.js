/**
 * 공통 UI 컴포넌트 — KPI 바, 아코디언, 알림 벨
 * 파일: js/core/ui-components.js
 * 모든 탭에서 공통으로 사용
 */

// ═══════════════════════════════════════
// KPI 바 렌더러
// ═══════════════════════════════════════

/**
 * KPI 바 렌더링
 * @param {string} containerId — 대상 엘리먼트 ID
 * @param {Array} items — [{value, label, color}]
 */
function renderKPIBar(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.className = 'kpi-bar';
    el.innerHTML = items.map(item => `
        <div class="kpi-card">
            <div class="kpi-value" style="color:${item.color || 'var(--text, #e2e8f0)'}">${item.value}</div>
            <div class="kpi-label">${item.label}</div>
        </div>
    `).join('');
}

// ═══════════════════════════════════════
// 아코디언
// ═══════════════════════════════════════

function toggleAccordion(el) {
    if (!el) return;
    // el이 accordion-header면 부모를, accordion 자체면 그대로
    const accordion = el.classList?.contains('accordion') ? el : el.closest('.accordion') || el;
    const body = accordion.querySelector('.accordion-body');
    const header = accordion.querySelector('.accordion-header');
    if (!body) return;

    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (header) {
        header.textContent = header.textContent.replace(/^[▸▾]/, isOpen ? '▸' : '▾');
    }
    accordion.classList.toggle('open', !isOpen);
}

// ═══════════════════════════════════════
// 알림 벨
// ═══════════════════════════════════════

const NotificationBell = {
    alerts: [],
    isOpen: false,

    async init() {
        this.render();
        await this.loadAlerts();
    },

    render() {
        const bell = document.getElementById('notification-bell');
        if (!bell) return;

        bell.innerHTML = `
            <div class="bell-icon" onclick="NotificationBell.toggle()">
                🔔
                <span class="bell-badge" id="bell-badge" style="display:none">0</span>
            </div>
            <div class="bell-dropdown" id="bell-dropdown" style="display:none">
                <div class="bell-dd-header">
                    <span style="font-weight:700;font-size:11px">알림</span>
                    <span class="bell-clear" onclick="NotificationBell.clearAll()">모두 읽음</span>
                </div>
                <div class="bell-dd-list" id="bell-list">
                    <div style="padding:12px;text-align:center;color:#64748b;font-size:10px">알림 없음</div>
                </div>
            </div>
        `;
    },

    async loadAlerts() {
        try {
            const result = await fetchGas('getAlerts', { limit: 20 });
            if (result?.alerts?.length) {
                this.alerts = result.alerts;
                this.updateUI();
            }
        } catch (e) {
            console.warn('[Bell] 알림 로드 실패');
        }
    },

    updateUI() {
        const unread = this.alerts.filter(a => !a.read);
        const badge = document.getElementById('bell-badge');
        if (badge) {
            badge.textContent = unread.length;
            badge.style.display = unread.length > 0 ? 'flex' : 'none';
        }

        const list = document.getElementById('bell-list');
        if (!list) return;

        if (!this.alerts.length) {
            list.innerHTML = '<div style="padding:12px;text-align:center;color:#64748b;font-size:10px">알림 없음</div>';
            return;
        }

        const typeIcons = { '가격변동': '⚠️', '트렌드하락': '📉', '재고부족': '📦', 'info': 'ℹ️' };

        list.innerHTML = this.alerts.slice(0, 15).map(a => `
            <div class="bell-item ${a.read ? 'read' : ''}" onclick="NotificationBell.markRead('${a.id}')">
                <span class="bell-item-icon">${typeIcons[a.type] || '🔔'}</span>
                <div class="bell-item-body">
                    <div class="bell-item-msg">${escapeHtml(a.message || a.productName || '')}</div>
                    <div class="bell-item-meta">${a.type || ''} · ${a.date ? new Date(a.date).toLocaleDateString('ko-KR') : ''}</div>
                </div>
            </div>
        `).join('');
    },

    toggle() {
        this.isOpen = !this.isOpen;
        const dd = document.getElementById('bell-dropdown');
        if (dd) dd.style.display = this.isOpen ? 'block' : 'none';

        // 외부 클릭 닫기
        if (this.isOpen) {
            setTimeout(() => {
                document.addEventListener('click', this._closeHandler);
            }, 10);
        }
    },

    _closeHandler(e) {
        const bell = document.getElementById('notification-bell');
        if (bell && !bell.contains(e.target)) {
            NotificationBell.isOpen = false;
            const dd = document.getElementById('bell-dropdown');
            if (dd) dd.style.display = 'none';
            document.removeEventListener('click', NotificationBell._closeHandler);
        }
    },

    markRead(id) {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) { alert.read = true; this.updateUI(); }
    },

    clearAll() {
        this.alerts.forEach(a => a.read = true);
        this.updateUI();
    },
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // 알림벨을 헤더에 자동 삽입 (헤더가 JS로 동적 생성되므로)
        if (!document.getElementById('notification-bell')) {
            // 로고 옆이나 헤더 영역 끝에 삽입 시도
            const targets = [
                document.querySelector('.user-info'),
                document.querySelector('.header-actions'),
                document.querySelector('[class*="header"] > div:last-child'),
                document.querySelector('header > div:last-child'),
            ];
            const target = targets.find(t => t);
            if (target) {
                const bellDiv = document.createElement('div');
                bellDiv.id = 'notification-bell';
                bellDiv.style.cssText = 'margin-right:8px;';
                target.insertBefore(bellDiv, target.firstChild);
            } else {
                // 헤더 못 찾으면 body 최상단에 fixed로 배치
                const bellDiv = document.createElement('div');
                bellDiv.id = 'notification-bell';
                bellDiv.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9000;';
                document.body.appendChild(bellDiv);
            }
        }
        NotificationBell.init();
    }, 500);
});

// 전역 노출
window.renderKPIBar = renderKPIBar;
window.toggleAccordion = toggleAccordion;
window.NotificationBell = NotificationBell;
