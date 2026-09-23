import { groupExperience, formatRoleDates, getExperienceTitle, type ExperienceGroup, type ExperienceItem } from '@/lib/experience/groupExperience'

interface Props {
  items: ExperienceItem[]
  groups?: ExperienceGroup[]
  scale?: 0.85 | 1
  showAside?: boolean
  showTopBorder?: boolean
}

export function DossierExperienceGroups({ items, groups: suppliedGroups, scale = 1, showAside = true, showTopBorder = false }: Props) {
  const groups = suppliedGroups ?? groupExperience(items)
  const companies = new Set(groupExperience(items).map((group) => group.companyKey)).size
  if (!groups.length) return null
  return (
    <div className={scale === 0.85 ? 'dossier-experience-list dossier-experience-list--compact' : 'dossier-experience-list'}>
      {showAside && <p className="dossier-experience-aside mb-1 font-inter text-[10.5px] text-fit-subtle">Digested from {items.length} {items.length === 1 ? 'role' : 'roles'} at {companies} {companies === 1 ? 'company' : 'companies'} · newest first</p>}
      {groups.map((group, index) => <DossierExperienceGroup key={`${group.companyKey}-${group.stint}`} group={group} bordered={showTopBorder || index > 0} />)}
    </div>
  )
}

export function DossierExperienceGroup({ group, bordered = false }: { group: ExperienceGroup; bordered?: boolean }) {
  const multi = group.entries.length > 1
  return (
    <div className={`dossier-experience-group grid min-w-0 gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5 ${bordered ? 'border-t border-fit-hairline' : ''}`}>
      <div className="dossier-experience-meta min-w-0">
        <p className="break-words font-inter text-[12.5px] font-semibold text-fit-ink">{group.spanText}</p>
        {group.locations.length > 0 && <p className="mt-1 break-words font-inter text-[11.5px] text-fit-subtle">{group.locations.join(', ')}</p>}
        {group.stints > 1 && <p className="mt-1 break-words font-inter text-[10.5px] text-fit-violet-deep">{ordinal(group.stint)} stint{group.returning && group.awayText ? ` · after ${group.awayText} away` : ''}</p>}
      </div>
      <div className="dossier-experience-body min-w-0">
        <p className="break-words font-poppins text-[14.5px] font-semibold text-fit-ink">{group.company}{multi && <span className="font-medium text-fit-subtle"> · {group.entries.length} roles</span>}</p>
        <div className="mt-2.5 min-w-0 space-y-2.5">
          {group.entries.map((entry) => (
            <div key={entry.id} className="dossier-experience-role min-w-0">
              <p className="break-words font-inter text-[12.5px] font-semibold text-fit-ink">{getExperienceTitle(entry)}{multi && <span className="font-normal text-fit-subtle"> · {formatRoleDates(entry)}</span>}</p>
              {entry.description && <p className="mt-[7px] whitespace-pre-line text-pretty break-words font-inter text-[12.5px] leading-[1.6] text-fit-muted">{stripHtml(entry.description)}</p>}
              {entry.supports && entry.supports.length > 0 && <div className="dossier-experience-supports mt-1.5 flex flex-wrap gap-x-3 gap-y-1">{entry.supports.map((support) => <span key={support.label} className="inline-flex items-center gap-1.5 font-inter text-[10.5px] text-fit-muted"><span className={`h-1.5 w-1.5 shrink-0 ${support.colorClass ?? 'bg-fit-violet-deep'}`} />supports {support.label}</span>)}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ordinal(value: number) {
  const mod100 = value % 100
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}
