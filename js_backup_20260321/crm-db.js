// ==================== crm-db.js ====================
// Phase 4: 직거래처 CRM DB
// 거래처 등록/관리/이력 + Google Sheets CRUD

const CrmDB = {
    suppliers: [],  // 거래처 목록 (인메모리)

    // 데모 거래처 데이터
    demoSuppliers: [
        { id: 's1', name: '(주)한국생활용품', contact: '김대표', phone: '010-1234-5678', email: 'han@life.co.kr', category: '생활용품', bank: '국민 123-456-7890', terms: 'MOQ 50개, 30일 결제', rating: 4.5, totalOrders: 23, totalAmount: 5200000, lastOrder: '2026-03-05' },
        { id: 's2', name: '심천무역유한공사', contact: 'Wang Li', phone: '+86-755-1234', email: 'wang@shenzhen.cn', category: '전자/IT', bank: 'ICBC 6212-XXXX', terms: 'MOQ 100, T/T 선불', rating: 4.2, totalOrders: 8, totalAmount: 12800000, lastOrder: '2026-02-28' },
        { id: 's3', name: '도매꾹 베스트셀러', contact: '박사장', phone: '010-9876-5432', email: 'park@domeggook.com', category: '패션잡화', bank: '신한 110-XXX', terms: '위탁, 무재고', rating: 4.8, totalOrders: 45, totalAmount: 3400000, lastOrder: '2026-03-08' },
    ],

    // 거래처 추가
    add(supplier) {
        const id = 's' + Date.now().toString(36);
        this.suppliers.push({ id, ...supplier, totalOrders: 0, totalAmount: 0, lastOrder: '-' });
        this.render();
        if (typeof showToast === 'function') showToast(`✅ 거래처 "${supplier.name}" 등록`);
    },

    // 거래처 삭제
    remove(id) {
        this.suppliers = this.suppliers.filter(s => s.id !== id);
        this.render();
    },

    // 거래처 검색
    search(keyword) {
        return this.suppliers.filter(s =>
            s.name.includes(keyword) || s.contact.includes(keyword) || s.category.includes(keyword)
        );
    },

    // 렌더링
    render() {
        const el = document.getElementById('crm-supplier-list');
        if (!el) return;

        if (!this.suppliers.length) {
            el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;margin-bottom:8px;">🤝</div>등록된 거래처가 없습니다</div>';
            return;
        }

        el.innerHTML = this.suppliers.map(s => `
            <div style="padding:14px;margin-bottom:10px;background:rgba(255,255,255,0.5);border-radius:12px;border:1px solid var(--border);transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="font-weight:700;font-size:14px;">${s.name}</span>
                        <span style="margin-left:8px;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;background:var(--accent-bg);color:var(--accent);">${s.category}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span style="font-size:12px;">⭐${s.rating}</span>
                        <button onclick="CrmDB.remove('${s.id}')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:12px;">✕</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;font-size:11px;color:var(--text-muted);">
                    <div>👤 ${s.contact}</div>
                    <div>📞 ${s.phone}</div>
                    <div>📦 총 ${s.totalOrders}건</div>
                    <div>💰 ₩${s.totalAmount.toLocaleString()}</div>
                </div>
                <div style="margin-top:6px;font-size:10px;color:var(--text-muted);">📋 ${s.terms} | 최근: ${s.lastOrder}</div>
            </div>
        `).join('');
    },

    // 새 거래처 추가 폼 토글
    showAddForm() {
        const el = document.getElementById('crm-add-form');
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    },

    submitForm() {
        const get = id => document.getElementById(id)?.value || '';
        this.add({
            name: get('crm-name'),
            contact: get('crm-contact'),
            phone: get('crm-phone'),
            email: get('crm-email'),
            category: get('crm-category'),
            bank: get('crm-bank'),
            terms: get('crm-terms'),
            rating: 4.0,
        });
        document.getElementById('crm-add-form').style.display = 'none';
    },

    // 데모 데이터 로드
    loadDemo() {
        this.suppliers = [...this.demoSuppliers];
        this.render();
        if (typeof showToast === 'function') showToast(`🤝 데모 거래처 ${this.suppliers.length}개 로드`);
    },

    init() {
        const searchInput = document.getElementById('crm-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.trim();
                if (q) {
                    const results = this.search(q);
                    const backup = this.suppliers;
                    this.suppliers = results;
                    this.render();
                    this.suppliers = backup;
                } else {
                    this.render();
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { CrmDB.init(); });
