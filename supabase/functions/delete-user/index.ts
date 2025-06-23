
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
  userId: string
  reassignBillingPoc?: {
    organizationId: string
    newBillingPocUserId: string | null
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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
    if (userType !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: DeleteUserRequest = await req.json()
    console.log('Delete user request:', body)

    // Step 1: Handle billing POC reassignment if provided
    if (body.reassignBillingPoc) {
      const { organizationId, newBillingPocUserId } = body.reassignBillingPoc
      
      const { error: reassignError } = await supabaseClient
        .from('organizations')
        .update({ 
          billing_poc_user_id: newBillingPocUserId,
          billing_poc_updated_by: user.id,
          billing_poc_updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)

      if (reassignError) {
        console.error('Error reassigning billing POC:', reassignError)
        return new Response(
          JSON.stringify({ error: 'Failed to reassign billing POC', details: reassignError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Billing POC reassigned successfully')
    }

    // Step 2: Use the safe delete function to remove from public tables
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

    // Step 3: Delete from auth.users using admin client
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(body.userId)

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError)
      return new Response(
        JSON.stringify({ 
          error: 'User data deleted but auth deletion failed', 
          details: authDeleteError.message,
          affectedTables: result.affected_tables
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User successfully deleted:', body.userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User completely deleted from all systems',
        affectedTables: result.affected_tables
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
