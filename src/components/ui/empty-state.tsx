import * as React from 'react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabaseClient'
import type { LucideIcon } from 'lucide-react'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

/**
 * EmptyState — single source of truth for all empty states.
 * Gio Foundation v1.0 §7.
 *
 * Variants:
 *   - page         Full page / large surface (Jobs, Deals, Organizations…)
 *   - table-row    Inside <TableBody> (use TableEmpty / TableFilteredEmpty wrappers)
 *   - chart        Inside analytics chart cards
 *   - inline       Cards, sheets, side panels (comments, attachments, activity…)
 *
 * Sub-exports:
 *   <EmptyState.Page />, <EmptyState.TableRow />, <EmptyState.Chart />,
 *   <EmptyState.Inline />, <EmptyState.Filtered />
 */

export type EmptyStateAssetType =
  | 'empty-state-organizations'
  | 'empty-state-jobs'
  | 'empty-state-candidates'
  | 'empty-state-members'
  | 'empty-state-comments'
  | 'empty-state-attachments'
  | 'empty-state-templates'
  | 'empty-state-independent-candidates'

type Variant = 'page' | 'table-row' | 'chart' | 'inline'
type Size = 'sm' | 'md' | 'lg'

type ButtonVariant = React.ComponentProps<typeof Button>['variant']

interface ActionProp {
  label: string
  onClick: () => void
  variant?: ButtonVariant
}

export interface EmptyStateProps {
  variant?: Variant
  title: React.ReactNode
  description?: React.ReactNode
  /** Lucide icon — alternative to mascot. */
  icon?: LucideIcon
  /** @deprecated use `icon` instead. */
  fallbackIcon?: LucideIcon
  /** DB-driven hero image (page variant only). */
  assetType?: EmptyStateAssetType
  /** Show Gio mascot (default true for page/inline; false for chart/table-row). */
  mascot?: boolean
  action?: ActionProp
  secondaryAction?: ActionProp
  size?: Size
  className?: string
  /** Required when variant="table-row". */
  colSpan?: number
}

const PADDING: Record<Variant, string> = {
  page: 'py-16 px-4',
  'table-row': 'py-12 px-4',
  chart: 'py-8 px-4',
  inline: 'py-10 px-4',
}

const VISUAL_SIZE: Record<Variant, string> = {
  page: 'h-16 w-16',
  'table-row': 'h-10 w-10',
  chart: 'h-10 w-10',
  inline: 'h-12 w-12',
}

const ICON_SIZE: Record<Variant, string> = {
  page: 'h-8 w-8',
  'table-row': 'h-5 w-5',
  chart: 'h-10 w-10',
  inline: 'h-6 w-6',
}

const TITLE_SIZE: Record<Variant, string> = {
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
        /* fallback to mascot/icon */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assetType])
  return url
}

function EmptyStateCore({
  variant = 'inline',
  title,
  description,
  icon,
  fallbackIcon,
  assetType,
  mascot,
  action,
  secondaryAction,
  size = 'md',
  className,
}: Omit<EmptyStateProps, 'colSpan'>) {
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
        className
      )}
    >
      {/* Visual */}
      {hasCustom ? (
        <div
          className={cn(
            'mb-4 flex items-center justify-center rounded-full overflow-hidden bg-virgilio-purple/10',
            VISUAL_SIZE[variant]
          )}
        >
          <img
            src={customImage as string}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        </div>
      ) : hasIcon ? (
        <div
          className={cn(
            'mb-4 flex items-center justify-center rounded-full',
            variant === 'chart' ? '' : 'bg-virgilio-purple/10',
            VISUAL_SIZE[variant]
          )}
        >
          {Icon ? (
            <Icon
              className={cn(
                ICON_SIZE[variant],
                variant === 'chart' ? 'text-virgilio-muted/30' : 'text-virgilio-purple'
              )}
            />
          ) : null}
        </div>
      ) : showMascot ? (
        <div
          className={cn(
            'mb-4 flex items-center justify-center rounded-full overflow-hidden bg-muted/30',
            VISUAL_SIZE[variant]
          )}
        >
          <img
            src={gioFaceEmpty}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      {/* Title with auto purple period */}
      <h3 className={cn(TITLE_SIZE[variant], titleColor, 'mb-1.5')}>
        {title}
        <span className="text-purple-period">.</span>
      </h3>

      {/* Description */}
      {description ? (
        <p
          className={cn(
            'max-w-md mx-auto leading-relaxed font-poppins',
            variant === 'page' ? 'text-sm' : 'text-body-sm',
            descColor
          )}
        >
          {description}
        </p>
      ) : null}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 pt-5">
          {action ? (
            <Button
              variant={action.variant ?? (variant === 'page' ? 'primary' : 'purple')}
              size="sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function EmptyStateRoot(props: EmptyStateProps) {
  if (props.variant === 'table-row') {
    const { colSpan, className, ...rest } = props
    if (!colSpan) {
      console.warn('[EmptyState] variant="table-row" requires `colSpan`.')
    }
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan ?? 1} className={cn('p-0', className)}>
          <EmptyStateCore {...rest} variant="table-row" />
        </TableCell>
      </TableRow>
    )
  }
  return <EmptyStateCore {...props} />
}

type SubProps = Omit<EmptyStateProps, 'variant'>

const PageEmpty = (p: SubProps) => <EmptyStateRoot {...p} variant="page" />
const TableRowEmpty = (p: SubProps & { colSpan: number }) => (
  <EmptyStateRoot {...p} variant="table-row" />
)
const ChartEmpty = (p: SubProps) => <EmptyStateRoot {...p} variant="chart" />
const InlineEmpty = (p: SubProps) => <EmptyStateRoot {...p} variant="inline" />

interface FilteredProps {
  variant?: Exclude<Variant, 'table-row'>
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
  Inline: InlineEmpty,
  Filtered: FilteredEmpty,
})

export default EmptyState
