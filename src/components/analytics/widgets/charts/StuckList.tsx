import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Row { id: string; href: string; name: string; job: string; stage: string; days: number; estimated: boolean }

const PAGE_SIZE = 10

export function StuckList({ rows }: { rows: Row[] }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  const start = current * PAGE_SIZE
  const visible = rows.slice(start, start + PAGE_SIZE)

  return (
    <div className="w-full overflow-hidden rounded-[8px] border border-[#F1F0EC]">
      <div className="grid grid-cols-[1.2fr_1fr_1fr_52px] gap-3 px-3 py-2 bg-[#FAFAF7] text-[10.5px] font-inter font-medium uppercase tracking-[0.06em] text-[#8B8F9E]">
        <div>Candidate</div>
        <div>Job</div>
        <div>Stage</div>
        <div className="text-right">Days</div>
      </div>
      <div className="divide-y divide-[#F1F0EC]">
        {visible.length === 0 && <div className="px-3 py-4 text-[12px] text-[#8B8F9E] font-inter">No candidates</div>}
        {visible.map(r => (
          <Link
            key={r.id}
            to={r.href}
            className="grid grid-cols-[1.2fr_1fr_1fr_52px] gap-3 px-3 py-1.5 items-center text-[12px] font-inter text-[#1F2230] hover:bg-[#FAFAF7]"
          >
            <div className="truncate font-medium text-[#0d0d09]" title={r.name}>{r.name}</div>
            <div className="truncate" title={r.job}>{r.job}</div>
            <div className="truncate" title={r.stage}>{r.stage}</div>
            <div className="text-right font-poppins font-semibold tabular-nums text-[#0d0d09]" title={r.estimated ? 'Estimated from the date added to the job' : undefined}>
              {r.days}d{r.estimated ? '*' : ''}
            </div>
          </Link>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#F1F0EC] bg-[#FAFAF7] text-[11px] font-inter text-[#8B8F9E]">
          <span className="tabular-nums">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-[#F1F0EC] disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">Page {current + 1} of {totalPages}</span>
              <button
                type="button"
                aria-label="Next page"
                disabled={current >= totalPages - 1}
                onClick={() => setPage(current + 1)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-[#F1F0EC] disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
