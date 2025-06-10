
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

    // Step 1: Check if Virgilio organization already exists
    console.log('Checking for existing Virgilio organization...')
    const { data: existingOrg, error: orgCheckError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('name', 'Virgilio')
      .eq('organization_type', 'platform')
      .single()

    let virgilioOrg
    if (existingOrg) {
      console.log('Virgilio organization already exists:', existingOrg)
      virgilioOrg = existingOrg
    } else {
      console.log('Creating Virgilio organization...')
      const { data: newOrg, error: orgError } = await supabaseAdmin
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

      console.log('Virgilio organization created:', newOrg)
      virgilioOrg = newOrg
    }

    // Step 2: Check if platform admin user already exists
    console.log('Checking for existing platform admin user...')
    const { data: existingUsers, error: userListError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userListError) {
      console.error('Error listing users:', userListError)
      throw new Error(`Failed to list users: ${userListError.message}`)
    }

    let adminUser = existingUsers.users.find(user => user.email === 'allan@virgilio.tech')

    if (adminUser) {
      console.log('Platform admin user already exists:', adminUser.id)
    } else {
      console.log('Creating platform admin user...')
      const { data: newAdminUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
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

      console.log('Platform admin user created:', newAdminUser.user?.id)
      adminUser = newAdminUser.user
    }

    if (!adminUser) {
      throw new Error('Failed to get or create admin user')
    }

    // Step 3: Check if member record already exists
    console.log('Checking for existing platform admin member record...')
    const { data: existingMember, error: memberCheckError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('user_id', adminUser.id)
      .eq('organization_id', virgilioOrg.id)
      .single()

    let adminMember
    if (existingMember) {
      console.log('Platform admin member record already exists:', existingMember)
      adminMember = existingMember
    } else {
      console.log('Creating platform admin member record...')
      const { data: newAdminMember, error: memberError } = await supabaseAdmin
        .from('members')
        .insert([{
          user_id: adminUser.id,
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

      console.log('Platform admin member record created:', newAdminMember)
      adminMember = newAdminMember
    }

    // Step 4: Update organization with owner_id if not set
    if (!virgilioOrg.owner_id) {
      console.log('Setting organization owner...')
      const { error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({ owner_id: adminUser.id })
        .eq('id', virgilioOrg.id)

      if (updateOrgError) {
        console.error('Error updating organization owner:', updateOrgError)
        throw new Error(`Failed to set organization owner: ${updateOrgError.message}`)
      }
    } else {
      console.log('Organization owner already set')
    }

    const response = {
      success: true,
      message: 'Virgilio platform setup completed successfully! Platform admin ready with email: allan@virgilio.tech and password: test1234',
      data: {
        organization: virgilioOrg,
        user: adminUser,
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
