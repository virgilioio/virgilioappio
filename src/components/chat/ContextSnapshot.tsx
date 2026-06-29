import { Mail, Phone, MapPin, Briefcase, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface ContextSnapshotData {
  candidateId: string
  candidateName: string | null
  email: string | null
  phone: string | null
  roleCurrent: string | null
  companyCurrent: string | null
  locationCity: string | null
  locationCountry: string | null
  jobId: string | null
  jobTitle: string | null
}

interface ContextSnapshotProps {
  data: ContextSnapshotData
}

/**
 * ContextSnapshot — candidate identity card at the top of the context pane (Step 1.8).
 * Pure presentational: name, role @ company, location, email, phone, and a deep link
 * to the in-job candidate profile.
 */
export function ContextSnapshot({ data }: ContextSnapshotProps) {
  const name = data.candidateName?.trim() || data.email || 'Candidate'
  const initial = (name[0] ?? '?').toUpperCase()
  const roleLine = [data.roleCurrent, data.companyCurrent].filter(Boolean).join(' · ')
  const locationLine = [data.locationCity, data.locationCountry].filter(Boolean).join(', ')

  const profileHref =
    data.jobId && data.candidateId
      ? `/jobs/${data.jobId}/candidates/${data.candidateId}`
      : null

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-full bg-[#EDE4FF] text-[#5B3FBF] flex items-center justify-center font-poppins font-semibold text-[15px] shrink-0">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-poppins font-semibold text-[14px] tracking-[-0.02em] text-virgilio-text truncate">
            {name}
          </div>
          {roleLine && (
            <div className="text-[11.5px] text-text-secondary truncate mt-0.5">{roleLine}</div>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-2">
        {data.jobTitle && (
          <SnapshotRow icon={<Briefcase className="h-3.5 w-3.5" />}>
            {profileHref ? (
              <Link
                to={profileHref}
                className="inline-flex items-center gap-1 hover:text-virgilio-purple transition-colors"
              >
                <span className="truncate">{data.jobTitle}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </Link>
            ) : (
              <span className="truncate">{data.jobTitle}</span>
            )}
          </SnapshotRow>
        )}
        {locationLine && (
          <SnapshotRow icon={<MapPin className="h-3.5 w-3.5" />}>{locationLine}</SnapshotRow>
        )}
        {data.email && (
          <SnapshotRow icon={<Mail className="h-3.5 w-3.5" />}>
            <a
              href={`mailto:${data.email}`}
              className="truncate hover:text-virgilio-purple transition-colors"
            >
              {data.email}
            </a>
          </SnapshotRow>
        )}
        {data.phone && (
          <SnapshotRow icon={<Phone className="h-3.5 w-3.5" />}>
            <a
              href={`tel:${data.phone}`}
              className="truncate hover:text-virgilio-purple transition-colors"
            >
              {data.phone}
            </a>
          </SnapshotRow>
        )}
      </dl>
    </div>
  )
}

function SnapshotRow({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-virgilio-text/85 font-inter">
      <span className="text-text-secondary shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 truncate">{children}</div>
    </div>
  )
}
