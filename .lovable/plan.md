## Bug

`src/components/ui/GioSplash.tsx` line 62 renders `<svg ... width="300" height="auto" ...>`. `auto` is not a valid SVG length and React throws in production (`Error: <svg> attribute height: Expected length, "auto"`), which crashes `<GioSplash>`. Because the splash sits above the auth UI and never unmounts cleanly on error, `/auth` shows the loader forever.

Unrelated to last commit — the bad attribute has been there; it only became fatal once the splash started mounting in this path.

## Fix

One line. Remove the invalid `height="auto"` and let the SVG derive its rendered height from `viewBox` + `width="300"` (intrinsic aspect ratio is preserved). No CSS change needed — `.logo-holder` already scales the whole thing with `transform: scale(0.5)`.

```diff
- height="auto"
```

That's it. No other edits.

## Verify

- `bun run build` clean.
- Open `/auth` in the preview — splash plays then exits, login form appears.
- Console clean of the SVG attribute error.
