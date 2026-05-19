export interface PanelMember {
  name: string
  role: string
  avatar_url?: string | null
}

const COLORS = ['#EDE4FF', '#FDE4F2', '#E4F2E4', '#FFF1D6', '#E0EEFF', '#FFE0DA']

interface Props {
  members: PanelMember[]
}

export function JobAsideHiringPanel({ members }: Props) {
  if (!members.length) return null
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 space-y-3">
      <div className="text-[10.5px] tracking-[0.06em] uppercase text-[#8B8F9E] font-poppins font-semibold">
        Hiring panel
      </div>
      <ul className="space-y-2.5">
        {members.map((m, i) => {
          const initials = m.name
            .split(/\s+/)
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
          return (
            <li key={i} className="flex items-center gap-2.5">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.name} className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[10.5px] font-poppins font-semibold text-[#0d0d09]"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {initials}
                </div>
              )}
              <div className="leading-tight">
                <div className="text-[12.5px] font-medium text-[#0d0d09]">{m.name}</div>
                <div className="text-[11.5px] text-[#5a6072]">{m.role}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
