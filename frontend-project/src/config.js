// ── 後端 API 連線設定（集中管理，避免各頁重複硬編碼 port / fallback）──
// 預設 port，可用 build 時的環境變數 VITE_BACKEND_PORT 覆寫。
export const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '8000'

// 解析後端 API base URL，優先序：
//   1) override（QR Code 的 ?backend 參數 / 使用者手動輸入）
//   2) VITE_BACKEND_URL（部署時注入）
//   3) 目前 hostname + 預設 port（本機與區網皆適用）
// 末端斜線一律去除，確保拼接路徑時不會出現雙斜線。
export function resolveBackendUrl(override) {
  const fromHost = `http://${window.location.hostname}:${BACKEND_PORT}`
  return (override || import.meta.env.VITE_BACKEND_URL || fromHost).replace(/\/$/, '')
}
