import type { ReactNode } from 'react'
import { HomeIcon, StarIcon } from './icons'
import './TopBar.css'

type Props = {
  onHome?: () => void
  center?: ReactNode
  score?: number | null
  account: ReactNode
}

type DotsProps = { round: number; total: number; answered: boolean }

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      City<span>Guessr</span>
    </span>
  )
}

export default function TopBar({ onHome, center, score, account }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-side">
        {onHome && (
          <>
            <button className="icon-btn" aria-label="Back to menu" onClick={onHome}>
              <HomeIcon />
            </button>
            <Wordmark className="topbar-wordmark" />
          </>
        )}
      </div>

      {center}

      <div className="topbar-side">
        {score != null && (
          <div className="pill">
            <StarIcon className="star" size={18} />
            <span className="mono">{score}</span>
            <span className="pill-unit">pts</span>
          </div>
        )}
        {account}
      </div>
    </header>
  )
}

export function RoundDots({ round, total, answered }: DotsProps) {
  const dots = Array.from({ length: total }, (_, i) => {
    let state = ''
    if (i < round - 1) state = 'done'
    else if (i === round - 1) state = answered ? 'done' : 'current'
    return <span key={i} className={`dot ${state}`} />
  })

  return (
    <div className="pill">
      <span className="dots" aria-hidden="true">
        {dots}
      </span>
      <span className="mono">
        Round {round}/{total}
      </span>
    </div>
  )
}
