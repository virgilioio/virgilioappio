

# Application Review Sheet: Cards & Tabbed Middle Column

## Changes

### 1. Wrap Review Controls in Cards
Wrap the action buttons and rejection settings in `Card` components matching the candidate profile sheet pattern:

- **Action Buttons Card**: `Card > CardHeader > CardTitle("Actions") + CardContent` containing the Reject | Pass | Advance button row
- **Rejection Settings Card**: `Card > CardHeader > CardTitle("Rejection Settings") + CardContent` containing the existing `RejectionConfigPanel` content

### 2. Tabbed Middle Column (Column 2)
Replace the static "Application Responses" column with a `Tabs` component containing two tabs:

- **Tab 1: "Application Responses"** — existing `CandidateApplicationResponses` component
- **Tab 2: "AI Career Summary"** — the `ProfileSummaryMarkdown` content currently buried at the bottom of Column 1 (below the resume)

Remove the AI Career Summary section from Column 1 (resume column) since it moves to Column 2's tab.

The tabs use the project's existing styled `Tabs/TabsList/TabsTrigger/TabsContent` components with the purple active state.

### File Modified
- **`src/components/candidates/ApplicationReviewSheet.tsx`**
  - Import `Card, CardContent, CardHeader, CardTitle` and `Tabs, TabsList, TabsTrigger, TabsContent`
  - Column 2: Replace static header + responses with `Tabs` containing two `TabsTrigger`s and corresponding `TabsContent`
  - Column 3: Wrap buttons in an "Actions" card, wrap `RejectionConfigPanel` in a "Rejection Settings" card
  - Column 1: Remove the AI Career Summary section (lines 197-207)

