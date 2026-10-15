// The projection arithmetic behind the page, kept apart from the React component so it can be tested.
//
//   Projected = YTD + (current period x remaining pay periods)
//   Projected federal wages = projected gross income - projected expenses that reduce federal wages

export type AmountLine = { period: string; ytd: string }
export type Totals = { period: number; ytd: number; proj: number }

// Amounts are typed as text. Commas are allowed; anything that is not a number counts as 0.
export const parseAmount = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

// A typed override replaces the calculated count (whole periods only); blank means use the calculated one.
export const periodsToProject = (override: string, calculated: number) =>
  override.trim() !== '' ? Math.floor(parseAmount(override)) : calculated

export const projectLine = (l: AmountLine, remaining: number) =>
  parseAmount(l.ytd) + parseAmount(l.period) * remaining

export const sumLines = (items: AmountLine[], remaining: number): Totals =>
  items.reduce(
    (t, l) => ({
      period: t.period + parseAmount(l.period),
      ytd: t.ytd + parseAmount(l.ytd),
      proj: t.proj + projectLine(l, remaining),
    }),
    { period: 0, ytd: 0, proj: 0 },
  )

export const subtractTotals = (a: Totals, b: Totals): Totals => ({
  period: a.period - b.period,
  ytd: a.ytd - b.ytd,
  proj: a.proj - b.proj,
})
