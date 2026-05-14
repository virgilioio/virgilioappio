import { Calendar, Globe, DollarSign, MapPin, BadgeCheck } from 'lucide-react'
import { ReactNode } from 'react'

interface Row {
  icon: ReactNode
  label: string
  value: ReactNode
}

interface ProfileApplicationCardProps {
  appliedAt?: string | null
  source?: string | null
  compensation?: string | null
  openTo?: string | null
  workAuth?: string | null
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return null }
}

export function ProfileApplicationCard({ appliedAt, source, compensation, openTo, workAuth }: ProfileApplicationCardProps) {
  const rows: Row[] = [
    { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Applied', value: fmtDate(appliedAt) || '—' },
    { icon: <Globe className="h-3.5 w-3.5" />, label: 'Source', value: source || '—' },
    { icon: <DollarSign className="h-3.5 w-3.5" />, label: 'Comp ask', value: compensation || '—' },
    { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Open to', value: openTo || '—' },
    { icon: <BadgeCheck className="h-3.5 w-3.5" />, label: 'Work auth', value: workAuth || '—' },
  ]
  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm p-5">
      <h3 className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
        Application
      </h3>
      <dl className="divide-y divide-virgilio-border/60">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <dt className="inline-flex items-center gap-2 text-[13px] font-poppins text-text-secondary">
              <span className="text-text-tertiary">{r.icon}</span>
              {r.label}
            </dt>
            <dd className="text-[13px] font-poppins text-text-primary text-right truncate max-w-[180px]">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default ProfileApplicationCard
