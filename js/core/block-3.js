/* ═══ js/core/block-3.js ═══ */

/**
 * calc.js
 * 마진 계산 및 세무 관련 순수 비즈니스 로직 (수학적 계산 수행)
 * 화면 DOM 제어(document.getElementById 등)는 완전히 배제되었습니다.
 */

// ==================== [ 소싱 및 시중가 수익 계산 로직 ] ====================

/**
 * 특정 마켓 수수료 및 간이과세자 부가율을 바탕으로 목표 마진 달성을 위한 최적 판매가를 계산합니다.
 * @param {number} cost 원가 (상품 본품)
 * @param {number} supShip 공급사 배송비 (원가에 포함되는 요소)
 * @param {number} mktShip 마켓 설정 배송비 (고객에게 부과하지만 수수료 산정/이익에 영향을 줄 수 있음)
 * @param {number} feeRate 해당 마켓 수수료율 (%)
 * @param {number} targetMargin 목표 마진율 (%)
 * @returns {Object} 계산 결과 ({ salePrice, feeAmt, vatAmt, profit, marginRate, totalCost })
 */
function calcForMarket(cost, supShip, mktShip, feeRate, targetMargin) {
  const totalCost = cost + supShip;
  const vatRate = 1.5; // 간이과세자 (소매업 부가가치율 15% * 10%)

  let salePrice, feeAmt, vatAmt, profit, marginRate;

  if (targetMargin > 0) {
    const denom = 1 - (feeRate / 100) - (vatRate / 100) - (targetMargin / 100);
    salePrice = denom <= 0 ? 0 : Math.ceil((totalCost + mktShip) / denom);
    feeAmt = salePrice * (feeRate / 100);
    vatAmt = salePrice * (vatRate / 100);
    profit = salePrice - feeAmt - vatAmt - mktShip - totalCost;
    marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  } else {
    salePrice = 0;
    feeAmt = 0;
    vatAmt = 0;
    profit = -(totalCost + mktShip);
    marginRate = 0;
  }
  return { salePrice, feeAmt, vatAmt, profit, marginRate, totalCost };
}


// ==================== [ 회계 및 세무(부가세) 계산 로직 ] ====================

// 업종별 부가가치율
const VAT_RATES = {
  '소매업': 0.15,
  '음식업': 0.40,
  '서비스업': 0.30
};

// 과세 유형 기준 (간이/일반 전환)
const THRESHOLDS = {
  warning: 64000000,
  danger: 72000000,
  limit: 80000000  // 8천만원 초과 시 일반과세자 전환
};

/**
 * 간이과세자 연간 예상 부가세를 계산합니다.
 * @param {number} annualSales 연간 총 매출
 * @param {string} businessType 업종 ('소매업', '음식업', '서비스업' 등)
 * @returns {number} 납부 예상 부가가치세 금액
 */
function calcSimplifiedVAT(annualSales, businessType) {
  const rate = VAT_RATES[businessType || '소매업'] || 0.15;
  // 부가세 계산식: 매출 * 업종별 부가가치율 * 10%
  return Math.round(annualSales * rate * 0.1);
}

/**
 * 현재 연 매출을 기반으로 간이과세자 유지 안전 상태를 진단합니다.
 * @param {number} annualSales 현재까지 누적 연 매출
 * @returns {Object} 진단 결과 ({ status, message, action })
 */
function checkVatStatus(annualSales) {
  if (annualSales >= THRESHOLDS.limit) {
    return { status: 'danger', message: '⚠️ 연 매출 8,000만원 초과! 다음 해부터 일반과세자로 자동 전환됩니다.', action: '세무사 상담 필요' };
  }
  if (annualSales >= THRESHOLDS.danger) {
    return { status: 'warning', message: '🔶 연 매출 8,000만원 초과 임박! 일반과세자 전환을 준비하세요.', action: '전환 시 세금계산서 발행 의무, 부가세 신고 방식 변경' };
  }
  if (annualSales >= THRESHOLDS.warning) {
    return { status: 'notice', message: '📋 연 매출 6,400만원 돌파. 연말까지 추이를 확인하세요.', action: null };
  }
  return { status: 'safe', message: '✅ 현재 상태: 안전 (간이과세자 유지 가능)', action: null };
}

/**
 * 본인의 매입/매출 구조를 바탕으로 일반과세자와 간이과세자 중 어느 쪽이 유리한지 절세액을 비교 시뮬레이션합니다.
 * @param {number} annualSales 예상 연간 매출
 * @param {number} annualCost 예상 연간 매입 원가 (세금계산서, 현금영수증 등 적격증빙 받은 금액)
 * @returns {Object} 비교결과 ({ recommendation, saving, reason })
 */
function compareVatBenefit(annualSales, annualCost) {
  const simplifiedVat = annualSales * 0.015; // 간이과세 부가세 (소매업 기준 1.5%)
  const generalVat = (annualSales * 0.1) - (annualCost * 0.1); // 일반과세 부가세 (매출의 10% - 매입의 10%)

  const diff = Math.abs(simplifiedVat - generalVat);
  // 외부 함수(fmt) 의존성을 최소화하고 순수 로직만 남기기 위해 기본 toLocaleString 활용
  const diffStr = typeof fmt === 'function' ? fmt(diff) : diff.toLocaleString('ko-KR');

  if (generalVat < simplifiedVat) {
    return {
      recommendation: '일반과세자가 유리',
      saving: simplifiedVat - generalVat,
      reason: '매입 비중이 높습니다. 일반과세자 전환 시 연 ' + diffStr + '원 절세가 가능합니다.'
    };
  }

  return {
    recommendation: '간이과세자 유지',
    saving: generalVat - simplifiedVat,
    reason: '현재 구조에서는 간이과세자가 오히려 연 ' + diffStr + '원 더 유리합니다.'
  };
}

// ==================== [ 지능형 위험 감지 로직 ] ====================

/**
 * 3순위: 자동화 및 지능형 알림(MCP 규격 데이터 인터페이스 기반)
 * @param {Object} input { productId, vendor, vendorProductId, currentStock, stockStatus, wholesalePrice, salePrice, marketFeeRate }
 * @returns {Object} { riskLevel, riskType, recommendedAction, details }
 */
function detectBusinessRisks(input) {
  // 1순위 (CRITICAL): 도매처 완전 품절 또는 재고 위험 수위
  if (input.stockStatus === 'OUT_OF_STOCK' || input.currentStock <= 0) {
    return {
      riskLevel: 'CRITICAL',
      riskType: 'OUT_OF_STOCK',
      recommendedAction: 'SUSPEND_SALE',
      details: '도매처 완전 품절 (잔여 재고 0개)'
    };
  }
  if (input.currentStock > 0 && input.currentStock < 5) {
    return {
      riskLevel: 'CRITICAL',
      riskType: 'LOW_STOCK',
      recommendedAction: 'SUSPEND_SALE',
      details: `도매처 재고 임계치 미달 (${input.currentStock}개 남음)`
    };
  }

  // 2순위 (CRITICAL): 역마진 감지 (도매가 및 수수료 상승 고려)
  const feeAmt = input.salePrice * ((input.marketFeeRate || 10) / 100);
  const estimatedProfit = input.salePrice - input.wholesalePrice - 3000 - feeAmt; // 3000원 기본 배송비 가정

  if (estimatedProfit < 0) {
    return {
      riskLevel: 'CRITICAL',
      riskType: 'REVERSE_MARGIN',
      recommendedAction: 'SUSPEND_SALE',
      details: `역마진 발생 예상 (-${Math.abs(Math.round(estimatedProfit))}원 손실)`
    };
  }

  // 3순위 (WARNING): 마진율 경고
  const marginRate = (estimatedProfit / input.salePrice) * 100;
  if (marginRate < 10) {
    return {
      riskLevel: 'WARNING',
      riskType: 'LOW_MARGIN',
      recommendedAction: 'INITIATE_WARNING',
      details: `수익성 악화 (마진율 ${marginRate.toFixed(1)}%로 하락)`
    };
  }

  return {
    riskLevel: 'SAFE',
    riskType: 'NONE',
    recommendedAction: 'NONE',
    details: '안전 상태'
  };
}