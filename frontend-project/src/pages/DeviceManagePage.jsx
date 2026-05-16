import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

// ── 網路設定（從 hostname 推斷預設值）─────────────────────────────
function guessUrls() {
  const h    = window.location.hostname   // 'localhost' or '192.168.x.x'
  const port = window.location.port || '5173'
  const proto = window.location.protocol
  return {
    frontend: `${proto}//${h}:${port}`,
    backend:  `http://${h}:8000`,
  }
}

const DEFAULTS = guessUrls()

// ── Helpers ──────────────────────────────────────────────────────────
function isLocalhost(url) {
  return /localhost|127\.0\.0\.1/.test(url)
}

// ── Network Config Card ──────────────────────────────────────────────
function NetworkConfig({ frontendUrl, backendUrl, onChange }) {
  const warn = isLocalhost(frontendUrl) || isLocalhost(backendUrl)
  return (
    <div className="network-config-card">
      <div className="network-config-title">🌐 網路設定（QR Code 連結用）</div>
      {warn && (
        <div className="network-warn">
          ⚠ 偵測到 <code>localhost</code>，手機掃描後將無法連線。
          請將下方網址改為電腦的區域 IP（例如 <strong>192.168.1.100</strong>）。
          <br />可在電腦終端機輸入 <code>ipconfig</code>（Windows）或 <code>ip addr</code>（Linux）查詢。
        </div>
      )}
      <div className="network-row">
        <label>前端網址（含 port）</label>
        <input value={frontendUrl}
          onChange={e => onChange('frontend', e.target.value)}
          placeholder="http://192.168.1.100:5173" />
      </div>
      <div className="network-row">
        <label>後端 API 網址</label>
        <input value={backendUrl}
          onChange={e => onChange('backend', e.target.value)}
          placeholder="http://192.168.1.100:8000" />
      </div>
    </div>
  )
}

// ── Device Card ──────────────────────────────────────────────────────
function DeviceCard({ device, frontendUrl, backendUrl, onEdit, onDelete, onImageUpload }) {
  const qrValue = `${frontendUrl}/ar-inspect.html?marker_id=${device.marker_id}&backend=${encodeURIComponent(backendUrl)}`
  const qrRef   = useRef(null)

  function downloadQR() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `device_${device.marker_id}_qr.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  function printCard() {
    const canvas = qrRef.current?.querySelector('canvas')
    const qrData = canvas ? canvas.toDataURL() : ''
    const win    = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>設備點檢卡 - ${device.name}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#fff;color:#111}
        .card{border:2px solid #333;border-radius:12px;padding:20px;max-width:340px;margin:auto}
        h2{margin:0 0 4px;font-size:1.2rem}
        .desc{color:#555;font-size:.85rem;margin-bottom:12px}
        .qr{text-align:center;margin:12px 0}
        .qr img{width:180px;height:180px}
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
        <div class="qr"><img src="${qrData}" alt="QR Code"/></div>
        ${device.image_url ? `<div class="img-preview"><img src="${backendUrl}${device.image_url}" alt="作業圖"/></div>` : ''}
        ${device.work_instruction ? `<div class="instruction">${device.work_instruction}</div>` : ''}
        <div class="footer">Marker ID: ${device.marker_id} · 掃描 QR Code 開始點檢</div>
      </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="device-card">
      <div className="device-card-header">
        <div>
          <div className="device-card-name">{device.name}</div>
          <div className="device-card-desc">{device.description || '—'}</div>
          <div className="device-card-id">Marker ID: {device.marker_id}</div>
        </div>
        <div ref={qrRef} className="device-qr" title={qrValue}>
          <QRCodeCanvas value={qrValue} size={88} bgColor="#fff" fgColor="#111" />
        </div>
      </div>

      {device.image_url && (
        <div className="device-image-wrap">
          <img src={`${backendUrl}${device.image_url}`} alt="作業指引圖" className="device-image" />
        </div>
      )}

      {device.work_instruction && (
        <pre className="device-instruction">{device.work_instruction}</pre>
      )}

      <div className="device-card-actions">
        <button className="btn btn-secondary" style={{fontSize:12}} onClick={downloadQR}>⬇ QR</button>
        <button className="btn btn-secondary" style={{fontSize:12}} onClick={printCard}>🖨 列印卡片</button>
        <button className="btn btn-secondary" style={{fontSize:12}} onClick={() => onEdit(device)}>✏ 編輯</button>
        <label className="btn btn-secondary" style={{fontSize:12, cursor:'pointer'}}>
          🖼 上傳圖片
          <input type="file" accept="image/*" style={{display:'none'}}
            onChange={e => { if (e.target.files[0]) onImageUpload(device.marker_id, e.target.files[0]) }} />
        </label>
        <button className="btn btn-danger" style={{fontSize:12}} onClick={() => onDelete(device.marker_id)}>🗑</button>
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
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>{isEdit ? '編輯設備' : '新增設備'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!isEdit && (
            <div className="form-row">
              <label>Marker ID <span className="required">*</span></label>
              <input type="number" min="0" value={form.marker_id}
                onChange={handle('marker_id')} placeholder="0 / 1 / 2 / ..." />
              <small className="form-hint">對應 AR 實體 Marker 編號（3×3 矩陣碼）</small>
            </div>
          )}
          <div className="form-row">
            <label>設備名稱 <span className="required">*</span></label>
            <input type="text" value={form.name} onChange={handle('name')} placeholder="例：INPUT 輸入端" />
          </div>
          <div className="form-row">
            <label>設備描述</label>
            <input type="text" value={form.description} onChange={handle('description')} placeholder="例：UPS 輸入模組" />
          </div>
          <div className="form-row">
            <label>作業指引</label>
            <textarea rows={5} value={form.work_instruction} onChange={handle('work_instruction')}
              placeholder={"1. 確認電壓正常\n2. 檢查接頭\n3. 確認指示燈"} />
            <small className="form-hint">AR 掃描時顯示在點檢面板中</small>
          </div>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────
export default function DeviceManagePage() {
  const [devices,     setDevices]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [modalDevice, setModalDevice] = useState(undefined)
  const [toast,       setToast]       = useState(null)
  const [frontendUrl, setFrontendUrl] = useState(DEFAULTS.frontend)
  const [backendUrl,  setBackendUrl]  = useState(DEFAULTS.backend)

  function handleUrlChange(key, val) {
    if (key === 'frontend') setFrontendUrl(val.trim())
    else                    setBackendUrl(val.trim())
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
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>載入中…</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-logo">🔧</span>
          <h1>設備管理</h1>
        </div>
        <div className="dash-header-right">
          <button className="btn btn-primary" onClick={() => setModalDevice(null)}>＋ 新增設備</button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/dashboard'}>← 儀表板</button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="dash-body">
        <NetworkConfig frontendUrl={frontendUrl} backendUrl={backendUrl} onChange={handleUrlChange} />

        <div className="device-grid">
          {devices.map(d => (
            <DeviceCard key={d.marker_id} device={d}
              frontendUrl={frontendUrl} backendUrl={backendUrl}
              onEdit={dev => setModalDevice(dev)}
              onDelete={handleDelete}
              onImageUpload={handleImageUpload}
            />
          ))}
          {devices.length === 0 && !error && (
            <p style={{ color: '#666', gridColumn: '1/-1' }}>尚無設備，請點「新增設備」</p>
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
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
