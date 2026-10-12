# Tax Projection

Single-page app that projects your **federal taxable wages for the year** from the latest pay period and year-to-date (YTD) amounts, then lets you download the workings as an Excel file with live formulas.

**Live site:** https://bsav0016.github.io/Tax-Projection/

![Tax Projection app](docs/screenshots/app.png)

## Why it exists

<!-- TODO: in your own words, why you built it (e.g. checking withholding mid-year?) -->

## What it does

1. **Pay schedule** – pick a pay frequency (weekly, bi-weekly, semi-monthly, monthly) and a pay date; the number of remaining pay periods in the year is calculated, and you can override it.
2. **Income, deductions and expenses** – enter each line's current-period and YTD amounts. Default deduction lines are Federal, Social Security, Medicare, State and Local. Each expense line has a "removes from federal wages" flag.
3. **Projection** – every line is projected as `YTD + (current period × remaining pay periods)`. Projected federal wages = projected gross income minus the expenses flagged as reducing federal wages.
4. **Excel export** – downloads a workbook in which the projected cells are formulas (not pasted values), with spare formula-filled rows so you can keep editing in Excel.

Everything runs in the browser. There is no backend and no account; your entries are saved in `localStorage` on your device.

## Stack

- React 18, TypeScript, Vite 5
- [ExcelJS](https://github.com/exceljs/exceljs) for the workbook export
- GitHub Pages, deployed by a GitHub Actions workflow on every push to `main`

## Running it

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check, then production build into dist/
npm run preview    # serve the production build locally
```

`vite.config.ts` sets `base: '/Tax-Projection/'` to match the GitHub Pages URL, so the dev and preview servers also serve under that path.

## Design decisions

- **No backend.** All state lives in the browser (`localStorage`), so nothing is sent to a server; the only output is the file you choose to download.
- **Formulas in the export, not values.** The same projection rule is written into the spreadsheet so you can change inputs there and see the result update.
- **Pay periods derived from the pay date and frequency**, with a manual override for odd calendars.

## Limitations

- It projects wages; it does **not** compute tax owed. <!-- TODO: confirm that is the intended scope -->
- No automated tests.
- <!-- TODO: any assumptions you want to state (e.g. tax year, which pay types are covered) -->

## License

MIT. See [LICENSE](LICENSE).
