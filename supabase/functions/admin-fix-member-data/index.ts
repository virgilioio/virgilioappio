import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the caller is a platform admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if caller is platform admin
    const userType = caller.user_metadata?.user_type
    if (userType !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Only platform admins can run this' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action, data } = await req.json()
    console.log(`[admin-fix-member-data] Action: ${action}`, data)

    let result: any = {}

    switch (action) {
      case 'fix-hiring-manager': {
        const { 
          userId, 
          virgilioMemberId, 
          aquamaticMemberId, 
          aquamaticTenantId,
          virgilioOrgId 
        } = data

        // Step 1: Update Virgilio member record
        console.log('Step 1: Updating Virgilio member record...')
        const { data: updatedMember, error: memberError } = await supabase
          .from('members')
          .update({ 
            user_status: 'active', 
            user_id: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', virgilioMemberId)
          .select()
          .single()

        if (memberError) {
          console.error('Failed to update member:', memberError)
          throw new Error(`Failed to update Virgilio member: ${memberError.message}`)
        }
        result.updatedMember = updatedMember
        console.log('Step 1 complete:', updatedMember)

        // Step 2: Delete AquaMatic member record
        console.log('Step 2: Deleting AquaMatic member record...')
        const { error: deleteError } = await supabase
          .from('members')
          .delete()
          .eq('id', aquamaticMemberId)

        if (deleteError) {
          console.error('Failed to delete member:', deleteError)
          throw new Error(`Failed to delete AquaMatic member: ${deleteError.message}`)
        }
        result.deletedMember = aquamaticMemberId
        console.log('Step 2 complete: deleted', aquamaticMemberId)

        // Step 3: Archive AquaMatic tenant
        console.log('Step 3: Archiving AquaMatic tenant...')
        const { data: archivedTenant, error: tenantError } = await supabase
          .from('tenants')
          .update({ 
            status: 'archived',
            updated_at: new Date().toISOString()
          })
          .eq('id', aquamaticTenantId)
          .select()
          .single()

        if (tenantError) {
          console.error('Failed to archive tenant:', tenantError)
          throw new Error(`Failed to archive tenant: ${tenantError.message}`)
        }
        result.archivedTenant = archivedTenant
        console.log('Step 3 complete:', archivedTenant)

        // Step 4: Update user metadata
        console.log('Step 4: Updating user metadata...')
        const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId)
        
        if (getUserError || !userData.user) {
          throw new Error(`Failed to get user: ${getUserError?.message}`)
        }

        const currentMeta = userData.user.user_metadata || {}
        const updatedMeta = { 
          ...currentMeta, 
          organization_id: virgilioOrgId,
          user_type: 'member' // Ensure they're a member, not workspace_owner
        }

        const { data: updatedUser, error: updateUserError } = await supabase.auth.admin.updateUserById(
          userId,
          { user_metadata: updatedMeta }
        )

        if (updateUserError) {
          console.error('Failed to update user metadata:', updateUserError)
          throw new Error(`Failed to update user metadata: ${updateUserError.message}`)
        }
        result.updatedUserMetadata = updatedUser.user?.user_metadata
        console.log('Step 4 complete:', updatedUser.user?.user_metadata)

        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[admin-fix-member-data] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
