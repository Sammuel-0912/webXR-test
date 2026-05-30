import { useEffect, useState } from 'react'

// 亮/暗主題切換：操作 <html data-bs-theme>，並持久化到 localStorage。
// 初始值已由 main.jsx 在 render 前套用，這裡只負責後續切換與同步。
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-bs-theme') || 'dark',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className={`btn btn-outline-secondary btn-sm ${className}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? '切換到亮色主題' : '切換到深色主題'}
      aria-label="切換主題"
    >
      {isDark ? '🌙' : '☀️'}
    </button>
  )
}
