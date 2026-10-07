export type Frequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly (52)' },
  { value: 'biweekly', label: 'Bi-weekly (26)' },
  { value: 'semimonthly', label: 'Semi-monthly (24)' },
  { value: 'monthly', label: 'Monthly (12)' },
]

function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

const DAY_MS = 86_400_000

/** Pay periods remaining in the year AFTER the given pay date. */
export function remainingPayPeriods(payDate: string, freq: Frequency): number {
  const d = parseDate(payDate)
  if (!d) return 0
  const yearEnd = new Date(d.getFullYear(), 11, 31)
  const daysLeft = Math.round((yearEnd.getTime() - d.getTime()) / DAY_MS)

  switch (freq) {
    case 'weekly':
      return Math.floor(daysLeft / 7)
    case 'biweekly':
      return Math.floor(daysLeft / 14)
    case 'monthly':
      return 11 - d.getMonth()
    case 'semimonthly': {
      // Pay days are the 15th and the last day of each month.
      const monthsAfter = 11 - d.getMonth()
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      let n = monthsAfter * 2
      if (d.getDate() < 15) n += 2
      else if (d.getDate() < lastDay) n += 1
      return n
    }
  }
}
