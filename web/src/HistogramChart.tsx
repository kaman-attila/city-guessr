import { type Histogram } from './api'

const LABELS = [0, 1000, 2000, 3000, 4000, 5000]
const GAP = 5

export default function HistogramChart({ data }: { data: Histogram }) {
  const max = Math.max(1, ...data.counts)
  const buckets = data.counts.length
  const step = data.bucket_starts[1] - data.bucket_starts[0]
  const summary =
    data.better_than_percent !== null
      ? `Your score is better than ${data.better_than_percent}% of ${data.players} players.`
      : `${data.players} players so far.`

  return (
    <div className="hist">
      <div className="hist-bars" role="img" aria-label={`Histogram of today's scores. ${summary}`}>
        {data.counts.map((count, i) => (
          <div key={i} className="hist-col">
            {i === data.your_bucket && <span className="hist-you">You</span>}
            <div
              className={i === data.your_bucket ? 'hist-bar you' : 'hist-bar'}
              style={{ height: `${(count / max) * 150}px`, animationDelay: `${i * 25}ms` }}
              title={`${data.bucket_starts[i]}–${data.bucket_starts[i] + step} points: ${count} players`}
            />
          </div>
        ))}
      </div>
      <div className="hist-axis" aria-hidden="true">
        {LABELS.map((value) => {
          const k = value / step
          return (
            <span
              key={value}
              style={{ left: `calc((100% + ${GAP}px) * ${k} / ${buckets} - ${GAP / 2}px)` }}
            >
              {value / 1000}k
            </span>
          )
        })}
      </div>
    </div>
  )
}
