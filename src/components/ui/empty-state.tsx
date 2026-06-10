import * as React from 'react'
import { useState, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button as ShadButton } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabaseClient'
import type { LucideIcon } from 'lucide-react'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

/**
 * EmptyState — single source of truth for all empty states.
 * Gio Empty States Build Spec §3.
 *
 * Canonical API:
 *   <EmptyState
 *     illustration={<SoftPlane />}
 *     title="No candidates yet"
 *     body="Add someone manually, or share your posting link…"
 *     primary={<EmptyAction icon={<Plus size={16} />} onClick={...}>Add candidate</EmptyAction>}
 *     secondary={<EmptyAction variant="secondary" icon={<Link size={16} />}>Share posting</EmptyAction>}
 *     size="route" | "card"
 *   />
 *
 * Legacy API (still supported during migration):
 *   <EmptyState title description variant="page|table-row|chart|inline" icon action secondaryAction />
 */

const INK = '#0d0d09'
const HAIRLINE = '#E7E8EE'
const TEXT_MUTED = '#5A6072'
const PURPLE = '#6F3FF5'

// ── Button used inside empty states ────────────────────────────────────────
export interface EmptyActionProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  icon?: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}

export function EmptyAction({
  children,
  variant = 'primary',
  icon,
  onClick,
  type = 'button',
}: EmptyActionProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    padding: '0 16px',
    borderRadius: 8,
    fontFamily: "'Poppins', system-ui, sans-serif",
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: '-0.005em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 120ms ease, border-color 120ms ease',
  }
  const skins = {
    primary: {
      background: INK,
      color: '#fffcf9',
      border: '1px solid transparent',
      boxShadow: '0 1px 2px rgba(13,13,9,0.08)',
    },
    secondary: {
      background: '#fff',
      color: '#1F2230',
      border: '1px solid #E0DDD3',
    },
  } as const
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...skins[variant] }}>
      {icon}
      {children}
    </button>
  )
}

// ── Canonical EmptyState (route / card) ────────────────────────────────────
export interface CanonicalEmptyStateProps {
  illustration: React.ReactNode
  title: React.ReactNode
  body?: React.ReactNode
  primary?: React.ReactNode
  secondary?: React.ReactNode
  size?: 'route' | 'card'
  className?: string
}

function CanonicalEmptyState({
  illustration,
  title,
  body,
  primary,
  secondary,
  size = 'route',
  className,
}: CanonicalEmptyStateProps) {
  const t =
    size === 'card'
      ? { title: 18, body: 13, minH: 300, pad: '32px 20px', maxW: 340 }
      : { title: 22, body: 14, minH: 440, pad: '48px 24px', maxW: 400 }
  return (
    <div
      className={className}
      style={{
        background: '#fff',
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 18,
        boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: t.minH,
        padding: t.pad,
        ...(size === 'card'
          ? { width: '100%', maxWidth: 480, marginInline: 'auto' }
          : null),
      }}
    >
      <div style={{ marginBottom: 6, transform: size === 'card' ? 'scale(0.82)' : 'none' }}>
        {illustration}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "'Poppins', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: t.title,
          letterSpacing: '-0.025em',
          color: INK,
        }}
      >
        {title}
      </h2>
      {body ? (
        <p
          style={{
            margin: '10px auto 0',
            maxWidth: t.maxW,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: t.body,
            lineHeight: 1.55,
            color: TEXT_MUTED,
          }}
        >
          {body}
        </p>
      ) : null}
      {(primary || secondary) && (
        <div style={{ display: 'inline-flex', gap: 10, marginTop: 20 }}>
          {primary}
          {secondary}
        </div>
      )}
    </div>
  )
}

// ── InlineEmpty (dense panels / sub-tabs) ──────────────────────────────────
export interface InlineEmptyProps {
  text: React.ReactNode
  action?: React.ReactNode
  onAction?: () => void
  className?: string
}

export function InlineEmpty({ text, action, onAction, className }: InlineEmptyProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '13px 14px',
        borderRadius: 12,
        background: '#F7F6F2',
        border: '1px solid #ECEAE3',
      }}
    >
      <Info size={15} strokeWidth={1.8} color="#A6A2AD" />
      <span
        style={{
          flex: 1,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 13,
          color: '#8B8694',
        }}
      >
        {text}
      </span>
      {action ? (
        <button
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: "'Poppins', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 12.5,
            color: PURPLE,
          }}
        >
          {action}
        </button>
      ) : null}
    </div>
  )
}

// ── Legacy back-compat (kept rendering close to canonical, mascot fallback)
export type EmptyStateAssetType =
  | 'empty-state-organizations'
  | 'empty-state-jobs'
  | 'empty-state-candidates'
  | 'empty-state-members'
  | 'empty-state-comments'
  | 'empty-state-attachments'
  | 'empty-state-templates'
  | 'empty-state-independent-candidates'

type LegacyVariant = 'page' | 'table-row' | 'chart' | 'inline'

interface LegacyActionProp {
  label: string
  onClick: () => void
  variant?: React.ComponentProps<typeof ShadButton>['variant']
}

export interface LegacyEmptyStateProps {
  variant?: LegacyVariant
  title: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  fallbackIcon?: LucideIcon
  assetType?: EmptyStateAssetType
  mascot?: boolean
  action?: LegacyActionProp
  secondaryAction?: LegacyActionProp
  size?: 'sm' | 'md' | 'lg'
  className?: string
  colSpan?: number
}

const PADDING: Record<LegacyVariant, string> = {
  page: 'py-16 px-4',
  'table-row': 'py-12 px-4',
  chart: 'py-8 px-4',
  inline: 'py-10 px-4',
}
const VISUAL: Record<LegacyVariant, string> = {
  page: 'h-16 w-16',
  'table-row': 'h-10 w-10',
  chart: 'h-10 w-10',
  inline: 'h-12 w-12',
}
const ICON: Record<LegacyVariant, string> = {
  page: 'h-8 w-8',
  'table-row': 'h-5 w-5',
  chart: 'h-10 w-10',
  inline: 'h-6 w-6',
}
const TITLE: Record<LegacyVariant, string> = {
  page: 'text-lg font-poppins font-bold tracking-page-title',
  'table-row': 'text-table-name',
  chart: 'text-sm font-poppins font-medium',
  inline: 'text-[1.38rem] font-semibold tracking-[-0.06em]',
}

function usePlatformAsset(assetType?: EmptyStateAssetType) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!assetType) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('platform_assets')
          .select('file_url')
          .eq('asset_type', assetType)
          .eq('is_active', true)
          .single()
        if (!cancelled && data && !error) setUrl(data.file_url)
      } catch {
        /* fallback */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assetType])
  return url
}

function LegacyEmptyStateCore({
  variant = 'inline',
  title,
  description,
  icon,
  fallbackIcon,
  assetType,
  mascot,
  action,
  secondaryAction,
  className,
}: Omit<LegacyEmptyStateProps, 'colSpan'>) {
  const Icon = icon ?? fallbackIcon
  const customImage = usePlatformAsset(variant === 'page' ? assetType : undefined)
  const showMascot = mascot ?? (variant === 'page' || variant === 'inline')
  const hasIcon = Boolean(Icon)
  const hasCustom = Boolean(customImage)

  const titleColor = variant === 'chart' ? 'text-virgilio-muted' : 'text-text-primary'
  const descColor = variant === 'chart' ? 'text-virgilio-muted/70' : 'text-text-tertiary'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        PADDING[variant],
        className,
      )}
    >
      {hasCustom ? (
        <div className={cn('mb-4 flex items-center justify-center rounded-full overflow-hidden bg-virgilio-purple/10', VISUAL[variant])}>
          <img src={customImage as string} alt="" className="h-full w-full rounded-full object-cover" />
        </div>
      ) : hasIcon ? (
        <div className={cn('mb-4 flex items-center justify-center rounded-full', variant === 'chart' ? '' : 'bg-virgilio-purple/10', VISUAL[variant])}>
          {Icon ? <Icon className={cn(ICON[variant], variant === 'chart' ? 'text-virgilio-muted/30' : 'text-virgilio-purple')} /> : null}
        </div>
      ) : showMascot ? (
        <div className={cn('mb-4 flex items-center justify-center rounded-full overflow-hidden bg-muted/30', VISUAL[variant])}>
          <img src={gioFaceEmpty} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      <h3 className={cn(TITLE[variant], titleColor, 'mb-1.5')}>
        {title}
        <span className="text-purple-period">.</span>
      </h3>

      {description ? (
        <p className={cn('max-w-md mx-auto leading-relaxed font-poppins', variant === 'page' ? 'text-sm' : 'text-body-sm', descColor)}>
          {description}
        </p>
      ) : null}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 pt-5">
          {action ? (
            <ShadButton variant={action.variant ?? (variant === 'page' ? 'primary' : 'purple')} size="sm" onClick={action.onClick}>
              {action.label}
            </ShadButton>
          ) : null}
          {secondaryAction ? (
            <ShadButton variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </ShadButton>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Unified entry point ────────────────────────────────────────────────────
export type EmptyStateProps =
  | (CanonicalEmptyStateProps & { variant?: never; description?: never; action?: never; secondaryAction?: never })
  | LegacyEmptyStateProps

function EmptyStateRoot(props: EmptyStateProps) {
  // Canonical path
  if ('illustration' in props && props.illustration !== undefined) {
    return <CanonicalEmptyState {...(props as CanonicalEmptyStateProps)} />
  }
  // Legacy path
  const legacy = props as LegacyEmptyStateProps
  if (legacy.variant === 'table-row') {
    const { colSpan, className, ...rest } = legacy
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan ?? 1} className={cn('p-0', className)}>
          <LegacyEmptyStateCore {...rest} variant="table-row" />
        </TableCell>
      </TableRow>
    )
  }
  return <LegacyEmptyStateCore {...legacy} />
}

// Sub-exports
type LegacySub = Omit<LegacyEmptyStateProps, 'variant'>
const PageEmpty = (p: LegacySub) => <EmptyStateRoot {...p} variant="page" />
const TableRowEmpty = (p: LegacySub & { colSpan: number }) => <EmptyStateRoot {...p} variant="table-row" />
const ChartEmpty = (p: LegacySub) => <EmptyStateRoot {...p} variant="chart" />
const InlineLegacyEmpty = (p: LegacySub) => <EmptyStateRoot {...p} variant="inline" />

interface FilteredProps {
  variant?: 'page' | 'chart' | 'inline'
  query?: string
  onClearFilters: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  className?: string
  colSpan?: number
}
function FilteredEmpty({
  variant = 'inline',
  query,
  onClearFilters,
  title = 'No matches',
  description,
  className,
  colSpan,
}: FilteredProps) {
  const desc =
    description ??
    (query ? (
      <>
        No items match <span className="font-medium text-text-primary">"{query}"</span>.
      </>
    ) : (
      'No items match the current filters.'
    ))
  if (colSpan != null) {
    return (
      <EmptyStateRoot
        variant="table-row"
        title={title}
        description={desc}
        action={{ label: 'Clear all filters', onClick: onClearFilters, variant: 'ghost' }}
        colSpan={colSpan}
        className={className}
      />
    )
  }
  return (
    <EmptyStateRoot
      variant={variant}
      title={title}
      description={desc}
      action={{ label: 'Clear all filters', onClick: onClearFilters, variant: 'ghost' }}
      className={className}
    />
  )
}

export const EmptyState = Object.assign(EmptyStateRoot, {
  Page: PageEmpty,
  TableRow: TableRowEmpty,
  Chart: ChartEmpty,
  Inline: InlineLegacyEmpty,
  Filtered: FilteredEmpty,
})

export default EmptyState
