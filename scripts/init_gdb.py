import os
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
KEY_PATH = r"H:\내 드라이브\위탁판매\소싱프로그램\key\google-key.json"
SPREADSHEET_ID = '1qs-dbzR-necdSo-MfV-hoIgAb65aaBflQVVg6JkFHFA'

def init_sheets():
    if not os.path.exists(KEY_PATH):
        print(f"ERROR: Key file not found at {KEY_PATH}")
        return

    creds = Credentials.from_service_account_file(KEY_PATH, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()

    # Define the core tabs we need for the Phase 1 Database
    required_tabs = ['상품목록', '발주내역', '지출증빙(영수증)', 'CS문의']

    # 1. Get existing sheets
    spreadsheet = sheet.get(spreadsheetId=SPREADSHEET_ID).execute()
    existing_tabs = [s['properties']['title'] for s in spreadsheet.get('sheets', [])]
    print(f"Existing tabs: {existing_tabs}")

    # 2. Add missing tabs
    requests = []
    for tab in required_tabs:
        if tab not in existing_tabs:
            requests.append({
                'addSheet': {
                    'properties': {
                        'title': tab
                    }
                }
            })

    if requests:
        print(f"Adding missing tabs: {[r['addSheet']['properties']['title'] for r in requests]}")
        body = {'requests': requests}
        sheet.batchUpdate(spreadsheetId=SPREADSHEET_ID, body=body).execute()
        print("Tabs added successfully.")
    else:
        print("All required tabs already exist.")

    # 3. Initialize headers for '상품목록' (Product List)
    headers = [
        "상품ID", "등록일자", "플랫폼", "원상품명", "판매상품명",
        "도매가(원)", "배송비(원)", "판매가(원)", "수수료(%)",
        "예상마진(원)", "마진율(%)", "소싱링크", "상태"
    ]
    body = {
        'values': [headers]
    }
    result = sheet.values().update(
        spreadsheetId=SPREADSHEET_ID, range="상품목록!A1:M1",
        valueInputOption="USER_ENTERED", body=body).execute()

    print("Database Initialization Complete.")

if __name__ == '__main__':
    print("Starting Google Sheets DB Initialization...")
    init_sheets()
