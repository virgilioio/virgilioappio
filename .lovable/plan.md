# Scorecard Draft Loss Prevention

## Status: ✅ Implemented

The fix has been applied to `src/components/candidates/ScorecardSheet.tsx`.

## Behavior Summary

| Action | Behavior |
|--------|----------|
| Click outside sheet | Draft saved immediately, sheet closes |
| Press Esc | Draft saved immediately, sheet closes |
| Click X button | Draft saved immediately, sheet closes |
| Click Cancel (no changes) | Sheet closes, no dialog |
| Click Cancel (with changes) | Confirmation dialog appears |
| Confirm "Discard Changes" | Draft cleared, form reset, sheet closes |
| Click "Keep Editing" | Dialog closes, continue editing |
| Click "Discard Draft" header button | Draft cleared, form reset |
| Submit Scorecard | Draft cleared after successful save |
