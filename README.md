# Tax Projection

Single-page React app that projects federal wages for the year from the latest pay period and YTD
amounts. Everything runs in the browser (no backend); entries are kept in `localStorage`.

- Pay schedule with auto-calculated remaining pay periods (overridable)
- Gross income, withholdings, and other expenses (each flagged Fed or not)
- Download as Excel with live formulas

```
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
```

Live site: https://bsav0016.github.io/Tax-Projection/
