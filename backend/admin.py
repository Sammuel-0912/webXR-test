import sqlite3
import pandas as pd
from datetime import datetime
import os

def export_inspection_to_excel(db_path='inspection.db'):
    # 檢查資料庫是否存在
    if not os.path.exists(db_path):
        print(f"錯誤：找不到資料庫檔案 {db_path}")
        return

    # 定義 Marker ID 與名稱的對照表，增加報表可讀性
    MARKER_NAMES = {
        0: "INPUT 輸入端",
        1: "OUTPUT 輸出端",
        2: "BATTERY 電池組"
    }

    try:
        # 1. 連接資料庫並讀取資料
        conn = sqlite3.connect(db_path)
        query = "SELECT id, marker_id, status, update_time FROM results ORDER BY update_time DESC"
        df = pd.read_sql_query(query, conn)
        conn.close()

        if df.empty:
            print("目前資料庫中沒有任何點檢紀錄。")
            return

        # 2. 資料處理：加入名稱對照與格式化
        df['設備名稱'] = df['marker_id'].map(MARKER_NAMES)
        df.rename(columns={
            "id": "紀錄唯一碼(UUID)",
            'marker_id': 'Marker ID',
            'status': '點檢結果',
            'update_time': '最後更新時間'
        }, inplace=True)

        # 調整欄位順序
        df = df[['紀錄唯一碼(UUID)', '設備ID', '設備名稱', '點檢結果', '點檢時間']]

        # 3. 產生檔案名稱 (包含日期時間)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"點檢紀錄報表_{timestamp}.xlsx"

        # 4. 匯出至 Excel 並進行簡單美化
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='點檢紀錄表')
            
            # 取得工作表以設定欄寬
            worksheet = writer.sheets['點檢紀錄表']
            for i, col in enumerate(df.columns):
                column_len = max(df[col].astype(str).map(len).max(), len(col)) + 5
                worksheet.column_dimensions[chr(65 + i)].width = column_len

        print(f"成功！點檢紀錄已匯出至：{filename}")

    except Exception as e:
        print(f"匯出過程中發生錯誤：{e}")

if __name__ == "__main__":
    export_inspection_to_excel()