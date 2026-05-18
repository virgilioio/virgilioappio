# Fix Offer banner button styling

## Change

Make the Offer banner action buttons use the same secondary button styling as the top Schedule and Email buttons:

```text
<Button variant="secondary" size="md" ...>
```

## Exact behavior

- `+ Create offer` becomes the standard secondary button: white fill, hairline border, dark text, same height as Schedule/Email.
- `Reactivate` sits to the left and uses the same standard secondary styling for consistency and legibility.
- Remove the `onDark` remap from these banner buttons because it intentionally changes secondary buttons into translucent white-text buttons, which is not what is wanted here.
- Keep the banner background black as-is.

## File

- `src/components/candidates/OfferStatusBanner.tsx`
