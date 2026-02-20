import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminOperationRequest {
  action: 'delete-job' | 'delete-candidate' | 'manage-member' | 'manage-organization'
  job_id?: string
  candidate_id?: string
  member_id?: string
  organization_id?: string
  changes?: Record<string, any>
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get the JWT from the request to verify platform admin status
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '')
    
    // Create client with user JWT to verify their identity
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Failed to get user from JWT:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin operation requested by user:', user.id)

    // Verify user is platform admin — read user_type from JWT user_metadata (set by auth trigger)
    const userType = user.user_metadata?.user_type
    if (userType !== 'platform_admin') {
      console.error('User is not platform admin:', user.id, 'user_type:', userType)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: AdminOperationRequest = await req.json()
    console.log('Admin operation:', body.action, 'by user:', user.id)

    let result: any

    // Route to appropriate SECURITY DEFINER function
    switch (body.action) {
      case 'delete-job':
        if (!body.job_id) {
          return new Response(
            JSON.stringify({ error: 'job_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('Calling admin_delete_job for:', body.job_id)
        const { data: jobResult, error: jobError } = await supabaseClient
          .rpc('admin_delete_job', { p_job_id: body.job_id })
        
        if (jobError) {
          console.error('admin_delete_job failed:', jobError)
          throw jobError
        }
        result = jobResult
        break

      case 'delete-candidate':
        if (!body.candidate_id) {
          return new Response(
            JSON.stringify({ error: 'candidate_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('Calling admin_delete_candidate for:', body.candidate_id)
        const { data: candidateResult, error: candidateError } = await supabaseClient
          .rpc('admin_delete_candidate', { p_candidate_id: body.candidate_id })
        
        if (candidateError) {
          console.error('admin_delete_candidate failed:', candidateError)
          throw candidateError
        }
        result = candidateResult
        break

      case 'manage-member':
        if (!body.member_id || !body.changes) {
          return new Response(
            JSON.stringify({ error: 'member_id and changes are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('Calling admin_manage_member for:', body.member_id)
        const { data: memberResult, error: memberManageError } = await supabaseClient
          .rpc('admin_manage_member', { 
            p_member_id: body.member_id,
            p_changes: body.changes 
          })
        
        if (memberManageError) {
          console.error('admin_manage_member failed:', memberManageError)
          throw memberManageError
        }
        result = memberResult
        break

      case 'manage-organization':
        if (!body.organization_id || !body.changes) {
          return new Response(
            JSON.stringify({ error: 'organization_id and changes are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('Calling admin_manage_organization for:', body.organization_id)
        const { data: orgResult, error: orgError } = await supabaseClient
          .rpc('admin_manage_organization', { 
            p_organization_id: body.organization_id,
            p_changes: body.changes 
          })
        
        if (orgError) {
          console.error('admin_manage_organization failed:', orgError)
          throw orgError
        }
        result = orgResult
        break

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    console.log('Admin operation succeeded:', body.action, 'result:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-operations:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
