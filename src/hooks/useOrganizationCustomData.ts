
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface OrganizationCustomData {
  id: string
  organization_id: string
  country_field_id: string
  field_value?: string
  file_url?: string
  file_name?: string
  file_size_bytes?: number
  created_at: string
  updated_at: string
}

export function useOrganizationCustomData(organizationId?: string) {
  const [customData, setCustomData] = useState<OrganizationCustomData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (organizationId) {
      console.log('useOrganizationCustomData: Fetching data for organization:', organizationId)
      fetchCustomData(organizationId)
    } else {
      console.log('useOrganizationCustomData: No organization ID provided')
      setCustomData([])
      setIsLoading(false)
    }
  }, [organizationId])

  const fetchCustomData = async (orgId: string) => {
    try {
      setIsLoading(true)
      console.log('Fetching custom data for organization:', orgId)
      
      const { data, error } = await supabase
        .from('organization_custom_data')
        .select('*')
        .eq('organization_id', orgId)

      if (error) {
        console.error('Error fetching custom data:', error)
        throw error
      }
      
      console.log('Fetched custom data:', data)
      setCustomData(data || [])
    } catch (error) {
      console.error('Error fetching organization custom data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load organization data',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const saveCustomData = async (
    organizationId: string,
    countryFieldId: string,
    value?: string,
    fileData?: { url: string; name: string; size: number }
  ) => {
    try {
      console.log('=== SAVE CUSTOM DATA START ===')
      console.log('Organization ID:', organizationId)
      console.log('Country Field ID:', countryFieldId)
      console.log('Value:', value)
      console.log('File Data:', fileData)
      
      const dataToSave = {
        organization_id: organizationId,
        country_field_id: countryFieldId,
        field_value: value || null,
        file_url: fileData?.url || null,
        file_name: fileData?.name || null,
        file_size_bytes: fileData?.size || null
      }

      console.log('Data to upsert:', dataToSave)

      const { data, error } = await supabase
        .from('organization_custom_data')
        .upsert(dataToSave, { 
          onConflict: 'organization_id,country_field_id'
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error saving custom data:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('Successfully saved custom data:', data)
      console.log('=== SAVE CUSTOM DATA SUCCESS ===')

      // Update local state
      setCustomData(prev => {
        const existingIndex = prev.findIndex(
          item => item.organization_id === organizationId && 
                  item.country_field_id === countryFieldId
        )
        
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = data
          console.log('Updated existing custom data in local state')
          return updated
        } else {
          console.log('Added new custom data to local state')
          return [...prev, data]
        }
      })

      return data
    } catch (error) {
      console.error('=== SAVE CUSTOM DATA ERROR ===')
      console.error('Error saving custom data:', error)
      toast({
        title: 'Error',
        description: 'Failed to save custom data',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteCustomData = async (organizationId: string, countryFieldId: string) => {
    try {
      const { error } = await supabase
        .from('organization_custom_data')
        .delete()
        .eq('organization_id', organizationId)
        .eq('country_field_id', countryFieldId)

      if (error) throw error

      setCustomData(prev => prev.filter(
        item => !(item.organization_id === organizationId && 
                  item.country_field_id === countryFieldId)
      ))

      toast({
        title: 'Success',
        description: 'Data cleared successfully'
      })
    } catch (error) {
      console.error('Error deleting custom data:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear data',
        variant: 'destructive'
      })
      throw error
    }
  }

  const uploadFile = async (file: File, organizationId: string, fieldName: string) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${organizationId}/${fieldName}_${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-files')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('organization-files')
        .getPublicUrl(fileName)

      return {
        url: urlData.publicUrl,
        name: file.name,
        size: file.size
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteFile = async (fileUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/organization-files/')
      if (urlParts.length < 2) return

      const filePath = urlParts[1]
      
      const { error } = await supabase.storage
        .from('organization-files')
        .remove([filePath])

      if (error) throw error
    } catch (error) {
      console.error('Error deleting file:', error)
      // Don't show toast for file deletion errors as it's often not critical
    }
  }

  return {
    customData,
    isLoading,
    saveCustomData,
    deleteCustomData,
    uploadFile,
    deleteFile,
    refetch: () => organizationId ? fetchCustomData(organizationId) : Promise.resolve()
  }
}
