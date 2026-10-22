export type Region = 'world' | 'EU' | 'AS' | 'AF' | 'NA' | 'SA' | 'OC'

export type GameOptions = { region: Region; level: number | null }

export const REGIONS: { value: Region; label: string }[] = [
  { value: 'world', label: 'World' },
  { value: 'EU', label: 'Europe' },
  { value: 'AS', label: 'Asia' },
  { value: 'AF', label: 'Africa' },
  { value: 'NA', label: 'North America' },
  { value: 'SA', label: 'South America' },
  { value: 'OC', label: 'Oceania' },
]

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert', 'Impossible']

export const DEFAULT_OPTIONS: GameOptions = { region: 'world', level: null }

export function regionLabel(region: string): string {
  return REGIONS.find((r) => r.value === region)?.label ?? region
}

export function describeOptions({ region, level }: GameOptions): string {
  if (level === null) return regionLabel(region)
  return `${regionLabel(region)} · ${DIFFICULTIES[level - 1]}`
}

export function bestKind({ region, level }: GameOptions): 'best' | 'region' | 'none' {
  if (level !== null) return 'none'
  return region === 'world' ? 'best' : 'region'
}
