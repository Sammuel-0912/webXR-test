import { useState, useEffect, useCallback } from 'react'

const BACKEND = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '')

// ── Helpers ──────────────────────────────────────────────────────────
function okRateClass(rate) {
  if (rate >= 0.9) return 'ok-high'
  if (rate >= 0.6) return 'ok-mid'
  return 'ok-low'
}

function formatTime(ts) {
  if (!ts) return '—'
  return ts.replace('T', ' ')
}

// ── Sub-components ───────────────────────────────────────────────────
function StatCard({ stat }) {
  const rateClass = okRateClass(stat.ok_rate)
  const pct = (stat.ok_rate * 100).toFixed(1)
  return (
    <div className={`stat-card ${rateClass}`}>
      <div className="stat-device">{stat.device_name}</div>
      <div className="stat-rate">{pct}%</div>
      <div className="stat-meta">
        <span className="badge-ok">OK {stat.ok_count}</span>
        <span className="badge-warn">WARN {stat.warn_count}</span>
        <span style={{ color: '#888', fontSize: 12 }}>/ 共 {stat.total}</span>
      </div>
    </div>
  )
}

function ResultsTable({ results, onDelete }) {
  const rows = Object.entries(results)
  if (rows.length === 0) {
    return <p style={{ color: '#666', padding: '16px 0' }}>尚無點檢紀錄</p>
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>設備</th>
            <th>狀態</th>
            <th>時間</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, r]) => (
            <tr key={id}>
              <td>{r.device_name}</td>
              <td>
                <span className={r.status === 'ok' ? 'badge-ok' : 'badge-warn'}>
                  {r.status === 'ok' ? '✔ OK' : '⚠ WARN'}
                </span>
              </td>
              <td style={{ color: '#aaa', fontSize: 13 }}>{formatTime(r.time)}</td>
              <td>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => onDelete(id)}
                >
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats]       = useState([])
  const [results, setResults]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Filters
  const [filterMarker, setFilterMarker] = useState('')
  const [filterStart,  setFilterStart]  = useState('')
  const [filterEnd,    setFilterEnd]    = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setError(null)
    try {
      // Build results query string
      const params = new URLSearchParams()
      if (filterMarker !== '') params.append('marker_id', filterMarker)
      if (filterStart)         params.append('start', filterStart)
      if (filterEnd)           params.append('end', filterEnd)
      const qs = params.toString() ? '?' + params.toString() : ''

      const [statsRes, resultsRes] = await Promise.all([
        fetch(BACKEND + '/stats'),
        fetch(BACKEND + '/results' + qs),
      ])
      if (!statsRes.ok || !resultsRes.ok) throw new Error('API 錯誤')
      setStats(await statsRes.json())
      setResults(await resultsRes.json())
    } catch (e) {
      setError('無法連線至後端，請確認服務是否已啟動。')
    } finally {
      setLoading(false)
    }
  }, [filterMarker, filterStart, filterEnd])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Delete ─────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('確定要刪除這筆紀錄？')) return
    setDeleting(id)
    try {
      const res = await fetch(BACKEND + '/results/' + id, { method: 'DELETE' })
      if (res.ok) {
        setResults(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        // Refresh stats
        fetch(BACKEND + '/stats').then(r => r.json()).then(setStats).catch(() => {})
      } else {
        alert('刪除失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setDeleting(null)
    }
  }

  // ── Export ─────────────────────────────────────────────────────────
  function handleExport() {
    window.open(BACKEND + '/export', '_blank')
  }

  // ── Render ─────────────────────────────────────────────────────────
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
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-logo">🏭</span>
          <h1>點檢儀表板</h1>
        </div>
        <div className="dash-header-right">
          <button className="btn btn-inspect" onClick={() => window.location.href = '/ar-inspect.html'}>
            📡 開始點檢
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/devices'}>
            🔧 設備管理
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            ⬇ 匯出報表
          </button>
          <button className="btn btn-secondary" onClick={fetchData}>
            ↺ 刷新
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="dash-body">
        {/* Stats Grid */}
        <section>
          <h2 className="section-title">設備良率總覽</h2>
          {stats.length === 0
            ? <p style={{ color: '#666' }}>尚無統計資料</p>
            : (
              <div className="stat-grid">
                {stats.map(s => <StatCard key={s.marker_id} stat={s} />)}
              </div>
            )
          }
        </section>

        {/* Filters */}
        <section>
          <h2 className="section-title">點檢紀錄</h2>
          <div className="filter-row">
            <select
              value={filterMarker}
              onChange={e => setFilterMarker(e.target.value)}
            >
              <option value="">全部設備</option>
              {stats.map(s => (
                <option key={s.marker_id} value={s.marker_id}>
                  {s.device_name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={filterStart}
              onChange={e => setFilterStart(e.target.value.replace('T', ' ') + ':00')}
              placeholder="開始時間"
            />
            <input
              type="datetime-local"
              value={filterEnd}
              onChange={e => setFilterEnd(e.target.value.replace('T', ' ') + ':00')}
              placeholder="結束時間"
            />
            <button className="btn btn-secondary" onClick={fetchData}>篩選</button>
            <button className="btn btn-secondary" onClick={() => {
              setFilterMarker(''); setFilterStart(''); setFilterEnd('')
            }}>清除</button>
          </div>

          <ResultsTable results={results} onDelete={handleDelete} />
        </section>
      </main>
    </div>
  )
}
