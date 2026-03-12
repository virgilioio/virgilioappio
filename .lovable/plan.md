

# Update Chrome Extension Integration Card

## Changes

**1. Copy the Gio avatar to assets**
- Copy `user-uploads://Gio_2-2.png` to `src/assets/gogio-avatar.png`

**2. Update `IntegrationsTab.tsx`**
- Change name from `'Chrome Extension'` to `'GoGio - LinkedIn Companion'`
- Replace `<Chrome>` icon with `<img src={gogioAvatar}>` (imported from assets)
- Remove unused `Chrome` import from lucide-react

