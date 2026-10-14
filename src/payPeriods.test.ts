import { describe, expect, it } from 'vitest'
import { remainingPayPeriods } from './payPeriods'

describe('remainingPayPeriods', () => {
  it('returns 0 for a date it cannot read', () => {
    expect(remainingPayPeriods('', 'weekly')).toBe(0)
    expect(remainingPayPeriods('not-a-date', 'monthly')).toBe(0)
  })

  it('counts a full year of periods from the first of January', () => {
    expect(remainingPayPeriods('2025-01-01', 'weekly')).toBe(52)
    expect(remainingPayPeriods('2025-01-01', 'biweekly')).toBe(26)
    expect(remainingPayPeriods('2025-01-01', 'semimonthly')).toBe(24)
    expect(remainingPayPeriods('2025-01-01', 'monthly')).toBe(11)
  })

  it('counts nothing after the last pay date of the year', () => {
    expect(remainingPayPeriods('2025-12-31', 'weekly')).toBe(0)
    expect(remainingPayPeriods('2025-12-31', 'biweekly')).toBe(0)
    expect(remainingPayPeriods('2025-12-31', 'semimonthly')).toBe(0)
    expect(remainingPayPeriods('2025-12-31', 'monthly')).toBe(0)
  })

  it('counts exactly one week after a pay date seven days before year end', () => {
    expect(remainingPayPeriods('2025-12-24', 'weekly')).toBe(1)
    expect(remainingPayPeriods('2025-12-23', 'weekly')).toBe(1)
    expect(remainingPayPeriods('2025-12-25', 'weekly')).toBe(0)
  })

  it('counts the remaining months after the pay date for monthly pay', () => {
    expect(remainingPayPeriods('2025-06-30', 'monthly')).toBe(6)
    expect(remainingPayPeriods('2025-12-15', 'monthly')).toBe(0)
  })

  it('treats the 15th and the last day of the month as semi-monthly pay days', () => {
    expect(remainingPayPeriods('2025-01-10', 'semimonthly')).toBe(24)
    expect(remainingPayPeriods('2025-01-15', 'semimonthly')).toBe(23)
    expect(remainingPayPeriods('2025-01-31', 'semimonthly')).toBe(22)
    expect(remainingPayPeriods('2025-12-15', 'semimonthly')).toBe(1)
  })

  it('handles the last day of a short month and a leap year', () => {
    expect(remainingPayPeriods('2025-02-28', 'semimonthly')).toBe(20)
    expect(remainingPayPeriods('2024-02-29', 'semimonthly')).toBe(20)
    expect(remainingPayPeriods('2024-01-01', 'weekly')).toBe(52)
  })
})
