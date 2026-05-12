import base64

with open('/sessions/festive-trusting-noether/mnt/outputs/wiring-diagram.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()

html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UPS AR 接線導引</title>

  <!-- A-Frame + AR.js (CDN，不需安裝任何東西) -->
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>

  <style>
    body {{ margin: 0; overflow: hidden; font-family: sans-serif; }}

    /* 頂部 HUD 提示列 */
    #hud {{
      position: fixed; top: 0; left: 0; right: 0;
      background: rgba(20, 50, 120, 0.82);
      color: #fff; text-align: center;
      padding: 10px 0; font-size: 15px; z-index: 999;
    }}

    /* 警示 banner */
    #warning {{
      display: none;
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(200, 20, 20, 0.9);
      color: #fff; padding: 12px 28px; border-radius: 8px;
      font-size: 16px; font-weight: bold; z-index: 999;
      animation: blink 0.7s infinite alternate;
    }}
    @keyframes blink {{ from{{opacity:1}} to{{opacity:0.4}} }}

    /* 底部控制列 */
    #controls {{
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; justify-content: center; gap: 12px;
      padding: 12px; background: rgba(0,0,0,0.55); z-index: 999;
    }}
    #controls button {{
      padding: 9px 20px; border-radius: 6px; border: none;
      font-size: 14px; cursor: pointer; font-weight: bold;
    }}
    #btn-ok   {{ background: #22cc66; color: #fff; }}
    #btn-warn {{ background: #e63030; color: #fff; }}
    #btn-reset{{ background: #aaa;    color: #fff; }}
  </style>
</head>
<body>

  <!-- HUD -->
  <div id="hud">📷 請將攝像頭對準 Hiro Marker，接線圖會自動疊加顯示</div>

  <!-- 警示 Banner -->
  <div id="warning">⚠️ 警告：L1 接線顏色錯誤！應接紅線</div>

  <!-- 底部按鈕（Prototype 模擬用） -->
  <div id="controls">
    <button id="btn-ok"   onclick="setStatus('ok')">✅ 模擬：接線正確</button>
    <button id="btn-warn" onclick="setStatus('warn')">🔴 模擬：接線錯誤</button>
    <button id="btn-reset" onclick="setStatus('reset')">重置</button>
  </div>

  <!-- AR 場景 -->
  <a-scene
    vr-mode-ui="enabled: false"
    embedded
    arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
  >

    <!-- Hiro Marker（AR.js 內建，最容易取得） -->
    <a-marker preset="hiro" id="main-marker" smooth="true" smoothCount="5">

      <!-- 接線圖圖層：疊加在 Marker 正上方 -->
      <a-image
        id="wiring-overlay"
        src="data:image/png;base64,{b64}"
        position="0 0.01 0"
        rotation="-90 0 0"
        width="2.2"
        height="1.5"
        opacity="0.88"
        visible="true"
      ></a-image>

      <!-- 正確狀態：綠色邊框光暈 -->
      <a-box
        id="border-ok"
        position="0 0.005 0"
        rotation="-90 0 0"
        width="2.3" height="1.6" depth="0.01"
        color="#00ee66"
        opacity="0.25"
        visible="false"
      ></a-box>

      <!-- 錯誤狀態：紅色閃爍覆蓋區塊（模擬 L1 端子閃警示） -->
      <a-box
        id="border-warn"
        position="-0.85 0.02 0.45"
        rotation="-90 0 0"
        width="0.28" height="0.28" depth="0.01"
        color="#ff2222"
        opacity="0.7"
        visible="false"
        animation__blink="property: opacity; from: 0.7; to: 0.1; dur: 500; loop: true; dir: alternate"
      ></a-box>

      <!-- 說明文字 -->
      <a-text
        id="status-text"
        value="掃描中..."
        position="0 0.01 -0.85"
        rotation="-90 0 0"
        color="#ffffff"
        align="center"
        width="3.5"
      ></a-text>

    </a-marker>

    <a-entity camera></a-entity>
  </a-scene>

  <script>
    // ── 狀態切換邏輯 ──────────────────────────────────
    function setStatus(state) {{
      const warning   = document.getElementById('warning');
      const borderOk  = document.getElementById('border-ok');
      const borderWarn= document.getElementById('border-warn');
      const statusTxt = document.getElementById('status-text');

      if (state === 'ok') {{
        warning.style.display   = 'none';
        borderOk.setAttribute('visible', 'true');
        borderWarn.setAttribute('visible', 'false');
        statusTxt.setAttribute('value', '✓ 所有接線正確');
        statusTxt.setAttribute('color', '#00ff88');

      }} else if (state === 'warn') {{
        warning.style.display   = 'block';
        borderOk.setAttribute('visible', 'false');
        borderWarn.setAttribute('visible', 'true');
        statusTxt.setAttribute('value', '⚠ L1 接線錯誤！');
        statusTxt.setAttribute('color', '#ff4444');

      }} else {{
        warning.style.display   = 'none';
        borderOk.setAttribute('visible', 'false');
        borderWarn.setAttribute('visible', 'false');
        statusTxt.setAttribute('value', '掃描中...');
        statusTxt.setAttribute('color', '#ffffff');
      }}
    }}

    // ── Marker 偵測到時自動提示 ───────────────────────
    document.getElementById('main-marker').addEventListener('markerFound', () => {{
      document.getElementById('hud').textContent = '✅ 機櫃已辨識！接線圖疊加中...';
    }});
    document.getElementById('main-marker').addEventListener('markerLost', () => {{
      document.getElementById('hud').textContent = '📷 請將攝像頭對準 Hiro Marker，接線圖會自動疊加顯示';
      setStatus('reset');
    }});
  </script>

</body>
</html>"""

with open('/sessions/festive-trusting-noether/mnt/outputs/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done! index.html size:", len(html), "bytes")
