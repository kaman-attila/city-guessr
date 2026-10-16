import { useState, type ReactNode } from 'react'
import MapView from './MapView'
import { getRound, submitGuess, type GuessResult, type LatLon, type Round, type Units } from './api'
import { formatDistance } from './settings'
import TopBar, { RoundDots } from './TopBar'

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

  function renderHud() {
    switch (state.phase) {
      case 'start':
        return (
          <>
            <p>Freeplay: 5 random cities, as many games as you like.</p>
            <button onClick={startGame}>Play</button> <button onClick={onExit}>Back to menu</button>
          </>
        )

      case 'loading':
        return <p>Loading…</p>

      case 'guessing':
        return (
          <>
            <p>
              Round {roundNumber}/{ROUNDS}: find <b>{state.round.name}</b>
            </p>
            <p>Click the map to place your guess</p>
            <button
              disabled={!pendingGuess}
              onClick={() => pendingGuess && guess(pendingGuess.lat, pendingGuess.lon)}
            >
              Submit guess
            </button>
          </>
        )

      case 'result': {
        const nearest = state.result.cities[state.result.closest]
        const count = state.result.cities.length
        return (
          <>
            <p>
              {formatDistance(state.result.distance_m, units)} from <b>{nearest.name}</b> (
              {nearest.country}): {state.result.score} points
            </p>
            {count > 1 && <p>{count} places have this name</p>}
            <button onClick={next}>{roundNumber < ROUNDS ? 'Next' : 'See total'}</button>
          </>
        )
      }

      case 'finished':
        return (
          <>
            <p>
              Total: <b>{total}</b> / {ROUNDS * 1000}
            </p>
            <button onClick={startGame}>Play again</button>{' '}
            <button onClick={onExit}>Back to menu</button>
          </>
        )

      case 'error':
        return (
          <>
            <p>Something went wrong: {state.message}</p>
            <button onClick={startGame}>Try again</button>{' '}
            <button onClick={onExit}>Back to menu</button>
          </>
        )
    }
  }

  const inGame = state.phase === 'guessing' || state.phase === 'result'

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
        <div className="map-card">
          <MapView
            guess={pendingGuess}
            result={state.phase === 'result' ? state.result : null}
            onMapClick={handleMapClick}
            dark={dark}
          />
          <div className="hud">{renderHud()}</div>
        </div>
      </main>
    </div>
  )
}
