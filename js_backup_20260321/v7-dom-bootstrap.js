/**
 * V7 DOM Bootstrap v4 — HTML 직접 패치 후 최소화 버전
 * 
 * HTML에 이미 V7 패치가 적용되어 있으므로,
 * 이 파일은 런타임 초기화와 아코디언 글로벌 함수만 담당합니다.
 */

// toggleAccordionExclusive — ui-components.js에 없으면 폴백
if (typeof window.toggleAccordionExclusive !== 'function') {
    window.toggleAccordionExclusive = function(el, groupClass) {
        const body = el.querySelector('.accordion-body');
        if (!body) return;
        const isOpen = body.style.display !== 'none';
        // 같은 그룹 내 다른 아코디언 닫기
        document.querySelectorAll('.' + groupClass).forEach(acc => {
            const b = acc.querySelector('.accordion-body');
            const h = acc.querySelector('.accordion-header');
            if (b && acc !== el) {
                b.style.display = 'none';
                if (h) h.textContent = h.textContent.replace('▾', '▸');
            }
        });
        body.style.display = isOpen ? 'none' : 'block';
        const header = el.querySelector('.accordion-header');
        if (header) {
            header.textContent = header.textContent.replace(isOpen ? '▾' : '▸', isOpen ? '▸' : '▾');
        }
    };
}

// toggleAccordion 폴백
if (typeof window.toggleAccordion !== 'function') {
    window.toggleAccordion = function(el) {
        const body = el.querySelector('.accordion-body');
        if (!body) return;
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        const header = el.querySelector('.accordion-header');
        if (header) {
            header.textContent = header.textContent.replace(isOpen ? '▾' : '▸', isOpen ? '▸' : '▾');
        }
    };
}

console.log('[V7] DOM Bootstrap v4 loaded (HTML direct patch mode)');
