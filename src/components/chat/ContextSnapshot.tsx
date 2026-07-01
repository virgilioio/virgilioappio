import { useNavigate } from 'react-router-dom'
import { MapPin, ExternalLink } from 'lucide-react'

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
  jobDepartment: string | null
  jobEmploymentType: string | null
}

interface ContextSnapshotProps {
  data: ContextSnapshotData
}

const AVATAR_PALETTE = [
  { bg: '#EDE4FF', fg: '#5B3FBF' },
  { bg: '#DBEAFE', fg: '#1E40AF' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#FEE2E2', fg: '#991B1B' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#CFFAFE', fg: '#155E75' },
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() ||
    '?'
  )
}

/**
 * ContextSnapshot — centered avatar, name, role, location + "View full profile".
 */
export function ContextSnapshot({ data }: ContextSnapshotProps) {
  const name = data.candidateName?.trim() || data.email || 'Candidate'
  const location = [data.locationCity, data.locationCountry].filter(Boolean).join(', ')
  const color = avatarColor(data.candidateId)
  const navigate = useNavigate()
  const canOpen = Boolean(data.jobId && data.candidateId)

  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ paddingTop: 4 }}
    >
      <div
        className="flex items-center justify-center font-poppins font-semibold"
        style={{
          height: 56,
          width: 56,
          borderRadius: 999,
          background: color.bg,
          color: color.fg,
          fontSize: 18,
          letterSpacing: '-0.02em',
        }}
        aria-hidden
      >
        {initials(name)}
      </div>
      <div
        className="font-poppins"
        style={{
          marginTop: 11,
          fontSize: 16,
          fontWeight: 600,
          color: '#0d0d09',
          letterSpacing: '-0.02em',
        }}
      >
        {name}
      </div>
      {data.jobTitle && (
        <div
          className="font-inter"
          style={{ marginTop: 2, fontSize: 12, color: '#5A6072' }}
        >
          {data.jobTitle}
        </div>
      )}
      {location && (
        <div
          className="inline-flex items-center font-inter"
          style={{ marginTop: 9, gap: 5, fontSize: 11.5, color: '#5A6072' }}
        >
          <MapPin style={{ height: 12, width: 12 }} strokeWidth={2} />
          {location}
        </div>
      )}
      <button
        type="button"
        disabled={!canOpen}
        onClick={() =>
          canOpen && navigate(`/jobs/${data.jobId}/candidates/${data.candidateId}`)
        }
        className="inline-flex items-center justify-center font-poppins transition-colors disabled:opacity-60"
        style={{
          marginTop: 13,
          width: '100%',
          height: 34,
          gap: 7,
          borderRadius: 9,
          background: '#FFFFFF',
          border: '1px solid #E7E8EE',
          color: '#1F2230',
          fontSize: 12.5,
          fontWeight: 500,
        }}
      >
        View full profile
        <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={2} />
      </button>
    </div>
  )
}
