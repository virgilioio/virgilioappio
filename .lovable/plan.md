## Goal

Replace the old `gogio-logo.png` (face-avatar wordmark) with the new uploaded `gio_ats_logo.svg` everywhere it appears: auth pages, public careers/booking pages, transactional emails, and any other public-facing surface.

The new logo is the clean **"gio"** wordmark with two stacked circles to the left (no face character).

## Source of truth

Add the SVG as a real inline React component so it scales crisply at every size and stays in the bundle (no extra request, no dependency on the DB-stored platform asset which still points to the old PNG).

- New file: `src/components/icons/GioWordmark.tsx` — inline `<svg>` from `user-uploads://gio_ats_logo.svg`, accepts `height` + `className`, uses `currentColor` for the dark fills so it can be re-tinted on dark backgrounds.
- New file: `public/gio-logo.svg` — same SVG written to public for use by emails and any external/HTML context (favicon/manifest stay untouched).

## Changes

### 1. `src/components/GoGioLogo.tsx` — rewrite (keep the same exported API)

Drop the Supabase `platform_assets` fetch and the `<img>` tag entirely. Render `<GioWordmark>` sized by the existing `sm | md | lg | xl` map (24/32/48/64 px height). All 14 existing call sites keep working untouched: Login, SignUp, ForgotPassword, ResetPassword, AcceptInvite, AccountSetup, TrialActivation, AuthCallback, ChromeOAuthStart, Onboarding, WorkspaceProvisioningLoader, CareersFooter, CareersTopBar (currently inert), and any future surface.

This single edit covers every in-app and public surface that already uses `<GoGioLogo>`.

### 2. `src/components/booking/PublicBookingHeader.tsx`

Currently shows a workspace initial in a black tile + "Powered by **Gio**" text. The workspace tile stays (it's the customer's brand). Replace the "Powered by Gio" text on the right with `<GioWordmark height={14} />` so the booking page also shows the real logo, consistent with the careers footer.

### 3. Transactional emails — `supabase/functions/_shared/emailTemplate.ts`

Header currently renders `<div class="logo">GoGio</div>` (plain text on the citron-noir gradient). Swap to an `<img>` pointing at the published URL of `gio-logo.svg` (`https://app.gogio.io/gio-logo.svg`), with `height="28"` and `alt="Gio"`. Keep the gradient header; the SVG fills with `#0d0d09` but on the dark header we'll serve a white-tinted variant by adding a second public file `public/gio-logo-light.svg` (same paths, `fill="#FFFCF9"`) and pointing the email at that one. Footer text "GoGio" stays as a textual brand mention — it's body copy, not the mark.

Edge functions that import `emailTemplate.ts` pick this up automatically on next deploy; no other email files need editing.

### 4. Old assets

- Delete `public/gogio-logo.png` (no remaining references after step 1).
- Leave `src/assets/gogio-avatar.png` alone — it's the Gio bot/AI assistant face used inside `IntegrationsTab.tsx` and other in-app AI surfaces. The user's brief was about the **wordmark with the face**, not the standalone face mascot. Flagging here in case you want that swapped too — say the word and I'll add it.

## Out of scope

- Favicon (`public/favicon.ico`, `custom-favicon.png`) and PWA manifest icons — different asset, separate request if you want them refreshed.
- The `platform_assets` DB row (admin-configurable logo) — `<GoGioLogo>` no longer reads it. We can either delete the row in a follow-up or leave it dormant.

## Verification

- Visit `/auth`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`, `/accept-invite`, `/account-setup`, `/trial-activation`, `/chrome-oauth-start`, `/auth/callback` — wordmark renders crisp at all sizes.
- Visit a public careers page and a public booking link — wordmark in footer/header.
- Inspect an email preview via the email-test edge function — header shows the SVG instead of the text "GoGio".
- `bun run build` clean.
