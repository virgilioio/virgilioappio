interface Row {
  id?: string
  label: string
  value: string | string[] | null
}

interface Props {
  rows: Row[]
}

export function JobAsideSummary({ rows }: Props) {
  const visible = rows.filter((r) => {
    if (Array.isArray(r.value)) return r.value.length > 0
    return r.value
  })
  if (visible.length === 0) return null
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <dl className="divide-y divide-black/5">
        {visible.map((r, index) => (
          <div key={r.id || `${r.label}-${index}`} className="flex items-start justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
            <dt className="text-[12px] text-[#5a6072] pt-0.5 shrink-0">{r.label}</dt>
            <dd className="text-[12.5px] text-[#0d0d09] font-medium text-right">
              {Array.isArray(r.value) ? (
                <span className="inline-flex flex-wrap justify-end gap-1.5">
                  {r.value.map((item, i) => (
                    <span
                      key={`${item}-${i}`}
                      className="inline-flex items-center rounded-full border border-black/8 bg-[#FAF7F2] px-2 py-0.5 text-[11.5px] font-medium text-[#0d0d09]"
                    >
                      {item}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="block max-w-[180px] truncate">{r.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
