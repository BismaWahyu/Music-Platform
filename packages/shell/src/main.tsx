import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Suppress the WebView's native right-click menu (Reload/Back/Inspect…). Elements with
// their own onContextMenu handler open a custom menu instead; inputs keep their menu so
// copy/paste still works.
document.addEventListener('contextmenu', (e) => {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  e.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
