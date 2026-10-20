export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

export function getCountdownValues(totalSeconds: number, units: readonly CountdownUnit[]) {
  const hasDays = units.includes('days')
  const hasHours = units.includes('hours')
  const hasMinutes = units.includes('minutes')

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor(totalSeconds / 3_600) % (hasDays ? 24 : Number.MAX_SAFE_INTEGER),
    minutes: Math.floor(totalSeconds / 60) % (hasHours ? 60 : hasDays ? 1_440 : Number.MAX_SAFE_INTEGER),
    seconds: totalSeconds % (hasMinutes ? 60 : hasHours ? 3_600 : hasDays ? 86_400 : Number.MAX_SAFE_INTEGER)
  }
}
