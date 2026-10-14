import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, handlePreflight, withRequestCors } from '../_shared/cors.ts'

/**
 * The workspace kill switch (Allan, 2026-10-13). Platform admins only.
 *
 *   { tenantId, apply: false }                 → preview: what removing would do
 *   { tenantId, apply: true, confirmName }     → remove it for good
 *
 * All the database work is one transaction in platform_remove_workspace():
 * candidates move to Virgilio, everything else of the workspace goes. The
 * preview runs the same steps and rolls them back. After a removal this
 * function also clears the files nothing uses any more and the logins of
 * people who belonged only to that workspace (each one checked first with
 * user_deletion_blockers, so nobody is half-removed).
 */

interface Body {
  tenantId?: string
  apply?: boolean
  confirmName?: string
}

interface Report {
  tenant_id: string
  name: string
  applied: boolean
  counts: Record<string, number>
  users_to_remove: string[]
  attachment_paths: string[]
}

const BUCKET = 'candidate-attachments'

function json(body: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
  })
}

Deno.serve(withRequestCors(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  const origin = req.headers.get('origin') ?? undefined

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'unauthorized', message: 'Sign in again.' }, 401, origin)

    const url = Deno.env.get('SUPABASE_URL')!
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user } } = await asCaller.auth.getUser()
    if (!user) return json({ error: 'unauthorized', message: 'Sign in again.' }, 401, origin)

    const { data: adminRow } = await admin
      .from('members').select('id')
      .eq('user_id', user.id).eq('user_type', 'platform_admin').eq('user_status', 'active')
      .limit(1).maybeSingle()
    if (!adminRow) {
      return json({ error: 'forbidden', message: 'Only a platform admin can remove a workspace.' }, 403, origin)
    }

    const body: Body = await req.json().catch(() => ({}))
    const tenantId = (body.tenantId ?? '').trim()
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return json({ error: 'bad_request', message: 'Which workspace? The request had no workspace id.' }, 400, origin)
    }

    const run = async (apply: boolean) => {
      const { data, error } = await admin.rpc('platform_remove_workspace', {
        p_tenant_id: tenantId,
        p_actor: user.id,
        p_apply: apply,
      })
      return { report: data as Report | null, error }
    }

    // Always preview first: it checks the rules and gives the name to match.
    const preview = await run(false)
    if (preview.error) return refusal(preview.error, origin)
    if (!body.apply) return json({ preview: preview.report }, 200, origin)

    const expected = (preview.report?.name ?? '').trim().toLowerCase()
    if (!expected || (body.confirmName ?? '').trim().toLowerCase() !== expected) {
      return json({
        error: 'name_mismatch',
        message: `Type the workspace name exactly as shown (${preview.report?.name ?? ''}) to remove it.`,
      }, 409, origin)
    }

    const done = await run(true)
    if (done.error || !done.report?.applied) {
      return done.error
        ? refusal(done.error, origin)
        : json({ error: 'not_applied', message: "The workspace wasn't removed. Nothing changed. Try again." }, 500, origin)
    }
    const report = done.report

    try {
      await admin.rpc('log_audit_event', {
        p_action: 'workspace_removed',
        p_table_name: 'tenants',
        p_record_id: tenantId,
        p_user_id: user.id,
        p_old_values: { name: report.name },
        p_new_values: report.counts,
      })
    } catch (e) {
      console.error('Audit log failed:', e)
    }

    // Files nothing uses any more. Best effort: the records are already gone.
    let filesRemoved = 0
    const paths = report.attachment_paths ?? []
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100))
      if (error) console.error('Storage cleanup failed:', error)
      else filesRemoved += data?.length ?? 0
    }

    // Logins of people who belonged only to this workspace.
    const loginsRemoved: string[] = []
    const loginsKept: { userId: string; reason: string }[] = []
    for (const userId of report.users_to_remove ?? []) {
      const { data: blockers, error: bErr } = await admin.rpc('user_deletion_blockers', { p_user_id: userId })
      if (bErr) {
        loginsKept.push({ userId, reason: "couldn't check what the account is linked to" })
        continue
      }
      if (Array.isArray(blockers) && blockers.length > 0) {
        const what = (blockers as { table_name: string; row_count: number }[])
          .map((b) => `${b.row_count} ${b.table_name.replace(/_/g, ' ')}`).join(', ')
        loginsKept.push({ userId, reason: `still linked to ${what}` })
        continue
      }
      const { error: sErr } = await admin.rpc('safe_delete_user', { target_user_id: userId })
      if (sErr) {
        loginsKept.push({ userId, reason: "couldn't clear the profile" })
        continue
      }
      const { error: aErr } = await admin.auth.admin.deleteUser(userId)
      if (aErr) loginsKept.push({ userId, reason: `profile cleared, login kept: ${aErr.message}` })
      else loginsRemoved.push(userId)
    }

    return json({
      removed: report,
      filesRemoved,
      loginsRemoved: loginsRemoved.length,
      loginsKept,
    }, 200, origin)
  } catch (e) {
    console.error('admin-remove-workspace failed:', e)
    return json({ error: 'internal', message: "Something went wrong, so nothing was removed. Try again." }, 500, origin)
  }
}))

/** Turns a database refusal into a plain sentence; never a raw server error. */
function refusal(error: { code?: string; message?: string }, origin?: string) {
  const code = error.code ?? ''
  if (code === 'GW002' || code === 'GW003') {
    return json({ error: code === 'GW003' ? 'not_ready' : 'refused', message: error.message }, 409, origin)
  }
  if (code === 'PGRST202' || code === '42883') {
    return json({
      error: 'not_installed',
      message: "Removing workspaces isn't switched on yet: its database step hasn't been applied.",
    }, 503, origin)
  }
  console.error('platform_remove_workspace failed:', error)
  return json({
    error: 'failed',
    message: "Couldn't remove the workspace, so nothing changed. Something still depends on it; the details are in the function logs.",
  }, 500, origin)
}
