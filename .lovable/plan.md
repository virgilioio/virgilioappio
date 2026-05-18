# Fix recruiter dropdown clicks in Create Offer composer

## Problem

In the "Create Offer" composer (rendered inside the Candidate Profile Sheet), the recruiter `SearchableSelect` opens but its list items cannot be clicked with the mouse. Keyboard (arrows + Enter) works, and search works.

## Root cause

The composer mounts inside a Radix `Sheet` (modal Dialog). The recruiter dropdown uses `Popover` (via `SearchableSelect`), which is portaled to `<body>`. Radix Dialog sets `pointer-events: none` on the body while open, so the portaled popover content receives focus (keyboard works) but pointer events are swallowed before reaching the `CommandItem`s.

The standard Radix fix is to mark the popover as modal so it manages pointer-events independently of the parent Dialog.

## Change

Pass `modal` through `Popover` in `src/components/ui/searchable-select.tsx` (default `true`, prop-overridable), so when the SearchableSelect is used inside a Dialog/Sheet its items are clickable.

Scope: only `searchable-select.tsx`. No logic, no styling changes. No edits to the composer, the offer flow, or other components.

## Verification

Open Create Offer on a candidate → click the Recruiter field → click a name from the list. The selection should apply on click, matching keyboard behavior.
