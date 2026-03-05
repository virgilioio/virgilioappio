

# Responsive Offer Details Header — Overflow Menu

## Problem
The offer details header has multiple action buttons (Edit, Approve, Decline, Generate Offer Letter, Send Offer, Request Approval, Recall) that overflow their container on smaller screens.

## Solution
Keep the **Edit** button and the **status Badge** always visible. Move all other action buttons (Approve, Decline, Generate Offer Letter, Send Offer, Request Approval, Recall) into a `DropdownMenu` triggered by a `MoreHorizontal` (ellipsis) icon button. The dropdown only renders when there are overflow actions to show.

## Changes

### `src/components/candidates/CandidateOfferDetails.tsx`

1. **Import** `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `@/components/ui/dropdown-menu` and `MoreHorizontal` from `lucide-react`.

2. **Refactor header actions** (lines 219-300):
   - Keep **Edit** button and **Badge** inline as direct children of the flex row.
   - Build an array of overflow action items based on current conditions (approve, decline, generate, send, request approval, recall). Each item has `label`, `icon`, `onClick`, and optional `disabled`.
   - If the array has items, render a `DropdownMenu` with a ghost `MoreHorizontal` icon button trigger, and map the items into `DropdownMenuItem` entries.
   - Place order: Edit button → ellipsis dropdown → Badge.

3. **No other files changed.** All the same conditional logic stays, just reorganized into the dropdown.

