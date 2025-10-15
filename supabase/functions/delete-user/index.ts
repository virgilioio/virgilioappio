
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

interface DeleteUserRequest {
  userId: string
}

Deno.serve(async (req) => {
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
    if (userType !== 'platform_admin') {
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
})
