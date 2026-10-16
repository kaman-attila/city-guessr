import type { ReactNode } from 'react'
import TopBar, { Wordmark } from './TopBar'
import { ArrowRightIcon, CalendarIcon, ClockIcon, InfinityIcon, PinIcon } from './icons'
import { useCountdown } from './useCountdown'
import './Menu.css'

type Props = {
  account: ReactNode
  bestScore: number | null
  onDaily: () => void
  onFreeplay: () => void
}

const TAGS = [
  { name: 'Santa Cruz', count: 15, pin: 'pin-accent', spot: 'tag-1' },
  { name: 'Springfield', count: 11, pin: 'pin-sun', spot: 'tag-2' },
  { name: 'Victoria', count: 13, pin: 'pin-sun', spot: 'tag-3' },
  { name: 'Lyon', count: null, pin: 'pin-accent', spot: 'tag-4' },
]

export default function Menu({ account, bestScore, onDaily, onFreeplay }: Props) {
  const countdown = useCountdown()

  return (
    <div className="menu">
      <svg className="menu-globe" viewBox="0 0 600 600" aria-hidden="true">
        <circle cx="300" cy="300" r="290" />
        <ellipse cx="300" cy="300" rx="210" ry="290" />
        <ellipse cx="300" cy="300" rx="110" ry="290" />
        <line x1="300" y1="10" x2="300" y2="590" />
        <line x1="90" y1="100" x2="510" y2="100" />
        <line x1="28" y1="200" x2="572" y2="200" />
        <line x1="10" y1="300" x2="590" y2="300" />
        <line x1="28" y1="400" x2="572" y2="400" />
        <line x1="90" y1="500" x2="510" y2="500" />
      </svg>

      {TAGS.map((tag) => (
        <div key={tag.name} className={`menu-tag ${tag.spot}`} aria-hidden="true">
          <PinIcon size={18} className={tag.pin} />
          {tag.name}
          {tag.count !== null && <span className="mono">×{tag.count}</span>}
        </div>
      ))}

      <TopBar account={account} />

      <main className="menu-main">
        <div className="menu-kicker">
          <span className="menu-kicker-dot" />
          Daily geography game
        </div>

        <h1 className="menu-title">
          <Wordmark />
          <svg className="menu-title-pin" viewBox="0 0 40 48" aria-hidden="true">
            <path d="M20 46s16-14.5 16-27A16 16 0 0 0 4 19c0 12.5 16 27 16 27z" />
            <circle cx="20" cy="19" r="6" />
          </svg>
        </h1>

        <p className="menu-tagline">
          Find any city on the map. One shared challenge a day, endless rounds in freeplay.
        </p>

        <div className="modes">
          <button className="mode mode-daily" onClick={onDaily}>
            <span className="mode-row">
              <span className="mode-icon">
                <CalendarIcon size={24} strokeWidth={2.2} />
              </span>
              <span className="mode-badge">5 CITIES</span>
            </span>
            <span>
              <span className="mode-title">Daily</span>
              <span className="mode-desc">The same 5 cities for everyone. One try.</span>
            </span>
            <span className="mode-row">
              <span className="mode-foot">
                <ClockIcon size={16} strokeWidth={2.2} />
                <span className="mono">resets in {countdown}</span>
              </span>
              <span className="mode-go">
                <ArrowRightIcon strokeWidth={2.4} />
              </span>
            </span>
          </button>

          <button className="mode mode-free" onClick={onFreeplay}>
            <span className="mode-row">
              <span className="mode-icon">
                <InfinityIcon size={26} strokeWidth={2.2} />
              </span>
              {bestScore !== null && <span className="mode-badge">BEST {bestScore}</span>}
            </span>
            <span>
              <span className="mode-title">Freeplay</span>
              <span className="mode-desc">Random cities, as many games as you like.</span>
            </span>
            <span className="mode-row">
              <span className="mode-foot">5 rounds per game</span>
              <span className="mode-go">
                <ArrowRightIcon strokeWidth={2.4} />
              </span>
            </span>
          </button>
        </div>
      </main>

      <footer className="menu-footer">
        <span>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
        </span>
        <span>
          Places ©{' '}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
          , CC BY 4.0
        </span>
      </footer>
    </div>
  )
}
