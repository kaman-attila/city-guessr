import { StarIcon } from './icons'
import './RoundTracker.css'

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert', 'Impossible']
const MAX_SCORE = 1000

type Props = {
  scores: (number | null)[]
  current: number | null
  total: number
}

function RoundPin({ round }: { round: number }) {
  return (
    <svg className="tracker-pin" viewBox="0 0 40 48" aria-hidden="true">
      <path d="M20 46s16-14.5 16-27A16 16 0 0 0 4 19c0 12.5 16 27 16 27z" />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central">
        {round}
      </text>
    </svg>
  )
}

export default function RoundTracker({ scores, current, total }: Props) {
  const answered = scores.length

  return (
    <div className="tracker" role="list" aria-label="Rounds">
      <span className="tracker-label" aria-hidden="true">
        Round
      </span>

      {DIFFICULTIES.map((difficulty, i) => {
        const round = i + 1
        const done = i < answered
        const score = done ? scores[i] : null
        const perfect = score === MAX_SCORE
        const now = !done && round === current
        const status = perfect ? 'perfect' : done ? 'done' : now ? 'now' : 'todo'
        const spoken = done
          ? score === null
            ? 'answered'
            : `${score} points${perfect ? ', perfect' : ''}`
          : now
            ? 'playing now'
            : 'not played yet'

        return (
          <div
            key={round}
            role="listitem"
            className={`tracker-round ${status} level-${round}`}
            aria-label={`Round ${round}, ${difficulty}: ${spoken}`}
          >
            <span className="tracker-difficulty">{difficulty}</span>
            <span className="tracker-pips" aria-hidden="true">
              {DIFFICULTIES.map((_, p) => (
                <span key={p} className={p <= i ? 'on' : undefined} />
              ))}
            </span>
            <RoundPin round={round} />
            <span className="tracker-score mono" aria-hidden="true">
              {perfect && <StarIcon size={13} />}
              {done ? (score ?? '✓') : now ? 'NOW' : '–'}
            </span>
          </div>
        )
      })}

      <div className="tracker-total" aria-label={`Total ${total} points`}>
        <span className="tracker-total-label">Total</span>
        <span className="tracker-total-value display">{total}</span>
        {answered > 0 && <span className="tracker-total-max mono">/ {answered * MAX_SCORE}</span>}
      </div>
    </div>
  )
}
