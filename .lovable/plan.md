

# Audit: Empty States Missing Gio Face Avatar

## Findings

The Gio face avatar (`gio-face-empty.png`) is currently used in **2 places**:
- `CandidateComments.tsx` (Notes tab) ✅
- `CandidateReminders.tsx` (Reminders tab) ✅

The following **candidate profile sheet** empty states use generic Lucide icons instead — these are the inconsistencies that matter most, since they sit right alongside the tabs that already use Gio:

| File | Current Icon | Context |
|------|-------------|---------|
| `CandidateAttachments.tsx` | `File` icon | Attachments tab in candidate profile |
| `CandidateUrls.tsx` | `ExternalLink` icon | URLs section in candidate profile |

Other empty states (dashboard widgets, settings pages, admin panels, billing) use their own patterns (`EmptyState` component with `fallbackIcon` + platform assets, or contextual icons). Those are intentionally different — they're not candidate profile tabs and don't need the Gio branding.

## Plan

### 1. `src/components/candidates/CandidateAttachments.tsx`
- Import `gioFaceEmpty` from `@/assets/gio-face-empty.png`
- Replace `<File className="h-8 w-8 mx-auto mb-2 opacity-50" />` with `<img src={gioFaceEmpty} alt="No attachments" className="h-16 w-16 mx-auto mb-4 rounded-full" />`

### 2. `src/components/candidates/CandidateUrls.tsx`
- Import `gioFaceEmpty` from `@/assets/gio-face-empty.png`
- Replace `<ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />` with `<img src={gioFaceEmpty} alt="No URLs" className="h-16 w-16 mx-auto mb-4 rounded-full" />`
- Update the text styling to match the branded pattern used in Comments/Reminders (add the purple period, use `text-[1.38rem] font-semibold tracking-[-0.06em]`)

Two file changes, no new dependencies.

