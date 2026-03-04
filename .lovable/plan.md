

# Allow Currency Selection on Salary Fields in Offer Forms

## Problem
Currently, salary fields in offer forms display the currency as a static badge based on the `field_config` setting. The period should remain locked, but the **currency must be selectable** by the person filling out the offer.

## Approach
Store the salary value as a JSON object `{ amount, currency }` instead of a plain number. The `field_config.currency` becomes the **default** currency, and `field_config.period` stays fixed/display-only.

## Changes

### 1. `src/components/candidates/OfferComposerBody.tsx` — salary case (lines 157-174)
Replace the static currency badge with a `CurrencySelect` dropdown. Store value as `{ amount: string, currency: string }`:
```tsx
case 'salary': {
  const salaryConfig = field.field_config as SalaryFieldConfig | null
  const period = salaryConfig?.period || 'annually'
  const salaryValue = (() => {
    try {
      if (typeof value === 'object' && value) return value
      if (typeof value === 'string' && value) return JSON.parse(value)
      return { amount: '', currency: salaryConfig?.currency || 'USD' }
    } catch { return { amount: '', currency: salaryConfig?.currency || 'USD' } }
  })()
  return (
    <div className="flex items-center gap-2">
      <CurrencySelect
        value={salaryValue.currency}
        onChange={(c) => handleFieldChange(field.field_name, JSON.stringify({ ...salaryValue, currency: c }))}
      />
      <Input type="number" value={salaryValue.amount}
        onChange={(e) => handleFieldChange(field.field_name, JSON.stringify({ ...salaryValue, amount: e.target.value }))}
        placeholder="Enter amount" />
      <Badge variant="secondary" className="shrink-0 capitalize">{period}</Badge>
    </div>
  )
}
```

### 2. `src/components/candidates/CreateOfferLetterDialog.tsx`
Add the missing `salary` case with the same CurrencySelect pattern (currently falls to default text input). Add `CurrencySelect` and `SalaryFieldConfig` imports.

### 3. `src/components/forms/ApplicationFieldsRenderer.tsx` — salary case (lines 260-294)
Same change: replace static badge with `CurrencySelect`, store as JSON `{ amount, currency }`. Adapt for react-hook-form by reading/writing the form value as a JSON string.

### 4. Imports
Add `import { CurrencySelect } from '@/components/ui/currency-select'` to all three files where missing.

## What stays the same
- **Period** remains a locked display-only badge from field_config
- **field_config** in the form builder still sets the **default** currency and the period
- No database changes needed — `field_values` is already a JSONB column

