import sys
import json
import urllib.request
import urllib.parse
from html.parser import HTMLParser

class NaverShoppingParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.prices = []
        self.in_price_tag = False
        self.current_price = ""

    def handle_starttag(self, tag, attrs):
        if tag == "span":
            for attr in attrs:
                # 네이버 쇼핑 검색결과의 가격을 감싸는 span 클래스 추적
                if attr[0] == "class" and "price_num__" in attr[1]:
                    self.in_price_tag = True
                    self.current_price = ""

    def handle_data(self, data):
        if self.in_price_tag:
            self.current_price += data

    def handle_endtag(self, tag):
        if self.in_price_tag and tag == "span":
            self.in_price_tag = False
            clean_price = ''.join(filter(str.isdigit, self.current_price))
            if clean_price:
                self.prices.append(int(clean_price))

def get_naver_market_price(query):
    """
    네이버 쇼핑 검색 결과에서 상위 5개 상품의 평균 판매가를 추출합니다.
    """
    url = f"https://search.shopping.naver.com/search/all?query={urllib.parse.quote(query)}"
    
    # 봇 차단을 피하기 위한 기본 User-Agent 설정
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }
    
    req = urllib.request.Request(url, headers=headers)
    try:
        response = urllib.request.urlopen(req)
        html = response.read().decode('utf-8')
        
        parser = NaverShoppingParser()
        parser.feed(html)
        
        if not parser.prices:
            return {"status": "error", "message": f"'{query}'에 대한 가격 정보를 파싱할 수 없습니다. (HTML 구조 변경 가능성 있음)"}
            
        # 광고나 비정상 가격 추방: 너무 튀는 가격 제외를 위해 정렬 후 상위 5개(상식선) 추출
        # 여기서는 단순 순서대로 5개 추출 (보통 상위 랭킹)
        top_5_prices = parser.prices[:5]
        avg_price = sum(top_5_prices) / len(top_5_prices)
        
        return {
            "status": "success",
            "query": query,
            "crawled_count": len(parser.prices),
            "top_5_prices": top_5_prices,
            "average_market_price": int(avg_price)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # 터미널에서 인자로 키워드를 받아 즉시 실행 가능
    target_keyword = sys.argv[1] if len(sys.argv) > 1 else "캠핑용 랜턴"
    result = get_naver_market_price(target_keyword)
    
    # JSON 형식으로 출력하여 프론트엔드/Node.js에서 파싱하기 쉽도록 함
    print(json.dumps(result, ensure_ascii=False, indent=2))
