

# Add Currency Converter Dashboard Widget

## Overview
Create a minimalist currency converter widget (1-column, xsmall) with a citron noir background, styled similarly to the World Clock widget. Users can input an amount, select two currencies, and see the converted value. Designed for quick salary conversions.

## Design (reference image inspired)

```text
┌──────────────┐
│ From     USD ▾│  ← label + currency selector
│ 120,000      │  ← editable amount (large Poppins)
│ ─── ⇅ ───── │  ← swap button + exchange rate
│ To       EUR ▾│
│ 110,400      │  ← converted amount (large Poppins)
└──────────────┘
```

- Background: `bg-primary text-primary-foreground` (citron noir)
- Typography: Poppins bold for amounts, similar scale to world clock
- Currency selectors: compact dropdown using existing `CURRENCIES` constant
- Swap button: circular icon to flip currencies
- Exchange rate display: small text showing rate
- Rates: fetched from the existing `currency_exchange_rates` Supabase table, with a localStorage fallback for offline/quick use
- State persisted in `dashboard-currency-converter` localStorage key

## Changes

### 1. `src/components/dashboard/CurrencyConverterWidget.tsx` — New component
- Compact 1-col card with citron noir background
- "From" currency + editable amount input at top
- Swap button + rate in middle
- "To" currency + computed amount at bottom
- Currency selection via small popover using `CURRENCIES` from `@/constants/currencies`
- Fetches rates from Supabase `currency_exchange_rates` table, falls back to a simple fetch or cached rates
- Persists selected currencies in localStorage

### 2. `src/hooks/useDashboardLayout.ts` — Register widget
- Add `'currency-converter'` to `DashboardCardId` union
- Add registry entry: `allowedSizes: ['xsmall'], defaultSize: 'xsmall', fixed: true`
- Add to `CARD_SIZE_RULES` and `ALL_CARD_IDS`

### 3. `src/pages/Dashboard.tsx` — Wire up
- Import `CurrencyConverterWidget`
- Add case in `renderCard` switch
- Add to `MOBILE_ORDER`

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/CurrencyConverterWidget.tsx` | New: minimalist currency converter, citron noir, 1-col |
| `src/hooks/useDashboardLayout.ts` | Register `currency-converter` as xsmall fixed widget |
| `src/pages/Dashboard.tsx` | Wire up new widget in renderCard and mobile order |

