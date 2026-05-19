interface Row {
  label: string
  value: string | null
}

interface Props {
  rows: Row[]
}

export function JobAsideSummary({ rows }: Props) {
  const visible = rows.filter((r) => r.value)
  if (visible.length === 0) return null
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <dl className="divide-y divide-black/5">
        {visible.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <dt className="text-[12px] text-[#5a6072]">{r.label}</dt>
            <dd className="text-[12.5px] text-[#0d0d09] font-medium text-right max-w-[60%] truncate">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
