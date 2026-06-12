import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Sidebar shell — ONE card per tab, 16px padding, holds stacked blocks. */
export function ProfileSidebar({
  children,
  className,
  /** Render without the card chrome (rare — for sidebars that compose multiple cards). */
  bare = false,
}: { children: ReactNode; className?: string; bare?: boolean }) {
  if (bare) {
    return <div className={cn('space-y-3', className)}>{children}</div>
  }
  return (
    <aside
      className={cn(
        'bg-white rounded-[14px] border border-[#E7E8EE] shadow-[0_1px_2px_rgba(13,13,9,0.04)] p-4 space-y-5',
        className,
      )}
    >
      {children}
    </aside>
  )
}

interface SidebarBlockProps {
  label: string
  action?: ReactNode
  children: ReactNode
  className?: string
}
/** A labeled block inside the sidebar card. */
export function SidebarBlock({ label, action, children, className }: SidebarBlockProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="font-inter font-semibold text-[10.5px] tracking-[0.08em] uppercase text-[#8B8F9E]">
          {label}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

interface MetaRowProps {
  icon?: LucideIcon
  label: string
  value?: ReactNode
  /** Override the muted em-dash empty placeholder. */
  emptyText?: string
}
/** Meta row: icon · label (min-w 90) · value right-aligned. Hairline below. */
export function MetaRow({ icon: Icon, label, value, emptyText = '—' }: MetaRowProps) {
  const hasValue =
    value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#F6F5F1] last:border-b-0">
      {Icon && <Icon className="h-3.5 w-3.5 text-[#8B8F9E] shrink-0" />}
      <span className="font-inter text-[11.5px] text-[#5A6072] min-w-[90px]">{label}</span>
      <span
        className={cn(
          'ml-auto font-inter text-[12.5px] font-medium text-right truncate',
          hasValue ? 'text-[#1F2230]' : 'text-[#8B8F9E]',
        )}
      >
        {hasValue ? value : emptyText}
      </span>
    </div>
  )
}

interface LinkRowProps {
  icon?: LucideIcon
  label: string
  url: string
  onOpen?: () => void
}
/** Link row: icon · label (caption) over purple url + external button. */
export function LinkRow({ icon: Icon, label, url, onOpen }: LinkRowProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (onOpen) {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group flex items-start gap-2.5 py-2 border-b border-[#F6F5F1] last:border-b-0 hover:bg-[#FAFAF7] -mx-1 px-1 rounded"
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-[#8B8F9E] mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="font-inter text-[11px] text-[#8B8F9E] uppercase tracking-[0.04em]">
          {label}
        </div>
        <div className="font-inter text-[12px] font-medium text-virgilio-purple truncate group-hover:underline">
          {url}
        </div>
      </div>
    </a>
  )
}

interface FileRowProps {
  icon: LucideIcon
  name: string
  meta?: string
  isResume?: boolean
  onDownload?: () => void
  downloadIcon?: LucideIcon
}
/** File row: bordered (radius 10), 32px tile, name + meta, download icon-button. */
export function FileRow({ icon: Icon, name, meta, isResume, onDownload, downloadIcon: DownloadIcon }: FileRowProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[#E7E8EE] p-2.5">
      <div
        className={cn(
          'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
          isResume ? 'bg-[#EDE4FF] text-virgilio-purple' : 'bg-[#FAFAF7] text-[#5A6072]',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-inter font-medium text-[12.5px] text-[#1F2230] truncate">{name}</span>
          {isResume && (
            <span className="inline-flex items-center px-1.5 h-[16px] rounded-full bg-[#EDE4FF] text-virgilio-purple font-inter font-semibold text-[9.5px] tracking-[0.04em] uppercase">
              Resume
            </span>
          )}
        </div>
        {meta && <div className="font-inter text-[11px] text-[#8B8F9E] truncate">{meta}</div>}
      </div>
      {onDownload && DownloadIcon && (
        <button
          type="button"
          onClick={onDownload}
          className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[#5A6072] hover:bg-[#F1F0EC] transition-colors"
          aria-label={`Download ${name}`}
        >
          <DownloadIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
