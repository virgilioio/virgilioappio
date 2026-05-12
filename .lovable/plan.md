## Fix Deals page syntax error so filter chip renders

**Root cause:** `src/pages/Deals.tsx` uses generic JSX syntax `<FilterChipSelect<DealAmountMode> ...>` which SWC fails to parse. The whole module fails to load, so the page errors out and the chip never appears.

**Fix (one file):**

`src/pages/Deals.tsx` — drop the explicit generic on the JSX element. TypeScript will infer `T` from the `options` array.

```tsx
<FilterChipSelect
  label="Amount"
  value={amountMode}
  options={AMOUNT_MODE_OPTIONS}
  onChange={(v) => setAmountMode(v as DealAmountMode)}
/>
```

Type-safety is preserved because `AMOUNT_MODE_OPTIONS` is already declared with `as const` literal values, and `setAmountMode` is typed.

**Out of scope:** No other behavior changes. Chip stays beside "New Deal" with Total / Collected / Outstanding options as already wired.
