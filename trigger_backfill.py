import requests
import json

url = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec'

print("📡 Triggering 14-day Backfill on Google Apps Script (POST method)...")
try:
    res = requests.post(url, json={"action": "buildHistoricalTrendArchive"}, allow_redirects=True, timeout=600)
    print("STATUS:", res.status_code)
    try:
        data = res.json()
        print("RESULT:", data)
    except:
        print("RAW:", res.text)
except Exception as e:
    print("ERROR:", str(e))
