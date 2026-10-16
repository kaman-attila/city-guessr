import type { Theme, Units } from './api'

export type Settings = { theme: Theme; units: Units }

const KEY = 'cityguessr-settings'
const DEFAULTS: Settings = { theme: 'system', units: 'metric' }

export function loadLocalSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveLocalSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch (err) {
    console.warn('could not save settings', err)
  }
}

export function isDark(theme: Theme): boolean {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches
  return theme === 'dark'
}

export function formatDistance(meters: number, units: Units): string {
  if (units === 'metric') {
    if (meters < 1000) return `${Math.round(meters)} m`
    return `${(meters / 1000).toFixed(1)} km`
  }

  const miles = meters / 1609.344
  if (miles < 0.2) return `${Math.round(meters * 3.28084)} ft`
  return `${miles.toFixed(1)} mi`
}
