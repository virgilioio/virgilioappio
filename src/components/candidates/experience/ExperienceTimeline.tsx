import { Repeat2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { groupExperience, formatRoleDates, getExperienceTitle, type ExperienceItem } from '@/lib/experience/groupExperience'

export function ExperienceTimeline({ items }: { items: ExperienceItem[] }) {
  const groups = groupExperience(items)
  if (!groups.length) return <p className="font-inter text-[12.5px] text-fit-subtle">No experience added yet.</p>

  return (
    <ol className="relative min-w-0">
      {groups.map((group, index) => {
        const multi = group.entries.length > 1
        return (
          <li key={`${group.companyKey}-${group.stint}`} className={`relative flex min-w-0 gap-3.5 ${index === groups.length - 1 ? '' : 'pb-5'}`}>
            {index < groups.length - 1 && <span aria-hidden className="absolute bottom-0 left-[17px] top-10 w-px bg-fit-row-border" />}
            {group.logoUrl ? (
              <img src={group.logoUrl} alt="" className="relative z-10 h-9 w-9 shrink-0 rounded-[9px] bg-fit-chip object-contain p-1" />
            ) : (
              <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] font-poppins text-[14px] font-bold ${group.current ? 'bg-primary text-primary-foreground' : 'bg-fit-chip text-fit-ink'}`}>
                {(group.company || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h4 className="min-w-0 break-words font-poppins text-[14px] font-semibold text-fit-ink">{group.company}</h4>
                {multi && <Badge tone="neutral" size="xs">{group.entries.length} roles</Badge>}
                {group.returning && <Badge tone="lilac" size="xs" icon={Repeat2}>Rejoined</Badge>}
                {group.current && <Badge tone="green" size="xs" dot>Current</Badge>}
              </div>
              <p className="mt-[3px] break-words font-inter text-[11.5px] text-fit-subtle">
                {[group.spanText, group.locations.join(', '), group.stints > 1 ? `${ordinal(group.stint)} stint` : null].filter(Boolean).join(' · ')}
                {group.returning && group.awayText ? ` · returned after ${group.awayText} away` : ''}
              </p>
              <div className={multi ? 'mt-2.5 border-l border-fit-row-border pl-3.5' : 'mt-2'}>
                {group.entries.map((entry, roleIndex) => (
                  <div key={entry.id} className={`relative min-w-0 ${roleIndex ? 'mt-3' : ''}`}>
                    {multi && <span aria-hidden className={`absolute -left-[17px] top-[7px] h-[5px] w-[5px] rounded-full ${entry.is_current || !entry.end_date ? 'bg-primary' : 'bg-fit-separator'}`} />}
                    <p className="break-words font-poppins text-[13px] font-semibold text-fit-ink">{getExperienceTitle(entry)}</p>
                    {multi && <p className="mt-0.5 font-inter text-[11.5px] text-fit-subtle">{formatRoleDates(entry)}</p>}
                    {entry.description && <p className="mt-[7px] whitespace-pre-line text-pretty break-words font-inter text-[12.5px] leading-[1.55] text-fit-muted">{stripHtml(entry.description)}</p>}
                  </div>
                ))}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
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
