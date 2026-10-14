import { Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { confirmDestructive } from '@/components/ui/confirm-dialog'

/**
 * The workspace kill switch (Allan, 2026-10-13): a platform admin deletes a
 * deactivated SaaS customer's workspace. Its candidates become Virgilio's; the
 * rest goes. The admin-remove-workspace edge function does the work in one
 * transaction; this asks it for a preview, shows the type-to-confirm dialog
 * with the real counts, then removes.
 */

interface Preview {
  name: string
  counts: Record<string, number>
  users_to_remove: string[]
}

export interface RemoveResult {
  removed: Preview
  filesRemoved: number
  loginsRemoved: number
  loginsKept: { userId: string; reason: string }[]
}

interface Call<T> {
  ok: boolean
  data?: T
  status?: number
  message?: string
}

async function call<T>(body: Record<string, unknown>): Promise<Call<T>> {
  const { data, error } = await supabase.functions.invoke('admin-remove-workspace', { body })
  if (!error) return { ok: true, data: data as T }
  let status = 0
  let message = ''
  try {
    const res = (error as { context?: Response }).context
    status = res?.status ?? 0
    const parsed = await res?.json?.()
    message = parsed?.message ?? ''
  } catch {
    /* fall through to the generic message */
  }
  return { ok: false, status, message: message || "Couldn't reach the server, so nothing changed. Try again." }
}

const n = (v: number | undefined) => (v ?? 0).toLocaleString('en-US')
const plural = (v: number | undefined, one: string, many: string) => `${n(v)} ${(v ?? 0) === 1 ? one : many}`

function describe(p: Preview): string {
  const c = p.counts
  const parts: string[] = []
  const total = c.candidates ?? 0
  if (total === 0) {
    parts.push('It has no candidates.')
  } else {
    const moved = c.candidates_moved ?? 0
    const known = c.candidates_already_in_virgilio ?? 0
    const discarded = c.candidates_discarded ?? 0
    const lead = moved === total
      ? (total === 1 ? 'Its one candidate moves to Virgilio.' : `All ${n(total)} candidates move to Virgilio.`)
      : `Of its ${plural(total, 'candidate', 'candidates')}, ${n(moved)} ${moved === 1 ? 'moves' : 'move'} to Virgilio.`
    parts.push(lead)
    if (known) parts.push(`${known === 1 ? 'One is' : `${n(known)} are`} already in Virgilio, which keeps its own ${known === 1 ? 'record' : 'records'}.`)
    if (discarded) parts.push(`${discarded === 1 ? 'One was' : `${n(discarded)} were`} already deleted or merged and ${discarded === 1 ? 'goes' : 'go'} too.`)
  }
  const gone = [
    c.jobs ? plural(c.jobs, 'job', 'jobs') : '',
    c.bookings ? plural(c.bookings, 'booking', 'bookings') : '',
    c.members ? plural(c.members, 'member', 'members') : '',
  ].filter(Boolean)
  parts.push(gone.length ? `Its ${gone.join(', ')} and all its history are deleted.` : 'All its history is deleted.')
  const logins = p.users_to_remove?.length ?? 0
  if (logins) parts.push(`${plural(logins, 'person who belongs', 'people who belong')} only to this workspace ${logins === 1 ? 'loses their' : 'lose their'} login.`)
  parts.push('This can’t be undone.')
  return parts.join(' ')
}

/**
 * Runs the whole flow. Resolves with the result once the workspace is gone,
 * or null if the admin cancelled or it was refused (the refusal is shown).
 */
export async function requestRemoveWorkspace(
  tenantId: string,
  displayName: string,
  onPreviewed?: () => void,
): Promise<RemoveResult | null> {
  const preview = await call<{ preview: Preview }>({ tenantId, apply: false })
  onPreviewed?.()
  if (!preview.ok) {
    await confirmDestructive({
      variant: 'blocked',
      icon: Building2,
      title: `${displayName} can’t be deleted yet`,
      description: preview.message,
      confirmLabel: '',
    })
    return null
  }
  const p = preview.data!.preview
  let result: RemoveResult | null = null
  const ok = await confirmDestructive({
    variant: 'delete',
    icon: Building2,
    title: `Delete ${p.name}?`,
    description: describe(p),
    confirmLabel: 'Delete workspace',
    typeToConfirm: p.name,
    onConfirm: async () => {
      const done = await call<RemoveResult>({ tenantId, apply: true, confirmName: p.name })
      if (!done.ok) throw new Error(done.message)
      result = done.data ?? null
    },
  })
  return ok ? result : null
}
