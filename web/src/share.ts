function roundEmoji(score: number | null): string {
  if (score === null) return '⬜'
  if (score >= 1000) return '🎯'
  if (score >= 750) return '🟩'
  if (score >= 400) return '🟨'
  if (score >= 100) return '🟧'
  return '🟥'
}

export function dailyShareText(
  date: string,
  number: number,
  total: number,
  scores: (number | null)[],
  siteUrl: string,
): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const squares = scores.map(roundEmoji).join('')
  return `PinTheCity Daily #${number} · ${day}\n${squares} ${total} / 5000\n${siteUrl}`
}

export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
