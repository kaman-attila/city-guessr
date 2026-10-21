import { useEffect, useRef, useState, type ReactNode } from 'react'
import MapView from './MapView'
import DailyResults, { type RoundScore } from './DailyResults'
import {
  getHistogram,
  replayDaily,
  startDaily,
  submitDailyGuess,
  type DailyDay,
  type DailyState,
  type GuessResult,
  type Histogram,
  type LatLon,
  type NextRound,
  type Units,
} from './api'
import TopBar from './TopBar'
import RoundTracker from './RoundTracker'
import { CityHeading, MapHint, GuessControls, CenterCard, ResultPanel } from './GameParts'
import { CalendarIcon, PlayIcon } from './icons'

const ROUNDS = 5

type DailyGameState =
  | { phase: 'checking' }
  | { phase: 'intro' }
  | { phase: 'loading' }
  | { phase: 'guessing'; round: NextRound }
  | { phase: 'result'; round: NextRound; result: GuessResult; next: NextRound | null }
  | { phase: 'finished'; histogram: Histogram }
  | { phase: 'error'; message: string }

type Props = {
  day: DailyDay | null
  units: Units
  dark: boolean
  signedIn: boolean
  admin: boolean
  account: ReactNode
  onExit: () => void
  onFinished: () => void
  onFreeplay: () => void
  onArchive: () => void
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Daily({
  day,
  units,
  dark,
  signedIn,
  admin,
  account,
  onExit,
  onFinished,
  onFreeplay,
  onArchive,
}: Props) {
  const [state, setState] = useState<DailyGameState>({ phase: 'checking' })
  const [date, setDate] = useState(day?.date ?? '')
  const [number, setNumber] = useState(day?.number ?? 0)
  const [total, setTotal] = useState(0)
  const [pendingGuess, setPendingGuess] = useState<LatLon | null>(null)
  const [rounds, setRounds] = useState<RoundScore[]>([])
  const [previousBest, setPreviousBest] = useState<number | null>(null)
  const [wasSignedIn, setWasSignedIn] = useState(signedIn)

  if (signedIn !== wasSignedIn) {
    setWasSignedIn(signedIn)
    if (!signedIn) {
      setState({ phase: 'intro' })
      setTotal(0)
      setPendingGuess(null)
      setRounds([])
      setPreviousBest(null)
    }
  }

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

  function applyStart(s: DailyState) {
    setDate(s.date)
    setNumber(s.number)
    setTotal(s.total)
    setRounds(s.history)
    setPendingGuess(null)
  }

  async function replay() {
    setState({ phase: 'loading' })
    try {
      await replayDaily(date)
      setPreviousBest(null)
      await begin()
    } catch (err) {
      fail(err)
    }
  }

  async function begin() {
    setState({ phase: 'loading' })
    try {
      const s = await startDaily(day?.date)
      applyStart(s)
      if (s.next) {
        setState({ phase: 'guessing', round: s.next })
      } else {
        await showFinished(s.date)
      }
    } catch (err) {
      fail(err)
    }
  }

  async function check() {
    try {
      const s = await startDaily(day?.date)
      applyStart(s)
      if (!s.next) {
        setState({ phase: 'finished', histogram: await getHistogram(s.date) })
      } else if (!day && s.history.length === 0) {
        setState({ phase: 'intro' })
      } else {
        setState({ phase: 'guessing', round: s.next })
      }
    } catch (err) {
      fail(err)
    }
  }

  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    check()
  })

  async function submit() {
    if (state.phase !== 'guessing' || !pendingGuess) return
    const round = state.round
    setState({ phase: 'loading' })
    try {
      const res = await submitDailyGuess(date, pendingGuess.lat, pendingGuess.lon)
      setTotal(res.total)
      setRounds((r) => [...r, { name: round.name, score: res.result.score }])
      setPreviousBest(res.previous_best)
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
            <h2 className="display">{day ? `Daily #${day.number}` : 'Daily challenge'}</h2>
            <p>
              {day && day.date !== utcToday()
                ? 'The 5 cities everyone got that day. One try.'
                : "Today's 5 cities, the same for everyone. One try."}
            </p>
            <button
              className="fab"
              aria-label={day ? `Start daily #${day.number}` : "Start today's challenge"}
              onClick={begin}
            >
              <PlayIcon size={34} />
            </button>
          </>
        )

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
  const showTracker = round !== null || (state.phase === 'loading' && rounds.length > 0)

  return (
    <div className="screen">
      <TopBar
        onHome={onExit}
        center={
          showTracker ? (
            <RoundTracker
              scores={rounds.map((r) => r.score)}
              current={state.phase === 'guessing' ? state.round.round : null}
              total={total}
            />
          ) : null
        }
        account={account}
      />
      {state.phase === 'finished' ? (
        <DailyResults
          date={date}
          number={number}
          isToday={date === utcToday()}
          total={total}
          histogram={state.histogram}
          rounds={rounds.length === ROUNDS ? rounds : null}
          previousBest={previousBest}
          onFreeplay={onFreeplay}
          onArchive={onArchive}
          onReplay={admin ? replay : undefined}
        />
      ) : state.phase === 'checking' ? (
        <main className="stage" aria-busy="true" />
      ) : (
        <main className="stage">
          <CityHeading name={round !== null ? round.name : null} />
          <div className="map-card">
            <MapView
              guess={pendingGuess}
              result={state.phase === 'result' ? state.result : null}
              onMapClick={handleMapClick}
              dark={dark}
              units={units}
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
              <ResultPanel
                result={state.result}
                units={units}
                placeName={state.round.name}
                nextLabel={state.next ? 'Next round' : 'See results'}
                onNext={next}
              />
            )}
            {overlay && <CenterCard>{overlay}</CenterCard>}
          </div>
        </main>
      )}
    </div>
  )
}
