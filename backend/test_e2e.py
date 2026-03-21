"""
백엔드 E2E 검증 스크립트
FastAPI 백엔드(mcp_server.py)의 모든 REST 엔드포인트를 자동 테스트합니다.
사용법: python test_e2e.py (백엔드가 127.0.0.1:8000에서 실행 중이어야 합니다)
"""
import requests
import json
import sys

BASE = "http://127.0.0.1:8000"
PASS = 0
FAIL = 0

def test(name, method, path, payload=None, expect_key=None):
    global PASS, FAIL
    url = BASE + path
    try:
        if method == "GET":
            r = requests.get(url, timeout=5)
        else:
            r = requests.post(url, json=payload, timeout=5)

        if r.status_code == 200:
            data = r.json()
            if expect_key and expect_key not in (data if isinstance(data, dict) else {}):
                print(f"  ⚠️  {name}: 200 OK but missing key '{expect_key}' → {json.dumps(data, ensure_ascii=False)[:100]}")
                FAIL += 1
            else:
                print(f"  ✅  {name}: OK → {json.dumps(data, ensure_ascii=False)[:120]}")
                PASS += 1
        else:
            print(f"  ❌  {name}: HTTP {r.status_code}")
            FAIL += 1
    except requests.ConnectionError:
        print(f"  ❌  {name}: 연결 실패 (백엔드 미실행?)")
        FAIL += 1
    except Exception as e:
        print(f"  ❌  {name}: {e}")
        FAIL += 1

print("=" * 60)
print("🔍 셀러 대시보드 백엔드 E2E 검증")
print("=" * 60)

# 1. Landed Cost
test("Landed Cost 계산", "POST", "/api/calculate-landed-cost", {
    "local_price": 50, "exchange_rate": 195, "hs_code_rate": 0.08,
    "overseas_shipping_fee": 20, "agency_fee": 2500
}, "landed_cost")

# 2. Curated Items
test("큐레이션 아이템 조회", "GET", "/api/get-curated-items")

# 3. Tax Pivot
test("Tax Pivot 부가세 분석", "POST", "/api/tax-pivot", {
    "annual_sales": 80000000, "annual_purchases": 40000000
}, "recommendation")

# 4. Miller-Orr
test("Miller-Orr 현금 최적화", "POST", "/api/miller-orr", {
    "daily_cash_variance": 5000000, "transaction_cost": 10000,
    "daily_interest_rate": 0.0001, "minimum_cash_balance": 10000000
}, "target_balance_Z")

# 5. Detail Page 생성
test("상세페이지 HTML 생성", "POST", "/api/generate-detail-page", {
    "name": "테스트 텀블러", "thumbnail_url": "https://via.placeholder.com/300"
}, "detail_html")

# 6. Evaluate Opportunities
test("기회 평가 엔진", "POST", "/api/evaluate-opportunities", [
    {"local_price": 30, "exchange_rate": 195, "hs_code_rate": 0.08,
     "overseas_shipping_fee": 15, "agency_fee": 2000, "expected_sell_price": 29900}
])

print("\n" + "=" * 60)
print(f"결과: ✅ {PASS} PASS / ❌ {FAIL} FAIL")
print("=" * 60)
sys.exit(1 if FAIL > 0 else 0)
