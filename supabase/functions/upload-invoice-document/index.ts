import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  orgId: string
  invoiceId: string
  fileName: string
  fileData: string // base64 encoded PDF
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Authenticated user:', user.id)

    // Parse request body
    const { orgId, invoiceId, fileName, fileData }: UploadRequest = await req.json()

    if (!orgId || !invoiceId || !fileName || !fileData) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Upload request:', { orgId, invoiceId, fileName, fileSize: fileData.length })

    // Convert base64 to blob
    const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
    const filePath = `${orgId}/${invoiceId}.pdf`

    // Initialize service role client for storage operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // Upload to storage using service role client
    console.log('Uploading to storage path:', filePath)
    const { error: uploadError } = await serviceSupabase.storage
      .from('invoices')
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType: 'application/pdf',
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return new Response(JSON.stringify({ 
        error: 'Storage upload failed', 
        details: uploadError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('File uploaded successfully')

    // Update invoice record using user's client (for RLS)
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        file_name: fileName,
        invoice_url: filePath 
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Database update error:', updateError)
      return new Response(JSON.stringify({ 
        error: 'Database update failed', 
        details: updateError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Invoice record updated successfully')

    return new Response(JSON.stringify({ 
      success: true, 
      filePath,
      fileName 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})