import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Mouse wheel over a focused number input silently changes its value — blur instead
document.addEventListener(
  'wheel',
  () => {
    const el = document.activeElement
    if (el instanceof HTMLInputElement && el.type === 'number') {
      el.blur()
    }
  },
  { passive: true }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
