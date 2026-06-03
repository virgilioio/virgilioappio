## Problem
Section cards inside the Add / Edit Candidate sheet look gray. They use `bg-background`, which resolves to `#F5F4F0` (the app cream). Against the sheet's `#F6F5F1` surface, they read as flat gray. The Job Wizard cards use plain white (`bg-white`).

## Fix
`src/components/candidates/form/CandidateSheetSection.tsx`, line 41:

- Change `bg-background` → `bg-white` on the card wrapper.

That's the entire change. Presentation-only, one token swap, applies to every section card (Resume, Identity, Professional, Skills, Source & Assignment, Current Assignments).

## Out of scope
No logic changes, no other files, no border / radius / padding adjustments.
