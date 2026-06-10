## Goal

Replace the hero copy on the general per-tenant careers page (`/careers/:companySlug`) — rendered by `src/components/careers/public/CareersHero.tsx` — with the new headline and subtext from the screenshot. The Virgilio Careers page (`/virgilio-careers`) is untouched.

## Change

**File:** `src/components/careers/public/CareersHero.tsx`

**Headline** — replace the current "Help us build the modern hiring stack." with:

> **Find your next role at a company** *worth joining***.**

- "Find your next role at a company" → Poppins bold (current display style)
- "worth joining" → italic serif (same `Instrument Serif` treatment already used for "hiring stack")
- Trailing period → purple (`text-purple-period`, same as today)

**Subtext** — replace the current paragraph with a fixed string (no more `headerText`/company-name interpolation on this page):

> Every role here is a live search we're running for a hand-picked team. We've already vetted the company, the people, and the opportunity — so you can focus on whether the work is right for you.

Because the copy is now generic across tenants, the `headerText` prop is no longer consulted for the paragraph. The prop stays in the signature (still passed from `PublicCareersPage`) but is ignored — keeps the change to one file, no callers to update.

## Out of scope

- No change to the stat cards, "Remote-first" dark card, CTAs, or the "We're hiring · N roles…" pill.
- No change to `VirgilioCareersPage` or its hero.
- No DB, routing, or settings changes.
