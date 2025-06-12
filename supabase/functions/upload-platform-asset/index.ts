
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    )

    // Get the user from the auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', user.id)

    // Verify user is platform admin
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('user_type')
      .eq('user_id', user.id)
      .single()

    if (memberError || memberData?.user_type !== 'platform_admin') {
      console.log('Unauthorized access attempt:', memberError || 'Not platform admin')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      const formData = await req.formData()
      const file = formData.get('file') as File
      const assetType = formData.get('assetType') as string

      if (!file || !assetType) {
        return new Response(
          JSON.stringify({ error: 'File and asset type are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate asset type
      if (!['logo', 'favicon'].includes(assetType)) {
        return new Response(
          JSON.stringify({ error: 'Invalid asset type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate file type
      const allowedTypes = {
        logo: ['image/png', 'image/svg+xml'],
        favicon: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']
      }

      if (!allowedTypes[assetType as keyof typeof allowedTypes].includes(file.type)) {
        return new Response(
          JSON.stringify({ error: `Invalid file type for ${assetType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate file size (1MB for logo, 500KB for favicon)
      const maxSizes = { logo: 1024 * 1024, favicon: 512 * 1024 }
      if (file.size > maxSizes[assetType as keyof typeof maxSizes]) {
        return new Response(
          JSON.stringify({ error: `File too large for ${assetType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fileName = `${assetType}-${Date.now()}.${file.name.split('.').pop()}`
      const filePath = `${assetType}/${fileName}`

      console.log(`Uploading ${assetType}:`, fileName)

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return new Response(
          JSON.stringify({ error: 'Failed to upload file' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath)

      // Insert asset record
      const { data: assetData, error: assetError } = await supabase
        .from('platform_assets')
        .insert({
          asset_type: assetType,
          file_name: fileName,
          file_url: urlData.publicUrl,
          uploaded_by: user.id,
          is_active: false // Will be activated separately
        })
        .select()
        .single()

      if (assetError) {
        console.error('Asset record error:', assetError)
        // Clean up uploaded file
        await supabase.storage.from('assets').remove([filePath])
        return new Response(
          JSON.stringify({ error: 'Failed to create asset record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Activate the new asset (deactivates old ones)
      const { error: activateError } = await supabase.rpc('activate_platform_asset', {
        new_asset_id: assetData.id,
        asset_type_param: assetType
      })

      if (activateError) {
        console.error('Activation error:', activateError)
        return new Response(
          JSON.stringify({ error: 'Failed to activate asset' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Successfully uploaded and activated ${assetType}:`, fileName)

      return new Response(
        JSON.stringify({ 
          success: true, 
          asset: assetData,
          publicUrl: urlData.publicUrl
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET method - retrieve current active assets
    if (req.method === 'GET') {
      const { data: assets, error } = await supabase
        .from('platform_assets')
        .select('*')
        .eq('is_active', true)
        .order('asset_type')

      if (error) {
        console.error('Get assets error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve assets' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ assets }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
