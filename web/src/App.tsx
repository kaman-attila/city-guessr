import { useEffect, useState } from 'react'

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

  return <h1>{status}</h1>
}