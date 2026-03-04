

# Add "Smart" Indicator to Field Type Dropdowns

## What
Add a small visual indicator next to smart field types (Salary, Location, Phone, Recruiter, Employment Type, Work Location) in the field type selector dropdowns, so users can instantly see which types are "smart" vs plain.

## How

Define a set of smart field types and check membership when rendering each `SelectItem`. Add a subtle tag/indicator after the label text.

### 1. `src/components/shared/FormFieldEditor.tsx` — Type selector (line ~202)

Add a small "Smart" badge next to smart field type labels in the dropdown:

```tsx
const SMART_FIELD_TYPES: FieldType[] = ['salary', 'location', 'phone', 'recruiter', 'employment_type', 'work_location']

// In the SelectContent:
{availableTypes.map(t => (
  <SelectItem key={t} value={t} className="capitalize">
    <span className="flex items-center gap-2">
      {fieldTypeLabel(t)}
      {SMART_FIELD_TYPES.includes(t) && (
        <span className="text-[10px] font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-full leading-none">
          Smart
        </span>
      )}
    </span>
  </SelectItem>
))}
```

### 2. `src/components/settings/OfferFormFieldsManager.tsx` — "Add Field" type selector (line ~242)

Same pattern — add the "Smart" tag next to smart field types in the offer form field creator dropdown.

### Files changed
- `src/components/shared/FormFieldEditor.tsx` — export `SMART_FIELD_TYPES`, add badge in type dropdown
- `src/components/settings/OfferFormFieldsManager.tsx` — import and use same badge pattern

