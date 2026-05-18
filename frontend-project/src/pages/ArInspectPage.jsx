import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const MARKER_COLORS = [
  '#22c55e','#3b82f6','#f59e0b','#a855f7',
  '#ef4444','#06b6d4','#84cc16','#f97316',
  '#ec4899','#14b8a6','#eab308','#8b5cf6',
]

// 動態載入 script tag（已存在則跳過）
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = Object.assign(document.createElement('script'), { src })
    s.onload = resolve
    s.onerror = () => reject(new Error('Failed to load: ' + src))
    document.head.appendChild(s)
  })
}

export default function ArInspectPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()

  // BACKEND：URL param（QR Code）> Vite env var > localhost fallback
  const BACKEND = useRef(
    (searchParams.get('backend') || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000')
      .replace(/\/$/, '')
  ).current
  const urlMarkerId = searchParams.get('marker_id')
  const qrMode      = urlMarkerId !== null

  // ── UI 狀態 ─────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState('loading') // loading | start | ar
  const [devices,      setDevices]      = useState([])
  const [connError,    setConnError]    = useState(null)
  const [scriptsReady, setScriptsReady] = useState(false)
  const [activeDevice, setActiveDevice] = useState(null)
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [scanVisible,  setScanVisible]  = useState(false)
  const [feedback,     setFeedback]     = useState(null)   // { type, msg } | null
  const [btnsDisabled, setBtnsDisabled] = useState(false)

  // ── Refs（不觸發 re-render）──────────────────────────────────────
  const cacheRef     = useRef({})
  const devicesRef   = useRef([])
  const markerIdRef  = useRef(null)
  const submitting   = useRef(false)

  // ── 載入 A-Frame + AR.js（背景進行，不阻塞 UI）────────────────
  useEffect(() => {
    loadScript('https://cdn.jsdelivr.net/npm/aframe@1.3.0/dist/aframe-master.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/@ar-js-org/ar.js@3.4.5/aframe/build/aframe-ar.js'))
      .then(() => setScriptsReady(true))
      .catch(e => console.error('AR 套件載入失敗:', e))
  }, [])

  // ── 離開頁面時清除注入的 A-Frame scene ────────────────────────
  useEffect(() => {
    return () => {
      const s = document.getElementById('ar-scene-dynamic')
      if (s) s.remove()
    }
  }, [])

  // ── 取得設備清單 ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(BACKEND + '/devices', { signal: AbortSignal.timeout(8000) })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const list = await res.json()
        list.forEach(d => { cacheRef.current[d.marker_id] = d })
        devicesRef.current = list
        setDevices(list)
      } catch {
        setConnError('後端連線失敗 (' + BACKEND + ')')
      } finally {
        setPhase('start')
        if (qrMode) setTimeout(() => onMarkerFound(Number(urlMarkerId)), 600)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Marker 偵測事件 ────────────────────────────────────────────
  const onMarkerFound = useCallback((id) => {
    if (markerIdRef.current === id) return
    markerIdRef.current = id
    const dev = cacheRef.current[id] || { marker_id: id, name: 'Marker ' + id, description: '' }
    setActiveDevice(dev)
    setSheetOpen(true)
    setScanVisible(false)
    setFeedback(null)
    setBtnsDisabled(false)
  }, [])

  const onMarkerLost = useCallback(() => {
    if (qrMode) return
    setTimeout(() => {
      if (markerIdRef.current !== null) {
        markerIdRef.current = null
        setSheetOpen(false)
        setScanVisible(true)
      }
    }, 2500)
  }, [qrMode])

  // ── 使用者點擊「開始 AR 掃描」後才建立 scene（確保 user gesture）
  const startAR = useCallback(() => {
    setPhase('ar')
    setScanVisible(true)

    // 動態建立 <a-scene> 並附加到 body（不走 React vdom）
    const scene = document.createElement('a-scene')
    scene.id = 'ar-scene-dynamic'
    scene.setAttribute('embedded', '')
    scene.setAttribute('arjs',
      'sourceType:webcam; detectionMode:mono_and_matrix; matrixCodeType:3x3; debugUIEnabled:false;')
    scene.setAttribute('vr-mode-ui', 'enabled:false')
    scene.setAttribute('renderer', 'logarithmicDepthBuffer:true; precision:medium;')
    scene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;'

    const camera = document.createElement('a-entity')
    camera.setAttribute('camera', '')
    scene.appendChild(camera)
    document.body.appendChild(scene)

    // scene loaded 後再注入各設備的 a-marker
    scene.addEventListener('loaded', () => {
      devicesRef.current.forEach(dev => {
        const color  = MARKER_COLORS[dev.marker_id % MARKER_COLORS.length]
        const marker = document.createElement('a-marker')
        marker.setAttribute('type',  'barcode')
        marker.setAttribute('value', String(dev.marker_id))

        const box = document.createElement('a-box')
        box.setAttribute('position', '0 0.05 0')
        box.setAttribute('scale',    '0.4 0.04 0.4')
        box.setAttribute('color',    color)
        box.setAttribute('opacity',  '0.85')
        marker.appendChild(box)

        if (dev.image_url) {
          const img = document.createElement('a-image')
          img.setAttribute('position', '0 0.6 0')
          img.setAttribute('scale',    '0.9 0.65 1')
          img.setAttribute('src',      BACKEND + dev.image_url)
          img.setAttribute('look-at',  '[camera]')
          marker.appendChild(img)
        }

        const txt = document.createElement('a-text')
        txt.setAttribute('value',  dev.name)
        txt.setAttribute('position', '0 1.3 0')
        txt.setAttribute('scale',    '0.45 0.45 0.45')
        txt.setAttribute('color',    'white')
        txt.setAttribute('align',    'center')
        marker.appendChild(txt)

        const id = dev.marker_id
        marker.addEventListener('markerFound', () => onMarkerFound(id))
        marker.addEventListener('markerLost',  () => onMarkerLost())
        scene.insertBefore(marker, camera)
      })
    }, { once: true })
  }, [BACKEND, onMarkerFound, onMarkerLost])

  // ── 送出點檢結果 ──────────────────────────────────────────────
  const submitInspection = async (status) => {
    if (submitting.current || markerIdRef.current === null) return
    submitting.current = true
    setBtnsDisabled(true)
    try {
      const res = await fetch(BACKEND + '/update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ marker_id: markerIdRef.current, status }),
        signal:  AbortSignal.timeout(8000),
      })
      if (res.ok) {
        setFeedback({ type: 'success', msg: status === 'ok' ? '✔ 已記錄：正常 OK' : '⚠ 已記錄：異常 WARN' })
        if (!qrMode) {
          setTimeout(() => {
            setSheetOpen(false); setScanVisible(true)
            markerIdRef.current = null; setFeedback(null); setBtnsDisabled(false)
          }, 1800)
        } else {
          setTimeout(() => { setFeedback(null); setBtnsDisabled(false) }, 1800)
        }
      } else {
        const b = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', msg: '上傳失敗：' + (b.detail || res.status) })
        setBtnsDisabled(false)
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: e.name === 'TimeoutError' ? '請求逾時' : '網路錯誤' })
      setBtnsDisabled(false)
    } finally { submitting.current = false }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="ar-page">
      {/* Top bar */}
      <div className="ar-top-bar">
        <span className="ar-title">📡 AR 點檢系統</span>
        <button className="ar-back-btn" onClick={() => navigate('/dashboard')}>← 儀表板</button>
      </div>

      {qrMode && <div className="ar-qr-banner">📱 QR Code 掃碼模式</div>}
      {connError && <div className="ar-conn-error">{connError}</div>}

      {/* ── 載入中 ── */}
      {phase === 'loading' && (
        <div className="ar-loading-overlay">
          <div className="ld-spinner" />
          <div>正在載入設備清單…</div>
        </div>
      )}

      {/* ── Start Screen ── */}
      {phase === 'start' && (
        <div className="ar-start-screen">
          <div className="ar-start-icon">📡</div>
          <div className="ar-device-list-card">
            <div className="ar-device-list-title">已載入設備</div>
            {devices.length === 0
              ? <div className="ar-no-devices">（無設備資料，仍可嘗試啟動）</div>
              : devices.map(d => (
                  <div key={d.marker_id} className="ar-device-list-item">
                    <span className="ar-device-dot"
                      style={{ background: MARKER_COLORS[d.marker_id % MARKER_COLORS.length] }} />
                    Marker {d.marker_id}：{d.name}
                  </div>
                ))
            }
          </div>
          <button className="ar-start-btn" onClick={startAR} disabled={!scriptsReady}>
            {scriptsReady ? '▶ 開始 AR 掃描' : '⌛ 載入 AR 套件中…'}
          </button>
          <div className="ar-start-hint">點擊後瀏覽器會請求相機權限</div>
        </div>
      )}

      {/* ── AR 執行中：瞄準框 + 提示 ── */}
      {phase === 'ar' && (
        <>
          <div className="ar-crosshair" style={{ opacity: scanVisible && !sheetOpen ? 1 : 0 }}>
            <svg viewBox="0 0 180 180" fill="none">
              <path d="M10 50 L10 10 L50 10"       stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M130 10 L170 10 L170 50"    stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M10 130 L10 170 L50 170"    stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M130 170 L170 170 L170 130" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          {scanVisible && !sheetOpen && (
            <div className="ar-scan-hint">將鏡頭對準設備上的 AR Marker</div>
          )}
        </>
      )}

      {/* ── Bottom Sheet ── */}
      <div className={`ar-bottom-sheet${sheetOpen ? ' open' : ''}`}>
        <div className="ar-sheet-handle" />
        <div className="ar-device-label">偵測設備</div>
        <div className="ar-device-name">{activeDevice?.name || '—'}</div>
        <div className="ar-device-desc">{activeDevice?.description || ''}</div>

        {activeDevice?.image_url && (
          <div className="ar-device-image-wrap">
            <img src={BACKEND + activeDevice.image_url} alt="作業圖" className="ar-device-image" />
          </div>
        )}

        {activeDevice?.work_instruction && (
          <div className="ar-instruction-wrap">
            <div className="ar-instruction-title">📋 作業指引</div>
            <pre className="ar-instruction-text">{activeDevice.work_instruction}</pre>
          </div>
        )}

        <div className="ar-btn-row">
          <button className="ar-judge-btn ar-btn-ok"
            disabled={btnsDisabled} onClick={() => submitInspection('ok')}>
            ✔ 正常 OK
          </button>
          <button className="ar-judge-btn ar-btn-warn"
            disabled={btnsDisabled} onClick={() => submitInspection('warn')}>
            ⚠ 異常 WARN
          </button>
        </div>

        {feedback && (
          <div className={`ar-feedback ar-feedback-${feedback.type}`}>{feedback.msg}</div>
        )}
      </div>
    </div>
  )
}
