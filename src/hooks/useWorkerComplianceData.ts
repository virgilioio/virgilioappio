import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface WorkerComplianceData {
  id: string
  worker_id: string
  worker_compliance_field_id: string
  field_value?: string
  file_url?: string
  file_name?: string
  file_size_bytes?: number
  uploaded_by?: string
  created_at: string
  updated_at: string
}

export function useWorkerComplianceData(workerId?: string) {
  const [data, setData] = useState<WorkerComplianceData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchWorkerData = async (id: string) => {
    try {
      setIsLoading(true)
      const { data: workerData, error } = await supabase
        .from('worker_compliance_data')
        .select('*')
        .eq('worker_id', id)

      if (error) {
        console.error('Error fetching worker compliance data:', error)
        return
      }

      setData(workerData || [])
    } catch (error) {
      console.error('Unexpected error fetching worker compliance data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveWorkerData = async (
    workerId: string,
    fieldId: string,
    fieldValue?: string,
    fileData?: {
      file_url: string
      file_name: string
      file_size_bytes: number
    }
  ) => {
    try {
      const dataToSave: any = {
        worker_id: workerId,
        worker_compliance_field_id: fieldId,
        field_value: fieldValue || null,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      }

      if (fileData) {
        dataToSave.file_url = fileData.file_url
        dataToSave.file_name = fileData.file_name
        dataToSave.file_size_bytes = fileData.file_size_bytes
      } else {
        // Clear file data if no file provided
        dataToSave.file_url = null
        dataToSave.file_name = null
        dataToSave.file_size_bytes = null
      }

      const { error } = await supabase
        .from('worker_compliance_data')
        .upsert(dataToSave, {
          onConflict: 'worker_id,worker_compliance_field_id'
        })

      if (error) {
        console.error('Error saving worker compliance data:', error)
        toast.error('Failed to save compliance data')
        throw error
      }

      // Refresh data
      if (workerId) {
        await fetchWorkerData(workerId)
      }
      
      toast.success('Compliance data saved successfully')
    } catch (error) {
      console.error('Error saving worker compliance data:', error)
      throw error
    }
  }

  const deleteWorkerData = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_compliance_data')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting worker compliance data:', error)
        toast.error('Failed to delete compliance data')
        throw error
      }

      // Refresh data
      if (workerId) {
        await fetchWorkerData(workerId)
      }
      
      toast.success('Compliance data deleted successfully')
    } catch (error) {
      console.error('Error deleting worker compliance data:', error)
      throw error
    }
  }

  useEffect(() => {
    if (workerId) {
      fetchWorkerData(workerId)
    } else {
      setData([])
      setIsLoading(false)
    }
  }, [workerId])

  const refetch = () => {
    if (workerId) {
      fetchWorkerData(workerId)
    }
  }

  return {
    data,
    isLoading,
    saveWorkerData,
    deleteWorkerData,
    refetch
  }
}