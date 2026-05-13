// 定義後端 API 位址
const API_URL = "http://localhost:8000";

async function setStatus(id, state) {
  // --- 原有的前端 UI 邏輯 ---
  const warn = document.getElementById("warn" + id);
  const ok = document.getElementById("ok" + id);
  const warnBanner = document.getElementById("warning");
  const sectionNames = ["INPUT 輸入端", "OUTPUT 輸出端", "BATTERY 電池組"];

  if (state === "ok") {
    warn.setAttribute("visible", "false");
    ok.setAttribute("visible", "true");
    warnBanner.style.display = "none";
  } else {
    warn.setAttribute("visible", "true");
    ok.setAttribute("visible", "false");
    warnBanner.style.display = "block";
    warnBanner.textContent = `⚠️ Marker ID${id} (${sectionNames[id]}) 接線錯誤！`;
  }

  // --- 新增：將結果傳送到後端 SQLite ---
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        marker_id: id,
        status: state,
      }),
    });
    const result = await response.json();
    console.log("儲存成功:", result);
  } catch (error) {
    console.error("同步至後端失敗:", error);
  }
}
window.addEventListener('load', async () => {
  try {
    const response = await fetch(`${API_URL}/results`);
    const history = await response.json();
    
    // 遍歷紀錄並更新 AR 畫面
    Object.keys(history).forEach(id => {
      const state = history[id].status;
      // 呼叫一個僅更新畫面的輔助函式，避免重複觸發儲存
      updateARDisplayOnly(id, state); 
    });
  } catch (error) {
    console.log("尚無歷史紀錄或後端未啟動");
  }
});

// 輔助函式：僅切換 AR 顯示，不呼叫 API
function updateARDisplayOnly(id, state) {
    const warn = document.getElementById('warn' + id);
    const ok = document.getElementById('ok' + id);
    if (state === 'ok') {
        warn.setAttribute('visible', 'false');
        ok.setAttribute('visible', 'true');
    } else if (state === 'warn') {
        warn.setAttribute('visible', 'true');
        ok.setAttribute('visible', 'false');
    }
}