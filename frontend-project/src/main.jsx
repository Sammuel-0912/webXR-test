import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Bootstrap 框架（CSS + JS bundle，含 Popper）
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// 自訂主題 tokens 與 OOCSS 物件層
import './index.css'
import './App.css'

import App from './App.jsx'

// ── 在 render 前套用主題，避免閃爍（FOUC）──────────────────
const saved = localStorage.getItem('theme')
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
document.documentElement.setAttribute(
  'data-bs-theme',
  saved || (prefersDark ? 'dark' : 'dark'), // 預設深色
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
