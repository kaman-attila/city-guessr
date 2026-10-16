export type LatLon = { lat: number; lon: number }

export type Round = {
  round: number
  name_id: number
  name: string
}

export type City = {
  name: string
  country: string
  lat: number
  lon: number
}

export type GuessResult = {
  distance_m: number
  score: number
  closest: number
  cities: City[]
}

export type DailyRound = { round: number; name: string }

export type DailyState = { date: string; total: number; next: DailyRound | null }

export type DailyGuessResult = {
  result: GuessResult
  total: number
  next: DailyRound | null
}

export type Histogram = {
  date: string
  bucket_starts: number[]
  counts: number[]
  players: number
  your_score: number | null
  your_bucket: number | null
  better_than_percent: number | null
}

export type Theme = 'system' | 'light' | 'dark'
export type Units = 'metric' | 'imperial'

export type Profile = {
  email: string
  best_score: number
  theme: Theme
  units: Units
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getRound(n: number): Promise<Round> {
  return request<Round>(`/api/freeplay/round/${n}`)
}

export function submitGuess(nameId: number, lat: number, lon: number): Promise<GuessResult> {
  return request<GuessResult>('/api/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name_id: nameId, lat, lon }),
  })
}

export function startDaily(): Promise<DailyState> {
  return request<DailyState>('/api/daily', { method: 'POST' })
}

export function submitDailyGuess(
  date: string,
  lat: number,
  lon: number,
): Promise<DailyGuessResult> {
  return request<DailyGuessResult>('/api/daily/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, lat, lon }),
  })
}

export function getHistogram(date: string): Promise<Histogram> {
  return request<Histogram>(`/api/daily/histogram/${date}`)
}

function sendJson<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  return request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function register(email: string, password: string) {
  return sendJson<{ email: string }>('/api/register', { email, password })
}

export function login(email: string, password: string) {
  return sendJson<{ email: string }>('/api/login', { email, password })
}

export function logout() {
  return sendJson<{ ok: boolean }>('/api/logout', {})
}

export async function getMe(): Promise<Profile | null> {
  const res = await fetch('/api/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function updateSettings(change: Partial<Pick<Profile, 'theme' | 'units'>>) {
  return sendJson<Profile>('/api/me/settings', change, 'PATCH')
}

export function submitFreeplayScore(score: number) {
  return sendJson<Profile>('/api/me/freeplay-score', { score })
}
