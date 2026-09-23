/**
 * Calendar colour system — interviews and holds are coloured by their HOST
 * (the person running them). The signed-in user is always brand purple.
 */

export interface CalendarTone {
  bg: string
  edge: string
  text: string
}

/** Slot 0 is the "you" purple; 1–5 cycle per workspace member. */
export const CALENDAR_PALETTE: CalendarTone[] = [
  { bg: '#EDE4FF', edge: '#6F3FF5', text: '#3D1FA3' }, // you / purple
  { bg: '#E0F2FE', edge: '#0284C7', text: '#075985' }, // blue
  { bg: '#FEF9C3', edge: '#CA8A04', text: '#713F12' }, // yellow
  { bg: '#DCFCE7', edge: '#16A34A', text: '#14532D' }, // green
  { bg: '#FCE7F3', edge: '#DB2777', text: '#831843' }, // pink
  { bg: '#CCFBF1', edge: '#0D9488', text: '#134E4A' }, // teal
]

export const YOU_TONE: CalendarTone = CALENDAR_PALETTE[0]

/** Debrief re-toned off amber so it never reads as "the yellow person". */
export const DEBRIEF_TONE: CalendarTone = { bg: '#EEF1F6', edge: '#475569', text: '#334155' }

export const BUSY_TONE: CalendarTone = { bg: '#F1F0EC', edge: '#D2D4DC', text: '#8B8F9E' }

/** Resolve the tone for a host. The current user is always purple. */
export function toneForHost(
  hostUserId: string | null | undefined,
  currentUserId: string | null | undefined,
  colorIndexByUser: Map<string, number>,
): CalendarTone {
  if (hostUserId && currentUserId && hostUserId === currentUserId) return YOU_TONE
  if (!hostUserId) return CALENDAR_PALETTE[0]
  const idx = colorIndexByUser.get(hostUserId)
  if (idx == null) {
    // Stable fallback derived from the id so colours never flicker between loads.
    let h = 0
    for (let i = 0; i < hostUserId.length; i++) h = (h * 31 + hostUserId.charCodeAt(i)) % 5
    return CALENDAR_PALETTE[1 + h]
  }
  const safe = ((idx % 6) + 6) % 6
  return CALENDAR_PALETTE[safe === 0 ? 1 : safe]
}
