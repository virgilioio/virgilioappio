import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

interface DownloadRequest {
  attachmentId: string
}

const corsHeaders = createSecureCorsHeaders();

Deno.serve(async (req) => {
  try {
    console.log(`Download attachment request: ${req.method} ${req.url}`)

    const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
    if (preflightResponse) return preflightResponse;

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    // Get the JWT token from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized - missing token', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Get request body
    const { attachmentId }: DownloadRequest = await req.json()

    if (!attachmentId) {
      return new Response('Attachment ID is required', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Create Supabase client with the user's token for RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    })

    console.log(`Looking for attachment: ${attachmentId}`)

    // Get attachment details from database (RLS will handle permissions)
    const { data: attachment, error: attachmentError } = await supabase
      .from('candidate_attachments')
      .select('file_url, file_name, file_type, candidate_id, candidates!inner(tenant_id)')
      .eq('id', attachmentId)
      .single()

    if (attachmentError || !attachment) {
      console.error('Failed to fetch attachment:', attachmentError)
      return new Response('Attachment not found or access denied', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    console.log(`Found attachment: ${attachment.file_name}, path: ${attachment.file_url}`)

    // Use file_url directly as storage path (it's already the correct storage path)
    const filePath = attachment.file_url

    // Download file from storage using service role client for storage access
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('candidate-attachments')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError, 'Path:', filePath)
      return new Response('Failed to download file', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    console.log(`Successfully downloaded file: ${attachment.file_name}`)

    // Log download to audit.download_logs table (Phase 4 MVP)
    try {
      // Get user ID from JWT
      const { data: { user } } = await supabase.auth.getUser()
      
      // Extract tenant_id from attachment data
      const tenantId = attachment.candidates?.tenant_id || null
      
      // Get IP address and user agent from request
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const userAgent = req.headers.get('user-agent') || null
      
      await supabase
        .from('download_logs')
        .insert({
          user_id: user?.id || null,
          tenant_id: tenantId,
          file_path: attachment.file_url,
          file_type: 'candidate_attachment',
          entity_id: attachment.candidate_id,
          ip_address: ipAddress,
          user_agent: userAgent
        })
      
      console.log('Download logged to audit.download_logs')
    } catch (auditError) {
      // Don't fail the download if audit logging fails
      console.error('Failed to log download audit:', auditError);
    }

    // Create response with proper download headers
    const headers = {
      ...corsHeaders,
      'Content-Type': attachment.file_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${attachment.file_name}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }

    return new Response(fileData, { headers })

  } catch (error) {
    console.error('Download attachment error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
})