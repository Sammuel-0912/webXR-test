import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000'

  return {
    plugins: [
      react(),

      // ── 把 VITE_BACKEND_URL 注入 ar-inspect.html ─────────────────
      // public/ 裡的靜態 HTML 不走 Vite 的 import.meta.env，
      // 所以用這個 plugin 在 dev 攔截請求、在 build 後修改輸出檔。
      {
        name: 'inject-backend-url-into-ar-html',

        // Dev server：攔截 /ar-inspect.html，即時替換佔位符
        configureServer(server) {
          server.middlewares.use('/ar-inspect.html', (_req, res) => {
            const src = resolve(__dirname, 'public/ar-inspect.html')
            let html = readFileSync(src, 'utf-8')
            html = html.replaceAll("'__VITE_BACKEND_URL__'", JSON.stringify(backendUrl))
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(html)
          })
        },

        // Build：在 dist/ 輸出後替換
        closeBundle() {
          const out = resolve(__dirname, 'dist/ar-inspect.html')
          if (!existsSync(out)) return
          let html = readFileSync(out, 'utf-8')
          html = html.replaceAll("'__VITE_BACKEND_URL__'", JSON.stringify(backendUrl))
          writeFileSync(out, html)
        },
      },
    ],
  }
})
