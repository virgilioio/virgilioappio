import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { emailLogId, storagePath } = await req.json();

    if (!emailLogId && !storagePath) {
      return new Response(JSON.stringify({ error: 'emailLogId or storagePath required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let targetPath = storagePath;

    // If emailLogId provided, look up the email and verify ownership
    if (emailLogId && !storagePath) {
      const { data: emailLog, error: logError } = await serviceClient
        .from('email_logs')
        .select('attachments, mail_identity_id')
        .eq('id', emailLogId)
        .single();

      if (logError || !emailLog) {
        return new Response(JSON.stringify({ error: 'Email not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user owns this mail identity
      const { data: identity } = await serviceClient
        .from('user_mail_identities')
        .select('id')
        .eq('id', emailLog.mail_identity_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!identity) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // If storagePath provided, verify it belongs to user's mail identity
    if (targetPath) {
      const mailIdentityId = targetPath.split('/')[0];
      const { data: identity } = await serviceClient
        .from('user_mail_identities')
        .select('id')
        .eq('id', mailIdentityId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!identity) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate signed URL (valid for 1 hour)
      const { data: signedUrlData, error: signError } = await serviceClient.storage
        .from('email-attachments')
        .createSignedUrl(targetPath, 3600);

      if (signError || !signedUrlData?.signedUrl) {
        return new Response(JSON.stringify({ error: 'Failed to generate download URL' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ signedUrl: signedUrlData.signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'No valid path' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Download Email Attachment] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
