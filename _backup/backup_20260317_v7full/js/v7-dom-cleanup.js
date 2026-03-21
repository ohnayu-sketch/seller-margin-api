/**
 * ★ [V7 Ultimate] 고아 DOM 강제 철거 모듈
 * 철거된 패널의 잔여 DOM을 부팅 시 display:none 처리
 */
(function v7UltimateDOMCleanup() {
    function hideOrphanPanels() {
        // 1. 시즌별 소싱 타이밍 (seasonality-panel 및 관련 요소)
        document.querySelectorAll('.seasonality-panel, .v5-opportunity-header').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // 2. AI 소싱 성과 관련 패널 + 시즌 캘린더 헤더
        document.querySelectorAll('.panel-header').forEach(h => {
            const txt = h.textContent || '';
            if (txt.includes('AI 소싱 성과') || txt.includes('시즌별 소싱') || txt.includes('AI 소싱 기회 레이더')) {
                let panel = h.closest('.panel');
                if (!panel) panel = h.parentElement;
                if (panel) panel.style.setProperty('display', 'none', 'important');
            }
        });

        // 3. AI 소싱 기회 레이더
        const radarPanel = document.getElementById('v5-radar-panel');
        if (radarPanel) radarPanel.style.setProperty('display', 'none', 'important');

        // 4. 카테고리 소싱 트리
        const catTree = document.getElementById('category-tree');
        if (catTree) {
            let panel = catTree.closest('.panel');
            if (!panel) panel = catTree.parentElement?.parentElement;
            if (panel) panel.style.setProperty('display', 'none', 'important');
        }

        // 5. 통합 공급처 검색 + 통합 소싱 분석 엔진
        const supplierPanel = document.getElementById('supplier-search-panel');
        if (supplierPanel) supplierPanel.style.setProperty('display', 'none', 'important');
        document.querySelectorAll('.panel-header').forEach(h => {
            const txt = h.textContent || '';
            // 통합 소싱 분석 엔진은 유지 — 공급처 검색만 숨김
            if (txt.includes('통합 공급처 검색')) {
                let panel = h.closest('.panel');
                if (!panel) panel = h.parentElement;
                if (panel) panel.style.setProperty('display', 'none', 'important');
            }
        });

        // 6. 통계 리본 (AI SCORE) + 인사이트 허브
        ['ag-stats-ribbon', 'sourcing-insight-hub'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty('display', 'none', 'important');
        });

        // 7. calc-left-pane 숨김 — 스크리너만 전체 화면 사용
        document.querySelectorAll('#page-sourcing .calc-left-pane').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // 8. 고아 시즌 타이밍 텍스트 노드 (panel 밖에 떠도는 경우)
        const pageSourcing = document.getElementById('page-sourcing');
        if (pageSourcing) {
            const allChildren = pageSourcing.children;
            for (let i = 0; i < allChildren.length; i++) {
                const ch = allChildren[i];
                // 주석이나 calc-container가 아닌 div들 중 숨겨야 할 것
                if (ch.tagName === 'DIV' && !ch.classList.contains('calc-container') && ch.id !== 'page-sourcing') {
                    const txt = ch.textContent || '';
                    if (txt.includes('시즌별 소싱') || txt.includes('AI 소싱 성과') || txt.includes('소싱 전환율') || txt.includes('저장된 상품이 없습니다')) {
                        ch.style.setProperty('display', 'none', 'important');
                    }
                }
            }
        }

        if (window.SystemLogger) SystemLogger.log('🧹 V7 Ultimate: 고아 DOM 강제 철거 완료', 'info');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideOrphanPanels);
    } else {
        hideOrphanPanels();
    }
})();
