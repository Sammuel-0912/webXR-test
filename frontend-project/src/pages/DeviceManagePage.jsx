import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

// ── 後端連線設定（從 env var 或 hostname 推斷預設值）────────────────
function guessBackend() {
  const h = window.location.hostname
  const envBackend = import.meta.env.VITE_BACKEND_URL
  return (envBackend || `http://${h}:8000`).replace(/\/$/, '')
}

const DEFAULT_BACKEND = guessBackend()

// ── Helpers ──────────────────────────────────────────────────────────
function isLocalhost(url) {
  return /localhost|127\.0\.0\.1/.test(url)
}

// ── Backend Config Card ──────────────────────────────────────────────
function NetworkConfig({ backendUrl, onChange }) {
  const warn = isLocalhost(backendUrl)
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h2 className="text-secondary text-uppercase small fw-bold mb-3">🌐 後端 API 連線設定</h2>
        {warn && (
          <div className="alert alert-warning small" role="alert">
            ⚠ 偵測到 <code>localhost</code>，其他裝置將無法連線。
            請改為電腦的區域 IP（例如 <strong>192.168.1.100</strong>）。
            <br />可在電腦終端機輸入 <code>ipconfig</code>（Windows）或 <code>ip addr</code>（Linux）查詢。
          </div>
        )}
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label small text-secondary mb-1">後端 API 網址</label>
            <input
              className="form-control form-control-sm font-monospace"
              value={backendUrl}
              onChange={e => onChange(e.target.value)}
              placeholder="http://192.168.1.100:8000"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Device Card ──────────────────────────────────────────────────────
// AR.js 3x3 barcode marker：值 0-63，圖檔在 public/markers/3x3/{id}.png
// 這才是相機在 AR 模式實際偵測的實體標記（matrixCodeType:3x3）
function markerSrc(markerId) {
  return Number.isInteger(markerId) && markerId >= 0 && markerId <= 63
    ? `/markers/3x3/${markerId}.png`
    : null
}

function DeviceCard({ device, backendUrl, onEdit, onDelete, onImageUpload }) {
  const arMarker = markerSrc(device.marker_id)

  function downloadMarker() {
    if (!arMarker) return
    const link = document.createElement('a')
    link.download = `device_${device.marker_id}_ar_marker.png`
    link.href = arMarker
    link.click()
  }

  function printCard() {
    const markerUrl = arMarker ? window.location.origin + arMarker : ''
    const win    = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>設備點檢卡 - ${device.name}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#fff;color:#111}
        .card{border:2px solid #333;border-radius:12px;padding:20px;max-width:340px;margin:auto}
        h2{margin:0 0 4px;font-size:1.2rem}
        .desc{color:#555;font-size:.85rem;margin-bottom:12px}
        .marker{text-align:center;margin:14px 0}
        .marker img{width:200px;height:200px;image-rendering:pixelated;border:1px solid #ccc}
        .label{font-size:.7rem;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
        .instruction{background:#f5f5f5;border-radius:8px;padding:10px;font-size:.8rem;white-space:pre-wrap;margin-top:12px}
        .img-preview{text-align:center;margin-top:10px}
        .img-preview img{max-width:100%;border-radius:6px}
        .footer{text-align:center;color:#888;font-size:.75rem;margin-top:14px}
        @media print{body{padding:0}}
      </style>
    </head><body>
      <div class="card">
        <h2>${device.name}</h2>
        <div class="desc">${device.description || ''}</div>
        ${markerUrl
          ? `<div class="marker"><img src="${markerUrl}" alt="AR Marker"/><div class="label">AR 標記 · 貼於設備供相機掃描</div></div>`
          : `<div class="label" style="text-align:center;color:#c00">Marker ID ${device.marker_id} 超出 3×3 範圍（0–63）</div>`}
        ${device.image_url ? `<div class="img-preview"><img src="${backendUrl}${device.image_url}" alt="作業圖"/></div>` : ''}
        ${device.work_instruction ? `<div class="instruction">${device.work_instruction}</div>` : ''}
        <div class="footer">Marker ID: ${device.marker_id}</div>
      </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="col">
      <div className="card h-100">
        <div className="card-body d-flex flex-column gap-2">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div className="overflow-hidden">
              <div className="fw-bold text-truncate">{device.name}</div>
              <div className="text-secondary small text-truncate">{device.description || '—'}</div>
              <div className="text-body-tertiary" style={{ fontSize: '0.7rem' }}>Marker ID: {device.marker_id}</div>
            </div>
            <div className="text-center flex-shrink-0">
              {arMarker ? (
                <div className="qr-light" title={`AR.js 3×3 barcode marker #${device.marker_id}`}>
                  <img
                    src={arMarker}
                    alt={`AR Marker ${device.marker_id}`}
                    width={88} height={88}
                    style={{ imageRendering: 'pixelated', display: 'block' }}
                  />
                </div>
              ) : (
                <div className="qr-light text-danger small d-flex align-items-center justify-content-center"
                  style={{ width: 100, height: 100 }}>
                  超出 0–63
                </div>
              )}
              <div className="text-body-tertiary mt-1" style={{ fontSize: '0.65rem' }}>AR 標記</div>
            </div>
          </div>

          {device.image_url && (
            <div className="text-center">
              <img
                src={`${backendUrl}${device.image_url}`}
                alt="作業指引圖"
                className="img-fluid rounded"
                style={{ maxHeight: 160, objectFit: 'cover' }}
              />
            </div>
          )}

          {device.work_instruction && (
            <pre className="instruction-block bg-body-tertiary border rounded p-2 small text-secondary mb-0">
              {device.work_instruction}
            </pre>
          )}

          <div className="d-flex flex-wrap gap-2 border-top pt-2 mt-auto">
            <button className="btn btn-sm btn-outline-secondary" onClick={downloadMarker} disabled={!arMarker}>
              ⬇ 標記
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={printCard}>🖨 列印卡片</button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(device)}>✏ 編輯</button>
            <label className="btn btn-sm btn-outline-secondary mb-0">
              🖼 上傳圖片
              <input
                type="file" accept="image/*" className="d-none"
                onChange={e => { if (e.target.files[0]) onImageUpload(device.marker_id, e.target.files[0]) }}
              />
            </label>
            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(device.marker_id)}>🗑</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────
const EMPTY_FORM = { marker_id: '', name: '', description: '', work_instruction: '', image_url: '' }

function DeviceModal({ initial, backendUrl, onSave, onClose }) {
  const [form,   setForm]   = useState(initial || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const isEdit = Boolean(initial)

  function handle(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSave() {
    if (!form.name.trim()) { setError('設備名稱不能為空'); return }
    if (!isEdit && form.marker_id === '') { setError('請輸入 Marker ID'); return }
    setSaving(true); setError(null)
    try {
      let res
      if (isEdit) {
        res = await fetch(`${backendUrl}/devices/${form.marker_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name, description: form.description || null,
            work_instruction: form.work_instruction || null,
            image_url: form.image_url || null,
          }),
        })
      } else {
        res = await fetch(`${backendUrl}/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marker_id: Number(form.marker_id), name: form.name,
            description: form.description || null,
            work_instruction: form.work_instruction || null,
            image_url: form.image_url || null,
          }),
        })
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || res.status)
      }
      onSave()
    } catch (e) {
      setError('儲存失敗：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5 mb-0">{isEdit ? '編輯設備' : '新增設備'}</h2>
              <button type="button" className="btn-close" aria-label="關閉" onClick={onClose} />
            </div>
            <div className="modal-body">
              {!isEdit && (
                <div className="mb-3">
                  <label className="form-label small text-secondary">
                    Marker ID <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number" min="0" className="form-control"
                    value={form.marker_id} onChange={handle('marker_id')} placeholder="0 / 1 / 2 / ..."
                  />
                  <div className="form-text">對應 AR 實體 Marker 編號（3×3 矩陣碼）</div>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label small text-secondary">
                  設備名稱 <span className="text-danger">*</span>
                </label>
                <input type="text" className="form-control" value={form.name}
                  onChange={handle('name')} placeholder="例：INPUT 輸入端" />
              </div>
              <div className="mb-3">
                <label className="form-label small text-secondary">設備描述</label>
                <input type="text" className="form-control" value={form.description}
                  onChange={handle('description')} placeholder="例：UPS 輸入模組" />
              </div>
              <div className="mb-3">
                <label className="form-label small text-secondary">作業指引</label>
                <textarea className="form-control" rows={5} value={form.work_instruction}
                  onChange={handle('work_instruction')}
                  placeholder={"1. 確認電壓正常\n2. 檢查接頭\n3. 確認指示燈"} />
                <div className="form-text">AR 掃描時顯示在點檢面板中</div>
              </div>
              {error && <div className="alert alert-danger small mb-0" role="alert">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────
export default function DeviceManagePage() {
  const navigate = useNavigate()
  const [devices,     setDevices]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [modalDevice, setModalDevice] = useState(undefined)
  const [toast,       setToast]       = useState(null)
  const [backendUrl,  setBackendUrl]  = useState(DEFAULT_BACKEND)

  function handleUrlChange(val) {
    setBackendUrl(val.trim())
  }

  async function fetchDevices() {
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/devices`)
      if (!res.ok) throw new Error('API 錯誤')
      setDevices(await res.json())
    } catch {
      setError(`無法連線至後端 (${backendUrl})，請確認服務已啟動`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDevices() }, [backendUrl])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  async function handleDelete(marker_id) {
    if (!window.confirm(`確定刪除 Marker ${marker_id}？`)) return
    const res = await fetch(`${backendUrl}/devices/${marker_id}`, { method: 'DELETE' })
    if (res.ok) { showToast('設備已刪除'); fetchDevices() }
    else showToast('刪除失敗', 'error')
  }

  async function handleImageUpload(marker_id, file) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${backendUrl}/devices/${marker_id}/image`, { method: 'POST', body: fd })
    if (res.ok) { showToast('圖片已上傳'); fetchDevices() }
    else showToast('圖片上傳失敗', 'error')
  }

  function handleSaved() {
    setModalDevice(undefined)
    showToast('設備已儲存')
    fetchDevices()
  }

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 gap-3 text-secondary">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">載入中…</span>
        </div>
        <p className="mb-0">載入中…</p>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 px-md-4 py-3 border-bottom bg-body-tertiary">
        <div className="d-flex align-items-center gap-2">
          <span className="fs-3">🔧</span>
          <h1 className="h5 fw-bold mb-0 text-primary">設備管理</h1>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button className="btn btn-primary" onClick={() => setModalDevice(null)}>＋ 新增設備</button>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/dashboard')}>← 儀表板</button>
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div className="alert alert-danger rounded-0 mb-0" role="alert">{error}</div>
      )}

      <main className="flex-grow-1 container-fluid px-3 px-md-4 py-4">
        <NetworkConfig backendUrl={backendUrl} onChange={handleUrlChange} />

        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {devices.map(d => (
            <DeviceCard key={d.marker_id} device={d}
              backendUrl={backendUrl}
              onEdit={dev => setModalDevice(dev)}
              onDelete={handleDelete}
              onImageUpload={handleImageUpload}
            />
          ))}
          {devices.length === 0 && !error && (
            <p className="text-secondary">尚無設備，請點「新增設備」</p>
          )}
        </div>
      </main>

      {modalDevice !== undefined && (
        <DeviceModal
          initial={modalDevice}
          backendUrl={backendUrl}
          onSave={handleSaved}
          onClose={() => setModalDevice(undefined)}
        />
      )}

      {toast && (
        <div className="toast-container position-fixed bottom-0 start-50 translate-middle-x p-3" style={{ zIndex: 1100 }}>
          <div className={`toast show text-bg-${toast.type === 'error' ? 'danger' : 'success'}`} role="alert">
            <div className="toast-body">{toast.msg}</div>
          </div>
        </div>
      )}
    </div>
  )
}
