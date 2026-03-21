

# Fix Action Buttons + Add Send Now/Schedule to Rejection Settings

## Changes

### 1. `src/components/candidates/ApplicationReviewSheet.tsx`

**Action buttons (lines 254-293)**:
- Change `flex flex-col` → `flex flex-row` for horizontal layout
- Change `size="sm"` → `size="default"` for taller buttons
- Remove `review.firstStageName` from Advance label — just "Advance"

**RejectionConfigPanel (lines 322-406)** — Add scheduling section after the email preview, before Notes:

- Import `RadioGroup`, `RadioGroupItem` from `@/components/ui/radio-group`
- Import `DatePickerVirgilio` and `TimePickerVirgilio`
- Import `setHours`, `setMinutes` from `date-fns`
- When `config.sendEmail` is true, show a "When to send" `RadioGroup` with "Send immediately" and "Schedule for later" — matching the exact pattern from `RejectionEmailComposer.tsx` lines 205-237
- When "later" is selected, show `DatePickerVirgilio` + `TimePickerVirgilio` — these are already our style guide components (Virgilio-styled with purple accents, hover animations, AM/PM format)
- Store `sendOption` ("now" | "later") and `scheduledDate`/`scheduledTime` in the `RejectionConfig` so they persist via localStorage (the hook already persists the entire config object)

### 2. `src/hooks/useApplicationReview.ts`

**RejectionConfig interface (lines 28-33)** — Add fields:
```ts
sendOption?: 'now' | 'later'
scheduledDate?: string  // ISO date string
scheduledTime?: string  // HH:mm
```

**handleReject (line 281-287)** — When `rejectionConfig.sendOption === 'later'`, pass `scheduleFor` (composed from `scheduledDate` + `scheduledTime`) to `rejectCandidate.mutateAsync()` so the email gets scheduled rather than sent immediately.

### Persistence

The existing `persistRejectionConfig` callback (line 68-73) already saves the full config to `localStorage` and restores it on mount. Adding `sendOption`, `scheduledDate`, and `scheduledTime` to the interface means they automatically persist as the user navigates between candidates — no extra work needed.

### Style Guide Compliance

The `DatePickerVirgilio` and `TimePickerVirgilio` components ARE the style guide components — they use `virgilio-purple` selected states, `virgilio-border` borders, `200ms ease-out` transitions, `rounded-lg` cells, and AM/PM format. The `RadioGroup` uses our standard Radix-based component. No custom styling overrides needed.

## Files

| File | Change |
|------|--------|
| `src/components/candidates/ApplicationReviewSheet.tsx` | Fix button layout; add scheduling RadioGroup + DatePicker/TimePicker to RejectionConfigPanel |
| `src/hooks/useApplicationReview.ts` | Add `sendOption`, `scheduledDate`, `scheduledTime` to RejectionConfig; pass `scheduleFor` in handleReject |

