from flask import Flask, render_template, request, redirect, url_for, jsonify
import gspread
from google.oauth2.service_account import Credentials
import uuid  # 患者ID生成用
import requests  # 郵便番号から住所取得用
from datetime import datetime  # 年齢計算用

app = Flask(__name__)

# Google Sheets API設定
SERVICE_ACCOUNT_FILE = 'service_account.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
credentials = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
gc = gspread.authorize(credentials)

SPREADSHEET_ID = '1rASJV_j8pGmXY5NhQrw4FKJY_eRy-iSPoGSh08gdLk0'  # スプレッドシートのID
ADDRESS_SHEET_NAME = '住所録'  # 住所録シート名

@app.route('/')
def index():
    try:
        sheet = gc.open_by_key(SPREADSHEET_ID).worksheet(ADDRESS_SHEET_NAME)
        records = sheet.get_all_records()
        
        now = datetime.now()
        for i, record in enumerate(records, start=2):  # 2行目以降
            birth_date = str(record.get('生年月日', ''))
            if birth_date and len(birth_date) == 8 and birth_date.isdigit():
                birth_year = int(birth_date[:4])
                birth_month = int(birth_date[4:6])
                birth_day = int(birth_date[6:])
                birth_date_obj = datetime(birth_year, birth_month, birth_day)
                age = (now - birth_date_obj).days // 365
                sheet.update_cell(i, 5, age)  # 年齢列を更新
                record['年齢'] = age  # UI反映用
            else:
                record['年齢'] = "不明"

        return render_template('index.html', records=records)
    except Exception as e:
        print(f"エラー: {e}")
        return "スプレッドシートとの連携に問題があります。"

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        patient_name = request.form['patient_name']
        gender = request.form['gender']
        birth_date = str(request.form['birth_date'])
        zipcode = request.form['zipcode']
        address = request.form['address']
        phone_number = request.form['phone_number']

        if len(birth_date) != 8 or not birth_date.isdigit():
            return "生年月日は8桁の数字で入力してください（例：19731010）。", 400

        birth_year = int(birth_date[:4])
        birth_month = int(birth_date[4:6])
        birth_day = int(birth_date[6:])
        birth_date_obj = datetime(birth_year, birth_month, birth_day)
        age = (datetime.now() - birth_date_obj).days // 365

        patient_id = str(uuid.uuid4())[:8]

        sheet = gc.open_by_key(SPREADSHEET_ID).worksheet(ADDRESS_SHEET_NAME)
        sheet.append_row([patient_id, patient_name, gender, birth_date, age, zipcode, address, phone_number])

        create_patient_sheet(patient_id, patient_name)

        return redirect(url_for('index'))
    return render_template('register.html')

@app.route('/edit/<patient_id>', methods=['GET', 'POST'])
def edit(patient_id):
    try:
        sheet = gc.open_by_key(SPREADSHEET_ID).worksheet(ADDRESS_SHEET_NAME)
        records = sheet.get_all_records()

        # 指定された患者IDのデータを取得
        patient_data = None
        row_number = None
        for index, record in enumerate(records, start=2):
            if str(record.get('患者ID')) == patient_id:
                patient_data = record
                row_number = index
                break

        if not patient_data:
            return "患者情報が見つかりませんでした。", 404

        # POSTリクエストの処理
        if request.method == 'POST':
            patient_name = request.form['patient_name']
            gender = request.form['gender']
            birth_date = str(request.form['birth_date'])
            zipcode = request.form['zipcode']
            address = request.form['address']
            phone_number = request.form['phone_number']

            # 更新データをリスト形式で作成
            update_range = f"B{row_number}:H{row_number}"
            update_values = [[patient_name, gender, birth_date, patient_data.get('年齢', ''), zipcode, address, phone_number]]

            # スプレッドシートを更新
            sheet.update(update_range, update_values)

            return redirect(url_for('index'))

        return render_template('edit.html', patient=patient_data)

    except Exception as e:
        print(f"エラー: {e}")
        return "編集処理に失敗しました。", 500



@app.route('/get_address', methods=['GET'])
def get_address():
    zipcode = request.args.get('zipcode')
    if not zipcode:
        return jsonify({"error": "郵便番号が指定されていません。"}), 400

    api_url = f"http://zipcloud.ibsnet.co.jp/api/search?zipcode={zipcode}"
    try:
        response = requests.get(api_url)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != 200 or not data.get("results"):
            return jsonify({"error": "有効な住所が見つかりません。"}), 400

        result = data['results'][0]
        return jsonify({
            "prefecture": result.get('address1', ''),
            "city": result.get('address2', ''),
            "town": result.get('address3', '')
        })
    except requests.exceptions.RequestException as e:
        print(f"エラー: {e}")
        return jsonify({"error": "住所を取得できませんでした。"}), 500

@app.route('/delete', methods=['POST'])
def delete():
    try:
        patient_id = request.form['patient_id']
        sheet = gc.open_by_key(SPREADSHEET_ID).worksheet(ADDRESS_SHEET_NAME)
        records = sheet.get_all_records()

        row_to_delete = None
        for index, record in enumerate(records, start=2):
            if str(record.get('患者ID')) == patient_id:
                row_to_delete = index
                break

        if row_to_delete:
            sheet.delete_rows(row_to_delete)
        else:
            return jsonify({"error": "指定された患者IDが見つかりませんでした。"}), 404

        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        sheet_list = spreadsheet.worksheets()
        sheet_name = next((s.title for s in sheet_list if s.title.startswith(f"{patient_id}_")), None)

        if sheet_name:
            spreadsheet.del_worksheet(spreadsheet.worksheet(sheet_name))

        return redirect(url_for('index'))
    except Exception as e:
        print(f"エラー: {e}")
        return jsonify({"error": f"削除処理に失敗しました: {e}"}), 500

@app.route('/patient/<patient_id>/add_record', methods=['GET', 'POST'])
def add_record(patient_id):
    if request.method == 'POST':
        # POSTデータを取得
        treatment_date = request.form['treatment_date']
        symptoms = request.form['symptoms']
        treatment = request.form['treatment']
        notes = request.form['notes']

        try:
            # 対応する患者のカルテシートを取得
            spreadsheet = gc.open_by_key(SPREADSHEET_ID)
            sheet_list = spreadsheet.worksheets()
            sheet_name = next((s.title for s in sheet_list if s.title.startswith(patient_id)), None)

            if not sheet_name:
                return "患者のカルテが見つかりませんでした。", 404

            # シートに診療記録を追加
            patient_sheet = spreadsheet.worksheet(sheet_name)
            patient_sheet.append_row([treatment_date, symptoms, treatment, notes])

            # 診療記録追加後、詳細ページにリダイレクト
            return redirect(url_for('patient_detail', patient_id=patient_id))
        except Exception as e:
            print(f"エラーが発生しました: {e}")
            return "診療記録の追加に失敗しました。", 500

    # 診療記録追加ページをレンダリング
    return render_template('add_record.html', patient_id=patient_id)



def create_patient_sheet(patient_id, patient_name):
    try:
        # Open the spreadsheet
        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        sheet_name = f"{patient_id}_{patient_name}"
        
        # Check if the sheet already exists
        existing_sheets = [sheet.title for sheet in spreadsheet.worksheets()]
        if sheet_name in existing_sheets:
            return
        
        # Create a new worksheet
        patient_sheet = spreadsheet.add_worksheet(title=sheet_name, rows=100, cols=10)
        patient_sheet.append_row(["診療日", "症状の経過", "治療内容", "備考"])
    except Exception as e:
        print(f"シート作成エラー: {e}")

@app.route('/patient/<patient_id>', methods=['GET'])
def patient_detail(patient_id):
    try:
        # スプレッドシートを開く
        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        sheet_list = spreadsheet.worksheets()
        
        # 対応するシート名を取得
        sheet_name = next((s.title for s in sheet_list if s.title.startswith(patient_id)), None)
        if not sheet_name:
            return "患者のカルテが見つかりませんでした。", 404

        # 患者のシートを取得して記録を取得
        patient_sheet = spreadsheet.worksheet(sheet_name)
        records = patient_sheet.get_all_records()

        # 患者名を取得 (シート名は "患者ID_患者名" の形式を想定)
        patient_name = sheet_name.split("_", 1)[1]

        # HTMLページをレンダリング
        return render_template('patient_detail.html', patient_name=patient_name, patient_id=patient_id, records=records)
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return "患者データの取得に失敗しました。", 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
