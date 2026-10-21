import type { ReactNode } from 'react'
import TopBar, { Wordmark } from './TopBar'
import { ArrowRightIcon, CalendarIcon, ClockIcon, FlameIcon, InfinityIcon } from './icons'
import { useCountdown } from './useCountdown'
import './Menu.css'
import Globe from './Globe'

type Props = {
  account: ReactNode
  bestScore: number | null
  streak: number
  onDaily: () => void
  onFreeplay: () => void
  onArchive: () => void
  onPrivacy: () => void
}

export default function Menu({
  account,
  bestScore,
  streak,
  onDaily,
  onFreeplay,
  onArchive,
  onPrivacy,
}: Props) {
  const countdown = useCountdown()

  return (
    <div className="menu">
      <Globe className="menu-globe" />

      <TopBar account={account} />

      <main className="menu-main">
        <h1 className="menu-title">
          <Wordmark />
          <svg className="menu-title-pin" viewBox="0 0 40 48" aria-hidden="true">
            <path d="M20 46s16-14.5 16-27A16 16 0 0 0 4 19c0 12.5 16 27 16 27z" />
            <circle cx="20" cy="19" r="6" />
          </svg>
        </h1>

        <p className="menu-tagline">Find any city on the map.</p>

        <div className="modes">
          <button className="mode mode-daily" onClick={onDaily}>
            <span className="mode-row">
              <span className="mode-icon">
                <CalendarIcon size={24} strokeWidth={2.2} />
              </span>
              <span className="mode-badges">
                {streak > 0 && (
                  <span className="mode-badge streak-badge" aria-label={`${streak} day streak`}>
                    <FlameIcon size={14} />
                    {streak}
                  </span>
                )}
                <span className="mode-badge">5 CITIES</span>
              </span>
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

        <button className="archive-link" onClick={onArchive}>
          <CalendarIcon size={18} strokeWidth={2.2} />
          Browse the daily archive
          <ArrowRightIcon size={16} strokeWidth={2.4} />
        </button>
      </main>

      <footer className="menu-footer">
        <button className="footer-link" onClick={onPrivacy}>
          Privacy
        </button>
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
          ,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>{' '}
          (modified)
        </span>
        <a href="/licenses.txt" target="_blank" rel="noreferrer">
          Licenses
        </a>
      </footer>
    </div>
  )
}
