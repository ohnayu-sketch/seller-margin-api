/* ═══ js/core/block-5.js ═══ */

/**
 * V5 Logistics & Cost Engine (T2)
 * Handles HS-CODE based duties, VAT deductions, and 3PL status.
 */

const LogisticsEngine = {
    // HS-CODE Duty Rates (Simulated UNIPASS data)
    HS_CODES: {
        'CLOTHES': { name: '의류/패션', duty: 13, vat: 10 },
        'ELECTRONICS': { name: '전자기기', duty: 0, vat: 10 },
        'KITCHEN': { name: '주방용품', duty: 8, vat: 10 },
        'SPORTS': { name: '스포츠/캠핑', duty: 8, vat: 10 },
        'BEAUTY': { name: '뷰티/화장품', duty: 6.5, vat: 10 },
        'ETC': { name: '기타 일반관세', duty: 8, vat: 10 }
    },

    /**
     * Calculates Landed Cost (V5.5 CBM-based)
     * 해상/항공 자동 선택 + 관세/부가세 세분화 + 통관수수료
     */
    calculateLandedCost(params) {
        const {
            originalPrice, // CNY or KRW
            exchangeRate,  // 1 CNY to KRW
            dutyRate,      // % (관세율)
            shippingCost,  // KRW (직접 입력 시 override)
            handlingFee,   // KRW (대행수수료)
            isGlobal,      // boolean
            weightKg,      // 실중량 kg (optional)
            cbm,           // 부피 m³ (optional)
            shippingMode   // 'sea'|'air'|'auto' (optional, default: auto)
        } = params;

        // T7 소싱 상수 읽기
        let sc = {};
        try { sc = JSON.parse(localStorage.getItem('sourcingConstants') || '{}'); } catch(e) {}
        const FX = exchangeRate || sc.exchangeRate || 195;

        let baseKRW = isGlobal ? originalPrice * FX : originalPrice;

        // === CBM 기반 물류비 계산 ===
        let calcShipping = shippingCost || 0;
        const wt = weightKg || 0.5;
        const vol = cbm || 0;
        const mode = shippingMode || 'auto';

        if (!shippingCost || shippingCost === 0) {
            // 해상 운임: CBM 기반 (1CBM ≈ ₩350,000 ~ ₩500,000)
            const SEA_RATE_PER_CBM = 400000;
            const seaCost = vol > 0 ? Math.round(vol * SEA_RATE_PER_CBM) : (sc.freightBase || 1000) + Math.round(wt * (sc.freightPerKg || 1500));

            // 항공 운임: kg 기반 (1kg ≈ ₩8,000 ~ ₩15,000)
            const AIR_RATE_PER_KG = 10000;
            const airCost = Math.round(wt * AIR_RATE_PER_KG);

            // 자동 선택: 소량(< 50kg)이면 항공, 대량이면 해상
            if (mode === 'air') calcShipping = airCost;
            else if (mode === 'sea') calcShipping = seaCost;
            else calcShipping = wt < 50 ? Math.min(seaCost, airCost) : seaCost;
        }

        // === 관세 (Customs Duty) ===
        const effectiveDutyRate = dutyRate || 8;
        const dutyAmount = Math.floor(baseKRW * (effectiveDutyRate / 100));

        // === 부가세 (VAT 10%) — 과세가격 = CIF + 관세 ===
        const importVat = Math.floor((baseKRW + dutyAmount + calcShipping) * 0.1);

        // === 통관수수료 (Customs Clearance Fee) ===
        const clearanceFee = baseKRW >= 150 * FX ? 30000 : 0; // USD150 이상 시 통관수수료

        // === 국내 택배비 ===
        const domesticShip = sc.domesticShipping || 3000;

        const totalLanded = baseKRW + dutyAmount + importVat + calcShipping + clearanceFee + (handlingFee || 0) + domesticShip;

        return {
            base: Math.floor(baseKRW),
            duty: Math.floor(dutyAmount),
            dutyRate: effectiveDutyRate,
            vat: Math.floor(importVat),
            shipping: calcShipping,
            shippingMode: calcShipping === Math.round(wt * 10000) ? 'air' : 'sea',
            clearance: clearanceFee,
            domestic: domesticShip,
            handling: handlingFee || 0,
            total: Math.floor(totalLanded)
        };
    },

    /**
     * 3PL 물류 상태 조회 (3PL API 연동 시 실데이터로 교체)
     */
    get3PLStatus(trackingNo) {
        return {
            status: '📦 물류 미연동',
            location: '-',
            updated_at: new Date().toISOString()
        };
    }
};

window.LogisticsEngine = LogisticsEngine;