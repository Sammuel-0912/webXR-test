import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { resolveBackendUrl } from '../config'

// 以 ?url 取得 npm 套件預建檔的 URL：Vite 會把檔案原樣複製到 dist/assets 並加 hash，
// 不經 bundler 解析。AR.js 的預建檔是依賴全域 AFRAME 的 IIFE，無法被當成 ESM 直接 import，
// 故用 ?url + classic <script> 注入。由自家伺服器供應、不依賴 CDN，部署時檔案必定存在。
import aframeUrl from 'aframe/dist/aframe-master.min.js?url'
import arjsUrl   from '@ar-js-org/ar.js/aframe/build/aframe-ar.js?url'

// 注入 classic <script>（已存在則跳過）
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = Object.assign(document.createElement('script'), { src })
    s.onload = resolve
    s.onerror = () => reject(new Error('Failed to load: ' + src))
    document.head.appendChild(s)
  })
}

// ── 設定常數（集中管理，避免散落的 magic number）──────────────
const REQUEST_TIMEOUT_MS     = 8000  // fetch 逾時
const QR_AUTO_DETECT_DELAY_MS = 600  // QR 模式：等 UI 就緒後自動觸發 marker
const MARKER_LOST_DELAY_MS   = 2500  // marker 短暫遮蔽不立即收面板的緩衝
const FEEDBACK_DURATION_MS   = 1800  // 送出結果後回饋訊息顯示時長

const MARKER_COLORS = [
  '#22c55e','#3b82f6','#f59e0b','#a855f7',
  '#ef4444','#06b6d4','#84cc16','#f97316',
  '#ec4899','#14b8a6','#eab308','#8b5cf6',
]


export default function ArInspectPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()

  // BACKEND：URL param（QR Code）> Vite env var > hostname fallback（見 config.js）
  const BACKEND = useRef(resolveBackendUrl(searchParams.get('backend'))).current
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
  // 順序重要：aframe 必須先註冊全域 AFRAME，ar.js 才能掛上 arjs 系統與 a-marker。
  useEffect(() => {
    loadScript(aframeUrl)
      .then(() => loadScript(arjsUrl))
      .then(() => setScriptsReady(true))
      .catch(e => console.error('AR 套件載入失敗:', e))
  }, [])

  // ── 離開頁面時清除注入的 A-Frame scene ────────────────────────
  useEffect(() => {
    return () => {
      const s = document.getElementById('ar-scene-dynamic')
      if (s) s.remove()
      // 恢復 body 背景色
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])

  // ── 取得設備清單 ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(BACKEND + '/devices', { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const list = await res.json()
        list.forEach(d => { cacheRef.current[d.marker_id] = d })
        devicesRef.current = list
        setDevices(list)
      } catch {
        setConnError('後端連線失敗 (' + BACKEND + ')')
      } finally {
        setPhase('start')
        if (qrMode) setTimeout(() => onMarkerFound(Number(urlMarkerId)), QR_AUTO_DETECT_DELAY_MS)
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
    }, MARKER_LOST_DELAY_MS)
  }, [qrMode])

  // ── 使用者點擊「開始 AR 掃描」後才建立 scene（確保 user gesture）
  const startAR = useCallback(() => {
    setPhase('ar')
    setScanVisible(true)

    // 讓 body 背景透明，否則會遮住 AR.js 的相機 canvas
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'

    // 動態建立 <a-scene> 並附加到 body（不走 React vdom）
    const scene = document.createElement('a-scene')
    scene.id = 'ar-scene-dynamic'
    // 不加 embedded，讓 A-Frame 自行接管 fullscreen canvas（解決 canvas 尺寸問題）
    scene.setAttribute('arjs',
      'sourceType:webcam; detectionMode:mono_and_matrix; matrixCodeType:3x3; debugUIEnabled:false;')
    scene.setAttribute('vr-mode-ui', 'enabled:false')
    scene.setAttribute('renderer', 'logarithmicDepthBuffer:true; precision:medium; alpha:true;')
    scene.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;'

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
        signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.ok) {
        setFeedback({ type: 'success', msg: status === 'ok' ? '✔ 已記錄：正常 OK' : '⚠ 已記錄：異常 WARN' })
        if (!qrMode) {
          setTimeout(() => {
            setSheetOpen(false); setScanVisible(true)
            markerIdRef.current = null; setFeedback(null); setBtnsDisabled(false)
          }, FEEDBACK_DURATION_MS)
        } else {
          setTimeout(() => { setFeedback(null); setBtnsDisabled(false) }, FEEDBACK_DURATION_MS)
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
        <span className="fw-semibold" style={{ letterSpacing: 1 }}>📡 AR 點檢系統</span>
        <button
          className="btn btn-sm btn-outline-light rounded-pill"
          onClick={() => navigate('/dashboard')}
        >
          ← 儀表板
        </button>
      </div>

      {qrMode && <div className="ar-banner ar-banner--info">📱 QR Code 掃碼模式</div>}
      {connError && <div className="ar-banner ar-banner--error">{connError}</div>}

      {/* ── 載入中 ── */}
      {phase === 'loading' && (
        <div className="ar-overlay text-secondary">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">載入中…</span>
          </div>
          <div>正在載入設備清單…</div>
        </div>
      )}

      {/* ── Start Screen ── */}
      {phase === 'start' && (
        <div className="ar-overlay ar-overlay--start">
          <div style={{ fontSize: 56 }}>📡</div>
          <div className="card w-100" style={{ maxWidth: 360 }}>
            <div className="card-body">
              <div className="text-secondary text-uppercase small mb-2" style={{ letterSpacing: 1 }}>
                已載入設備
              </div>
              {devices.length === 0
                ? <div className="text-secondary small py-1">（無設備資料，仍可嘗試啟動）</div>
                : devices.map(d => (
                    <div key={d.marker_id}
                      className="d-flex align-items-center gap-2 py-1 border-bottom small">
                      <span className="dot"
                        style={{ background: MARKER_COLORS[d.marker_id % MARKER_COLORS.length] }} />
                      Marker {d.marker_id}：{d.name}
                    </div>
                  ))
              }
            </div>
          </div>
          <button className="ar-start-btn" onClick={startAR} disabled={!scriptsReady}>
            {scriptsReady ? '▶ 開始 AR 掃描' : '⌛ 載入 AR 套件中…'}
          </button>
          <div className="text-secondary small">點擊後瀏覽器會請求相機權限</div>
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
      <div className={`ar-sheet${sheetOpen ? ' is-open' : ''}`}>
        <div className="ar-sheet__handle" />
        <div className="text-uppercase small text-secondary" style={{ letterSpacing: 1 }}>偵測設備</div>
        <div className="fs-4 fw-bold mt-1">{activeDevice?.name || '—'}</div>
        <div className="text-secondary small mb-3">{activeDevice?.description || ''}</div>

        {activeDevice?.image_url && (
          <div className="text-center mb-3">
            <img src={BACKEND + activeDevice.image_url} alt="作業圖"
              className="img-fluid rounded" style={{ maxHeight: 180, objectFit: 'cover' }} />
          </div>
        )}

        {activeDevice?.work_instruction && (
          <div className="mb-3">
            <div className="text-uppercase small mb-1" style={{ color: 'var(--c-accent)', letterSpacing: 1 }}>
              📋 作業指引
            </div>
            <pre className="instruction-block bg-dark border rounded p-2 small text-light">
              {activeDevice.work_instruction}
            </pre>
          </div>
        )}

        <div className="d-flex gap-3 mb-3">
          <button className="ar-judge-btn ar-judge-btn--ok"
            disabled={btnsDisabled} onClick={() => submitInspection('ok')}>
            ✔ 正常 OK
          </button>
          <button className="ar-judge-btn ar-judge-btn--warn"
            disabled={btnsDisabled} onClick={() => submitInspection('warn')}>
            ⚠ 異常 WARN
          </button>
        </div>

        {feedback && (
          <div className={`alert alert-${feedback.type === 'success' ? 'success' : 'danger'} text-center py-2 mb-0`}>
            {feedback.msg}
          </div>
        )}
      </div>
    </div>
  )
}
