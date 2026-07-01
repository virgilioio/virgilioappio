## Goal
Make real Chat conversations appear in the left pane and render the left pane like the provided reference when conversations exist.

## Root cause to fix
The current left-pane query joins `candidates(first_name, last_name, email, avatar_url)`, but the live database `candidates` table does not have `first_name`, `last_name`, or `avatar_url`. It has `candidate_name`, `email`, `role_current`, `current_job_title`, etc. That query fails, so the UI falls back to an empty state even though the database currently has 2 real `chat_threads` for the active tenant.

## Implementation plan
1. **Repair chat thread data fetching**
   - Update `useChatThreads` to select existing candidate columns: `candidate_name`, `email`, `role_current`, `current_job_title`.
   - Normalize the returned candidate shape in the hook so the UI can display a full name, initials, email, and role/title without depending on non-existent split-name fields.
   - Keep sorting by `updated_at DESC` and keep `last_message_preview`, `message_count`, unread state, and job title from real records.

2. **Repair selected thread header**
   - Update `ThreadPane` header query to use `candidate_name`, `email`, `role_current/current_job_title` instead of missing split-name columns.
   - Ensure `/chat/:threadId` can show the selected candidate header while the left pane also includes that conversation.

3. **Make the left pane match the screenshot when conversations exist**
   - Conversation pane width around 320px, white surface, border-right, header row with “Conversations” and count badge.
   - Pencil/new-message button in the header.
   - Search input and filter chips styled like the reference.
   - Conversation rows with:
     - circular initials avatar,
     - candidate name,
     - role/job subtitle,
     - last message preview,
     - concise timestamp,
     - unread indicator/count using real unread calculation,
     - active row styling when the current route thread is selected.
   - Use real data only; no seeded/mock rows.

4. **Fix empty/error handling**
   - If the query errors, show a non-destructive inline error state instead of incorrectly saying “No conversations yet”.
   - Preserve the true zero state only when the backend returns zero threads.

5. **Preserve notification-open behavior**
   - Keep the filter reset when opening from a chat notification.
   - Keep the active-thread pinning behavior so a directly opened thread appears in the left pane when it is accessible.
   - Keep realtime invalidation for `chat_threads` and `chat_messages` so new or updated conversations refresh the list.

## Validation
- Verify the active tenant’s 2 existing real threads render in the left pane.
- Verify `/chat/c062d74c-c47d-4993-8c28-802948025cdb` shows Allan Bravo in the left pane and selected thread area.
- Verify no console/runtime error from the old missing candidate columns.
- Verify searching/filtering does not hide the route-opened active conversation unexpectedly.