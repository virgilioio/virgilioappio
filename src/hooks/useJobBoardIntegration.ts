import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'
import { useToast } from '@/hooks/use-toast'

interface JobBoardIntegration {
  id: string
  tenant_id: string
  board_name: string
  is_enabled: boolean
  feed_url: string | null
  webhook_url: string | null
  questions_url: string | null
  api_key: string | null
  settings: any
  created_at: string
  updated_at: string
}

export function useJobBoardIntegration(boardName: string) {
  const { tenant } = useTenant()
  const { toast } = useToast()
  const [integration, setIntegration] = useState<JobBoardIntegration | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchIntegration = async () => {
      if (!tenant?.id) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const { data, error } = await supabase
        .from('job_board_integrations' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('board_name', boardName)
        .maybeSingle()

      if (error) {
        console.error('Error fetching integration:', error)
      }

      setIntegration(data as any)
      setIsLoading(false)
    }

    fetchIntegration()
  }, [tenant?.id, boardName])

  const toggleIntegration = async (enabled: boolean) => {
    if (!tenant?.id) return

    try {
      if (!integration) {
        // Create new integration
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://etrxjxstjfcozdjumfsj.supabase.co'
        const feedUrl = `${supabaseUrl}/functions/v1/generate-talent-feed?tenant_id=${tenant.id}`
        const webhookUrl = `${supabaseUrl}/functions/v1/talent-apply-webhook`
        const questionsUrl = `${supabaseUrl}/functions/v1/talent-questions`

        const { data, error } = await supabase
          .from('job_board_integrations' as any)
          .insert({
            tenant_id: tenant.id,
            board_name: boardName,
            is_enabled: enabled,
            feed_url: feedUrl,
            webhook_url: webhookUrl,
            questions_url: questionsUrl
          })
          .select()
          .single()

        if (error) throw error

        setIntegration(data as any)
        toast({
          title: 'Integration enabled',
          description: `${boardName} integration has been enabled successfully`
        })
      } else {
        // Update existing
        const { data, error } = await supabase
          .from('job_board_integrations' as any)
          .update({ 
            is_enabled: enabled,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id)
          .select()
          .single()

        if (error) throw error

        setIntegration(data as any)
        toast({
          title: enabled ? 'Integration enabled' : 'Integration disabled',
          description: `${boardName} integration has been ${enabled ? 'enabled' : 'disabled'}`
        })
      }
    } catch (error) {
      console.error('Error toggling integration:', error)
      toast({
        title: 'Error',
        description: 'Failed to update integration',
        variant: 'destructive'
      })
    }
  }

  return {
    integration,
    isLoading,
    toggleIntegration,
    isEnabled: integration?.is_enabled || false
  }
}
