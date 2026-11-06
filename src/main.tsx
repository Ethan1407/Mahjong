import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics：統計瀏覽人數（不使用 cookie）。本機開發時不會送出資料。 */}
    <Analytics />
  </StrictMode>,
)
