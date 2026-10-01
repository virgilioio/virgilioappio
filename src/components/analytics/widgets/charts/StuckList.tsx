import { Link } from 'react-router-dom'

interface Row { id: string; href: string; name: string; job: string; stage: string; days: number; estimated: boolean }

export function StuckList({ rows }: { rows: Row[] }) {
  return (
    <div className="w-full overflow-hidden rounded-[8px] border border-[#F1F0EC]">
      <div className="grid grid-cols-[1.2fr_1fr_1fr_52px] gap-3 px-3 py-2 bg-[#FAFAF7] text-[10.5px] font-inter font-medium uppercase tracking-[0.06em] text-[#8B8F9E]">
        <div>Candidate</div>
        <div>Job</div>
        <div>Stage</div>
        <div className="text-right">Days</div>
      </div>
      <div className="divide-y divide-[#F1F0EC] max-h-[260px] overflow-auto">
        {rows.length === 0 && <div className="px-3 py-4 text-[12px] text-[#8B8F9E] font-inter">No candidates</div>}
        {rows.map(r => (
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
    </div>
  )
}
