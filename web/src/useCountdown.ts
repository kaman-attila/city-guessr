import { useEffect, useState } from 'react'

export function useCountdown(): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)

  const secs = Math.max(0, Math.floor((next.getTime() - now) / 1000))
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = secs % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
