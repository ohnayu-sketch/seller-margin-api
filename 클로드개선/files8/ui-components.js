/**
 * 공통 UI 컴포넌트 — KPI 바, 아코디언, 알림 벨
 * 파일: js/core/ui-components.js
 * 의존성: fetch-gas.js, ui-helpers.js, event-bus.js
 */

// ═══════════════════════════════════════
// 1. KPI 바 렌더러
// ═══════════════════════════════════════

/**
 * KPI 바를 렌더링한다.
 * @param {string} containerId — DOM 컨테이너 id
 * @param {Array<{value:string|number, label:string, color?:string}>} items — KPI 항목 (최대 4개)
 */
function renderKPIBar(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.className = 'kpi-bar';
    el.innerHTML = items.map(item => {
        const color = item.color || 'var(--text)';
        return `<div class="kpi-card">
            <div class="kpi-num" style="color:${color}">${item.value}</div>
            <div class="kpi-label">${item.label}</div>
        </div>`;
    }).join('');
}

// ═══════════════════════════════════════
// 2. 아코디언 컴포넌트
// ═══════════════════════════════════════

/**
 * 아코디언 토글. 클릭하면 내용 펼침/접힘.
 * HTML 구조:
 *   <div class="accordion" onclick="toggleAccordion(this)">
 *     <div class="accordion-header">▸ 제목</div>
 *     <div class="accordion-body" style="display:none">내용</div>
 *   </div>
 */
function toggleAccordion(el) {
    const body = el.querySelector('.accordion-body');
    const header = el.querySelector('.accordion-header');
    if (!body) return;

    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';

    if (header) {
        const text = header.textContent;
        header.textContent = isOpen
            ? text.replace('▾', '▸')
            : text.replace('▸', '▾');
    }
}

/**
 * 아코디언 그룹: 하나를 열면 나머지 닫힘
 */
function toggleAccordionExclusive(el, groupClass) {
    const group = document.querySelectorAll('.' + groupClass);
    group.forEach(item => {
        if (item !== el) {
            const body = item.querySelector('.accordion-body');
            const header = item.querySelector('.accordion-header');
            if (body) body.style.display = 'none';
            if (header) header.textContent = header.textContent.replace('▾', '▸');
        }
    });
    toggleAccordion(el);
}

// ═══════════════════════════════════════
// 3. 알림 벨 시스템
// ═══════════════════════════════════════

const AlertBell = {
    alerts: [],
    isOpen: false,

    async load() {
        try {
            const result = await fetchGas('getAlerts', { limit: 20 });
            if (result?.alerts) {
                this.alerts = result.alerts;
            }
        } catch (e) {
            console.warn('[AlertBell] 알림 로드 실패:', e);
        }
        this.renderBadge();
    },

    renderBadge() {
        const badge = document.getElementById('alert-bell-badge');
        const unread = this.alerts.filter(a => !a.read).length;
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    },

    toggle() {
        this.isOpen = !this.isOpen;
        const dropdown = document.getElementById('alert-bell-dropdown');
        if (dropdown) {
            dropdown.style.display = this.isOpen ? 'block' : 'none';
            if (this.isOpen) this.renderDropdown();
        }
    },

    renderDropdown() {
        const dropdown = document.getElementById('alert-bell-dropdown');
        if (!dropdown) return;

        if (!this.alerts.length) {
            dropdown.innerHTML = `
                <div class="bell-dd-header">알림</div>
                <div class="bell-dd-empty">새 알림이 없습니다</div>`;
            return;
        }

        const unread = this.alerts.filter(a => !a.read).length;
        let html = `<div class="bell-dd-header">알림 ${unread > 0 ? unread + '건' : ''}</div>`;

        this.alerts.slice(0, 10).forEach(alert => {
            const dotColor = alert.severity === 'danger' ? '#ef4444'
                : alert.severity === 'warning' ? '#f59e0b'
                : '#10b981';
            const timeAgo = this._timeAgo(alert.date);

            html += `<div class="bell-dd-item ${alert.read ? 'read' : ''}" onclick="AlertBell.onClickAlert('${alert.id}')">
                <div class="bell-dd-dot" style="background:${dotColor}"></div>
                <div class="bell-dd-text">
                    <div class="bell-dd-title">${escapeHtml(alert.productName || '')}</div>
                    <div class="bell-dd-desc">${escapeHtml(alert.message || '')}</div>
                </div>
                <div class="bell-dd-time">${timeAgo}</div>
            </div>`;
        });

        dropdown.innerHTML = html;
    },

    onClickAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.read = true;
            this.renderBadge();
            // 해당 탭으로 이동하거나 상세 보기
            if (alert.tab && typeof showTab === 'function') {
                showTab(alert.tab);
            }
        }
        this.toggle(); // 드롭다운 닫기
    },

    // 알림 추가 (프론트에서 직접 추가할 때)
    push(alert) {
        this.alerts.unshift({
            id: 'local_' + Date.now(),
            read: false,
            date: new Date().toISOString(),
            ...alert,
        });
        this.renderBadge();
    },

    _timeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return '방금';
        if (mins < 60) return mins + '분 전';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + '시간 전';
        const days = Math.floor(hours / 24);
        return days + '일 전';
    },
};

// 페이지 로드 시 알림 벨 초기화
document.addEventListener('DOMContentLoaded', () => {
    AlertBell.load();

    // 벨 아이콘 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        const bellWrap = document.getElementById('alert-bell-wrap');
        if (bellWrap && !bellWrap.contains(e.target) && AlertBell.isOpen) {
            AlertBell.toggle();
        }
    });
});

// 이벤트 버스로 알림 수신
if (typeof AppEventBus !== 'undefined') {
    AppEventBus.on('PRICE_ALERT', (data) => {
        AlertBell.push({ severity: 'danger', productName: data.name, message: `시중가 ${data.change}`, tab: 'sourcing' });
    });
    AppEventBus.on('TREND_ALERT', (data) => {
        AlertBell.push({ severity: 'warning', productName: data.keyword, message: `검색량 ${data.change}% 하락`, tab: 'sourcing' });
    });
    AppEventBus.on('STOCK_ALERT', (data) => {
        AlertBell.push({ severity: 'warning', productName: data.name, message: '재고 부족 — 재주문 필요', tab: 'inventory' });
    });
}

// 전역 노출
window.renderKPIBar = renderKPIBar;
window.toggleAccordion = toggleAccordion;
window.toggleAccordionExclusive = toggleAccordionExclusive;
window.AlertBell = AlertBell;
