import { useEffect, useState } from 'react'
import { FREQUENCIES, remainingPayPeriods, type Frequency } from './payPeriods'
import { downloadExcel } from './exportExcel'

type Line = { id: number; desc: string; period: string; ytd: string }
type Expense = Line & { fed: boolean }
type Key = 'income' | 'deductions' | 'expenses'
type State = {
  payDate: string
  frequency: Frequency
  periodsOverride: string
  nextId: number
  income: Line[]
  deductions: Line[]
  expenses: Expense[]
}
type Totals = { period: number; ytd: number; proj: number }

const STORAGE_KEY = 'tax-projection-v1'
const DEFAULT_DEDUCTIONS = ['Federal', 'Social Security', 'Medicare', 'State', 'Local']

const today = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const line = (id: number, desc = ''): Line => ({ id, desc, period: '', ytd: '' })

const initialState = (): State => ({
  payDate: today(),
  frequency: 'biweekly',
  periodsOverride: '',
  nextId: 20,
  income: [line(1, 'Regular')],
  deductions: DEFAULT_DEDUCTIONS.map((d, i) => line(2 + i, d)),
  expenses: [],
})

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initialState(), ...JSON.parse(raw) }
  } catch {
    // corrupt or unavailable storage: start fresh
  }
  return initialState()
}

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

const money = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const sub = (a: Totals, b: Totals): Totals => ({
  period: a.period - b.period,
  ytd: a.ytd - b.ytd,
  proj: a.proj - b.proj,
})

export default function App() {
  const [s, setS] = useState<State>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      // ignore
    }
  }, [s])

  const calculated = remainingPayPeriods(s.payDate, s.frequency)
  const overridden = s.periodsOverride.trim() !== ''
  const remaining = overridden ? Math.floor(num(s.periodsOverride)) : calculated

  // Projected = YTD + (current period * remaining pay periods)
  const proj = (l: Line) => num(l.ytd) + num(l.period) * remaining

  const sum = (items: Line[]): Totals =>
    items.reduce(
      (t, l) => ({ period: t.period + num(l.period), ytd: t.ytd + num(l.ytd), proj: t.proj + proj(l) }),
      { period: 0, ytd: 0, proj: 0 },
    )

  const gross = sum(s.income)
  const withheld = sum(s.deductions)
  const expenseTotal = sum(s.expenses)
  const fedExp = sum(s.expenses.filter((e) => e.fed))
  const fedWages = sub(gross, fedExp)

  const patch = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))

  const updateLine = (key: Key, id: number, p: Partial<Expense>) =>
    setS((prev) => ({
      ...prev,
      [key]: (prev[key] as Expense[]).map((l) => (l.id === id ? { ...l, ...p } : l)),
    }))

  const removeLine = (key: Key, id: number) =>
    setS((prev) => ({ ...prev, [key]: (prev[key] as Line[]).filter((l) => l.id !== id) }))

  const addLine = (key: Key) =>
    setS((prev) => {
      const base = line(prev.nextId)
      const row = key === 'expenses' ? { ...base, fed: true } : base
      return { ...prev, nextId: prev.nextId + 1, [key]: [...prev[key], row] }
    })

  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    setExporting(true)
    try {
      const n = (l: Line) => ({ desc: l.desc, period: num(l.period), ytd: num(l.ytd) })
      await downloadExcel({
        payDate: s.payDate,
        frequency: s.frequency,
        periodsOverride: overridden ? remaining : null,
        calculatedPeriods: calculated,
        remaining,
        income: s.income.map(n),
        deductions: s.deductions.map(n),
        expenses: s.expenses.map((e) => ({ ...n(e), fed: e.fed })),
      })
    } finally {
      setExporting(false)
    }
  }

  const downloadButton = (
    <button className="download" onClick={exportExcel} disabled={exporting}>
      {exporting ? 'Preparing…' : 'Download Excel'}
    </button>
  )

  const reset = () => {
    if (window.confirm('Clear all entries and start over?')) setS(initialState())
  }

  // On phones each row becomes a stacked card; the .cell/.cap wrappers are invisible on desktop.
  const renderRow = (k: Key, l: Line, removable: boolean) => (
    <div className={`row${removable ? ' has-x' : ''}`} key={l.id}>
      <input
        className="f-desc"
        aria-label="Description"
        placeholder="Description"
        value={l.desc}
        onChange={(e) => updateLine(k, l.id, { desc: e.target.value })}
      />
      <label className="cell f-period">
        <span className="cap">Period</span>
        <input
          className="money"
          inputMode="decimal"
          aria-label={`${l.desc} period`}
          placeholder="0.00"
          value={l.period}
          onChange={(e) => updateLine(k, l.id, { period: e.target.value })}
        />
      </label>
      <label className="cell f-ytd">
        <span className="cap">YTD</span>
        <input
          className="money"
          inputMode="decimal"
          aria-label={`${l.desc} YTD`}
          placeholder="0.00"
          value={l.ytd}
          onChange={(e) => updateLine(k, l.id, { ytd: e.target.value })}
        />
      </label>
      {k === 'expenses' && (
        <label className="cell f-fed">
          <input
            type="checkbox"
            className="check"
            aria-label={`${l.desc} reduces federal wages`}
            checked={(l as Expense).fed}
            onChange={(e) => updateLine(k, l.id, { fed: e.target.checked })}
          />
          <span className="cap">Removes from federal wages</span>
        </label>
      )}
      <output className="proj f-proj" data-label="Projected">
        {money(proj(l))}
      </output>
      {removable ? (
        <button className="icon f-x" aria-label={`Remove ${l.desc || 'row'}`} onClick={() => removeLine(k, l.id)}>
          ×
        </button>
      ) : (
        <span className="f-x" />
      )}
    </div>
  )

  const totalRow = (label: string, t: Totals, expense = false) => (
    <div className="row total-row">
      <span className="f-desc">{label}</span>
      <output className="f-period" data-label="Period">
        {money(t.period)}
      </output>
      <output className="f-ytd" data-label="YTD">
        {money(t.ytd)}
      </output>
      {expense && <span className="blank" />}
      <output className="proj f-proj" data-label="Projected">
        {money(t.proj)}
      </output>
      <span className="blank" />
    </div>
  )

  const head = (expense = false) => (
    <div className="row head">
      <span>Description</span>
      <span className="r">Period</span>
      <span className="r">YTD</span>
      {expense && <span className="c">Fed</span>}
      <span className="r">Projected</span>
      <span />
    </div>
  )

  const banner = (extra = '') => (
    <div className={`sticky ${extra}`}>
      <div className="sticky-inner">
        <span className="sticky-label">Projected federal wages</span>
        <strong className="sticky-value">{money(fedWages.proj)}</strong>
      </div>
    </div>
  )

  return (
    <>
      <header>{banner()}</header>

      <main>
        <div className="title-row">
          <h1>Federal Wage Projection</h1>
          {downloadButton}
        </div>

        <section>
          <h2>1. Pay schedule</h2>
          <div className="schedule">
            <label>
              Most recent pay date
              <input type="date" value={s.payDate} onChange={(e) => patch({ payDate: e.target.value })} />
            </label>
            <label>
              Pay frequency
              <select value={s.frequency} onChange={(e) => patch({ frequency: e.target.value as Frequency })}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Remaining pay periods
              <input
                inputMode="numeric"
                value={s.periodsOverride}
                placeholder={String(calculated)}
                onChange={(e) => patch({ periodsOverride: e.target.value.replace(/\D/g, '') })}
              />
              <small>
                {overridden ? (
                  <>
                    Overriding calculated {calculated}.{' '}
                    <button className="link" onClick={() => patch({ periodsOverride: '' })}>
                      Use calculated
                    </button>
                  </>
                ) : (
                  'Calculated after this pay date. Type to override.'
                )}
              </small>
            </label>
          </div>
        </section>

        <section>
          <h2>2. Gross income</h2>
          <div className="grid g-basic">
            {head()}
            {s.income.map((l, i) => renderRow('income', l, i > 0))}
            {totalRow('Total gross', gross)}
          </div>
          <button className="add" onClick={() => addLine('income')}>
            + Add bonus / other income
          </button>
        </section>

        <section>
          <h2>3. Withholdings</h2>
          <div className="grid g-basic">
            {head()}
            {s.deductions.map((l, i) => renderRow('deductions', l, i >= DEFAULT_DEDUCTIONS.length))}
            {totalRow('Total withheld', withheld)}
          </div>
          <button className="add" onClick={() => addLine('deductions')}>
            + Add deduction
          </button>
        </section>

        <section>
          <h2>4. Other expenses</h2>
          <p className="hint">
            Check <b>Fed</b> if the expense is removed from federal wages (e.g. pre-tax 401(k), health premiums).
          </p>
          <div className="grid g-expense">
            {head(true)}
            {s.expenses.map((l) => renderRow('expenses', l, true))}
            {s.expenses.length > 0 && totalRow('Total expenses', expenseTotal, true)}
          </div>
          <button className="add" onClick={() => addLine('expenses')}>
            + New expense
          </button>
        </section>

        <section>
          <h2>Final numbers</h2>
          <div className="summary">
            <span />
            <span className="head r">Period</span>
            <span className="head r">YTD</span>
            <span className="head r">Projected</span>

            <span>Total gross income</span>
            <output>{money(gross.period)}</output>
            <output>{money(gross.ytd)}</output>
            <output>{money(gross.proj)}</output>

            <span>Less: Fed-exempt expenses</span>
            <output>{money(-fedExp.period)}</output>
            <output>{money(-fedExp.ytd)}</output>
            <output>{money(-fedExp.proj)}</output>

            <span className="big">Federal wages</span>
            <output className="big">{money(fedWages.period)}</output>
            <output className="big">{money(fedWages.ytd)}</output>
            <output className="big">{money(fedWages.proj)}</output>
          </div>
          <p className="hint">
            Projected = YTD + (current period × {remaining} remaining pay period{remaining === 1 ? '' : 's'}).
          </p>
          <div className="actions">
            {downloadButton}
            <button className="link" onClick={reset}>
              Reset all
            </button>
          </div>
        </section>
      </main>

      <footer>{banner('bottom')}</footer>
    </>
  )
}
