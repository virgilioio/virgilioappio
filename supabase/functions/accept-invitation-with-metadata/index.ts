
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

    // Retry logic for accepting invitation (handles race conditions)
    let acceptResult = null;
    let acceptError = null;
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      const { data, error } = await supabase.rpc('accept_invitation', {
        token_input: token,
        new_user_id: newUserId
      });

      acceptResult = data;
      acceptError = error;

      if (!error) {
        break; // Success, exit retry loop
      }

      // Check if this is a retryable error (foreign key constraint)
      if (error.message?.includes('foreign key constraint') || 
          error.message?.includes('User account not ready')) {
        retryCount++;
        console.log(`Retrying invitation acceptance (attempt ${retryCount}/${maxRetries}) due to: ${error.message}`);
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, retryCount - 1) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      break; // Non-retryable error, exit loop
    }

    if (acceptError) {
      console.error('Error accepting invitation after retries:', acceptError)
      
      // Handle specific error cases
      if (acceptError.message?.includes('Invalid or expired invitation')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'This invitation has expired or is no longer valid. Please request a new invitation.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }

      if (acceptError.message?.includes('User account not ready')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your account is still being set up. Please wait a few seconds and try again.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 503
          }
        )
      }
      
      throw new Error(acceptError.message || 'Failed to accept invitation')
    }

    const result = acceptResult?.[0]
    if (!result?.success) {
      const errorMessage = result?.error_message || 'Failed to accept invitation'
      console.error('Invitation acceptance failed:', errorMessage)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log('Invitation accepted successfully:', result)

    // Inject metadata using admin client with better error handling
    try {
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
    } catch (metadataError) {
      console.error('Metadata injection failed:', metadataError)
      // Continue with success since invitation was accepted
    }

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
