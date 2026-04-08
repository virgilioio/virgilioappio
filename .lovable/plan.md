

# Mobile Optimization: Profile Page (Consultation-Only)

Following the consultation-first mobile philosophy, the mobile view should be read-only — no editing, no creating. Users can view their info and copy URLs.

## Changes

### 1. ProfileTab — Hide editing on mobile

- Import `useIsMobile` hook
- Hide the **Profile Form** fields, **Save button**, and **Avatar upload button** on mobile — show only the avatar display, name, and read-only account info
- Hide the **Booking Link section separators** tightening: `my-4 sm:my-8`
- Make save button `w-full sm:w-auto` (won't matter since it's hidden on mobile, but good fallback)

### 2. BookingLinkSection — Consultation + copy only on mobile

- Import `useIsMobile` hook
- **Card header**: Hide the Switch + Active/Inactive badge toggle on mobile (no editing)
- **Booking URL row**: Stack vertically on mobile (`flex-col sm:flex-row`), keep Copy button visible, hide "Open in new tab" button on mobile
- **Event Types section**: Hide "Create New" button on mobile. Hide empty state create button on mobile. Make event type rows **not clickable** on mobile (no `onClick` to open edit sheet) — keep only the Copy link button visible
- **Event type rows**: On mobile, use `flex-wrap` so title + duration wrap nicely. Hide the active badge on mobile to save space

### 3. ProfileForm — Read-only display on mobile

- Wrap the form in a conditional: on mobile, render a simple read-only display of the profile fields (name, title, phone, timezone, LinkedIn) as text instead of inputs
- Or simpler: hide the entire form on mobile and show a compact summary card with the key info

## Files changed

| File | Change |
|------|--------|
| `src/components/settings/ProfileTab.tsx` | Import `useIsMobile`; hide form/save on mobile; show read-only summary; tighter spacing |
| `src/components/settings/BookingLinkSection.tsx` | Import `useIsMobile`; hide switch/create/edit on mobile; stack URL row; keep copy buttons |

