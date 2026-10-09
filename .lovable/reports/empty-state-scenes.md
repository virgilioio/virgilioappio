# Animated empty states: plane v2, flag, magnifier, calendar (2026-10-09)

Built by Claude directly in the repo, tested against intercepted fake data, merged to `main`. Source: "START HERE", "Claude Prompt · Paper Plane v2", "Claude Prompt · Animated Empty States (Jobs, Search, Scheduling)" and the reference JSX from Claude Design. Rules: CLAUDE.md §17 (new) and §16.

## What changed
- **Paper plane v2.** One continuous glide (`glide` = cubic-bezier .45,0,.15,1), a smoothed bank that eases in and levels out before landing, gentle lift. Geometry, colours, 2.8s, resting frame and reduced motion unchanged.
- **Shared scene kit** (`src/components/empty/scene-kit.tsx`): easing helpers (`cubicBezier`, `glide`, `smooth`, `easeOut`, `easeInOut`), `Spark`, `BLOB_PATH`, `SceneSvg`, and `useSceneMode`, which decides when a scene plays.
- **Three new scenes** (`scenes.tsx`): `FlagScene` (CSS, 2.6s), `MagnifierScene` (rAF along the dotted path, 2.8s, tilt reaches 0 before it lands), `CalendarScene` (CSS, 2.6s).
- **`AnimatedEmpty`**: the one empty-state block for all four scenes. `CandidatesEmpty` is now a thin wrapper (plane, or the search scene when filtered). `EmptyCard` is the card it sits in when no list hosts it.
- **`LoadError` + `useLoadTimeout`**: what a list shows when its first load fails or runs past 15s, with Retry.

## Where they went
| Surface | Empty | Filtered / hidden | Error |
|---|---|---|---|
| Jobs list | Flag, "No open jobs", Create job | Search, "No jobs match these filters", Clear filters. An empty status tab gets its own copy ("No closed jobs" …) instead of a Clear filters that did nothing | LoadError + Retry, 15s timeout |
| Careers pages (public + Virgilio) | Flag, "No open roles right now", no action | Search, Clear filters | The postings error was swallowed; now LoadError + Retry. "Not found" stays for a missing page |
| Global search (top-bar panel) | Compact search scene, "No matches", Clear search, above the Ask Gio / Add as candidate rows | — | When every source fails: LoadError + Retry (was "no matches") |
| Global search (phone dialog) | Search scene in a card, Clear search | A tab that hides every result: "Show all results" | LoadError + Retry |
| Candidates | Plane, "No candidates yet", Add candidate | Search, "Nothing fits “…”. The N candidates are still there…", Clear filters · Edit search. Favorites, New this week and saved views now count as filters | LoadError + Retry inside the list (was a red line replacing the page) |
| Talent Intelligence | Plane, "Your talent database is empty", Import candidates (opens the CSV import on Candidates) | Search, Clear filters | LoadError + Retry |
| Find results | Search, "No matches for this search", Edit search (focuses the first criteria field) | Result filters hiding every match: Clear filters | LoadError + Retry (the hook's error was never read) |
| Dashboard › Today | Compact calendar, "Nothing on today" | — | LoadError + Retry |
| Candidate › Activity | Compact calendar, "No activities yet", Schedule interview | Categories hiding every event: search scene, Clear filters | LoadError + Retry; the header no longer says "0 events" while loading |
| Settings › Booking › Event types | Compact calendar, "No event types yet", Create event type (secondary) | — | LoadError + Retry |

## Design → ATS mappings (existing primitives win)
| Design value | Built as | Why |
|---|---|---|
| `cta` prop, black pills | `primary` / `secondary` `{ label, icon, onClick }` on `EmptyAction` | The ATS empty-state button and typography |
| "Use a template" (Jobs) | Left out | There's no job template feature |
| Careers "Follow" link | No action | Orgs have no follow link |
| "Log activity" (candidate Activity) | Schedule interview | There's no log-activity feature; Schedule interview is the existing action with the same purpose |
| "No booking links yet / Create booking link" | "No event types yet / Create an event type candidates can use to pick a time that works." / Create event type | The page calls them event types, and its header button is "Create event type" |
| Flag and calendar shadows animate opacity 0→1 on an ellipse with `opacity=.05` | The animation runs on a wrapper `<g>` | Otherwise the shadow flashes solid black |
| Transform origins about the SVG origin | Explicit origins in view-box px (plane 123.1/57, lens 122/66, shadows at their centres) | Rotations and scales stay on the graphic |
| Scenes play on mount | They wait (drawn blank, their own first frame) until a third is on screen | Below-the-fold scenes (careers on a phone) played unseen; a hidden desktop/phone copy took the one flight |
| Top-bar search: "no animation" (§2 command palette / `gio-static`) | The panel itself still doesn't animate; the scene plays once per session (`onceKey`) | Matches §17 without animating every keystroke |
| Today card: canonical EmptyState card inside the card | Compact scene directly in the card (the card is shorter) | No card-in-a-card |

## Checks (Step 6)
1. **Final frame = static graphic** (screenshot diff, max channel difference): plane 1, flag 0, magnifier 1, calendar 6 (antialiasing), no pixel above 8. Pass.
2. **No snaps:** plane speed changes at most 0.0085 px/ms per frame and its roll at most 2.2° per frame; roll and magnifier tilt reach 0 before landing. Pass.
3. **Plays once:** a second scene in view rests; `onceKey` surfaces rest on return; a flight cut short doesn't count. Pass.
4. **Reduced motion:** rest state at once, 0 running animations. Pass.
5. **Two scenes on a page:** unique mask and path ids; the CSS-hidden desktop/phone copy never plays. Pass.
6. **Every Step 5 surface uses `AnimatedEmpty`**, except the Calendar grid (below). Pass.
7. **Filtered empty:** search scene + Clear filters, no create actions, on every surface above. Pass.
8. **No layout shift / status-driven views:** each surface was tested for empty, filtered, failed-then-Retry in Chromium with fake data. Search shows "No matches" only once results belong to what's typed. Pixel comparison against `main` on 7 routes at 1440 and 390: only the Dashboard Today card differs (intended). Production build passes; no new lint errors. Pass.

## Not done, and why
- **Calendar page grid.** Its empty slots are the content: you drag on them to create an interview. An illustration over an empty week would cover the slots you need, so the grid stays as it is. If you want the scheduling scene there, the place would be a strip above the grid ("No interviews this week · Schedule interview · Send booking link"); say the word.
- **Skeleton → empty crossfade** on surfaces that don't already use `Loadable` (table bodies, cards): the swap is instant, but every scene starts blank and fades in, so it reads as a fade. The job pipeline keeps its `Loadable`.
- **Find has no 15s timeout.** Its search calls outside providers and can legitimately take longer; a failure still shows Retry.
