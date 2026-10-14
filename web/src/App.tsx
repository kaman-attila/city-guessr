import { useEffect, useState } from 'react'
import MapView from './MapView'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setStatus(data.ok ? 'API ok' : 'API error'))
      .catch(() => setStatus('API error'))
  }, [])

  return (
  <>
    <MapView />
    <div className="hud">{status}</div>
  </>
)
}