import { useState, type ReactNode } from 'react'
import MapView from './MapView'
import {
  startFreeplay,
  submitFreeplayGuess,
  type GuessResult,
  type LatLon,
  type NextRound,
  type Units,
} from './api'
import TopBar from './TopBar'
import RoundTracker from './RoundTracker'
import { InfinityIcon, PlayIcon, ReplayIcon } from './icons'
import {
  CityHeading,
  MapHint,
  GuessControls,
  CenterCard,
  NewBestBadge,
  ResultPanel,
} from './GameParts'

type GameState =
  | { phase: 'start' }
  | { phase: 'loading' }
  | { phase: 'guessing'; round: NextRound }
  | { phase: 'result'; round: NextRound; result: GuessResult; next: NextRound | null }
  | { phase: 'finished' }
  | { phase: 'error'; message: string }

type Props = {
  units: Units
  dark: boolean
  account: ReactNode
  onExit: () => void
  onFinished: () => void
}

export default function Freeplay({ units, dark, account, onExit, onFinished }: Props) {
  const [state, setState] = useState<GameState>({ phase: 'start' })
  const [gameId, setGameId] = useState('')
  const [total, setTotal] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [previousBest, setPreviousBest] = useState<number | null>(null)
  const [pendingGuess, setPendingGuess] = useState<LatLon | null>(null)

  async function startGame() {
    setState({ phase: 'loading' })
    setPendingGuess(null)
    setTotal(0)
    setScores([])
    setPreviousBest(null)
    try {
      const game = await startFreeplay()
      setGameId(game.game_id)
      setState({ phase: 'guessing', round: game.next })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  async function guess(lat: number, lon: number) {
    if (state.phase !== 'guessing') return
    const round = state.round
    setState({ phase: 'loading' })
    try {
      const res = await submitFreeplayGuess(gameId, lat, lon)
      setTotal(res.total)
      setScores((s) => [...s, res.result.score])
      setPreviousBest(res.previous_best)
      setState({ phase: 'result', round, result: res.result, next: res.next })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  function next() {
    if (state.phase !== 'result') return
    if (state.next) {
      setPendingGuess(null)
      setState({ phase: 'guessing', round: state.next })
    } else {
      setPendingGuess(null)
      setState({ phase: 'finished' })
      onFinished()
    }
  }

  function handleMapClick(lat: number, lon: number) {
    if (state.phase !== 'guessing') return
    setPendingGuess({ lat, lon })
  }

  function renderOverlay() {
    switch (state.phase) {
      case 'start':
        return (
          <>
            <span className="center-card-icon">
              <InfinityIcon size={30} strokeWidth={2.2} />
            </span>
            <h2 className="display">Freeplay</h2>
            <p>5 random cities, from easy to hard. Drop your pin as close as you can.</p>
            <button className="fab" aria-label="Start" onClick={startGame}>
              <PlayIcon size={34} />
            </button>
          </>
        )

      case 'finished':
        return (
          <>
            <span className="label">Total</span>
            <div className="display total">
              {total}
              <small> / 5000</small>
            </div>
            {previousBest !== null && <NewBestBadge previous={previousBest} />}
            <button className="fab" aria-label="Play again" onClick={startGame}>
              <ReplayIcon size={32} strokeWidth={2.6} />
            </button>
          </>
        )

      case 'error':
        return (
          <>
            <h2 className="display">Oops</h2>
            <p>Something went wrong: {state.message}</p>
            <button className="btn-primary" onClick={startGame}>
              Try again
            </button>
          </>
        )
      default:
        return null
    }
  }

  const overlay = renderOverlay()
  const cityName = state.phase === 'guessing' || state.phase === 'result' ? state.round.name : null
  const showTracker =
    state.phase === 'guessing' ||
    state.phase === 'result' ||
    state.phase === 'finished' ||
    (state.phase === 'loading' && scores.length > 0)

  return (
    <div className="screen">
      <TopBar
        onHome={onExit}
        center={
          showTracker ? (
            <RoundTracker
              scores={scores}
              current={state.phase === 'guessing' ? state.round.round : null}
              total={total}
            />
          ) : null
        }
        account={account}
      />
      <main className="stage">
        <CityHeading name={cityName} />
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
              onSubmit={() => pendingGuess && guess(pendingGuess.lat, pendingGuess.lon)}
            />
          )}
          {state.phase === 'result' && (
            <ResultPanel
              result={state.result}
              units={units}
              placeName={state.round.name}
              nextLabel={state.next ? 'Next round' : 'See total'}
              onNext={next}
            />
          )}
          {overlay && <CenterCard>{overlay}</CenterCard>}
        </div>
      </main>
    </div>
  )
}
