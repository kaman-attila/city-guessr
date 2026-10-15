import { useState } from 'react'
import MapView from './MapView'
import { getRound, submitGuess, type Round, type GuessResult } from './api'

const ROUNDS = 5

type GameState =
  | { phase: 'start' }
  | { phase: 'loading' }
  | { phase: 'guessing'; round: Round }
  | { phase: 'result'; round: Round; result: GuessResult }
  | { phase: 'finished' }
  | { phase: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<GameState>({ phase: 'start' })
  const [roundNumber, setRoundNumber] = useState(1)
  const [total, setTotal] = useState(0)

  async function startRound(n: number) {
    setState({ phase: 'loading' })
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
    }
  }

  function renderHud() {
    switch (state.phase) {
      case 'start':
        return <button onClick={startGame}>Play</button>

      case 'loading':
        return <p>Loading…</p>

      case 'guessing':
        return (
          <>
            <p>
              Round {roundNumber}/{ROUNDS}: find <b>{state.round.name}</b>
            </p>
            <button onClick={() => guess(47.4979, 19.0402)}>Test guess: Budapest</button>
          </>
        )

      case 'result':
        return (
          <>
            <p>
              {(state.result.distance_m / 1000).toFixed(1)} km from <b>{state.round.name}</b>:{' '}
              {state.result.score} points
            </p>
            <button onClick={next}>{roundNumber < ROUNDS ? 'Next' : 'See total'}</button>
          </>
        )

      case 'finished':
        return (
          <>
            <p>
              Total: <b>{total}</b> / {ROUNDS * 1000}
            </p>
            <button onClick={startGame}>Play again</button>
          </>
        )

      case 'error':
        return (
          <>
            <p>Something went wrong: {state.message}</p>
            <button onClick={startGame}>Try again</button>
          </>
        )
    }
  }

  return (
    <>
      <MapView />
      <div className="hud">{renderHud()}</div>
    </>
  )
}