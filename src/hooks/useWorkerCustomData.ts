import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface WorkerCustomData {
  id: string
  worker_id: string
  country_field_id: string
  field_value: string | null
  file_url: string | null
  file_name: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkerCustomDataWithField extends WorkerCustomData {
  country_field: {
    field_name: string
    field_label: string
    field_type: string
    is_required: boolean
  }
}

export function useWorkerCustomData(workerId?: string) {
  const [data, setData] = useState<WorkerCustomData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchWorkerData = async () => {
    if (!workerId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const { data: workerData, error } = await supabase
        .from('worker_custom_data')
        .select('*')
        .eq('worker_id', workerId)

      if (error) throw error
      setData(workerData || [])
    } catch (error: any) {
      console.error('Error fetching worker custom data:', error)
      toast.error('Failed to load worker compliance data')
    } finally {
      setIsLoading(false)
    }
  }

  const saveWorkerData = async (
    workerId: string,
    countryFieldId: string,
    fieldValue?: string,
    fileData?: {
      file_url: string
      file_name: string
      file_size_bytes: number
    }
  ) => {
    try {
      const updateData: any = {
        worker_id: workerId,
        country_field_id: countryFieldId,
        field_value: fieldValue || null,
        ...fileData,
        uploaded_by: fileData ? (await supabase.auth.getUser()).data.user?.id : null,
      }

      const { data: savedData, error } = await supabase
        .from('worker_custom_data')
        .upsert(updateData, {
          onConflict: 'worker_id,country_field_id'
        })
        .select()

      if (error) throw error
      
      toast.success('Worker compliance data saved successfully')
      await fetchWorkerData()
      return savedData
    } catch (error: any) {
      console.error('Error saving worker custom data:', error)
      toast.error('Failed to save worker compliance data')
      throw error
    }
  }

  const deleteWorkerData = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_custom_data')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      toast.success('Worker compliance data deleted successfully')
      await fetchWorkerData()
    } catch (error: any) {
      console.error('Error deleting worker custom data:', error)
      toast.error('Failed to delete worker compliance data')
      throw error
    }
  }

  useEffect(() => {
    fetchWorkerData()
  }, [workerId])

  return {
    data,
    isLoading,
    saveWorkerData,
    deleteWorkerData,
    refetch: fetchWorkerData
  }
}