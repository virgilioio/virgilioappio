import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronRight,
  MapPin,
  Building2,
  Clock,
  ExternalLink,
  Share2,
  UserPlus,
  MoreHorizontal,
  Plus,
  Pencil,
  Copy,
  XCircle,
  Archive as ArchiveIcon,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { cn } from '@/lib/utils'

type HiringTeamMember = {
  user_id?: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  avatar_url?: string | null
}

interface JobHeroProps {
  title: string
  status?: string | null
  department?: string | null
  location?: string | null
  createdAt?: string | null
  hiringTeam?: HiringTeamMember[]
  onShare?: () => void
  onViewPosting?: () => void
  onCreatePosting?: () => void
  hasPosting?: boolean
  onAddCandidate?: () => void
  onMoreActions?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onCloseJob?: () => void
  onArchive?: () => void
  onDelete?: () => void
  canEdit?: boolean
}

const STATUS_TONE: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'neutral' }> = {
  open: { label: 'Open', tone: 'green' },
  draft: { label: 'Draft', tone: 'yellow' },
  closed: { label: 'Closed', tone: 'red' },
  archived: { label: 'Archived', tone: 'neutral' },
}

function getInitials(m: HiringTeamMember) {
  const fn = (m.first_name || '').trim()
  const ln = (m.last_name || '').trim()
  if (fn || ln) return `${fn[0] || ''}${ln[0] || ''}`.toUpperCase() || '?'
  return (m.email || '?').slice(0, 2).toUpperCase()
}

function HiringTeamStack({ members }: { members: HiringTeamMember[] }) {
  if (!members?.length) return null
  const visible = members.slice(0, 3)
  const overflow = members.length - visible.length
  return (
    <div className="flex items-center gap-2">
      <span className="text-body-sm text-text-secondary">Hiring team</span>
      <div className="flex -space-x-2">
        {visible.map((m, i) => (
          <Avatar key={(m.user_id || m.email || i.toString())} className="h-6 w-6 ring-2 ring-background">
            {m.avatar_url ? <AvatarImage src={m.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-[10px] font-medium bg-virgilio-purple text-white">
              {getInitials(m)}
            </AvatarFallback>
          </Avatar>
        ))}
        {overflow > 0 && (
          <div className="h-6 min-w-6 px-1.5 rounded-full bg-muted ring-2 ring-background grid place-items-center text-[10px] font-medium text-text-secondary">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}

export function JobHero({
  title,
  status,
  department,
  location,
  createdAt,
  hiringTeam = [],
  onShare,
  onViewPosting,
  onCreatePosting,
  hasPosting = true,
  onAddCandidate,
  onMoreActions,
  canEdit = true,
}: JobHeroProps) {
  const statusInfo = STATUS_TONE[(status || 'open').toLowerCase()] || STATUS_TONE.open
  const posted = createdAt ? formatDistanceToNowStrict(new Date(createdAt), { addSuffix: true }) : null

  return (
    <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4">
      <div className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-body-sm text-text-tertiary mb-2">
          <Link to="/jobs" className="hover:text-text-secondary transition-colors">Jobs</Link>
          {department && (
            <>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span className="text-text-tertiary">{department}</span>
            </>
          )}
        </nav>

        {/* Title */}
        <h1 className={cn(
          'font-poppins font-semibold tracking-[-0.04em] text-text-primary',
          'text-[28px] leading-tight sm:text-[32px]'
        )}>
          {title}<span className="text-virgilio-purple">.</span>
        </h1>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-sm text-text-secondary">
          <Badge tone={statusInfo.tone as any} dot size="sm">{statusInfo.label}</Badge>
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </span>
          )}
          {department && (
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> {department}
            </span>
          )}
          {posted && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Posted {posted}
            </span>
          )}
          {hiringTeam.length > 0 && <HiringTeamStack members={hiringTeam} />}
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center gap-2 shrink-0">
          {onShare && (
            <Button variant="secondary" size="md" icon={Share2} onClick={onShare}>
              Share
            </Button>
          )}
          {hasPosting && onViewPosting && (
            <Button
              variant="secondary"
              size="md"
              icon={ExternalLink}
              onClick={onViewPosting}
            >
              View posting
            </Button>
          )}
          {!hasPosting && onCreatePosting && (
            <Button
              variant="secondary"
              size="md"
              icon={Plus}
              onClick={onCreatePosting}
            >
              Create job post
            </Button>
          )}
          {onAddCandidate && (
            <Button
              variant="primary"
              size="md"
              icon={UserPlus}
              onClick={onAddCandidate}
              className="text-white [&_svg]:text-white"
            >
              Add candidate
            </Button>
          )}
          {onMoreActions && (
            <Button variant="secondary" size="md" iconOnly icon={MoreHorizontal} aria-label="More actions" onClick={onMoreActions} />
          )}
        </div>
      )}
    </header>
  )
}

export default JobHero
