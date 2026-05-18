# Fix Offer banner buttons to match Schedule/Email

## What will change

Make the Offer banner buttons structurally match the top action buttons and prevent the banner text color from bleeding into them.

## Exact fix

- Keep the Offer banner background aligned with the navigation black.
- Remove `text-white` from the Offer banner wrapper so it cannot cascade into child buttons.
- Apply white text only to the banner text/icon elements that need it.
- Keep both banner actions as standard Gio secondary buttons:

```text
<Button variant="secondary" size="md" icon={...}>...</Button>
```

## Result

- `Reactivate` and `Create offer` will render like `Schedule` and `Email`: white fill, hairline border, dark readable text, 34px height, same typography.
- No custom button color overrides.
- No changes to Schedule/Email or offer workflow logic.

## File

- `src/components/candidates/OfferStatusBanner.tsx`
