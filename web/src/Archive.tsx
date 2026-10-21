import { useEffect, useState, type ReactNode } from 'react'
import TopBar from './TopBar'
import { getArchive, type Archive as ArchiveData, type ArchiveDay, type DailyDay } from './api'
import { ArrowRightIcon, CheckIcon } from './icons'
import './Archive.css'

type Props = {
  account: ReactNode
  onHome: () => void
  onOpen: (day: DailyDay) => void
}

const DAY_MS = 86_400_000

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function relativeDay(date: string, today: string): string | null {
  const diff = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return null
}

function MiniPins({ answered }: { answered: number }) {
  return (
    <span className="archive-pins" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((round) => (
        <svg
          key={round}
          viewBox="0 0 40 48"
          className={`archive-pin level-${round} ${round <= answered ? 'answered' : ''}`}
        >
          <path d="M20 46s16-14.5 16-27A16 16 0 0 0 4 19c0 12.5 16 27 16 27z" />
          <circle cx="20" cy="19" r="6" />
        </svg>
      ))}
    </span>
  )
}

function ArchiveRow({
  day,
  today,
  onOpen,
}: {
  day: ArchiveDay
  today: string
  onOpen: (day: DailyDay) => void
}) {
  const finished = day.round >= 5
  const started = day.round > 0
  const relative = relativeDay(day.date, today)
  const status = finished ? 'complete' : started ? 'started' : 'new'

  return (
    <li className={`archive-row ${status} ${relative === 'today' ? 'is-today' : ''}`}>
      <span className="archive-no mono">#{String(day.number).padStart(3, '0')}</span>
      <span className="archive-date">
        <strong>{shortDate(day.date)}</strong>
        {relative && <small>{relative}</small>}
      </span>
      <span className="archive-preview">
        {finished && day.cities ? day.cities.join(' · ') : <MiniPins answered={day.round} />}
      </span>
      <span className="archive-score">
        {finished ? day.score : started ? <small>{day.score} so far</small> : '–'}
      </span>
      <span className="archive-status">
        <button
          className={`archive-btn ${status}`}
          onClick={() => onOpen({ date: day.date, number: day.number })}
          aria-label={
            finished
              ? `See your results for daily #${day.number}`
              : `${started ? 'Continue' : 'Play'} daily #${day.number}`
          }
        >
          {finished ? (
            <>
              Complete <CheckIcon size={16} strokeWidth={3} />
            </>
          ) : (
            <>
              {started ? 'Continue' : 'Play'} <ArrowRightIcon size={16} strokeWidth={2.6} />
            </>
          )}
        </button>
      </span>
    </li>
  )
}

export default function Archive({ account, onHome, onOpen }: Props) {
  const [archive, setArchive] = useState<ArchiveData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getArchive()
      .then(setArchive)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <div className="screen">
      <TopBar onHome={onHome} account={account} />
      <main className="archive">
        <h1 className="display">Daily archive</h1>
        <p className="archive-intro">
          Every daily challenge so far. Play the ones you missed, or look back at how you did.
        </p>

        {error && <p className="error">Couldn't load the archive: {error}</p>}
        {!archive && !error && <p className="archive-intro">Loading…</p>}

        {archive && (
          <div className="archive-table">
            <div className="archive-columns" aria-hidden="true">
              <span>No.</span>
              <span>Date</span>
              <span className="archive-preview">Puzzle</span>
              <span>Score</span>
              <span className="archive-status">Status</span>
            </div>
            <ol className="archive-list">
              {archive.days.map((day) => (
                <ArchiveRow key={day.date} day={day} today={archive.today} onOpen={onOpen} />
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  )
}
