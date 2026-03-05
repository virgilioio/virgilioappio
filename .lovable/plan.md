

# Rename "Offer Details" Tab → "Offer" with Internal Subtabs

## Changes

### 1. Rename the main tab label
In `CandidateProfileSheet.tsx` (line 993), change `'Offer Details'` to `'Offer'`.

### 2. Add subtabs inside the Offer tab content
In `CandidateProfileSheet.tsx` (around line 1531-1533), wrap the current `CandidateOfferDetails` render in a subtab layout:

- Use the existing `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` components from `@/components/ui/tabs`
- Default subtab: **Offer Details** — renders the existing `CandidateOfferDetails` component
- Second subtab: **Offer Approvals** — renders a new placeholder `CandidateOfferApprovals` component (empty state for now, will be built out when the approval workflow is implemented)

### 3. New file: `src/components/candidates/CandidateOfferApprovals.tsx`
A simple placeholder component showing an empty state ("No approval chain configured" or similar) that accepts `candidateId`, `jobId`, and `organizationId` props — ready for future wiring to the approval chain data.

### Files
| Action | File |
|--------|------|
| Modify | `src/components/candidates/CandidateProfileSheet.tsx` — rename tab label + add subtabs |
| New | `src/components/candidates/CandidateOfferApprovals.tsx` — placeholder |

