
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createSecureCorsHeaders, handleSecureCorsPreFlight, withRequestCors } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

interface DeleteUserRequest {
  userId: string
}

interface BlockerRow {
  table_name: string
  column_name: string
  row_count: number
}

/** What a blocking row means, in words a workspace owner recognises. */
const BLOCKER_LABELS: Record<string, [string, string]> = {
  'candidate_attachments.uploaded_by': ['file they uploaded', 'files they uploaded'],
  'candidate_urls.created_by': ['candidate link they added', 'candidate links they added'],
  'careers_page_settings.created_by': ['careers page setting', 'careers page settings'],
  'credit_purchases.purchased_by': ['credit purchase', 'credit purchases'],
  'dossier_shares.created_by': ['shared dossier', 'shared dossiers'],
  'download_logs.user_id': ['download record', 'download records'],
  'invitations.invited_by': ['invitation they sent', 'invitations they sent'],
  'job_assignments.assigned_by': ['job assignment they made', 'job assignments they made'],
  'job_board_integrations.created_by': ['job board connection', 'job board connections'],
  'job_candidate_associations.hired_by': ['hire they recorded', 'hires they recorded'],
  'job_candidate_associations.offered_by': ['offer they recorded', 'offers they recorded'],
  'job_openings.recruiter_user_id': ['opening they recruit for', 'openings they recruit for'],
  'job_openings.sourcer_user_id': ['opening they source for', 'openings they source for'],
  'jobs.last_edited_by': ['job they last edited', 'jobs they last edited'],
  'offer_letters.created_by': ['offer letter', 'offer letters'],
  'organizations.billing_poc_updated_by': ['workspace billing record', 'workspace billing records'],
  'organizations.created_by': ['organization they created', 'organizations they created'],
  'rejection_email_templates.created_by': ['rejection email template', 'rejection email templates'],
  'rejection_reasons.created_by': ['rejection reason', 'rejection reasons'],
  'scheduled_bookings.booked_by': ['meeting they booked', 'meetings they booked'],
  'scheduled_bookings.cancelled_by': ['meeting they cancelled', 'meetings they cancelled'],
  'scheduled_bookings.interviewer_id': ['interview or meeting they host', 'interviews and meetings they host'],
  'sourcing_project_collaborators.added_by': ['sourcing collaborator they added', 'sourcing collaborators they added'],
  'sourcing_projects.created_by': ['sourcing project', 'sourcing projects'],
  'stage_automations.created_by': ['stage automation', 'stage automations'],
  'stage_scorecard_templates.created_by': ['scorecard template', 'scorecard templates'],
  'tenant_domains.added_by': ['workspace domain they added', 'workspace domains they added'],
  'tenant_domains.verified_by': ['workspace domain they verified', 'workspace domains they verified'],
  'tenants.owner_id': ['workspace they own', 'workspaces they own'],
}

function describeBlocker(b: BlockerRow): string {
  const n = Number(b.row_count)
  const label = BLOCKER_LABELS[`${b.table_name}.${b.column_name}`]
  const count = n.toLocaleString('en-US')
  if (label) return `${count} ${n === 1 ? label[0] : label[1]}`
  return `${count} ${b.table_name.replace(/_/g, ' ')} (${b.column_name.replace(/_/g, ' ')})`
}

Deno.serve(withRequestCors(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    })

    // Verify the user is a platform admin
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: userType } = await supabaseClient.rpc('get_user_type')
    if (userType !== 'platform_admin' && userType !== 'workspace_owner') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: DeleteUserRequest = await req.json()
    console.log('Delete user request:', body)

    // Validate userId
    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For workspace owners, verify the target user belongs to their tenant
    if (userType === 'workspace_owner') {
      const { data: callerOrg } = await supabaseClient.rpc('get_user_organization_id')
      const { data: callerTenantData } = await supabaseAdmin
        .from('organizations').select('tenant_id').eq('id', callerOrg).single()
      const { data: targetMember } = await supabaseAdmin
        .from('members').select('tenant_id').eq('user_id', body.userId).limit(1).single()

      if (!callerTenantData || !targetMember || callerTenantData.tenant_id !== targetMember.tenant_id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete users outside your tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Step 0 (2026-10-13): check before removing anything. Rows that still point
    // at this login with no cascade rule would make the last step fail after
    // the profile and memberships were already gone, leaving the person
    // half-removed. Refuse up front, in plain words, and change nothing.
    const { data: blockers, error: blockersError } = await supabaseAdmin
      .rpc('user_deletion_blockers', { p_user_id: body.userId })
    if (blockersError) {
      console.error('Error in user_deletion_blockers:', blockersError)
      return new Response(
        JSON.stringify({ error: 'check_failed', message: "Couldn't check what this person is linked to, so nothing was removed. Try again." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (Array.isArray(blockers) && blockers.length > 0) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('first_name, last_name, email').eq('user_id', body.userId).maybeSingle()
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
        || profile?.email || 'this person'
      const reasons = (blockers as BlockerRow[]).map(describeBlocker)
      const shown = reasons.slice(0, 4).join(', ')
      const more = reasons.length > 4 ? ` and ${reasons.length - 4} more` : ''
      return new Response(
        JSON.stringify({
          error: 'blocked',
          message: `Can't delete ${name} yet. Their account is still linked to ${shown}${more}. Nothing was deleted.`,
          blockers,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Use the safe delete function to remove from public tables
    const { data: deleteResult, error: deleteError } = await supabaseClient
      .rpc('safe_delete_user', { target_user_id: body.userId })

    if (deleteError) {
      console.error('Error in safe_delete_user:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user data', details: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = deleteResult[0]
    if (!result.success) {
      console.log('Safe delete failed:', result.message)
      return new Response(
        JSON.stringify({ error: result.message, affectedTables: result.affected_tables }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Delete from auth.users using admin client (only if user has auth record)
    let authDeleteMessage = 'No auth user to delete (invited member only)';
    
    // Only try to delete from auth if userId is a valid UUID and user exists
    if (body.userId) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(body.userId)

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError)
        return new Response(
          JSON.stringify({ 
            error: 'User data deleted but auth deletion failed', 
            message: "Their profile and memberships were removed, but their login couldn't be. Tell a platform admin.",
            details: authDeleteError.message,
            affectedTables: result.affected_tables
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      authDeleteMessage = 'Auth user successfully deleted';
    }

    console.log('User successfully deleted:', body.userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User completely deleted from all systems. ${authDeleteMessage}`,
        affectedTables: result.affected_tables
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}))
