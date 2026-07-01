
## Goal

Scaffold the front end of the Chat module for a brand-new workspace: the shell chrome, the Chat label + scope control inside the **existing** dark top bar (single bar, no second one), the left conversation pane, and the canonical zero state. Frontend only, no data/AI/realtime changes.

## Shell integration (single top bar)

The existing `Header` renders the dark bar with section nav (Dashboard/Analytics/CRM). Its left cluster is empty on `/chat` because Chat has no section nav. We slot Chat-specific items into that same bar — no second bar.

Edit `src/components/layout/Header.tsx`:
- Detect `location.pathname.startsWith('/chat')`.
- When true, render a new `ChatHeaderSlot` in place of `visibleNavItems`.
- `ChatHeaderSlot` shows: `messages-square` icon + "Chat" (Poppins 600, 13.5px, cream) · `ScopeSegmented` pill group with **All / Unread / Assigned to me** (bg `rgba(255,255,255,0.06)`, radius 9, pad 3; active pill = cream fill, citron-noir text, Poppins 600; inactive = `rgba(255,255,255,0.72)` weight 500).
- Scope state is stored in the URL as `?scope=all|unread|assigned` via `useSearchParams` so the Chat page can read it without prop drilling. Default `all`.
- The right utility cluster (Global Search, Create, credits, bell, avatar) stays untouched — no separate "New message" button is added there.

## Chat page (`src/pages/Chat.tsx`)

- Wrap the content area in the white rounded-16 frame inset `top 72 · left 88 · right/bottom 12`, `1px hairline` border, over canvas `#F6F5F1`.
- Inside frame: `ConversationListPane` (320px, white, right border hairline) + `ThreadPane` (flex-1, bg `#FAFAF7`).
- `ContextPane` is only mounted when `threadId` is present (already handled).
- Read `scope` from `useSearchParams` and pass to the list pane.

## Left pane rebuild (`ConversationListPane`)

Header block (`padding 18 16 12`):
- Title row: **"Conversations"** (Poppins 600 16) + `<Badge tone="neutral">` **count tag** reflecting the filtered list length + right-aligned icon-only Button (`pen-line`, 30px white square, hairline border, tooltip "New message") — this is the Chat compose entry point.
- Search input "Search conversations" (canvas bg `#F6F5F1`, `search` icon, h-34, radius 9).
- Filter pill row (wrap, gap 6): **Unread** (`mail-open`, toggle), **By job** (`briefcase`, multi-select popover), **By stage** (`git-branch`, multi-select popover). Pill style: rounded-full, Inter 500 11.5, inactive white + hairline + muted, active citron-noir + cream. Job/stage popovers show an `InlineEmpty` placeholder for this pass (no new data hooks).

List body (scrollable, `border-top soft-hairline`):
- Uses existing `useChatThreads({ scope, search })` plus local Unread pill + selected job/stage sets applied client-side.
- Row (~72px): 40px Avatar with `ChannelDot` overlay (in-app purple / email blue / whatsapp green), Name (Poppins 600 13) + timestamp (tertiary 10.5 top-right), role/job line (tertiary 11), 2-line preview clamp (unread → weight 500 + darker, read → 400 muted), right side = purple count badge if unread else assigned recruiter mini-avatar (18px, initials fallback). Selected = soft-hairline bg + 2px purple left border; hover `#FAFAF7`.
- **Filtered empty**: `<InlineEmpty text="No conversations here" />`.
- **True zero** (no threads at all): `<InlineEmpty text="No conversations yet" />`; count tag reads `0`.
- Keep admin `AdminChatAuditViewer` and `ChatSlaWidget` mounted for admins as they are today (compact, in header area).

## Thread pane zero states (`ThreadPane`)

Two variants using canonical `<EmptyState>` + `SoftBubble`:

1. **Brand-new (no threads at all)** — detect via `useChatThreads({ scope: 'all' }).data?.length === 0`:
   - Card variant, `SoftBubble` illustration.
   - Title "No conversations yet".
   - Body: "Chat brings every conversation — in-app, email, and WhatsApp — into one calm space, with Gio drafting and summarizing alongside you."
   - Buttons: primary `New message` (`pen-line`, opens recipient picker) + secondary `Connect a channel` (`link`, navigates to `/settings?tab=organization#chat-channels`).
2. **No conversation selected (threads exist)** — bare variant (no card border):
   - Title "Select a conversation".
   - Body: "Choose a candidate from the left to pick up where you left off — or start a new message."
   - Single primary `New message`.

Removes the current `ConnectChannelCTA` from the thread empty (component stays available elsewhere).

## Compose / connect-channel handlers

- `New message` (list pencil + empty-state buttons) opens a shared `NewMessageSheet` — placeholder Sheet titled "New message" with a search field and `<InlineEmpty text="Recipient picker coming soon" />`. Real picker is out of scope.
- `Connect a channel` routes to `/settings?tab=organization#chat-channels` where `ChatChannelsCard` already lives.

## Files

**Create**
- `src/components/chat/ChatHeaderSlot.tsx` — `messages-square` + "Chat" label + scope segmented control; reads/writes `?scope` via `useSearchParams`.
- `src/components/chat/ConversationFilterPills.tsx` — Unread / By job / By stage row with popovers.
- `src/components/chat/ChannelDot.tsx` — channel-color dot for avatar overlay.
- `src/components/chat/NewMessageSheet.tsx` — placeholder recipient picker Sheet.

**Edit**
- `src/components/layout/Header.tsx` — conditional Chat slot in the left cluster.
- `src/pages/Chat.tsx` — white rounded frame, read `scope` from URL, conditional `ContextPane`.
- `src/components/chat/ConversationListPane.tsx` — new header (title + count tag + pencil), new pill row via `ConversationFilterPills`, channel dot on avatars, InlineEmpty for true-zero and filtered-empty.
- `src/components/chat/ThreadPane.tsx` — two zero-state variants (brand-new vs no-selection); shared compose handler.
- `src/components/chat/ScopeTabs.tsx` — deprecated (superseded by `ChatHeaderSlot`); keep the `ChatThreadScope` type export in `useChatThreads`.

## Acceptance

- Single dark top bar; Chat label + All/Unread/Assigned pills live inside it on `/chat`.
- Global Search, Create, credits, bell, avatar unchanged in the top bar.
- Left pane header: "Conversations" + count tag + pencil + search + Unread/By job/By stage pills.
- True zero: left list `InlineEmpty "No conversations yet"` (count 0); thread area `SoftBubble` `EmptyState` with New message + Connect a channel.
- No conversation selected (threads exist): bare `EmptyState "Select a conversation"` with single `New message`.
- Filtered empty: `InlineEmpty "No conversations here"`.
- `ContextPane` absent whenever no `threadId` is in the URL.
- All tokens, fonts, radii come from the existing system.
