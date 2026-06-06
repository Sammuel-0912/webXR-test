# 變更說明 — 後端拆分 + /results 分頁與索引

日期:2026-06-06
範圍:後端 `main.py` 模組化、`/results` 分頁與索引、前端 Dashboard 分頁載入,以及隨之而來的 ESLint 修正。

---

## 一、概述

本次變更分三塊:

1. **後端結構重整**:把 361 行的單檔 `main.py` 依職責拆成多個模組,降低耦合、方便維護。功能與 API 行為完全不變。
2. **`/results` 效能與擴充性**:為查詢欄位建立索引,並讓 `/results` 支援分頁,避免一次撈回整張紀錄表。
3. **前端配合分頁**:Dashboard 改為分頁載入(預設顯示最新 100 筆,其餘按需載入)。
4. **ESLint 修正**:`eslint-plugin-react-hooks` v7 的嚴格規則造成的錯誤一併處理。

---

## 二、後端變更

### 2.1 `main.py` 模組化

原本所有 model、DB 操作、路由都集中在 `backend/main.py`。現拆分為:

| 檔案 | 職責 |
| --- | --- |
| `backend/db.py` | 資料層:持久化路徑、上傳設定、`connect()`、`init_db()` |
| `backend/models.py` | Pydantic schema 與 enum |
| `backend/routers/devices.py` | 設備管理 API(CRUD + 圖片上傳) |
| `backend/routers/inspections.py` | 點檢結果與統計 API |
| `backend/routers/export.py` | 報表匯出 API |
| `backend/main.py` | 組裝層:建立 app、CORS、掛載 `/uploads`、`init_db()`、`include_router` |

- 12 條既有路由與 `/uploads` 靜態掛載**路徑與回傳格式完全不變**,前端不需調整。
- 順手讓 `DB_PATH`、`UPLOAD_DIR` 也支援環境變數覆寫(原本只有 `DATA_DIR`、`CORS_ORIGINS`),符合「避免硬編碼」原則,且皆提供安全預設值。

### 2.2 索引(`db.py` / `init_db()`)

`results` 表常以 `marker_id` 篩選、以 `update_time` 排序與範圍查詢,新增兩個索引避免全表掃描:

- `idx_results_marker_id` → `results(marker_id)`
- `idx_results_update_time` → `results(update_time)`

使用 `CREATE INDEX IF NOT EXISTS`,既有資料庫在下次啟動 `init_db()` 時自動補上,無需手動 migration。

### 2.3 `/results` 分頁(`routers/inspections.py`)

- 新增查詢參數 `limit`(預設 `100`,上限 `1000`)與 `offset`(預設 `0`)。
- 新增一次 `COUNT(*)`(套用相同篩選),把符合筆數放進 **`X-Total-Count`** 回應 header,供前端計算分頁。
- 回應 body **維持原本以 UUID 為 key 的 dict 結構**,因此前端資料結構不受影響。
- 分頁大小以具名常數 `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` 管理,避免魔術數字。

### 2.4 CORS(`main.py`)

新增 `expose_headers=["X-Total-Count"]`,瀏覽器端才讀得到分頁總數 header。

---

## 三、前端變更

### 3.1 `DashboardPage.jsx`(分頁載入)

- 新增常數 `PAGE_SIZE = 100`(對應後端預設值)。
- 將原本一次抓 stats + 全部 results 的 `fetchData`,拆成:
  - `fetchStats()`:只在首次載入時抓統計。
  - `fetchResults(append, offset)`:`append=false` 重置為第一頁、`append=true` 接續載入下一頁。
  - `buildResultsQuery(offset)`:組裝含分頁參數的查詢字串。
- 新增 `total`、`loadingMore` 狀態,讀取 `X-Total-Count`。
- 紀錄區下方新增「**載入更多(已顯示 N / 總數)**」按鈕;已載入筆數 < 總數時才顯示。
- 刪除紀錄時同步遞減 `total` 並重新抓統計。

### 3.2 `ArInspectPage.jsx`(ESLint `refs` 修正)

- 原本 `const BACKEND = useRef(resolveBackendUrl(...)).current` 在 render 期間讀取 `ref.current`(反模式)。
- 改用 `useState` 惰性初始化,只在掛載時計算一次:`const [BACKEND] = useState(() => resolveBackendUrl(...))`。屬正規修法,無需 disable 規則。

### 3.3 `DeviceManagePage.jsx`(ESLint 修正)

- `useEffect(() => { fetchDevices() }, [backendUrl])` 觸發 `set-state-in-effect` 錯誤與 `exhaustive-deps` 警告。
- 抓設備清單屬 effect 同步外部系統的正當用途,且 `fetchDevices` 僅依賴 `backendUrl`(已在 deps),行為正確,以單行 inline disable 一併處理。

### 3.4 ESLint 規則背景

`pnpm lint` 報錯源自 `eslint-plugin-react-hooks` v7 recommended 新增的嚴格規則(`set-state-in-effect`、`refs`)。這些規則對「掛載時抓資料」這類正當用途會過度告警;`main` 上原本即會報錯。本次以最小變動修正(沿用本專案既有的 inline disable 慣例)。

> 後續可考慮在 `eslint.config.js` 對資料抓取 effect 統一降級此規則,取代各檔分散 disable。

---

## 四、行為差異與相容性

- **Dashboard 不再一次撈整張紀錄表**:預設只顯示最新 100 筆,其餘以「載入更多」按需載入。
- **API 相容**:`/results` 回應 body 結構不變;`limit`/`offset` 為選用參數,未帶時以預設值回傳第一頁。其他端點完全不變。
- **資料庫相容**:索引自動建立,無需資料遷移。

---

## 五、變更檔案清單

**新增**
- `backend/db.py`
- `backend/models.py`
- `backend/routers/__init__.py`
- `backend/routers/devices.py`
- `backend/routers/inspections.py`
- `backend/routers/export.py`

**修改**
- `backend/main.py`(改為組裝層 + CORS `expose_headers`)
- `frontend-project/src/pages/DashboardPage.jsx`
- `frontend-project/src/pages/ArInspectPage.jsx`
- `frontend-project/src/pages/DeviceManagePage.jsx`

---

## 六、驗證方式(合併前須通過)

```bash
# 後端
cd backend
python -m py_compile main.py db.py models.py routers/*.py

# 前端
cd ../frontend-project
pnpm lint     # 預期 0 error
pnpm build    # 預期 EXIT=0
```

另建議本機 `uvicorn main:app` 啟動後,實測:
- Dashboard 良率卡片、紀錄列表、篩選、「載入更多」、刪除、匯出皆正常。
- AR 點檢頁可正常載入設備、掃描送出結果。

---

## 七、後續建議(未含於本次變更)

- 寫入/刪除端點加上權限(API Key 或登入),刪除改軟刪除以保留稽核軌跡。
- `routers` 內以 `Depends(get_db)` 取代各端點重複的 `sqlite3.connect`。
- 時間統一以 UTC / ISO 8601 儲存。
