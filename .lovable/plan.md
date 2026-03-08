

# Add Smart Badges to Job Posting Field Type Selector

## Problem
The "Add Field" type selector in `PostingFieldsBuilder.tsx` (lines 485-492) is **hardcoded** with a plain list of types and no "Smart" badges, while both the `FormFieldEditor` (inline edit) and `OfferFormFieldsManager` already use `SMART_FIELD_TYPES` + `ALL_FIELD_TYPES` with purple "Smart" badges. This creates an inconsistency.

Additionally, the PostingFieldsBuilder is missing several smart field types from its dropdown: `phone`, `recruiter`, `employment_type`, and `work_location`.

## Changes

### `src/components/jobs/postings/PostingFieldsBuilder.tsx`

1. **Import** `SMART_FIELD_TYPES` and `ALL_FIELD_TYPES` from `@/components/shared/FormFieldEditor`
2. **Replace** the hardcoded type array (line 488) with `ALL_FIELD_TYPES`
3. **Replace** the plain `SelectItem` label (line 489) with the same pattern used in OfferFormFieldsManager and FormFieldEditor — wrapping the label in a `<span>` with a conditional purple "Smart" badge:

```tsx
{ALL_FIELD_TYPES.map((t) => (
  <SelectItem key={t} value={t} className="capitalize">
    <span className="flex items-center gap-2">
      {fieldTypeLabel(t)}
      {SMART_FIELD_TYPES.includes(t as any) && (
        <span className="text-[10px] font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-full leading-none">
          Smart
        </span>
      )}
    </span>
  </SelectItem>
))}
```

4. **Import** `fieldTypeLabel` from FormFieldEditor (or reuse the existing one) so labels are consistent (e.g., "Checkbox Group", "Employment Type") instead of the current inline ternary chain.

One file changed. Purely cosmetic — no logic or data changes.

