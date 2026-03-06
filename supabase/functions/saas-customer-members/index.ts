import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MemberWithProfile {
  id: string
  user_id: string | null
  system_role: string
  user_status: string
  user_type: string | null
  invited_email: string | null
  created_at: string
  updated_at: string
  profile: {
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header to verify the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify they're authenticated
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client for cross-tenant queries
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if user is platform admin using service client to bypass RLS
    const { data: memberRecord, error: memberError } = await serviceClient
      .from('members')
      .select('user_type, user_status')
      .eq('user_id', user.id)
      .eq('user_type', 'platform_admin')
      .eq('user_status', 'active')
      .maybeSingle()

    console.log('Platform admin check for user:', user.id, 'Result:', memberRecord)

    if (memberError || !memberRecord) {
      console.error('Not platform admin:', memberError || 'No platform_admin membership found for user ' + user.id)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body for tenantId
    const body = await req.json().catch(() => ({}))
    const tenantId = body.tenantId

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching members for tenant:', tenantId)

    // Fetch members for the tenant using service role to bypass RLS
    const { data: members, error: membersError } = await serviceClient
      .from('members')
      .select(`
        id,
        user_id,
        system_role,
        user_status,
        user_type,
        invited_email,
        created_at,
        updated_at
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (membersError) {
      console.error('Error fetching members:', membersError)
      throw membersError
    }

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ members: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user_ids for members who have completed signup
    const userIds = members
      .filter(m => m.user_id)
      .map(m => m.user_id)

    // Fetch profiles for members with user_ids
    let profiles: any[] = []
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await serviceClient
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .in('user_id', userIds)

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
      } else {
        profiles = profilesData || []
      }
    }

    // Merge members with profiles
    const membersWithProfiles: MemberWithProfile[] = members.map(member => ({
      id: member.id,
      user_id: member.user_id,
      system_role: member.system_role,
      user_status: member.user_status,
      user_type: member.user_type,
      invited_email: member.invited_email,
      created_at: member.created_at,
      updated_at: member.updated_at,
      profile: member.user_id 
        ? profiles.find(p => p.user_id === member.user_id) || null
        : null
    }))

    console.log(`Successfully fetched ${membersWithProfiles.length} members for tenant ${tenantId}`)

    return new Response(
      JSON.stringify({ members: membersWithProfiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in saas-customer-members:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
