
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, newUserId } = await req.json()

    if (!token || !newUserId) {
      throw new Error('Token and newUserId are required')
    }

    console.log(`Processing invitation acceptance for token: ${token}, user: ${newUserId}`)

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create regular client for RPC calls
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Accept the invitation using the RPC function
    const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_invitation', {
      token_input: token,
      new_user_id: newUserId
    })

    if (acceptError) {
      console.error('Error accepting invitation:', acceptError)
      throw new Error(acceptError.message || 'Failed to accept invitation')
    }

    const result = acceptResult?.[0]
    if (!result?.success) {
      throw new Error(result?.error_message || 'Failed to accept invitation')
    }

    console.log('Invitation accepted successfully:', result)

    // Inject metadata using admin client
    const { data: updateResult, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      newUserId,
      {
        user_metadata: {
          user_type: result.user_type,
          member_role: result.member_role,
          organization_id: result.organization_id
        }
      }
    )

    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      // Don't fail the whole process, but log the issue
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Invitation accepted but metadata injection failed',
          result
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log('User metadata updated successfully:', updateResult)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation accepted and metadata injected successfully',
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in accept-invitation-with-metadata:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
