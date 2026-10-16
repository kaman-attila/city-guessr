import { useState } from 'react'
import MapView from './MapView'
import HistogramChart from './HistogramChart'
import {
  getHistogram,
  startDaily,
  submitDailyGuess,
  type DailyRound,
  type GuessResult,
  type Histogram,
  type LatLon,
  type Units,
} from './api'
import { formatDistance } from './settings'

type DailyGameState =
  | { phase: 'intro' }
  | { phase: 'loading' }
  | { phase: 'guessing'; round: DailyRound }
  | { phase: 'result'; round: DailyRound; result: GuessResult; next: DailyRound | null }
  | { phase: 'finished'; histogram: Histogram }
  | { phase: 'error'; message: string }

type Props = {
  units: Units
  dark: boolean
  onExit: () => void
  onFinished: () => void
}

export default function Daily({ units, dark, onExit, onFinished }: Props) {
  const [state, setState] = useState<DailyGameState>({ phase: 'intro' })
  const [date, setDate] = useState('')
  const [total, setTotal] = useState(0)
  const [pendingGuess, setPendingGuess] = useState<LatLon | null>(null)

  function fail(err: unknown) {
    setState({ phase: 'error', message: (err as Error).message })
  }

  async function showFinished(day: string) {
    setState({ phase: 'loading' })
    try {
      setState({ phase: 'finished', histogram: await getHistogram(day) })
    } catch (err) {
      fail(err)
    }
  }

  async function begin() {
    setState({ phase: 'loading' })
    try {
      const s = await startDaily()
      setDate(s.date)
      setTotal(s.total)
      if (s.next) {
        setPendingGuess(null)
        setState({ phase: 'guessing', round: s.next })
      } else {
        await showFinished(s.date)
      }
    } catch (err) {
      fail(err)
    }
  }

  async function submit() {
    if (state.phase !== 'guessing' || !pendingGuess) return
    const round = state.round
    setState({ phase: 'loading' })
    try {
      const res = await submitDailyGuess(date, pendingGuess.lat, pendingGuess.lon)
      setTotal(res.total)
      setState({ phase: 'result', round, result: res.result, next: res.next })
    } catch (err) {
      fail(err)
    }
  }

  function next() {
    if (state.phase !== 'result') return
    if (state.next) {
      setPendingGuess(null)
      setState({ phase: 'guessing', round: state.next })
    } else {
      showFinished(date)
      onFinished()
    }
  }

  function handleMapClick(lat: number, lon: number) {
    if (state.phase !== 'guessing') return
    setPendingGuess({ lat, lon })
  }

  function renderHud() {
    switch (state.phase) {
      case 'intro':
        return (
          <>
            <p>Today's challenge: 5 cities, the same for everyone, one try per day.</p>
            <button onClick={begin}>Start</button> <button onClick={onExit}>Back</button>
          </>
        )
      case 'loading':
        return <p>Loading…</p>
      case 'guessing':
        return (
          <>
            <p>
              Daily, round {state.round.round}/5: find <b>{state.round.name}</b>
            </p>
            <p>Score so far: {total}</p>
            <button disabled={!pendingGuess} onClick={submit}>
              Submit guess
            </button>
          </>
        )
      case 'result': {
        const nearest = state.result.cities[state.result.closest]
        return (
          <>
            <p>
              {formatDistance(state.result.distance_m, units)} from <b>{nearest.name}</b> (
              {nearest.country}): {state.result.score} points
            </p>
            <button onClick={next}>{state.next ? 'Next' : 'See results'}</button>
          </>
        )
      }
      case 'finished': {
        const h = state.histogram
        return (
          <>
            <p>
              Your score: <b>{total}</b> / 5000
            </p>
            <HistogramChart data={h} />
            {h.better_than_percent !== null && (
              <p>
                Better than {h.better_than_percent}% of {h.players} players
              </p>
            )}
            <button onClick={onExit}>Back to menu</button>
          </>
        )
      }
      case 'error':
        return (
          <>
            <p>Something went wrong: {state.message}</p>
            <button onClick={begin}>Try again</button> <button onClick={onExit}>Back</button>
          </>
        )
    }
  }

  return (
    <>
      <MapView
        guess={pendingGuess}
        result={state.phase === 'result' ? state.result : null}
        onMapClick={handleMapClick}
        dark={dark}
      />
      <div className="hud">{renderHud()}</div>
    </>
  )
}
