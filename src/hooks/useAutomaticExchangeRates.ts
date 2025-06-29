
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface CronStatus {
  is_enabled: boolean
  next_run: string | null
  last_automatic_update: string | null
  last_update_status: string | null
}

interface UpdateLog {
  id: string
  update_type: 'automatic' | 'manual'
  status: 'success' | 'error' | 'pending'
  message: string | null
  stats: any
  created_at: string
  updated_at: string
}

export function useAutomaticExchangeRates() {
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null)
  const [updateLogs, setUpdateLogs] = useState<UpdateLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isManaging, setIsManaging] = useState(false)
  const { toast } = useToast()

  const fetchCronStatus = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.rpc('get_exchange_rate_cron_status')
      
      if (error) {
        console.error('Error fetching cron status:', error)
        throw error
      }

      if (data && data.length > 0) {
        setCronStatus(data[0])
      }
    } catch (error: any) {
      console.error('Failed to fetch cron status:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch automatic update status',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUpdateLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('exchange_rate_update_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching update logs:', error)
        throw error
      }

      setUpdateLogs(data || [])
    } catch (error: any) {
      console.error('Failed to fetch update logs:', error)
      // Don't show toast for logs as it's less critical
    }
  }

  const manageCronJob = async (enable: boolean) => {
    try {
      setIsManaging(true)
      const { data, error } = await supabase.rpc('manage_exchange_rate_cron', {
        enable_cron: enable
      })
      
      if (error) {
        console.error('Error managing cron job:', error)
        throw error
      }

      toast({
        title: 'Success',
        description: data || (enable ? 'Automatic updates enabled' : 'Automatic updates disabled')
      })

      // Refresh status after change
      await fetchCronStatus()
      await fetchUpdateLogs()
      
      return true
    } catch (error: any) {
      console.error('Failed to manage cron job:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to manage automatic updates',
        variant: 'destructive'
      })
      return false
    } finally {
      setIsManaging(false)
    }
  }

  useEffect(() => {
    fetchCronStatus()
    fetchUpdateLogs()
  }, [])

  return {
    cronStatus,
    updateLogs,
    isLoading,
    isManaging,
    manageCronJob,
    refetchStatus: fetchCronStatus,
    refetchLogs: fetchUpdateLogs
  }
}
