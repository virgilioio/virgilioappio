
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../utils/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

Deno.serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

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
      console.log('Authentication failed:', userError?.message || 'No user found')
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required', 
          details: userError?.message || 'No user session found' 
        }),
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
      console.log('Unauthorized access attempt:', {
        userId: user.id,
        userEmail: user.email,
        memberError: memberError?.message,
        userType: memberData?.user_type,
        hasMemberRecord: !!memberData
      })
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Platform admin access required',
          details: `User type: ${memberData?.user_type || 'no member record'}`
        }),
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
      const validAssetTypes = [
        'logo', 
        'favicon',
        'empty-state-organizations',
        'empty-state-jobs',
        'empty-state-candidates',
        'empty-state-members',
        'empty-state-comments',
        'empty-state-attachments',
        'empty-state-templates',
        'empty-state-independent-candidates',
        'empty-state-urls'
      ]
      
      if (!validAssetTypes.includes(assetType)) {
        return new Response(
          JSON.stringify({ error: `Invalid asset type. Must be one of: ${validAssetTypes.join(', ')}.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate file type
      const allowedTypes: Record<string, string[]> = {
        logo: ['image/png', 'image/svg+xml', 'image/jpeg'],
        favicon: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/jpeg'],
        // All empty state images must be PNG
        'empty-state-organizations': ['image/png'],
        'empty-state-jobs': ['image/png'],
        'empty-state-candidates': ['image/png'],
        'empty-state-members': ['image/png'],
        'empty-state-comments': ['image/png'],
        'empty-state-attachments': ['image/png'],
        'empty-state-templates': ['image/png'],
        'empty-state-independent-candidates': ['image/png'],
        'empty-state-urls': ['image/png']
      }

      if (!allowedTypes[assetType]?.includes(file.type)) {
        return new Response(
          JSON.stringify({ 
            error: `Invalid file type for ${assetType}. Allowed types: ${allowedTypes[assetType]?.join(', ') || 'none'}. Received: ${file.type}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate file size (1MB for logo, 500KB for others)
      const maxSizes: Record<string, number> = { 
        logo: 1024 * 1024, 
        favicon: 512 * 1024,
        // 500KB for all empty state images
        'empty-state-organizations': 512 * 1024,
        'empty-state-jobs': 512 * 1024,
        'empty-state-candidates': 512 * 1024,
        'empty-state-members': 512 * 1024,
        'empty-state-comments': 512 * 1024,
        'empty-state-attachments': 512 * 1024,
        'empty-state-templates': 512 * 1024,
        'empty-state-independent-candidates': 512 * 1024,
        'empty-state-urls': 512 * 1024
      }
      if (file.size > (maxSizes[assetType] || 512 * 1024)) {
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
      console.log('Activating asset:', assetData.id, 'of type:', assetType)
      
      const { error: activateError } = await supabase.rpc('activate_platform_asset', {
        new_asset_id: assetData.id,
        asset_type_param: assetType
      })

      if (activateError) {
        console.error('Activation error:', {
          code: activateError.code,
          message: activateError.message,
          details: activateError.details,
          hint: activateError.hint
        })
        
        // Clean up uploaded file and asset record on activation failure
        await supabase.storage.from('assets').remove([filePath])
        await supabase.from('platform_assets').delete().eq('id', assetData.id)
        
        let errorMessage = 'Failed to activate asset'
        
        // Handle specific error types with user-friendly messages
        if (activateError.code === '23505' || activateError.message?.includes('constraint violation')) {
          errorMessage = 'An asset of this type already exists and could not be replaced. Please try again in a moment.'
        } else if (activateError.message?.includes('Asset with id') && activateError.message?.includes('not found')) {
          errorMessage = 'Asset record was not created properly. Please try uploading again.'
        } else if (activateError.message) {
          errorMessage = activateError.message
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage, 
            details: activateError.message,
            code: activateError.code 
          }),
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
