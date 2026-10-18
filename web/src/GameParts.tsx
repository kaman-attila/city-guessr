import type { ReactNode } from 'react'
import { ArrowRightIcon, CheckIcon, CloseIcon, PinIcon, StarIcon } from './icons'
import { formatDistance } from './settings'
import { type GuessResult, type Units } from './api'
import './Game.css'

type ResultPanelProps = {
  result: GuessResult
  units: Units
  placeName: string
  nextLabel: string
  onNext: () => void
}

export function CityHeading({ name }: { name: string | null }) {
  return (
    <div className="city-heading">
      <h1 className="display city-name">{name ?? '\u00a0'}</h1>
    </div>
  )
}

/** Shown on the final score when the game beat the player's best; `previous` is the old best. */
export function NewBestBadge({ previous }: { previous: number }) {
  return (
    <div className="new-best" role="status">
      <StarIcon size={18} />
      <span>
        <strong>New personal best!</strong>
        <small>{previous === 0 ? 'Your first saved best score' : `Previous best: ${previous}`}</small>
      </span>
    </div>
  )
}

export function MapHint() {
  return (
    <div className="map-hint">
      <PinIcon size={18} className="pin-accent" />
      Tap the map to drop your pin
    </div>
  )
}

type ControlsProps = { hasPin: boolean; onClear: () => void; onSubmit: () => void }

export function GuessControls({ hasPin, onClear, onSubmit }: ControlsProps) {
  return (
    <div className="guess-controls">
      {hasPin && (
        <button className="icon-btn icon-btn-lg" aria-label="Remove pin" onClick={onClear}>
          <CloseIcon strokeWidth={2.4} />
        </button>
      )}
      <button
        className="fab"
        aria-label={hasPin ? 'Submit guess' : 'Submit guess (drop a pin first)'}
        disabled={!hasPin}
        onClick={onSubmit}
      >
        <CheckIcon size={34} strokeWidth={3} />
      </button>
    </div>
  )
}

export function CenterCard({ children }: { children: ReactNode }) {
  return (
    <div className="center-card-backdrop">
      <div className="center-card">{children}</div>
    </div>
  )
}

export function ResultPanel({ result, units, placeName, nextLabel, onNext }: ResultPanelProps) {
  const nearest = result.cities[result.closest]
  const count = result.cities.length

  return (
    <div className="result-panel">
      <div className="result-top">
        <div>
          <div className="display result-points">+{result.score}</div>
          <div className="label result-points-label">Points this round</div>
        </div>
        <button className="fab fab-sm" aria-label={nextLabel} onClick={onNext}>
          <ArrowRightIcon size={28} strokeWidth={2.8} />
        </button>
      </div>

      <div className="meter result-meter">
        <div style={{ width: `${result.score / 10}%` }} />
      </div>

      <div className="result-distance">
        <span className="mono">{formatDistance(result.distance_m, units)}</span>
        <span>
          from {nearest.name}, {nearest.country}
        </span>
      </div>

      {count > 1 && (
        <div className="result-note">
          <span className="legend-dot other" aria-hidden="true" />
          <span>
            {count} places are called {placeName}. The nearest one counts.
          </span>
        </div>
      )}
    </div>
  )
}
