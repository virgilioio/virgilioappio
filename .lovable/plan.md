## Objective
Add the job name below the candidate’s name in both the Chat conversation list and the candidate context pane.

## Changes

### 1. Conversation list row (`src/components/chat/ConversationListPane.tsx`)
- Update Line 2 (currently role + stage badge) to display the **job title** as the primary subtitle under the candidate name.
- Keep the stage badge on the same line or adjust layout so job name is clearly visible.

### 2. Context snapshot (`src/components/chat/ContextSnapshot.tsx`)
- Insert a new line directly under the candidate name showing `jobTitle`.
- Keep the existing location line below it; remove or demote the current role/company line since job name now occupies that position.

## Technical details
- `ChatThreadRow` from `useChatThreads` already carries `job?.title`, and `ContextSnapshotData` already carries `jobTitle`, so no backend or hook changes are required.
- Both edits are presentational-only (layout + copy). No new dependencies or state logic.