import { describe, expect, it } from 'vitest'
import { parseAmount, periodsToProject, projectLine, subtractTotals, sumLines } from './projection'

const line = (period: string, ytd: string) => ({ period, ytd })

describe('parseAmount', () => {
  it('reads plain, decimal and comma-separated amounts', () => {
    expect(parseAmount('2500')).toBe(2500)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('1,234,567')).toBe(1234567)
  })

  it('counts anything that is not a number as 0, so a half-typed field cannot break the totals', () => {
    for (const text of ['', ' ', '-', 'abc', '$', '.']) expect(parseAmount(text)).toBe(0)
  })

  it('keeps a negative amount, such as a correction or refund', () => {
    expect(parseAmount('-150.25')).toBe(-150.25)
  })
})

describe('periodsToProject', () => {
  it('uses the calculated count when the override is blank', () => {
    expect(periodsToProject('', 12)).toBe(12)
    expect(periodsToProject('   ', 12)).toBe(12)
  })

  it('uses a typed override instead, in whole periods', () => {
    expect(periodsToProject('10', 12)).toBe(10)
    expect(periodsToProject('9.9', 12)).toBe(9)
    expect(periodsToProject('0', 12)).toBe(0)
  })
})

describe('projectLine', () => {
  it('is year-to-date plus the current period for each remaining period', () => {
    // paid 5,000 a period, 20,000 so far, 22 periods to go
    expect(projectLine(line('5000', '20000'), 22)).toBe(20000 + 5000 * 22)
  })

  it('is just the year-to-date amount when no periods remain', () => {
    expect(projectLine(line('5000', '125000'), 0)).toBe(125000)
  })

  it('treats a blank field as zero', () => {
    expect(projectLine(line('', '1000'), 5)).toBe(1000)
    expect(projectLine(line('200', ''), 5)).toBe(1000)
  })
})

describe('sumLines', () => {
  it('adds the current period, year-to-date and projected amounts across lines', () => {
    const totals = sumLines([line('1000', '4000'), line('500', '2000'), line('', '')], 3)
    expect(totals).toEqual({ period: 1500, ytd: 6000, proj: 4000 + 1000 * 3 + 2000 + 500 * 3 })
  })

  it('is all zeros for no lines', () => {
    expect(sumLines([], 10)).toEqual({ period: 0, ytd: 0, proj: 0 })
  })
})

describe('projected federal wages', () => {
  // Gross income less the expenses that reduce federal wages, as the page computes it.
  it('is projected gross minus the projected flagged expenses, and ignores unflagged ones', () => {
    const remaining = 20
    const gross = sumLines([line('4000', '24000')], remaining) // 24,000 + 80,000
    const reducing = sumLines([line('300', '1800')], remaining) // 1,800 + 6,000
    const fedWages = subtractTotals(gross, reducing)
    expect(gross.proj).toBe(104000)
    expect(fedWages).toEqual({ period: 3700, ytd: 22200, proj: 96200 })
  })

  it('subtracts every column independently', () => {
    const a = { period: 10, ytd: 100, proj: 1000 }
    const b = { period: 1, ytd: 20, proj: 300 }
    expect(subtractTotals(a, b)).toEqual({ period: 9, ytd: 80, proj: 700 })
    expect(subtractTotals(a, { period: 0, ytd: 0, proj: 0 })).toEqual(a)
  })
})
