

# Unified Gio Avatar Loading Animation

## Approach

Extract the coin-flipping Gio avatar animation from `GioThinkingHeader` into a standalone **`GioLoader`** component — just the cycling avatars, no shimmer bar, no text messages. Then replace every generic spinner across the app with it.

The component will accept an optional `size` prop (`sm | md`) so it works in both full-page and inline contexts, and an optional `message` prop for cases that still want a status label (like "Signing out..." or "Checking billing status...").

## New Component

**`src/components/ui/GioLoader.tsx`**

- Reuses the same `GIO_AVATARS` array, flip interval, and `animate-coin-flip-2d` / `animate-coin-flip-2d-reverse` animations from `GioThinkingHeader`
- Props: `size?: 'sm' | 'md'` (default `md` = 20×20, `sm` = 10×10), `message?: string`, `className?: string`
- No shimmer bar, no rotating messages — just the flipping avatar + optional single message below it

## Files to Update (replace spinner → `<GioLoader />`)

| File | Current text | Notes |
|---|---|---|
| `src/App.tsx` (4 spinners) | "Loading...", "Initializing authentication...", "Authenticating..." / "Signing out...", "Loading workspace..." | Full-page loaders, pass message prop |
| `src/components/auth/AuthGate.tsx` | "Loading..." | Full-page |
| `src/components/auth/BillingGuard.tsx` | "Checking billing status..." | Inline (`min-h-[400px]`), use `size="sm"` |
| `src/pages/Login.tsx` | "Loading..." | Full-page |
| `src/pages/SignUp.tsx` | "Loading..." | Full-page |
| `src/pages/TrialActivation.tsx` | "Loading..." | Full-page |
| `src/pages/ChromeOAuthStart.tsx` | "Connecting to GoGio..." | Full-page |
| `src/pages/MailOAuthCallback.tsx` | Dynamic message | Full-page |

**Not touching**: `PDFResumeViewer`, `AttachmentPreviewDialog` — these are content-specific inline loaders where a small spinner makes more sense than Gio's face.

## GioThinkingHeader Update

`GioThinkingHeader` will import and render `<GioLoader size="md" />` for its avatar section instead of duplicating the flip logic, then keep its own shimmer bar + rotating messages below it.

Total: 1 new file, ~10 files updated. Every page transition and auth/billing gate gets the branded Gio flip animation.

