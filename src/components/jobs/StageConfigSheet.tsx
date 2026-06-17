import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Check, Loader2, X } from 'lucide-react'
import { useStageConfiguration, type StageConfiguration } from '@/hooks/useStageConfiguration'
import { BasicsTab } from './stage-config/BasicsTab'
import { TeamTab } from './stage-config/TeamTab'
import { AutomationsTab } from './stage-config/AutomationsTab'
import { ScorecardsTab } from './stage-config/ScorecardsTab'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

interface StageConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jhsId: string | null
  jobId: string
}

type TabKey = 'basics' | 'team' | 'automations' | 'scorecards'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'team', label: 'Team' },
  { key: 'automations', label: 'Automations' },
  { key: 'scorecards', label: 'Scorecards' },
]

export function StageConfigSheet({ open, onOpenChange, jhsId, jobId }: StageConfigSheetProps) {
  const { loadStageConfig, updateCustomStageName, isLoading } = useStageConfiguration()
  const [config, setConfig] = useState<StageConfiguration | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('scorecards')

  const { data: job } = useQuery({
    queryKey: ['job-org-context', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('organization_id')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data
    },
    enabled: open && !!jobId,
  })

  useEffect(() => {
    if (open && jhsId) {
      loadStageConfig(jhsId).then(setConfig).catch(console.error)
    }
  }, [open, jhsId])

  const handleSaveBasics = async (customName: string | null) => {
    if (!jhsId) return
    await updateCustomStageName.mutateAsync({ jhsId, customName })
    const updated = await loadStageConfig(jhsId)
    setConfig(updated)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-[760px] p-0 border-0 overflow-hidden"
        style={{ background: '#FAFAF7', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }}
      >
        {isLoading || !config ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-virgilio-muted" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div
              className="flex items-start justify-between gap-4 px-7 pt-6 pb-5"
              style={{ borderBottom: '1px solid #F1F0EC' }}
            >
              <div className="min-w-0">
                <h2
                  className="font-poppins font-semibold text-[20px] leading-tight"
                  style={{ color: '#0d0d09', letterSpacing: '-0.035em' }}
                >
                  Configure Stage: {config.customStageName || config.stageName}
                  <span className="text-purple-period">.</span>
                </h2>
                <p className="font-inter mt-1.5" style={{ fontSize: 12.5, color: '#5A6072' }}>
                  Customize this stage's behavior for this specific job.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="shrink-0 rounded-md p-1.5 text-[#5A6072] hover:bg-[#F1F0EC]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-5">
              {/* Tab pills */}
              <div className="flex flex-row gap-1.5 mb-[18px]">
                {TABS.map((t) => {
                  const active = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={cn(
                        'rounded-full font-inter font-medium transition-colors',
                        active
                          ? 'bg-[#0d0d09] text-[#fffcf9] border border-[#0d0d09]'
                          : 'bg-white text-[#1F2230] border border-[#E7E8EE] hover:bg-[#FAFAF7]'
                      )}
                      style={{ height: 28, padding: '0 13px', fontSize: 11.5 }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {activeTab === 'basics' && (
                <BasicsTab
                  config={config}
                  onSave={handleSaveBasics}
                  isSaving={updateCustomStageName.isPending}
                />
              )}
              {activeTab === 'team' && job && jhsId && (
                <TeamTab jhsId={jhsId} jobId={jobId} organizationId={job.organization_id} />
              )}
              {activeTab === 'automations' && job?.organization_id && jhsId && (
                <AutomationsTab
                  jhsId={jhsId}
                  jobId={jobId}
                  organizationId={job.organization_id}
                />
              )}
              {activeTab === 'scorecards' && job && jhsId && (
                <ScorecardsTab
                  jhsId={jhsId}
                  jobId={jobId}
                  stageName={config.customStageName || config.stageName}
                  stageType={config.stageType}
                />
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-4 px-7 py-4"
              style={{ borderTop: '1px solid #F1F0EC', background: '#fff' }}
            >
              <div
                className="flex items-center gap-2 font-inter"
                style={{ fontSize: 12, color: '#8B8F9E' }}
              >
                <Check className="h-3.5 w-3.5" style={{ color: '#12B886' }} />
                <span>Auto-saved · last edit 8 days ago by you</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
