
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface PlatformAsset {
  id: string
  asset_type: 'logo' | 'favicon'
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

  const uploadAsset = async (file: File, assetType: 'logo' | 'favicon') => {
    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetType', assetType)

      const { data, error } = await supabase.functions.invoke('upload-platform-asset', {
        method: 'POST',
        body: formData
      })

      if (error) throw error

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
      toast({
        title: 'Upload Failed',
        description: error.message || `Failed to upload ${assetType}`,
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
