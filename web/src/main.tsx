import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@fontsource-variable/unbounded'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
