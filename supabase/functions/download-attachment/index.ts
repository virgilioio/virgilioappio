import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from '../../utils/createSecureEdgeFunction.ts'

interface DownloadRequest {
  attachmentId: string
}

const corsHeaders = createSecureCorsHeaders()

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    const corsResponse = handleSecureCorsPreFlight(req, corsHeaders)
    if (corsResponse) return corsResponse

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get attachment details from database
    const { data: attachment, error: attachmentError } = await supabase
      .from('candidate_attachments')
      .select('file_url, file_name, file_type')
      .eq('id', attachmentId)
      .single()

    if (attachmentError || !attachment) {
      console.error('Failed to fetch attachment:', attachmentError)
      return new Response('Attachment not found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    // Extract bucket and file path from file_url
    const urlParts = attachment.file_url.split('/')
    const bucketIndex = urlParts.findIndex(part => part === 'candidate-attachments')
    
    if (bucketIndex === -1 || bucketIndex >= urlParts.length - 1) {
      return new Response('Invalid file URL format', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    const filePath = urlParts.slice(bucketIndex + 1).join('/')

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('candidate-attachments')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError)
      return new Response('Failed to download file', { 
        status: 500, 
        headers: corsHeaders 
      })
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
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})