import { MapPin, ArrowRight } from 'lucide-react'

export interface CareersRole {
  id: string
  slug: string
  title: string
  department: string
  location: string | null
  type: string | null
  workMode: string | null
  postedAt: string
  featured: boolean
  description?: string | null
}

interface Props {
  groups: { department: string; roles: CareersRole[] }[]
  onOpen: (slug: string) => void
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor(diff / day)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return '1 month ago'
  return `${Math.floor(days / 30)} months ago`
}

export function CareersRoleList({ groups, onOpen }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10" id="open-roles">
      {groups.map((g) => (
        <div key={g.department}>
          <div className="flex items-baseline gap-3 mb-3 px-2">
            <h2 className="font-poppins font-semibold text-[14px] text-[#0d0d09] tracking-[-0.01em]">{g.department}</h2>
            <span className="text-[12px] text-[#8B8F9E]">{g.roles.length} open role{g.roles.length === 1 ? '' : 's'}</span>
          </div>
          <div className="rounded-2xl bg-white border border-black/5 divide-y divide-black/5 overflow-hidden">
            {g.roles.map((r) => (
              <RoleRow key={r.id} role={r} onOpen={() => onOpen(r.slug)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RoleRow({ role, onOpen }: { role: CareersRole; onOpen: () => void }) {
  return (
    <div
      className="grid grid-cols-12 items-center gap-3 px-5 py-4 hover:bg-[#FAFAF7] transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <div className="col-span-12 md:col-span-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-poppins font-semibold text-[14px] text-[#0d0d09] tracking-[-0.01em]">
            {role.title}
          </span>
          {role.featured && (
            <span className="inline-flex items-center h-[18px] px-1.5 rounded text-[9.5px] font-poppins font-semibold tracking-[0.06em] uppercase bg-[#EDE4FF] text-[#5b2bd1]">
              Featured
            </span>
          )}
        </div>
        <div className="text-[12px] text-[#5a6072] mt-0.5">
          {role.department}
        </div>
      </div>

      <div className="col-span-6 md:col-span-2 flex items-center gap-1.5 text-[12.5px] text-[#3f4451]">
        <MapPin className="h-3.5 w-3.5 text-[#8B8F9E]" />
        <span className="truncate">{role.location || 'Remote'}</span>
      </div>

      <div className="col-span-3 md:col-span-1">
        {role.workMode && (
          <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-[#F1F0EC] text-[11px] text-[#3f4451]">
            {role.workMode}
          </span>
        )}
      </div>

      <div className="hidden md:block col-span-2 text-[12.5px] text-[#3f4451]">
        {role.type || 'Full-time'}
      </div>

      <div className="hidden md:block col-span-1 text-[11.5px] text-[#8B8F9E]">
        {relTime(role.postedAt)}
      </div>

      <div className="col-span-3 md:col-span-1 flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0d0d09] text-[#FFFCF9] text-[12px] font-poppins font-medium hover:bg-black"
        >
          View role
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
