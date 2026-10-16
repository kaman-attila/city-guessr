import { type Histogram } from './api'
import Globe from './Globe'
import HistogramChart from './HistogramChart'
import { ClockIcon, InfinityIcon } from './icons'
import { useCountdown } from './useCountdown'
import './DailyResults.css'

export type RoundScore = { name: string; score: number }

type Props = {
  date: string
  total: number
  histogram: Histogram
  rounds: RoundScore[] | null
  onFreeplay: () => void
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export default function DailyResults({ date, total, histogram, rounds, onFreeplay }: Props) {
  const countdown = useCountdown()
  const better = histogram.better_than_percent

  return (
    <main className="daily-results">
      <Globe className="results-globe" />

      <span className="label">Daily · {formatDay(date)}</span>

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

      {rounds && (
        <ol className="round-chips">
          {rounds.map((r, i) => (
            <li key={i} className="round-chip">
              <span className="round-chip-top">
                <span className="mono">ROUND {i + 1}</span>
                {r.score === 1000 && <span className="perfect">PERFECT</span>}
              </span>
              <span className="round-chip-city">{r.name}</span>
              <span className="mono round-chip-score">{r.score}</span>
              <div className="meter">
                <div style={{ width: `${r.score / 10}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="results-card">
        <div className="results-card-head">
          <h2 className="display">How everyone did today</h2>
          <span className="mono">{histogram.players} players</span>
        </div>
        <HistogramChart data={histogram} />
      </section>

      <div className="results-actions">
        <span className="pill">
          <ClockIcon size={18} strokeWidth={2.2} />
          Next daily in <span className="mono">{countdown}</span>
        </span>
        <button className="btn-pill" onClick={onFreeplay}>
          <InfinityIcon size={22} strokeWidth={2.4} />
          Freeplay
        </button>
      </div>
    </main>
  )
}
