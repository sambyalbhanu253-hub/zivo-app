import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import '../main.css'
import './styles/app.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The app root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)

requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  splash.classList.add('is-hidden')
  window.setTimeout(() => splash.remove(), 400)
})
