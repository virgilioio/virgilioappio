import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useJobBoardIntegration } from '@/hooks/useJobBoardIntegration'
import { Copy, Loader2, Radio, Briefcase } from 'lucide-react'
import { copyToClipboard } from '@/utils/clipboard'
import { useToast } from '@/hooks/use-toast'
import { SpecCard } from '@/components/settings/shared/SpecCard'
import { SpecRow, SEC_BTN } from '@/components/settings/shared/SpecRow'
import { SpecChip } from '@/components/settings/shared/SpecChip'

interface FeedTestResult { status: 'success' | 'error'; jobCount?: number; message?: string }

const ROWS: { key: 'feed_url' | 'webhook_url' | 'questions_url'; label: string }[] = [
  { key: 'feed_url', label: 'XML feed' },
  { key: 'webhook_url', label: 'Application webhook' },
  { key: 'questions_url', label: 'Screening questions' },
]

export function JobBoardsTab() {
  const { toast } = useToast()
  const { integration, isLoading, toggleIntegration, isEnabled } = useJobBoardIntegration('talent')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<FeedTestResult | null>(null)

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text)
    toast({ title: 'Copied', description: `${label} copied to clipboard` })
  }

  const handleTestFeed = async () => {
    if (!integration?.feed_url) return
    setIsTesting(true); setTestResult(null)
    try {
      const r = await fetch(integration.feed_url)
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        setTestResult({ status: 'error', message: err.error || `HTTP ${r.status}` })
        return
      }
      const xml = await r.text()
      const count = (xml.match(/<job>/g) || []).length
      setTestResult({ status: 'success', jobCount: count })
      toast({ title: 'Feed working', description: `${count} active job${count !== 1 ? 's' : ''} found` })
    } catch (e) {
      setTestResult({ status: 'error', message: e instanceof Error ? e.message : 'Failed' })
    } finally { setIsTesting(false) }
  }

  return (
    <div className="max-w-[860px]">
      <SpecCard
        title="Talent.com"
        description="Jobs sync automatically from your feed; applications flow back via webhook and AI parses the resumes."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={SEC_BTN}
              style={{ height: 26, padding: '0 10px', fontSize: 11.5 }}
              onClick={handleTestFeed}
              disabled={!integration?.feed_url || isTesting}
            >
              {isTesting ? <Loader2 size={11} className="animate-spin" /> : <Radio size={11} />} Test feed
            </button>
            <Switch checked={isEnabled} onCheckedChange={toggleIntegration} disabled={isLoading} />
          </div>
        }
      >
        {isEnabled && integration ? (
          <>
            {ROWS.map((row, i) => {
              const url = (integration as any)[row.key] as string | null
              return (
                <SpecRow key={row.key} last={i === ROWS.length - 1}>
                  <span
                    className="font-inter text-[#0d0d09] shrink-0"
                    style={{ width: 150, fontSize: 11.5, fontWeight: 600 }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="flex-1 min-w-0 truncate"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: '#5A6072' }}
                  >
                    {url || '—'}
                  </span>
                  <button
                    type="button"
                    className="text-[#8B8F9E] hover:text-[#0d0d09]"
                    onClick={() => url && handleCopy(url, row.label)}
                    disabled={!url}
                    aria-label="Copy"
                  >
                    <Copy size={12} />
                  </button>
                </SpecRow>
              )
            })}
            <div
              className="font-inter text-[#8B8F9E]"
              style={{ borderTop: '1px solid #F1F0EC', padding: '9px 18px', fontSize: 11 }}
            >
              Enable Talent.com per job in each job's posting settings.
              {testResult?.status === 'success' && testResult.jobCount === 0 && (
                <span className="ml-1 text-[#92400E]">No jobs published yet.</span>
              )}
              {testResult?.status === 'error' && (
                <span className="ml-1 text-[#B91C1C]">Feed error: {testResult.message}</span>
              )}
            </div>
          </>
        ) : (
          <div className="font-inter text-[#8B8F9E]" style={{ padding: '18px', fontSize: 12 }}>
            Enable Talent.com to view your sync URLs.
          </div>
        )}
      </SpecCard>

      <SpecCard title="More boards" description="Coming soon to your workspace.">
        {[
          { icon: Briefcase, label: 'Indeed', desc: "Post to the world's #1 job site." },
          { icon: Briefcase, label: 'LinkedIn Jobs', desc: 'Publish openings to LinkedIn.' },
        ].map((b, i, arr) => {
          const Icon = b.icon
          return (
            <SpecRow key={b.label} last={i === arr.length - 1} className="opacity-60">
              <Icon size={16} color="#5A6072" />
              <div className="flex-1 min-w-0">
                <div className="font-inter text-[#0d0d09]" style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</div>
                <div className="font-inter text-[#8B8F9E]" style={{ fontSize: 11 }}>{b.desc}</div>
              </div>
              <SpecChip tone="gray">Coming soon</SpecChip>
            </SpecRow>
          )
        })}
      </SpecCard>
    </div>
  )
}
