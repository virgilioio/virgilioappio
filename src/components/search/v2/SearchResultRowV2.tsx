import React from 'react'
import { cn } from '@/lib/utils'
import { highlight } from './highlight'

export type GlyphKind = 'avatar' | 'job' | 'company' | 'saved' | 'recent' | 'command' | 'ai'

interface SearchResultRowV2Props {
  glyph: GlyphKind
  initials?: string
  icon?: React.ComponentType<{ className?: string }>
  title: string
  sub?: React.ReactNode
  rightMeta?: React.ReactNode
  query?: string
  selected?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}

const tilePalette: Record<GlyphKind, { bg: string; fg: string }> = {
  avatar:   { bg: 'bg-virgilio-purple/20',  fg: 'text-virgilio-purple' },
  job:      { bg: 'bg-emerald-100',         fg: 'text-emerald-700' },
  company:  { bg: 'bg-sky-100',             fg: 'text-sky-700' },
  saved:    { bg: 'bg-violet-100',          fg: 'text-violet-700' },
  recent:   { bg: 'bg-[#F1F0EC]',           fg: 'text-virgilio-muted' },
  command:  { bg: 'bg-emerald-100',         fg: 'text-emerald-700' },
  ai:       { bg: 'bg-violet-100',          fg: 'text-violet-700' },
}

export function SearchResultRowV2({
  glyph,
  initials,
  icon: Icon,
  title,
  sub,
  rightMeta,
  query = '',
  selected = false,
  onClick,
  onMouseEnter,
}: SearchResultRowV2Props) {
  const palette = tilePalette[glyph]
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-selected={selected || undefined}
      className={cn(
        'group relative w-full flex items-center gap-3 rounded-lg pl-[14px] pr-[10px] py-[9px] text-left transition-colors',
        selected
          ? 'bg-[#F1F0EC]'
          : 'hover:bg-[#FAFAF7]',
      )}
    >
      {/* Selected: 2px noir left rail */}
      {selected && (
        <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#0d0d09]" />
      )}

      {/* Glyph: 30px tile or avatar */}
      <span
        className={cn(
          'flex-shrink-0 inline-flex items-center justify-center h-[30px] w-[30px] rounded-full',
          palette.bg,
          palette.fg,
        )}
      >
        {glyph === 'avatar' ? (
          <span className="font-poppins font-semibold text-[11px] tracking-[-0.02em]">
            {initials || '·'}
          </span>
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5" />
        ) : null}
      </span>

      {/* Title + sub */}
      <span className="flex-1 min-w-0">
        <span className="block truncate font-inter text-[13px] text-foreground leading-tight">
          {highlight(title, query)}
        </span>
        {sub && (
          <span className="block truncate font-inter text-[11.5px] text-virgilio-muted leading-tight mt-0.5">
            {sub}
          </span>
        )}
      </span>

      {/* Right meta */}
      {rightMeta && (
        <span className="flex-shrink-0 flex items-center gap-2 text-[11px] text-virgilio-muted">
          {rightMeta}
        </span>
      )}
    </button>
  )
}
