import requests
import json

url = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec?action=debugSmartMatch'

try:
    res = requests.get(url, allow_redirects=True)
    o = res.json()
    print("STATUS:", res.status_code)
    if 'naverAd' in o: print(json.dumps(o['naverAd'], indent=2, ensure_ascii=False))
    else: print("RAW:", res.text[:2000])
except Exception as e:
    print("ERROR:", str(e))
