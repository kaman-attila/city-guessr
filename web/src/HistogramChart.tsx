import { type Histogram } from './api'

export default function HistogramChart({ data }: { data: Histogram }) {
  const max = Math.max(1, ...data.counts)
  return (
    <div className="histogram">
      {data.counts.map((count, i) => (
        <div
          key={i}
          className={i === data.your_bucket ? 'bar you' : 'bar'}
          style={{ height: `${(count / max) * 100}%` }}
          title={`${data.bucket_starts[i]}+ points: ${count} players`}
        />
      ))}
    </div>
  )
}