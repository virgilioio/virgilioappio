import React from 'react'
import { Sparkles, CheckCircle2, Info } from 'lucide-react'

interface FooterStatusLineProps {
  parseStep: 'idle' | 'parsing' | 'done'
  enrich: 'idle' | 'working' | 'done'
  parsedFieldsCount?: number
  dedupeCount?: number | null
}

/**
 * Left-side live status line in the candidate sheet footer.
 * Mirrors the two-state machine; primary submit stays enabled throughout.
 */
export function FooterStatusLine({
  parseStep,
  enrich,
  parsedFieldsCount = 0,
  dedupeCount,
}: FooterStatusLineProps) {
  if (parseStep === 'parsing') {
    return (
      <div className="flex items-center gap-1.5 text-[12px] font-inter" style={{ color: '#5B21B6' }}>
        <span className="gio-spinner" style={{ width: 12, height: 12 }} />
        <span>Reading résumé…</span>
      </div>
    )
  }

  if (enrich === 'working') {
    return (
      <div className="flex items-center gap-1.5 text-[12px] font-inter" style={{ color: '#5B21B6' }}>
        <Sparkles className="h-3.5 w-3.5 gio-pulse" strokeWidth={1.75} />
        <span>Skills &amp; summary are generating in the background — you can save now.</span>
      </div>
    )
  }

  if (enrich === 'done') {
    return (
      <div className="flex items-center gap-1.5 text-[12px] font-inter" style={{ color: '#12B886' }}>
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>
          All set{parsedFieldsCount > 0 ? ` · ${parsedFieldsCount} fields auto-filled.` : '.'}
        </span>
      </div>
    )
  }

  // idle
  return (
    <div className="flex items-start gap-1.5 text-[12px] font-inter leading-tight max-w-[320px]" style={{ color: '#5A6072' }}>
      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
      <span>
        {typeof dedupeCount === 'number' && dedupeCount > 0
          ? `We'll de-duplicate against your existing ${dedupeCount.toLocaleString()} candidates.`
          : "We'll de-duplicate against your existing candidates."}
      </span>
    </div>
  )
}

export default FooterStatusLine
