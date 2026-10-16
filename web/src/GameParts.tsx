import type { ReactNode } from 'react'
import { CheckIcon, CloseIcon, PinIcon } from './icons'
import './Game.css'

export function CityHeading({ kicker, name }: { kicker: string; name: string | null }) {
  return (
    <div className="city-heading">
      <span className="label">{kicker}</span>
      <h1 className="display city-name">{name ?? '\u00a0'}</h1>
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
