import { useState } from 'react'
import { type Histogram } from './api'
import Globe from './Globe'
import HistogramChart from './HistogramChart'
import { CalendarIcon, CheckIcon, ClockIcon, InfinityIcon, ShareIcon } from './icons'
import { NewBestBadge } from './GameParts'
import { dailyShareText, shareOrCopy } from './share'
import { useCountdown } from './useCountdown'
import './DailyResults.css'

export type RoundScore = { name: string; score: number | null }

type Props = {
  date: string
  number: number
  isToday: boolean
  total: number
  histogram: Histogram
  rounds: RoundScore[] | null
  previousBest: number | null
  onFreeplay: () => void
  onArchive: () => void
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export default function DailyResults({
  date,
  number,
  isToday,
  total,
  histogram,
  rounds,
  previousBest,
  onFreeplay,
  onArchive,
}: Props) {
  const countdown = useCountdown()
  const better = histogram.better_than_percent
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function share() {
    const text = dailyShareText(
      date,
      number,
      total,
      (rounds ?? []).map((r) => r.score),
      window.location.origin,
    )
    try {
      const outcome = await shareOrCopy(text)
      if (outcome === 'copied') {
        setShareState('copied')
        setTimeout(() => setShareState('idle'), 2500)
      }
    } catch {
      setShareState('failed')
    }
  }

  return (
    <main className="daily-results">
      <Globe className="results-globe" />

      <span className="label">
        Daily #{number} · {formatDay(date)}
      </span>

      <div className="results-hero">
        <div className="results-total">
          <span className="display">{total}</span>
          <span className="mono">/ 5000</span>
        </div>
        {better !== null && (
          <div className="sticker">
            BETTER THAN
            <strong>{better}%</strong>
            OF PLAYERS
          </div>
        )}
      </div>

      {previousBest !== null && <NewBestBadge previous={previousBest} />}

      <button className="btn-pill share-btn" onClick={share} aria-live="polite">
        {shareState === 'copied' ? (
          <>
            <CheckIcon size={22} strokeWidth={2.6} />
            Copied! Paste it anywhere
          </>
        ) : (
          <>
            <ShareIcon size={22} strokeWidth={2.4} />
            Share your result
          </>
        )}
      </button>
      {shareState === 'failed' && (
        <p className="error share-error">Couldn't copy. Your browser blocked the clipboard.</p>
      )}

      {rounds && (
        <ol className="round-chips">
          {rounds.map((r, i) => (
            <li key={i} className="round-chip">
              <span className="round-chip-top">
                <span className="mono">ROUND {i + 1}</span>
                {r.score === 1000 && <span className="perfect">PERFECT</span>}
              </span>
              <span className="round-chip-city">{r.name}</span>
              <span className="mono round-chip-score">{r.score ?? '–'}</span>
              <div className="meter">
                <div style={{ width: `${(r.score ?? 0) / 10}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="results-card">
        <div className="results-card-head">
          <h2 className="display">How everyone did {isToday ? 'today' : 'that day'}</h2>
          <span className="mono">
            {histogram.players} {histogram.players === 1 ? 'player' : 'players'}
          </span>
        </div>
        <HistogramChart data={histogram} />
      </section>

      <div className="results-actions">
        {isToday && (
          <span className="pill">
            <ClockIcon size={18} strokeWidth={2.2} />
            Next daily in <span className="mono">{countdown}</span>
          </span>
        )}
        <button className="btn-pill btn-pill-quiet" onClick={onArchive}>
          <CalendarIcon size={20} strokeWidth={2.4} />
          Archive
        </button>
        <button className="btn-pill" onClick={onFreeplay}>
          <InfinityIcon size={22} strokeWidth={2.4} />
          Freeplay
        </button>
      </div>
    </main>
  )
}
