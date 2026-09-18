import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { GIO_FIT_LANGUAGES, getGioFitLanguage } from '@/lib/gioFitLanguages'
import { cn } from '@/lib/utils'
import type { FitAnalysis } from '@/hooks/useCandidateFitInsights'

interface GioFitLanguageControlProps {
  analysis: FitAnalysis
  workspaceLanguage: string
  overrideLanguage: string | null
  resolvedLanguage: string
  appliedLanguage: string | null
  keepProperNouns: boolean
  isRewriting: boolean
  onApply: (language: string | null, keepProperNouns: boolean) => Promise<void>
}

export function GioFitLanguageControl({ analysis, workspaceLanguage, overrideLanguage, resolvedLanguage, appliedLanguage, keepProperNouns, isRewriting, onApply }: GioFitLanguageControlProps) {
  const [open, setOpen] = useState(false)
  const [draftLanguage, setDraftLanguage] = useState<string | null>(overrideLanguage)
  const [draftKeepProperNouns, setDraftKeepProperNouns] = useState(keepProperNouns)
  const detected = analysis.detected_languages
  const detectedCodes = useMemo(() => new Set((detected?.sources || []).map((source) => source.code)), [detected?.sources])
  const language = getGioFitLanguage(resolvedLanguage)
  const draftResolved = draftLanguage || workspaceLanguage || 'en'
  const stale = appliedLanguage !== resolvedLanguage
  const changed = draftLanguage !== overrideLanguage || draftKeepProperNouns !== keepProperNouns || stale

  useEffect(() => {
    if (!open) {
      setDraftLanguage(overrideLanguage)
      setDraftKeepProperNouns(keepProperNouns)
    }
  }, [open, overrideLanguage, keepProperNouns])

  const sortedLanguages = useMemo(() => [...GIO_FIT_LANGUAGES].sort((a, b) => {
    const aSource = detectedCodes.has(a.code) ? 0 : 1
    const bSource = detectedCodes.has(b.code) ? 0 : 1
    return aSource - bSource || a.name.localeCompare(b.name)
  }), [detectedCodes])

  const apply = async () => {
    setOpen(false)
    try {
      await onApply(draftLanguage, draftKeepProperNouns)
    } catch {
      // The dossier keeps its previous content and the parent shows the error.
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" title="Language Gio writes in" className="h-7 gap-1.5 px-[9px]" aria-label={`Language Gio writes in: ${language.name}`}>
          <Languages className="h-[13px] w-[13px] text-fit-muted" strokeWidth={2} />
          <span className="text-[12px] font-medium text-fit-ink">{language.name}</span>
          {detected?.summary && <span className="text-[10.5px] font-normal text-fit-subtle">· {detected.summary.toLowerCase() === 'mixed' ? 'mixed source' : `from ${detected.summary}`}</span>}
          <ChevronDown className="h-3 w-3 text-fit-null" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[344px] overflow-hidden rounded-xl border border-virgilio-border bg-surface-primary p-0 shadow-[0_18px_44px_-12px_rgba(13,13,9,0.22),0_2px_6px_rgba(13,13,9,0.05)]">
        <section className="border-b border-fit-chip bg-fit-paper px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-fit-subtle">Detected in the source</p>
          <div className="mt-2 space-y-[5px]">
            {(detected?.sources || []).map((source, index) => (
              <div key={`${source.label}-${source.code}-${index}`} className="flex items-center gap-[5px]">
                <span className="w-[104px] shrink-0 text-[11.5px] text-fit-subtle">{source.label}</span>
                <span className="rounded bg-fit-chip px-[5px] py-px font-mono text-[9.5px] font-semibold uppercase text-fit-muted">{source.code}</span>
                <span className="text-[11.5px] font-medium text-fit-ink">{source.name}</span>
              </div>
            ))}
            {!detected?.sources?.length && <p className="text-[11.5px] text-fit-subtle">Detection will appear after the next refresh.</p>}
          </div>
          <p className="mt-2 text-[10.5px] leading-[1.5] text-fit-subtle">Detection is automatic and not editable. Scoring already compares across languages, so this never changes the score.</p>
        </section>

        <section className="px-3.5 pb-2.5 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-fit-subtle">Gio writes in</p>
          <p className="mt-1 text-[11.5px] leading-[1.5] text-fit-muted">Applies to the profile summary, dossier prose, dimension insights, and validation points.</p>
          <div className="mt-2 max-h-[186px] space-y-0.5 overflow-y-auto">
            <button type="button" onClick={() => setDraftLanguage(null)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left', draftLanguage === null && 'bg-fit-violet-wash')}>
              <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-medium text-fit-ink">Workspace default</span><span className="block text-[11px] text-fit-subtle">{getGioFitLanguage(workspaceLanguage).name} · set in Settings → Recruiting</span></span>
              {draftLanguage === null && <Check className="h-3.5 w-3.5 text-virgilio-purple" strokeWidth={2.5} />}
            </button>
            {sortedLanguages.map((item) => (
              <button key={item.code} type="button" onClick={() => setDraftLanguage(item.code)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left', draftLanguage === item.code && 'bg-fit-violet-wash')}>
                <span className="min-w-0 flex-1 text-[12.5px] font-medium text-fit-ink">{item.name} <span className="ml-1 text-[11px] font-normal text-fit-subtle">{item.nativeName}</span></span>
                {detectedCodes.has(item.code) && <Badge tone="neutral" size="sm">in source</Badge>}
                {draftLanguage === item.code && <Check className="h-3.5 w-3.5 text-virgilio-purple" strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-3 border-t border-fit-hairline px-3.5 py-2.5">
          <div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-fit-ink">Keep names and titles as written</p><p className="mt-0.5 text-[11px] leading-[1.45] text-fit-subtle">Companies, schools, and certifications stay in the original — a translated employer name is unsearchable.</p></div>
          <Switch checked={draftKeepProperNouns} onCheckedChange={setDraftKeepProperNouns} className="h-[22px] w-[38px] border-0 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" aria-label="Keep names and titles as written" />
        </section>

        <footer className="flex items-center gap-3 border-t border-fit-hairline bg-fit-paper px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-[10.5px] leading-[1.45] text-fit-subtle">Re-writes the dossier. The score, dimensions, and evidence are unchanged.</p>
          <Button variant={changed ? 'primary' : 'secondary'} size="sm" disabled={!changed || isRewriting} loading={isRewriting} onClick={apply}>{changed ? 'Re-write' : 'Applied'}</Button>
        </footer>
      </PopoverContent>
    </Popover>
  )
}

export function GioFitLanguageProvenance({ analysis, outputLanguage }: { analysis: FitAnalysis; outputLanguage: string }) {
  const names = [...new Set((analysis.detected_languages?.sources || []).filter((source) => source.code !== outputLanguage).map((source) => source.name))]
  if (!names.length) return null
  return <span className="inline-flex items-center gap-1 rounded-md border border-fit-lilac bg-fit-violet-wash px-[7px] py-0.5 text-[11px] text-fit-muted"><Languages className="h-[11px] w-[11px] text-virgilio-purple" />Written in {getGioFitLanguage(outputLanguage).name} from {names.join(' and ')} sources</span>
}