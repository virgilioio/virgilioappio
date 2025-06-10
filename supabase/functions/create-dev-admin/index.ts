
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail('allan@virgilio.tech')
    
    if (existingUser.user) {
      return new Response(
        JSON.stringify({ 
          message: 'Platform admin user already exists',
          user: existingUser.user 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Create the platform admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'allan@virgilio.tech',
      password: 'test1234',
      email_confirm: true,
      user_metadata: {
        user_type: 'platform_admin',
        first_name: 'Allan',
        last_name: 'Bravo'
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('Platform admin user created successfully:', newUser.user?.id)

    return new Response(
      JSON.stringify({ 
        message: 'Platform admin user created successfully',
        user: newUser.user 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
