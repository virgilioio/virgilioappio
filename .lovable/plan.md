

# Add Gio Face to Notes (Comments) Empty State

The "Notes" tab in the candidate profile sheet uses `CandidateComments.tsx`, which shows a `MessageSquare` icon in its empty state. The "Reminders" tab already uses the `gio-face-empty.png` avatar. We need consistency.

## Change — `src/components/candidates/CandidateComments.tsx`

1. Import `gioFaceEmpty` from `@/assets/gio-face-empty.png`
2. Replace the `<MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />` (line 118) with:
   ```tsx
   <img src={gioFaceEmpty} alt="No comments" className="h-16 w-16 mx-auto mb-4 rounded-full" />
   ```
   This matches the exact pattern used in `CandidateReminders.tsx`.

