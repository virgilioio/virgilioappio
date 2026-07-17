## Goal
Gmail-style trimming of quoted history inside an expanded email in the Emails tab. Only the newest reply is visible; the prior thread collapses behind a small "…" toggle. Pure presentation — no backend, no data changes, no changes outside the email-history card body.

## Where
`src/components/candidates/EmailHistoryList.tsx` — the expanded body block that renders `email.body_html` / `body_text` (around lines 347–362). One new helper file for the split logic.

## Approach

### 1. New helper: `src/utils/emailQuoteSplit.ts`
Pure function `splitEmailQuote(html?: string, text?: string) → { main, quoted, hasQuote }`.

Detection rules (run in order, first match wins; conservative — if nothing matches, `hasQuote = false` and we render as today):

**HTML path** (parse with `DOMParser`):
- Gmail: first `.gmail_quote`, `.gmail_quote_container`, or `.gmail_attr` node
- Apple Mail: `blockquote[type="cite"]`
- Outlook: `#divRtfBody`, `#appendonsend`, `div[id^="OLK_SRC_BODY_SECTION"]`, `hr#stopSpelling`
- Yahoo/Superhuman: `.yahoo_quoted`, `.ms-outlook-mobile-signature`'s following siblings
- Generic: first `<blockquote>` that comes after visible text
- Fallback header line: first element containing text matching `/^On .+ (wrote|escreveu|a écrit|schrieb):/i` or a line starting with `-----+ ?Original Message ?-----+` / `From: .+\nSent: .+`

Everything from the matched node onward (that node + all following siblings, walking up to the body) is the `quoted` fragment. Everything before is `main`. Both serialized back to HTML strings.

**Plain-text path**: split on the first line matching the same "On … wrote:" / "-----Original Message-----" / leading `>` block. Preserve original line breaks.

Guardrails:
- If `main` after trim is empty (e.g. top-poster with no text — rare), treat as `hasQuote = false` so we never hide the whole email.
- If `quoted` after trim is < 40 chars, also `hasQuote = false` (not worth a toggle).

Small unit sanity: mount the file with a couple of doctests in comments; no test framework change needed.

### 2. Row rendering (EmailHistoryList.tsx)
Inside the `open` branch, replace the current body renderer with:

```
const { main, quoted, hasQuote } = useMemo(
  () => splitEmailQuote(email.body_html, email.body_text),
  [email.body_html, email.body_text],
)
const [showQuoted, setShowQuoted] = useState(false)
```

Render:
1. `<SafeHtml content={main} …>` (or plain-text `<div>` when no HTML), same wrapper classes/styles as today.
2. If `hasQuote`, a compact toggle button placed immediately after the main body:
   - Collapsed state: a 22×22 pill with three dots (`MoreHorizontal` icon from lucide, already available) — background `#F1F0EC`, hover `#E7E6E0`, border `1px solid #E0DDD3`, radius 6. `aria-label="Show trimmed content"`. Matches Gmail affordance.
   - Expanded state: same pill rotated / filled, `aria-label="Hide trimmed content"`.
3. When `showQuoted`, render `<SafeHtml content={quoted} …>` below the toggle, wrapped in a muted container: left border `2px solid #E0DDD3`, `padding-left: 10px`, `margin-top: 8px`, text color `#5A6072`, font-size unchanged. For plain-text emails, render `quoted` inside a `<pre className="whitespace-pre-wrap">` with the same muted styling.
4. Reset `showQuoted` to `false` whenever the row collapses (`open` goes false) so reopening always starts trimmed — done with a `useEffect` on `open`.

No changes to attachments, error banner, action row, or the collapsed preview snippet (the existing `preview` already strips HTML so it stays short).

### 3. Non-goals (explicit)
- No change to inbound/outbound detection, statuses, rail colors, header, or Refresh button.
- No change to `EmailHistoryCard.tsx` (legacy, not used by the reskinned list).
- No change to compose/reply/forward flows or `formatQuotedReply` (reply still quotes the full original — that's separate).
- Not touching sidebar, insights, or composer.

## Acceptance
- Long back-and-forth threads show only the newest reply; a "…" chip reveals the rest.
- Emails without a detectable quote render exactly as they do today (no toggle).
- Toggle state is per-row and resets when the row is collapsed and reopened.
- Works for Gmail, Apple Mail, Outlook, and generic "On … wrote:" plain-text replies.
