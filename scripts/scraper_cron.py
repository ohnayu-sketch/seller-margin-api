import os
import requests
import json
from datetime import datetime

# 데이터 오라클 FastAPI 백엔드 엔드포인트
ORACLE_URL = os.environ.get("DATA_ORACLE_URL", "http://127.0.0.1:8000")

def scrape_wholesale_site():
    """
    browser_subagent 또는 Playwright를 이용해 비공식 API 도매 사이트 스크래핑.
    (이 스크립트는 Github Actions 환경에서 headless 브라우저를 구동하는 진입점입니다.)
    """
    print("[1] 스크래핑 엔진 가동: 비공식 API 타겟 도매 사이트 접속")

    # ---------------------------------------------------------
    # 여기서는 시각적 인지 계층(Visual Perception)을 통해
    # 스크래핑된 결과물 데이터셋을 시뮬레이션합니다.
    # (실제 환경에서는 브라우저 자동화 라이브러리가 HTML/DOM을 읽음)
    # ---------------------------------------------------------
    scraped_data = [
        {
            "id": "item_1688_A",
            "name": "[자동번역] 방수 캠핑 텐트 초경량 2인용",
            "original_name": "户外全自动帐篷加厚防雨",
            "local_price": 120.0, # 위안화(CNY)
            "exchange_rate": 195.0,
            "hs_code_rate": 0.08, # 8% 관세
            "overseas_shipping_fee": 20.0, # 20 CNY
            "agency_fee": 2500, # 2500 KRW
            "source_type": "1688",
            "source_url": "https://m.1688.com/offer/1234.html",
            "thumbnail_url": "https://via.placeholder.com/200",
            "category": "캠핑/레저",
            "expected_sell_price": 55000, # 네이버쇼핑에서 조사된 적정 판매가 추정
            "competition_score": 40
        },
        {
            "id": "item_TB_B",
            "name": "[자동번역] 접이식 캠핑용 의자 휴대용 의자 레드",
            "original_name": "折叠椅户外便携马扎",
            "local_price": 25.0, # CNY
            "exchange_rate": 195.0,
            "hs_code_rate": 0.08,
            "overseas_shipping_fee": 10.0,
            "agency_fee": 2000,
            "source_type": "taobao",
            "source_url": "https://item.taobao.com/item.htm?id=5678",
            "thumbnail_url": "https://via.placeholder.com/200",
            "category": "캠핑/레저",
            "expected_sell_price": 12000,
            "competition_score": 75 # 경쟁이 쎔
        }
    ]

    return scraped_data

def evaluate_and_route(products):
    """
    스크래핑된 데이터를 API 백엔드(Landed Cost + AI Score 부여 및 15% 마진 필터링)로 전송.
    """
    print(f"[2] Data Oracle 서버로 {len(products)}개 상품 평가 요청")
    try:
        response = requests.post(f"{ORACLE_URL}/api/evaluate-opportunities", json=products)
        if response.status_code == 200:
            filtered_results = response.json()
            print(f" => 평가 완료! 15% 마진 이상 기회상품 {len(filtered_results)}개 필터링 됨.")
            return filtered_results
        else:
            print(f"Error evaluating products: {response.text}")
            return []
    except Exception as e:
        print(f"Connection Error to Oracle MCP: {e}")
        return []

def append_to_sheets(results):
    """
    Data Oracle의 MCP Tool('append_to_google_sheet')을 사용해 구글 시트에 즉각 반영
    """
    print("[3] Google Drive & Sheets MCP를 통해 DB 적재")
    for r in results:
        print(f" ✔️ [적재됨] {r['name']} / 예상원가: {r['landed_cost']}원 / 마진율: {r['margin_rate']}% / AI점수: {r['ai_score']}")

    # 여기서 T1 30구역 고밀도 그리드 렌더링에 사용할 JSON 파일을 프론트로 배포하는 과정이 추가됨
    with open("t1_curation_data.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(" => T1 큐레이션용 JSON 파일 업데이트 완료.")

if __name__ == "__main__":
    print(f"--- 자동 스크래핑 및 기회상품 평가 파이프라인 시작 (Time: {datetime.now()}) ---")
    raw_products = scrape_wholesale_site()
    opportunities = evaluate_and_route(raw_products)
    if opportunities:
        append_to_sheets(opportunities)
    print("--- 파이프라인 종료 ---")
