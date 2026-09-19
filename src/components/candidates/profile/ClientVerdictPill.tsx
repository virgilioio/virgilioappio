/**
 * The client's answer, at a glance, on every tab. Never retires — unlike the
 * Job Overview banner, this is the state, not a call to action.
 *
 * Declined is neutral sand, never red: the client made a normal decision and the
 * interface should not scold them for it.
 */
import type { ClientVerdictState } from '@/hooks/useClientVerdict'

const TONES: Record<Exclude<ClientVerdictState, 'none'>, { label: string; bg: string; border: string; fg: string }> = {
  sent: { label: 'Dossier sent', bg: '#FBFAF7', border: '#E7E5DC', fg: '#5A6072' },
  viewed: { label: 'Client viewed', bg: '#FBFAF7', border: '#E7E5DC', fg: '#5A6072' },
  requested: { label: 'Interview requested', bg: '#F2FBF5', border: '#C6E9D3', fg: '#0B6E4F' },
  declined: { label: 'Client: not a fit', bg: '#FBFAF7', border: '#E0DDD3', fg: '#5A6072' },
}

export function ClientVerdictPill({ state }: { state: ClientVerdictState }) {
  if (state === 'none') return null
  const tone = TONES[state]

  return (
    <span
      className="hidden sm:inline-flex items-center h-[34px] rounded-full px-3 font-inter text-[11.5px] font-medium whitespace-nowrap"
      style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.fg }}
    >
      {tone.label}
    </span>
  )
}
