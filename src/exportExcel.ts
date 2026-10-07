import type { Cell } from 'exceljs'
import type { Frequency } from './payPeriods'

export type ExportLine = { desc: string; period: number; ytd: number }
export type ExportExpense = ExportLine & { fed: boolean }

export type ExportData = {
  payDate: string // yyyy-mm-dd
  frequency: Frequency
  periodsOverride: number | null
  calculatedPeriods: number
  remaining: number
  income: ExportLine[]
  deductions: ExportLine[]
  expenses: ExportExpense[]
}

const FREQ_LABEL: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semimonthly: 'Semi-monthly',
  monthly: 'Monthly',
}

const MONEY = '$#,##0.00;[Red]-$#,##0.00'

// Spare formula-filled rows so more lines can be typed straight into Excel.
const MIN_INCOME_ROWS = 10
const MIN_DEDUCTION_ROWS = 8
const MIN_EXPENSE_ROWS = 15

// Sheet layout: Final numbers pinned on top, then the four sections side by side.
const FINAL_HEAD_ROW = 3 // header; gross / less / federal wages follow
const SECTION_TITLE_ROW = 9
const TOTAL_ROW = 10 // each block's totals sit above its column headers
const HEADER_ROW = 11
const FIRST_DATA_ROW = 12

/**
 * Builds a workbook whose Projected cells are formulas (YTD + Period * remaining periods)
 * and whose expense Y/N column drives the federal wages total. Cached results are written
 * alongside each formula so viewers that don't recalculate still show the right numbers.
 */
export async function downloadExcel(data: ExportData) {
  const { default: ExcelJS } = await import('exceljs')

  const wb = new ExcelJS.Workbook()
  wb.calcProperties.fullCalcOnLoad = true
  const ws = wb.addWorksheet('Tax Projection', {
    // Freeze the title + Final numbers rows so the total stays visible while scrolling.
    views: [{ state: 'frozen', ySplit: FINAL_HEAD_ROW + 3, showGridLines: false }],
  })

  // A pay schedule | gap | B income | gap | C withholdings | gap | D expenses
  const widths: Record<string, number> = {
    A: 34, B: 16, C: 3,
    D: 32, E: 15, F: 15, G: 17, H: 3,
    I: 22, J: 15, K: 15, L: 17, M: 3,
    N: 26, O: 15, P: 15, Q: 11, R: 17,
  }
  for (const [col, width] of Object.entries(widths)) ws.getColumn(col).width = width

  const bold = { bold: true }
  const inputFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } } as const
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF7' } } as const
  const input = (cell: Cell) => {
    cell.fill = inputFill
  }
  const projOf = (l: ExportLine) => l.ytd + l.period * data.remaining
  const sumBy = (items: ExportLine[], pick: (l: ExportLine) => number) =>
    items.reduce((t, l) => t + pick(l), 0)

  ws.getCell('A1').value = 'Federal Wage Projection'
  ws.getCell('A1').font = { bold: true, size: 16 }
  ws.getCell('A2').value = 'Yellow cells are inputs. Everything else is calculated.'
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF6B7280' } }

  const sectionTitle = (col: string, text: string) => {
    const c = ws.getCell(`${col}${SECTION_TITLE_ROW}`)
    c.value = text
    c.font = { bold: true, size: 12 }
  }

  const headerRow = (cols: string[], labels: string[]) =>
    cols.forEach((col, i) => {
      const c = ws.getCell(`${col}${HEADER_ROW}`)
      c.value = labels[i]
      c.font = bold
      c.fill = headFill
      c.alignment = { horizontal: i === 0 ? 'left' : 'right' }
    })

  // ---- 1. Pay schedule (A:B) ----
  sectionTitle('A', '1. Pay schedule')
  const [y, m, d] = data.payDate.split('-').map(Number)
  const R_DATE = TOTAL_ROW
  const R_FREQ = TOTAL_ROW + 1
  const R_CALC = TOTAL_ROW + 2
  const R_OVERRIDE = TOTAL_ROW + 3
  const R_USED = TOTAL_ROW + 4
  ws.getCell(`A${R_DATE}`).value = 'Most recent pay date'
  ws.getCell(`B${R_DATE}`).value = new Date(Date.UTC(y, m - 1, d))
  ws.getCell(`B${R_DATE}`).numFmt = 'mm/dd/yyyy'
  ws.getCell(`A${R_FREQ}`).value = 'Pay frequency'
  ws.getCell(`B${R_FREQ}`).value = FREQ_LABEL[data.frequency]
  ws.getCell(`B${R_FREQ}`).dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"Weekly,Bi-weekly,Semi-monthly,Monthly"'],
  }
  const dt = `B${R_DATE}`
  const fq = `B${R_FREQ}`
  ws.getCell(`A${R_CALC}`).value = 'Remaining pay periods (calculated)'
  ws.getCell(`B${R_CALC}`).value = {
    formula:
      `IF(${fq}="Weekly",INT((DATE(YEAR(${dt}),12,31)-${dt})/7),` +
      `IF(${fq}="Bi-weekly",INT((DATE(YEAR(${dt}),12,31)-${dt})/14),` +
      `IF(${fq}="Monthly",12-MONTH(${dt}),` +
      `(12-MONTH(${dt}))*2+IF(DAY(${dt})<15,2,IF(DAY(${dt})<DAY(EOMONTH(${dt},0)),1,0)))))`,
    result: data.calculatedPeriods,
  }
  ws.getCell(`A${R_OVERRIDE}`).value = 'Override (optional)'
  if (data.periodsOverride !== null) ws.getCell(`B${R_OVERRIDE}`).value = data.periodsOverride
  ws.getCell(`A${R_USED}`).value = 'Remaining pay periods (used)'
  ws.getCell(`A${R_USED}`).font = bold
  ws.getCell(`B${R_USED}`).value = {
    formula: `IF(B${R_OVERRIDE}="",B${R_CALC},B${R_OVERRIDE})`,
    result: data.remaining,
  }
  ws.getCell(`B${R_USED}`).font = bold
  for (const r of [R_DATE, R_FREQ, R_OVERRIDE]) input(ws.getCell(`B${r}`))
  const REMAINING = `$B$${R_USED}`

  /**
   * One section block: Desc | Period | YTD | [Fed Y/N] | Projected, with the totals row above
   * the column headers so rows can be added below without moving it.
   */
  const block = (
    cols: string[], // [desc, period, ytd, (fed,) proj]
    title: string,
    totalLabel: string,
    items: (ExportLine | ExportExpense)[],
    minRows: number,
    withFed: boolean,
  ) => {
    const [cDesc, cPeriod, cYtd] = cols
    const cProj = cols[cols.length - 1]
    const cFed = withFed ? cols[3] : null
    const count = Math.max(items.length, minRows)
    const last = FIRST_DATA_ROW + count - 1

    sectionTitle(cDesc, title)
    headerRow(cols, ['Description', 'Period', 'YTD', ...(withFed ? ['Fed (Y/N)'] : []), 'Projected'])

    ws.getCell(`${cDesc}${TOTAL_ROW}`).value = totalLabel
    const totals: [string, number][] = [
      [cPeriod, sumBy(items, (l) => l.period)],
      [cYtd, sumBy(items, (l) => l.ytd)],
      [cProj, sumBy(items, projOf)],
    ]
    for (const [col, result] of totals) {
      ws.getCell(`${col}${TOTAL_ROW}`).value = {
        formula: `SUM(${col}${FIRST_DATA_ROW}:${col}${last})`,
        result,
      }
      ws.getCell(`${col}${TOTAL_ROW}`).numFmt = MONEY
    }
    for (const col of cols) {
      const c = ws.getCell(`${col}${TOTAL_ROW}`)
      c.font = bold
      c.border = { bottom: { style: 'thin' } }
    }

    for (let i = 0; i < count; i++) {
      const r = FIRST_DATA_ROW + i
      const it = items[i] as ExportExpense | undefined
      ws.getCell(`${cDesc}${r}`).value = it?.desc ?? ''
      ws.getCell(`${cPeriod}${r}`).value = it?.period ?? 0
      ws.getCell(`${cYtd}${r}`).value = it?.ytd ?? 0
      ws.getCell(`${cPeriod}${r}`).numFmt = MONEY
      ws.getCell(`${cYtd}${r}`).numFmt = MONEY
      for (const col of [cDesc, cPeriod, cYtd]) input(ws.getCell(`${col}${r}`))
      if (cFed) {
        const fed = ws.getCell(`${cFed}${r}`)
        fed.value = it?.fed ? 'Y' : 'N'
        fed.alignment = { horizontal: 'center' }
        fed.dataValidation = { type: 'list', allowBlank: false, formulae: ['"Y,N"'] }
        input(fed)
      }
      ws.getCell(`${cProj}${r}`).value = {
        formula: `${cYtd}${r}+${cPeriod}${r}*${REMAINING}`,
        result: it ? projOf(it) : 0,
      }
      ws.getCell(`${cProj}${r}`).numFmt = MONEY
      ws.getCell(`${cProj}${r}`).font = bold
    }
    return { first: FIRST_DATA_ROW, last }
  }

  block(['D', 'E', 'F', 'G'], '2. Gross income', 'Total gross', data.income, MIN_INCOME_ROWS, false)
  block(['I', 'J', 'K', 'L'], '3. Withholdings', 'Total withheld', data.deductions, MIN_DEDUCTION_ROWS, false)
  const exp = block(
    ['N', 'O', 'P', 'Q', 'R'],
    '4. Other expenses (Fed = Y removes it from federal wages)',
    'Total expenses',
    data.expenses,
    MIN_EXPENSE_ROWS,
    true,
  )

  // ---- Final numbers, pinned on top, in the same columns as the Gross income block ----
  const R_GROSS = FINAL_HEAD_ROW + 1
  const R_LESS = FINAL_HEAD_ROW + 2
  const R_FED = FINAL_HEAD_ROW + 3
  ;['Final numbers', 'Period', 'YTD', 'Projected'].forEach((text, i) => {
    const c = ws.getCell(FINAL_HEAD_ROW, 4 + i) // D:G
    c.value = text
    c.font = bold
    c.fill = headFill
    c.alignment = { horizontal: i === 0 ? 'left' : 'right' }
  })

  const fedItems = data.expenses.filter((e) => e.fed)
  // Final column -> [income column, expense column, period/ytd/proj extractor]
  const finals: [string, string, (l: ExportLine) => number][] = [
    ['E', 'O', (l) => l.period],
    ['F', 'P', (l) => l.ytd],
    ['G', 'R', projOf],
  ]
  ws.getCell(`D${R_GROSS}`).value = 'Total gross income'
  ws.getCell(`D${R_LESS}`).value = 'Less: Fed-exempt expenses (Fed = Y)'
  ws.getCell(`D${R_FED}`).value = 'Federal wages'
  for (const [col, expCol, pick] of finals) {
    const gross = sumBy(data.income, pick)
    const less = sumBy(fedItems, pick)
    ws.getCell(`${col}${R_GROSS}`).value = { formula: `${col}${TOTAL_ROW}`, result: gross }
    ws.getCell(`${col}${R_LESS}`).value = {
      formula: `-SUMIF($Q$${exp.first}:$Q$${exp.last},"Y",${expCol}$${exp.first}:${expCol}$${exp.last})`,
      result: -less,
    }
    ws.getCell(`${col}${R_FED}`).value = {
      formula: `${col}${R_GROSS}+${col}${R_LESS}`,
      result: gross - less,
    }
    for (const r of [R_GROSS, R_LESS, R_FED]) ws.getCell(`${col}${r}`).numFmt = MONEY
  }
  for (const col of ['D', 'E', 'F', 'G']) {
    const c = ws.getCell(`${col}${R_FED}`)
    c.font = { bold: true, size: 12 }
    c.border = { top: { style: 'medium' } }
  }

  const buf = await wb.xlsx.writeBuffer()
  // A data: URL (not a blob: URL) so Chrome keeps the filename even on non-HTTPS origins,
  // where it otherwise saves blob downloads under a random UUID with no extension.
  const bytes = new Uint8Array(buf as ArrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  const a = document.createElement('a')
  a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${btoa(binary)}`
  a.download = `federal-wage-projection-${data.payDate}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
