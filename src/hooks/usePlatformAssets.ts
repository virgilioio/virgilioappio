
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

interface PlatformAsset {
  id: string
  asset_type: 'logo' | 'favicon' | 'empty-state-organizations' | 'empty-state-jobs' | 'empty-state-candidates' | 'empty-state-members' | 'empty-state-comments' | 'empty-state-attachments' | 'empty-state-templates' | 'empty-state-independent-candidates' | 'empty-state-urls'
  file_name: string
  file_url: string
  uploaded_by: string
  uploaded_at: string
  is_active: boolean
}

export function usePlatformAssets() {
  const [assets, setAssets] = useState<PlatformAsset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const fetchAssets = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.functions.invoke('upload-platform-asset', {
        method: 'GET'
      })

      if (error) throw error

      setAssets(data.assets || [])
    } catch (error) {
      console.error('Error fetching assets:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch platform assets',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const uploadAsset = async (file: File, assetType: PlatformAsset['asset_type']) => {
    try {
      setIsUploading(true)
      
      console.log('Starting upload for asset type:', assetType, 'File:', file.name, 'Size:', file.size)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetType', assetType)

      // Get auth session for token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Use fetch instead of invoke for proper FormData handling
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(
        `${supabaseUrl}/functions/v1/upload-platform-asset`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
            // Don't set Content-Type - browser will set it with boundary for FormData
          },
          body: formData
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        console.error('Upload failed:', errorData)
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()

      console.log('Upload successful:', data)
      
      toast({
        title: 'Success',
        description: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} uploaded successfully`
      })

      // Refresh assets list
      await fetchAssets()
      
      // If favicon was uploaded, trigger page reload to update favicon
      if (assetType === 'favicon') {
        setTimeout(() => window.location.reload(), 1000)
      }

      return data.asset
    } catch (error: any) {
      console.error('Error uploading asset:', error)
      
      let errorMessage = `Failed to upload ${assetType}`
      
      // Handle specific error types
      if (error.message?.includes('constraint violation')) {
        errorMessage = 'An asset of this type already exists. Please try again in a moment.'
      } else if (error.message?.includes('file too large')) {
        errorMessage = 'File size too large. Please choose a smaller file.'
      } else if (error.message?.includes('invalid file type')) {
        errorMessage = 'Invalid file type. Please upload a PNG, JPG, or ICO file.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    fetchAssets()
  }, [])

  return {
    assets,
    isLoading,
    isUploading,
    uploadAsset,
    refetchAssets: fetchAssets
  }
}
