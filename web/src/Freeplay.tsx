import { useState, type ReactNode } from 'react'
import MapView from './MapView'
import { getRound, submitGuess, type GuessResult, type LatLon, type Round, type Units } from './api'
import TopBar, { RoundDots } from './TopBar'
import { InfinityIcon, PlayIcon, ReplayIcon } from './icons'
import {
  CityHeading,
  MapHint,
  GuessControls,
  CenterCard,
  ResultLegend,
  ResultPanel,
} from './GameParts'

const ROUNDS = 5

type GameState =
  | { phase: 'start' }
  | { phase: 'loading' }
  | { phase: 'guessing'; round: Round }
  | { phase: 'result'; round: Round; result: GuessResult }
  | { phase: 'finished' }
  | { phase: 'error'; message: string }

type Props = {
  units: Units
  dark: boolean
  account: ReactNode
  onExit: () => void
  onFinished: (total: number) => void
}

export default function Freeplay({ units, dark, account, onExit, onFinished }: Props) {
  const [state, setState] = useState<GameState>({ phase: 'start' })
  const [roundNumber, setRoundNumber] = useState(1)
  const [total, setTotal] = useState(0)
  const [pendingGuess, setPendingGuess] = useState<LatLon | null>(null)

  async function startRound(n: number) {
    setState({ phase: 'loading' })
    setPendingGuess(null)
    try {
      const round = await getRound(n)
      setRoundNumber(n)
      setState({ phase: 'guessing', round })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  function startGame() {
    setTotal(0)
    startRound(1)
  }

  async function guess(lat: number, lon: number) {
    if (state.phase !== 'guessing') return
    const round = state.round
    setState({ phase: 'loading' })
    try {
      const result = await submitGuess(round.name_id, lat, lon)
      setTotal((t) => t + result.score)
      setState({ phase: 'result', round, result })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  function next() {
    if (roundNumber < ROUNDS) {
      startRound(roundNumber + 1)
    } else {
      setState({ phase: 'finished' })
      onFinished(total)
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

  const inGame = state.phase === 'guessing' || state.phase === 'result'
  const overlay = renderOverlay()
  const cityName = state.phase === 'guessing' || state.phase === 'result' ? state.round.name : null

  return (
    <div className="screen">
      <TopBar
        onHome={onExit}
        center={
          inGame ? (
            <RoundDots round={roundNumber} total={ROUNDS} answered={state.phase === 'result'} />
          ) : null
        }
        score={inGame ? total : null}
        account={account}
      />
      <main className="stage">
        <CityHeading
          kicker={state.phase === 'result' ? 'Freeplay · you found' : 'Freeplay · find'}
          name={cityName}
        />
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
            <>
              <ResultLegend sameName={state.result.cities.length > 1} />
              <ResultPanel
                result={state.result}
                units={units}
                placeName={state.round.name}
                nextLabel={'Next round'}
                onNext={next}
              />
            </>
          )}
          {overlay && <CenterCard>{overlay}</CenterCard>}
        </div>
      </main>
    </div>
  )
}
