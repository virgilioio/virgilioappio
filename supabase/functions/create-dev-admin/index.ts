
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
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Virgilio platform setup...')

    // Step 1: Create the Virgilio platform organization
    console.log('Creating Virgilio organization...')
    const { data: virgilioOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert([{
        name: 'Virgilio',
        country: 'United States',
        status: 'active',
        organization_type: 'platform'
      }])
      .select()
      .single()

    if (orgError) {
      console.error('Error creating Virgilio organization:', orgError)
      throw new Error(`Failed to create Virgilio organization: ${orgError.message}`)
    }

    console.log('Virgilio organization created:', virgilioOrg)

    // Step 2: Create the platform admin user
    console.log('Creating platform admin user...')
    const { data: adminUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: 'allan@virgilio.tech',
      password: 'test1234',
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        first_name: 'Allan',
        last_name: 'Admin',
        user_type: 'platform_admin'
      }
    })

    if (userError) {
      console.error('Error creating admin user:', userError)
      throw new Error(`Failed to create admin user: ${userError.message}`)
    }

    console.log('Platform admin user created:', adminUser.user?.id)

    // Step 3: Create member record linking admin to Virgilio organization
    console.log('Creating platform admin member record...')
    const { data: adminMember, error: memberError } = await supabaseAdmin
      .from('members')
      .insert([{
        user_id: adminUser.user?.id,
        organization_id: virgilioOrg.id,
        member_role: 'platform_admin',
        user_status: 'active'
      }])
      .select()
      .single()

    if (memberError) {
      console.error('Error creating member record:', memberError)
      throw new Error(`Failed to create member record: ${memberError.message}`)
    }

    console.log('Platform admin member record created:', adminMember)

    // Step 4: Update organization with owner_id
    console.log('Setting organization owner...')
    const { error: updateOrgError } = await supabaseAdmin
      .from('organizations')
      .update({ owner_id: adminUser.user?.id })
      .eq('id', virgilioOrg.id)

    if (updateOrgError) {
      console.error('Error updating organization owner:', updateOrgError)
      throw new Error(`Failed to set organization owner: ${updateOrgError.message}`)
    }

    const response = {
      success: true,
      message: 'Virgilio platform setup completed successfully! Platform admin created with email: allan@virgilio.tech and password: test1234',
      data: {
        organization: virgilioOrg,
        user: adminUser.user,
        member: adminMember
      }
    }

    console.log('Setup completed successfully:', response)

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Setup failed:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred during setup'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
