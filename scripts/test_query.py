import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
KEY_PATH = r"H:\내 드라이브\위탁판매\소싱프로그램\key\google-key.json"
SPREADSHEET_ID = '1qs-dbzR-necdSo-MfV-hoIgAb65aaBflQVVg6JkFHFA'

def test_query():
    creds = Credentials.from_service_account_file(KEY_PATH, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()

    # 1. Insert a dummy product into '상품목록'
    print("Agent: Inserting test query data...")
    test_data = [
        ["TEST-001", "2026-03-02", "스마트스토어", "테스트소싱상품", "마진계산기_테스트",
         5000, 2500, 10000, 6.6, 1840, 18.4, "https://domeggook.com", "판매대기"]
    ]
    body = {'values': test_data}

    # Use append so we don't overwrite headers
    result = sheet.values().append(
        spreadsheetId=SPREADSHEET_ID, range="상품목록!A:M",
        valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS", body=body).execute()

    updated_range = result.get('updates').get('updatedRange')
    print(f"Agent: Successfully inserted at {updated_range}")

    # 2. Read it back
    print("Agent: Fetching data back from DB...")
    read_result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range="상품목록!A1:M5").execute()
    rows = read_result.get('values', [])

    if not rows:
        print("Agent Query Failed: No data found.")
    else:
        print("Agent Query Success! Data retrieved:")
        for row in rows:
            print(row)

if __name__ == '__main__':
    test_query()
