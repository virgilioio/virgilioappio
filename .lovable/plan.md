

# Align Empty States to Branded Gio Pattern

## Problem
Several empty states in the candidate profile use plain icons and generic small text instead of the branded pattern with the Gio avatar face, large title typography (`text-[1.38rem] font-semibold tracking-[-0.06em]`), and lilac period (`text-[#d7c5fb]`).

## Already Aligned (reference pattern)
- CandidateComments, CandidateAttachments, CandidateUrls, CandidateReminders — all use `gio-face-empty.png` + branded typography.

## Components to Fix

### 1. `src/components/candidates/CandidateOfferDetails.tsx` (lines 63-74)
Replace the plain `FileText` icon empty state with the Gio avatar pattern:
- Import `gioFaceEmpty` asset
- Use `<img src={gioFaceEmpty} className="h-16 w-16 mx-auto mb-4 rounded-full" />`
- Title: `text-[1.38rem] font-semibold tracking-[-0.06em]` with lilac period
- Keep the subtitle and any action button below

### 2. `src/components/candidates/CandidateProfileSheet.tsx` — Resume empty state (lines 1229-1245)
Replace the plain `FileText` icon with the Gio avatar pattern:
- Import `gioFaceEmpty` asset
- Same branded title/period styling
- Keep the "Upload Resume" button

### 3. `src/components/candidates/EmailHistoryList.tsx` (lines 64-76)
Replace the plain `Mail` icon circle with the Gio avatar pattern:
- Import `gioFaceEmpty` asset
- Apply branded title/period styling to "No emails yet"

### 4. `src/components/candidates/ActivityFeedList.tsx` (lines 43-56)
Replace the plain `Activity` icon circle with the Gio avatar pattern:
- Import `gioFaceEmpty` asset
- Apply branded title/period styling to "No activity yet"

## Files Changed
- `src/components/candidates/CandidateOfferDetails.tsx`
- `src/components/candidates/CandidateProfileSheet.tsx`
- `src/components/candidates/EmailHistoryList.tsx`
- `src/components/candidates/ActivityFeedList.tsx`

