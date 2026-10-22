import type { ReactNode } from 'react'
import { HomeIcon } from './icons'
import './TopBar.css'

type Props = {
  onHome?: () => void
  center?: ReactNode
  account: ReactNode
  tools?: ReactNode
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      PinThe<span>City</span>
    </span>
  )
}

export default function TopBar({ onHome, center, account, tools }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-side">
        {onHome && (
          <>
            <button className="icon-btn" aria-label="Back to menu" onClick={onHome}>
              <HomeIcon />
            </button>
            {tools}
            {!tools && <Wordmark className="topbar-wordmark" />}
          </>
        )}
      </div>

      {center && <div className="topbar-center">{center}</div>}

      <div className="topbar-side">{account}</div>
    </header>
  )
}
