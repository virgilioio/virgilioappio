

# Update Center Gio Avatar in Mobile Bottom Nav

**File: `src/components/layout/MobileBottomNav.tsx`**

1. **Switch to `gio-avatar.png`**: Import `gioAvatar` from `@/assets/gio-avatar.png` (already imported in GioLoader) and use it instead of `gioFacePurple` in the center Home button's `<img>` tag (line 81).

2. **Make it 15% bigger**: Change the container from `h-11 w-11` (~44px) to `h-[50px] w-[50px]` (~15% larger) on line 78.

3. **Raise it higher**: Change `-mt-4` to `-mt-6` on line 75 to shift the avatar further upward, centering it visually relative to the nav bar.

