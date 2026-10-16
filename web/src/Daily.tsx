import { useState, type ReactNode } from 'react'
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
import TopBar, { RoundDots } from './TopBar'
import { CityHeading, CenterCard, GuessControls, MapHint } from './GameParts'
import { CalendarIcon, HomeIcon, PlayIcon } from './icons'

const ROUNDS = 5

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
  account: ReactNode
  onExit: () => void
  onFinished: () => void
}

export default function Daily({ units, dark, account, onExit, onFinished }: Props) {
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

  function renderOverlay() {
    switch (state.phase) {
      case 'intro':
        return (
          <>
            <span className="center-card-icon daily">
              <CalendarIcon size={28} strokeWidth={2.2} />
            </span>
            <h2 className="display">Daily challenge</h2>
            <p>Today's 5 cities, the same for everyone. One try.</p>
            <button className="fab" aria-label="Start today's challenge" onClick={begin}>
              <PlayIcon size={34} />
            </button>
          </>
        )

      case 'finished': {
        const h = state.histogram
        return (
          <>
            <span className="label">Your score</span>
            <div className="display total">
              {total}
              <small> / 5000</small>
            </div>
            <HistogramChart data={h} />
            {h.better_than_percent !== null && (
              <p>
                Better than {h.better_than_percent}% of {h.players} players
              </p>
            )}
            <button className="fab" aria-label="Back to menu" onClick={onExit}>
              <HomeIcon size={30} strokeWidth={2.4} />
            </button>
          </>
        )
      }

      case 'error':
        return (
          <>
            <h2 className="display">Oops</h2>
            <p>Something went wrong: {state.message}</p>
            <button className="btn-primary" onClick={begin}>
              Try again
            </button>
          </>
        )

      default:
        return null
    }
  }

  const overlay = renderOverlay()
  const round = state.phase === 'guessing' || state.phase === 'result' ? state.round : null

  return (
    <div className="screen">
      <TopBar
        onHome={onExit}
        center={
          round !== null ? (
            <RoundDots round={round.round} total={ROUNDS} answered={state.phase === 'result'} />
          ) : null
        }
        score={round !== null ? total : null}
        account={account}
      />
      <main className="stage">
        <CityHeading
          kicker={state.phase === 'result' ? 'Daily · you found' : 'Daily · find'}
          name={round !== null ? round.name : null}
        />
        <div className="map-card">
          <MapView
            guess={pendingGuess}
            result={state.phase === 'result' ? state.result : null}
            onMapClick={handleMapClick}
            dark={dark}
          />
          {state.phase === 'guessing' && !pendingGuess && <MapHint />}
          {state.phase === 'guessing' && (
            <GuessControls
              hasPin={pendingGuess !== null}
              onClear={() => setPendingGuess(null)}
              onSubmit={submit}
            />
          )}
          {state.phase === 'result' && (
            <div className="hud">
              <p>
                {formatDistance(state.result.distance_m, units)} from{' '}
                <b>{state.result.cities[state.result.closest].name}</b> (
                {state.result.cities[state.result.closest].country}): {state.result.score} points
              </p>
              <button onClick={next}>{state.next ? 'Next' : 'See results'}</button>
            </div>
          )}
          {overlay && <CenterCard>{overlay}</CenterCard>}
        </div>
      </main>
    </div>
  )
}
