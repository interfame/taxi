// Utilidades de fechas en zona horaria America/Buenos_Aires (UTC-3, sin DST)

const ART_OFFSET_HOURS = -3

/** Comienzo del día "hoy" en Buenos Aires, como Date UTC. */
export function startOfTodayART(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + ART_OFFSET_HOURS * 3600 * 1000)
  const startArt = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  return new Date(startArt - ART_OFFSET_HOURS * 3600 * 1000)
}

/** Comienzo del día (en ART) correspondiente a hace `daysAgo` días. */
export function startOfDayDaysAgoART(daysAgo: number, now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + ART_OFFSET_HOURS * 3600 * 1000)
  const startArt = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysAgo)
  return new Date(startArt - ART_OFFSET_HOURS * 3600 * 1000)
}

/** Etiqueta corta tipo "lun 10/6" para los últimos 7 días. */
export function shortDayLabel(date: Date): string {
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const shifted = new Date(date.getTime() + ART_OFFSET_HOURS * 3600 * 1000)
  return `${dias[shifted.getUTCDay()]} ${shifted.getUTCDate()}/${shifted.getUTCMonth() + 1}`
}
