import { Button } from '@/components/ui/button'

interface CandidatesFooterProps {
  shown: number
  total: number
  pageSize: number
  onPageSizeChange: (n: number) => void
  onLoadMore: () => void
  canLoadMore: boolean
}

export function CandidatesFooter({ shown, total, pageSize, onPageSizeChange, onLoadMore, canLoadMore }: CandidatesFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-[12px] font-inter text-text-tertiary">
      <div>
        Showing <span className="text-text-primary font-medium tabular-nums">1–{shown.toLocaleString()}</span> of{' '}
        <span className="text-text-primary font-medium tabular-nums">{total.toLocaleString()}</span> matching this search
      </div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-1.5">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-virgilio-border bg-white px-1.5 text-[12px] font-poppins"
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <Button size="xs" variant="secondary" onClick={onLoadMore} disabled={!canLoadMore}>
          Load {pageSize} more
        </Button>
      </div>
    </div>
  )
}
