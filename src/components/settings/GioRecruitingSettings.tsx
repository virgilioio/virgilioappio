import { Sparkles } from 'lucide-react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { GIO_FIT_LANGUAGES, type GioFitLanguageCode } from '@/lib/gioFitLanguages'
import { useWorkspaceGioFitLanguage } from '@/hooks/useGioFitLanguage'

export function GioRecruitingSettings() {
  const { userType } = useAuth()
  const { toast } = useToast()
  const { language, isLoading, update } = useWorkspaceGioFitLanguage()
  const canEdit = userType === 'platform_admin' || userType === 'workspace_owner'

  const handleChange = async (value: GioFitLanguageCode) => {
    try {
      await update.mutateAsync(value)
      toast({ title: 'Gio language updated', description: 'New and refreshed candidate content will use this language.' })
    } catch (error) {
      toast({ title: 'Could not update Gio language', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' })
    }
  }

  return (
    <SettingsCard title="Gio" description="Workspace defaults for AI-generated recruiting content." action={<Sparkles className="h-4 w-4 text-virgilio-purple" />}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-poppins text-[13px] font-medium text-text-primary">Generate candidate content in</p>
          <p className="mt-1 max-w-[520px] font-inter text-[12px] leading-relaxed text-text-secondary">Gio writes summaries, dossiers, and insights in this language regardless of the language of the CV.</p>
        </div>
        <Select value={language} onValueChange={(value) => handleChange(value as GioFitLanguageCode)} disabled={!canEdit || isLoading || update.isPending}>
          <SelectTrigger className="h-8 w-full shrink-0 sm:w-[210px]" aria-label="Default Gio output language"><SelectValue /></SelectTrigger>
          <SelectContent align="end">
            {GIO_FIT_LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{item.name} · {item.nativeName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </SettingsCard>
  )
}