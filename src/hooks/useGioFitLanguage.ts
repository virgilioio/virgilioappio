import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import type { GioFitLanguageCode } from '@/lib/gioFitLanguages'

export function useWorkspaceGioFitLanguage() {
  const { organizationId } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['gio-fit-workspace-language', organizationId]
  const query = useQuery({
    queryKey,
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return 'en' as GioFitLanguageCode
      const { data, error } = await supabase
        .from('organizations')
        .select('default_output_language')
        .eq('id', organizationId)
        .single()
      if (error) throw error
      return (data.default_output_language || 'en') as GioFitLanguageCode
    },
  })

  const update = useMutation({
    mutationFn: async (language: GioFitLanguageCode) => {
      if (!organizationId) throw new Error('No workspace selected')
      const { error } = await supabase
        .from('organizations')
        .update({ default_output_language: language })
        .eq('id', organizationId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { ...query, language: query.data ?? 'en', update }
}