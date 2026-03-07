import math
from pydantic import BaseModel
from typing import Dict

# ---------------------------------------------------------
# T4 (Finance) 모듈: Tax Pivot & Miller-Orr 모형 알고리즘
# ---------------------------------------------------------

class TaxPivotRequest(BaseModel):
    annual_sales: float         # 연간 총 매출액 (VAT 포함)
    annual_purchases: float     # 연간 총 매입액 (VAT 포함, 매입세금계산서 수취분)
    is_service_industry: bool = False # 업종 구분 (위탁판매업 기준 False)

def calculate_tax_pivot(req: TaxPivotRequest) -> Dict[str, float]:
    """
    [과업 5-1] Tax Pivot 엔진
    간이과세자와 일반과세자 기준 부가가치세 납부 예상액을 병렬 대조하여
    과세 유형 전환의 유불리 시점을 계산합니다.
    (단순화된 2024년 세법 기준 예시 로직)
    """
    sales_supply = req.annual_sales / 1.1       # 공급가액
    sales_vat = req.annual_sales - sales_supply # 매출세액

    purchase_supply = req.annual_purchases / 1.1
    purchase_vat = req.annual_purchases - purchase_supply # 매입세액

    # 1. 일반과세자 예상 세액 (매출세액 - 매입세액 전액 공제)
    general_tax = sales_vat - purchase_vat
    general_tax = max(0, general_tax) # 환급 발생 시 0으로 표기(또는 환급액 표기)

    # 2. 간이과세자 예상 세액 (소매업 기준 부가가치율 15% 가정)
    # 세액 = 공급대가(매출액) x 부가가치율(15%) x 10% - 매입세금계산서 수취세액 공제(매입액의 0.5%)
    # 과세표준 1억 400만원 미만 시 적용 가능.
    if req.annual_sales < 104_000_000:
        value_added_rate = 0.15 # 소매업 15%
        kani_tax_base = req.annual_sales * value_added_rate * 0.10
        kani_deduction = req.annual_purchases * 0.005 # 매입세금계산서 등 수취세액 공제 (공급대가의 0.5%)
        kani_tax = max(0, kani_tax_base - kani_deduction)

        # 간이과세자 4800만원 미만 납부면제 (2024년 기준 1억 400만 상향 중이나 면제점은 별도, 여기선 4800만 적용)
        if req.annual_sales < 48_000_000:
            kani_tax = 0
    else:
        kani_tax = -1 # 간이과세 적용 불가

    return {
        "general_tax_estimated": math.floor(general_tax),
        "kani_tax_estimated": math.floor(kani_tax) if kani_tax != -1 else -1,
        "recommendation": "GENERAL" if (kani_tax == -1 or general_tax < kani_tax) else "KANI"
    }

class MillerOrrRequest(BaseModel):
    daily_cash_variance: float   # 일일 순현금흐름 분산 (Variance)
    transaction_cost: float      # 유가증권 1회 매매(또는 자금 차입) 거래 비용 (b)
    daily_interest_rate: float   # 일일 이자율 (i)
    minimum_cash_balance: float  # 경영자가 유지하고자 하는 최소 현금 잔고 (L)

def calculate_miller_orr(req: MillerOrrRequest) -> Dict[str, float]:
    """
    [과업 5-2] Miller-Orr 모형 (최적 현금 복귀점 산출)
    현금흐름의 불확실성이 큰 위탁/사입 셀러를 위한 흑자 부도 방어 로직.
    Z = (3 * b * V / (4 * i))^(1/3) + L
    H = 3Z - 2L
    """
    b = req.transaction_cost
    v = req.daily_cash_variance
    i = req.daily_interest_rate
    L = req.minimum_cash_balance

    if i <= 0:
        return {"error": "이자율은 0보다 커야 합니다."}

    # Z: 최적 현금 복귀점 (Target Cash Balance)
    cube_root_term = (3 * b * v) / (4 * i)
    z_spread = math.pow(cube_root_term, 1/3)
    Z = z_spread + L

    # H: 최고 현금 상한선 (Upper Control Limit)
    H = 3 * Z - 2 * L

    return {
        "lower_limit_L": round(L, 2),
        "target_balance_Z": round(Z, 2),
        "upper_limit_H": round(H, 2),
        "status_message": "현재 잔고가 H에 도달하면 잉여금을 투자/차입상환 하고, 잔고가 L로 떨어지면 Z까지 차입/자금회수 하십시오."
    }

# ---------------------------------------------------------
# 기존 mcp_server.py에 라우트 병합용 더미 호출부 (실제로는 FastAPI router에 연결)
# ---------------------------------------------------------
if __name__ == "__main__":
    # 테스트 구동
    test_tax = calculate_tax_pivot(TaxPivotRequest(annual_sales=80000000, annual_purchases=40000000))
    print("Tax Pivot 결과:", test_tax)

    test_mo = calculate_miller_orr(MillerOrrRequest(
        daily_cash_variance=5000000,
        transaction_cost=10000,
        daily_interest_rate=0.0001,
        minimum_cash_balance=10000000
    ))
    print("Miller-Orr 결과:", test_mo)
