## Remove Header Bottom Border

The floating sidebar now has soft rounded corners and a subtle ring shadow. The header's `border-b` creates a sharp horizontal rule that visually fights that softer aesthetic.

### Change
- **`src/components/layout/Header.tsx`**: Remove `border-b border-virgilio-border` from the `<header>` className. The header will still gain a soft shadow on scroll via the existing `shadow-calendly` when `scrolled` is true, so separation is preserved when needed without a permanent hard line.