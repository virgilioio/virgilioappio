import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { email, adminKey } = await req.json();

    // Simple admin key validation (for internal cleanup operations)
    const expectedKey = Deno.env.get('ADMIN_CLEANUP_KEY') || 'cleanup-secret-key-2024';
    if (adminKey !== expectedKey) {
      console.error('[Cleanup] Invalid admin key provided');
      return new Response(
        JSON.stringify({ error: 'Forbidden: Invalid admin key' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    console.log(`[Cleanup] Admin cleanup initiated for: ${email}`);

    if (!email) {
      throw new Error('Email is required');
    }

    console.log(`[Cleanup] Starting cleanup for email: ${email}`);

    // 1. Get user_id from auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    const user = authUser?.users.find(u => u.email === email);

    if (!user) {
      console.log(`[Cleanup] No auth user found for ${email}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No user found to clean up',
          deleted: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const userId = user.id;
    console.log(`[Cleanup] Found user ID: ${userId}`);

    const deletedItems: string[] = [];

    // 2. Find and delete associated tenant
    const { data: tenants, error: tenantFindError } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('owner_id', userId);

    if (tenantFindError) {
      console.error('[Cleanup] Error finding tenants:', tenantFindError);
    }

    if (tenants && tenants.length > 0) {
      for (const tenant of tenants) {
        console.log(`[Cleanup] Deleting tenant: ${tenant.name} (${tenant.id})`);
        
        // Delete tenant_subscriptions first
        const { error: subError } = await supabaseAdmin
          .from('tenant_subscriptions')
          .delete()
          .eq('tenant_id', tenant.id);
        
        if (subError) {
          console.error('[Cleanup] Error deleting subscriptions:', subError);
        } else {
          deletedItems.push(`subscription for tenant ${tenant.name}`);
        }

        // Delete organizations
        const { error: orgError } = await supabaseAdmin
          .from('organizations')
          .delete()
          .eq('tenant_id', tenant.id);
        
        if (orgError) {
          console.error('[Cleanup] Error deleting organizations:', orgError);
        } else {
          deletedItems.push(`organizations for tenant ${tenant.name}`);
        }

        // Delete members
        const { error: memberError } = await supabaseAdmin
          .from('members')
          .delete()
          .eq('tenant_id', tenant.id);
        
        if (memberError) {
          console.error('[Cleanup] Error deleting members:', memberError);
        } else {
          deletedItems.push(`members for tenant ${tenant.name}`);
        }

        // Delete tenant
        const { error: tenantError } = await supabaseAdmin
          .from('tenants')
          .delete()
          .eq('id', tenant.id);
        
        if (tenantError) {
          console.error('[Cleanup] Error deleting tenant:', tenantError);
        } else {
          deletedItems.push(`tenant ${tenant.name}`);
        }
      }
    }

    // 3. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    
    if (profileError) {
      console.error('[Cleanup] Error deleting profile:', profileError);
    } else {
      deletedItems.push('profile');
    }

    // 4. Delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('[Cleanup] Error deleting auth user:', authDeleteError);
    } else {
      deletedItems.push('auth user');
    }

    console.log(`[Cleanup] Cleanup complete. Deleted: ${deletedItems.join(', ')}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully cleaned up data for ${email}`,
        deleted: deletedItems
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
