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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name_id: nameId, lat, lon })
  })
}