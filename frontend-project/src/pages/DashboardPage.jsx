import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { resolveBackendUrl } from '../config'

const BACKEND = resolveBackendUrl()

// 單頁筆數（與後端 DEFAULT_PAGE_SIZE 對應,避免硬編碼散落）
const PAGE_SIZE = 100

// ── Helpers ──────────────────────────────────────────────────────────
function okRateModifier(rate) {
  if (rate >= 0.9) return 'high'
  if (rate >= 0.6) return 'mid'
  return 'low'
}

function formatTime(ts) {
  if (!ts) return '—'
  return ts.replace('T', ' ')
}

// ── Sub-components ───────────────────────────────────────────────────
function StatCard({ stat }) {
  const mod = okRateModifier(stat.ok_rate)
  const pct = (stat.ok_rate * 100).toFixed(1)
  return (
    <div className="col">
      <div className={`card h-100 stat-accent stat-accent--${mod}`}>
        <div className="card-body">
          <h3 className="h6 fw-bold mb-3 text-truncate">{stat.device_name}</h3>
          <div className="stat-rate mb-2">{pct}%</div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="badge-soft badge-soft--ok">OK {stat.ok_count}</span>
            <span className="badge-soft badge-soft--warn">WARN {stat.warn_count}</span>
            <span className="text-secondary small">/ 共 {stat.total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultsTable({ results, onDelete }) {
  const rows = Object.entries(results)
  if (rows.length === 0) {
    return <p className="text-secondary py-3 mb-0">尚無點檢紀錄</p>
  }
  return (
    <div className="table-responsive border rounded-3 overflow-hidden">
      <table className="table table-hover align-middle mb-0">
        <thead className="text-secondary small text-uppercase">
          <tr>
            <th>設備</th>
            <th>狀態</th>
            <th>時間</th>
            <th className="text-end">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, r]) => (
            <tr key={id}>
              <td>{r.device_name}</td>
              <td>
                <span className={`badge-soft badge-soft--${r.status === 'ok' ? 'ok' : 'warn'}`}>
                  {r.status === 'ok' ? '✔ OK' : '⚠ WARN'}
                </span>
              </td>
              <td className="text-secondary small">{formatTime(r.time)}</td>
              <td className="text-end">
                <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(id)}>
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
  const navigate = useNavigate()
  const [stats, setStats]       = useState([])
  const [results, setResults]   = useState({})
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]       = useState(null)

  // Filters
  const [filterMarker, setFilterMarker] = useState('')
  const [filterStart,  setFilterStart]  = useState('')
  const [filterEnd,    setFilterEnd]    = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────
  // 組裝 /results 查詢字串（含分頁參數）
  const buildResultsQuery = useCallback((offset) => {
    const params = new URLSearchParams()
    if (filterMarker !== '') params.append('marker_id', filterMarker)
    if (filterStart)         params.append('start', filterStart)
    if (filterEnd)           params.append('end', filterEnd)
    params.append('limit',  PAGE_SIZE)
    params.append('offset', offset)
    return '?' + params.toString()
  }, [filterMarker, filterStart, filterEnd])

  // append=false：重置為第一頁；append=true：載入下一頁並接續既有資料
  const fetchResults = useCallback(async (append = false, offset = 0) => {
    if (append) setLoadingMore(true)
    else        setError(null)
    try {
      const res = await fetch(BACKEND + '/results' + buildResultsQuery(offset))
      if (!res.ok) throw new Error('API 錯誤')
      const data = await res.json()
      setTotal(Number(res.headers.get('X-Total-Count')) || 0)
      setResults(prev => (append ? { ...prev, ...data } : data))
    } catch {
      setError('無法連線至後端，請確認服務是否已啟動。')
    } finally {
      if (append) setLoadingMore(false)
    }
  }, [buildResultsQuery])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(BACKEND + '/stats')
      if (!res.ok) throw new Error('API 錯誤')
      setStats(await res.json())
    } catch {
      setError('無法連線至後端，請確認服務是否已啟動。')
    }
  }, [])

  // 首次載入統計（只需一次）。向後端抓資料屬 effect 同步外部系統的正當用途,
  // 此處刻意在 effect 內觸發 setState,故停用過度告警的規則。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStats() }, [fetchStats])

  // 首次載入 + 篩選條件變動 → 重新抓第一頁
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResults(false, 0).finally(() => setLoading(false))
  }, [fetchResults])

  // 手動重新整理（統計 + 紀錄第一頁）
  const refresh = () => { fetchStats(); fetchResults(false, 0) }

  // 載入更多：以目前已載入筆數作為 offset
  const loadMore = () => fetchResults(true, Object.keys(results).length)

  // ── Delete ─────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('確定要刪除這筆紀錄？')) return
    try {
      const res = await fetch(BACKEND + '/results/' + id, { method: 'DELETE' })
      if (res.ok) {
        setResults(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setTotal(t => Math.max(0, t - 1))
        fetchStats()
      } else {
        alert('刪除失敗')
      }
    } catch {
      alert('網路錯誤')
    }
  }

  // ── Export ─────────────────────────────────────────────────────────
  function handleExport() {
    window.open(BACKEND + '/export', '_blank')
  }

  // ── Render ─────────────────────────────────────────────────────────
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
      {/* Header */}
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 px-md-4 py-3 border-bottom bg-body-tertiary">
        <div className="d-flex align-items-center gap-2">
          <span className="fs-3">🏭</span>
          <h1 className="h5 fw-bold mb-0 text-primary">點檢儀表板</h1>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button className="btn btn-primary" onClick={() => navigate('/ar-inspect')}>
            📡 開始點檢
          </button>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/devices')}>
            🔧 設備管理
          </button>
          <button className="btn btn-outline-secondary" onClick={handleExport}>
            ⬇ 匯出報表
          </button>
          <button className="btn btn-outline-secondary" onClick={refresh}>
            ↺ 刷新
          </button>
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div className="alert alert-danger rounded-0 mb-0" role="alert">{error}</div>
      )}

      <main className="flex-grow-1 container-fluid px-3 px-md-4 py-4 d-flex flex-column gap-4">
        {/* Stats Grid */}
        <section>
          <h2 className="text-secondary text-uppercase small fw-semibold mb-3">設備良率總覽</h2>
          {stats.length === 0
            ? <p className="text-secondary mb-0">尚無統計資料</p>
            : (
              <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xxl-4 g-3">
                {stats.map(s => <StatCard key={s.marker_id} stat={s} />)}
              </div>
            )
          }
        </section>

        {/* Records */}
        <section className="flex-grow-1">
          <h2 className="text-secondary text-uppercase small fw-semibold mb-3">點檢紀錄</h2>
          <div className="row g-2 align-items-end mb-3">
            <div className="col-12 col-sm-6 col-lg-3">
              <label className="form-label small text-secondary mb-1">設備</label>
              <select
                className="form-select form-select-sm"
                value={filterMarker}
                onChange={e => setFilterMarker(e.target.value)}
              >
                <option value="">全部設備</option>
                {stats.map(s => (
                  <option key={s.marker_id} value={s.marker_id}>{s.device_name}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-sm-6 col-lg-3">
              <label className="form-label small text-secondary mb-1">開始時間</label>
              <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={filterStart ? filterStart.slice(0, 16).replace(' ', 'T') : ''}
                onChange={e => setFilterStart(e.target.value ? e.target.value.replace('T', ' ') + ':00' : '')}
              />
            </div>
            <div className="col-6 col-sm-6 col-lg-3">
              <label className="form-label small text-secondary mb-1">結束時間</label>
              <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={filterEnd ? filterEnd.slice(0, 16).replace(' ', 'T') : ''}
                onChange={e => setFilterEnd(e.target.value ? e.target.value.replace('T', ' ') + ':00' : '')}
              />
            </div>
            <div className="col-12 col-lg-3 d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary flex-fill" onClick={() => fetchResults(false, 0)}>篩選</button>
              <button
                className="btn btn-sm btn-outline-secondary flex-fill"
                onClick={() => { setFilterMarker(''); setFilterStart(''); setFilterEnd('') }}
              >
                清除
              </button>
            </div>
          </div>

          <ResultsTable results={results} onDelete={handleDelete} />

          {Object.keys(results).length < total && (
            <div className="text-center mt-3">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? '載入中…'
                  : `載入更多（已顯示 ${Object.keys(results).length} / ${total}）`}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
