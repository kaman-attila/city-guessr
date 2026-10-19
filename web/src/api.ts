export type LatLon = { lat: number; lon: number }

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

export type NextRound = { round: number; name: string }

export type PlayedRound = { name: string; score: number | null }

export type DailyState = {
  date: string
  total: number
  history: PlayedRound[]
  next: NextRound | null
}

export type FreeplayStart = { game_id: string; next: NextRound }

export type RoundGuessResult = {
  result: GuessResult
  total: number
  next: NextRound | null
  previous_best: number | null
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
  email_verified: boolean
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

export function startFreeplay(): Promise<FreeplayStart> {
  return request<FreeplayStart>('/api/freeplay', { method: 'POST' })
}

export function submitFreeplayGuess(
  gameId: string,
  lat: number,
  lon: number,
): Promise<RoundGuessResult> {
  return request<RoundGuessResult>('/api/freeplay/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, lat, lon }),
  })
}

export function startDaily(): Promise<DailyState> {
  return request<DailyState>('/api/daily', { method: 'POST' })
}

export function submitDailyGuess(
  date: string,
  lat: number,
  lon: number,
): Promise<RoundGuessResult> {
  return request<RoundGuessResult>('/api/daily/guess', {
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

export function deleteAccount(password: string) {
  return sendJson<{ ok: boolean }>('/api/me', { password }, 'DELETE')
}

export function updateSettings(change: Partial<Pick<Profile, 'theme' | 'units'>>) {
  return sendJson<Profile>('/api/me/settings', change, 'PATCH')
}

export function resendVerification() {
  return sendJson<{ ok: boolean }>('/api/me/verification-email', {})
}

export function verifyEmail(token: string) {
  return sendJson<{ ok: boolean }>('/api/verify-email', { token })
}

export function forgotPassword(email: string) {
  return sendJson<{ ok: boolean }>('/api/forgot-password', { email })
}

export function resetPassword(token: string, password: string) {
  return sendJson<{ email: string }>('/api/reset-password', { token, password })
}
