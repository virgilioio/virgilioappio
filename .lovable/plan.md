

# Add Automations Tab to Job Settings + "Soon" Badge Component

## Overview

Add an **Automations** tab to Job Settings with sub-tabs for different automation categories. The **Confirmation Email** sub-tab will be fully functional; the remaining sub-tabs (Applicant Notifications, Interview Reminders, Stage Stagnation Alerts) will be disabled with a "Soon" badge. A reusable `SoonBadge` component will be created and documented in the Style Guide.

## What's Being Built

### 1. `SoonBadge` Component
A small reusable component matching the existing pattern in `ScorecardSheet.tsx` (`<Badge variant="outline" className="text-xs">Soon</Badge>`), standardized for consistent use across the app.

### 2. Automations Tab in `JobSettingsManager.tsx`
Add a new "Automations" tab alongside Stages Library, Application Fields, Templates, Careers Page, and Job Boards. This tab renders a new `AutomationsTab` component.

### 3. `AutomationsTab` Component
Contains inner tabs for each automation category:

| Sub-tab | Status | Description |
|---------|--------|-------------|
| Confirmation Email | Active | Configure default application confirmation email |
| Applicant Notifications | Soon | Notify hiring team of new applicants |
| Interview Reminders | Soon | Automated reminders for candidates/interviewers |
| Stage Alerts | Soon | Nudges when candidates stagnate in a stage |

### 4. `ConfirmationEmailAutomation` Component
The active sub-tab content. A settings card where workspace owners can:
- Toggle the automation on/off
- Set a default subject line
- Edit the email body template (using the existing email template patterns)
- Preview placeholder variables (candidate name, job title, company name)

This will be a **UI-only scaffold** for now -- the actual email sending infrastructure already exists via `posting_automations` tables and `process-application-automations` edge function (per memory context). This component provides the workspace-level default configuration UI.

### 5. Style Guide Update
Add a "Soon Badge" example to `TabsGuide.tsx` showing a disabled tab with the `SoonBadge`, documenting the pattern for future use.

## Technical Details

### Files to create
| File | Purpose |
|------|---------|
| `src/components/ui/soon-badge.tsx` | Reusable `SoonBadge` component |
| `src/components/settings/AutomationsTab.tsx` | Automations tab with sub-tabs |
| `src/components/settings/automations/ConfirmationEmailAutomation.tsx` | Confirmation email default config UI |

### Files to modify
| File | Change |
|------|--------|
| `src/components/settings/JobSettingsManager.tsx` | Add Automations tab |
| `src/components/settings/PlatformJobSettingsManager.tsx` | Add Automations tab for platform defaults |
| `src/components/candidates/ScorecardSheet.tsx` | Replace inline Badge with `SoonBadge` |
| `src/components/settings/styleguide/TabsGuide.tsx` | Add "Soon Badge" pattern example |

### `SoonBadge` implementation
```tsx
import { Badge } from '@/components/ui/badge'

export function SoonBadge() {
  return (
    <Badge variant="outline" className="text-xs ml-1">Soon</Badge>
  )
}
```

### `AutomationsTab` structure
```tsx
<Tabs defaultValue="confirmation-email">
  <TabsList>
    <TabsTrigger value="confirmation-email">Confirmation Email</TabsTrigger>
    <TabsTrigger value="applicant-notifications" disabled className="gap-2">
      Applicant Notifications <SoonBadge />
    </TabsTrigger>
    <TabsTrigger value="interview-reminders" disabled className="gap-2">
      Interview Reminders <SoonBadge />
    </TabsTrigger>
    <TabsTrigger value="stage-alerts" disabled className="gap-2">
      Stage Alerts <SoonBadge />
    </TabsTrigger>
  </TabsList>
  <TabsContent value="confirmation-email">
    <ConfirmationEmailAutomation />
  </TabsContent>
</Tabs>
```

### `ConfirmationEmailAutomation` scaffold
A card-based UI with:
- Toggle switch for enabling/disabling the default confirmation email
- Subject line input field with placeholder variables
- Rich text body area (or textarea for now) with available placeholders listed
- This is the workspace-level default; per-posting overrides will come later
