import { Link } from 'react-router-dom'
import { Briefcase, ChevronRight } from 'lucide-react'

import { ListPage } from '@/components/layout/ListPage'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { AccountCard } from '@/components/os/AccountCard'
import { PersonAvatar } from '@/components/os/PeopleBits'
import { ProfileCard } from '@/components/os/ProfileParts'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { JOB_SEAT_LABEL, personName, usePersonJobs, type PersonJob } from '@/lib/os/peopleAccess'

const STATUS: Record<string, string> = { open: 'Open', draft: 'Draft', closed: 'Closed', archived: 'Closed' }

/**
 * My profile for an external user (2026-10-24): a customer who takes part as a
 * hiring manager or interviewer. Only the jobs they're on and the You card; none
 * of the People & Access information applies to them.
 */
export function ExternalProfile() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const jobs = usePersonJobs(user?.id)
  const timedOut = useLoadTimeout(jobs.isLoading, 'external-jobs')

  const me = {
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    email: user?.email ?? null,
    avatar_url: profile?.avatar_url ?? null,
  }
  const list = jobs.data ?? []
  const clients = [...new Set(list.map((j) => j.client).filter(Boolean))] as string[]
  const live = list.filter((j) => j.status === 'open' || j.status === 'draft')
  const count = (role: string) => live.filter((j) => j.role === role).length
  const hm = count('hiring_manager')
  const iv = count('interviewer')
  const seats = [
    hm > 0 && `Hiring manager on ${hm} ${hm === 1 ? 'job' : 'jobs'}`,
    iv > 0 && `Interviewer on ${iv} ${iv === 1 ? 'job' : 'jobs'}`,
  ].filter(Boolean) as string[]

  return (
    <ListPage
      title={
        <span className="inline-flex min-w-0 items-center gap-3 align-middle">
          <PersonAvatar person={me} size={48} />
          <span className="truncate">{personName(me)}</span>
        </span>
      }
      meta={
        <>
          {clients.length > 0 && <span className="truncate font-medium text-[#1F2230]">{clients.join(', ')}</span>}
          <Badge tone="neutral">External</Badge>
          {seats.length > 0 && <span className="tabular-nums">{seats.join(' · ')}</span>}
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <ProfileCard id="card-jobs" title="Your jobs" icon={Briefcase} tone="purple">
            {jobs.isError || timedOut ? (
              <LoadError what="your jobs" timedOut={timedOut && !jobs.isError} compact onRetry={() => void jobs.refetch()} />
            ) : jobs.isLoading ? (
              <div className="flex flex-col gap-1.5">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-[62px] w-full rounded-[10px]" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <AnimatedEmpty
                scene="jobs"
                size="compact"
                onceKey="external-jobs-empty"
                title="No jobs yet"
                body="When Virgilio's team adds you to a job, it shows here."
              />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {list.map((j) => (
                  <JobRow key={`${j.job_id}-${j.role}`} job={j} />
                ))}
              </ul>
            )}
          </ProfileCard>
        </div>
        <div className="min-w-0">
          <AccountCard note="Virgilio's team sees these, and candidates see your name, title and photo on interview invitations." />
        </div>
      </div>
    </ListPage>
  )
}

function JobRow({ job }: { job: PersonJob }) {
  return (
    <li>
      <Link
        to={`/jobs/${job.job_id}`}
        className="flex items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-3 font-inter transition-colors duration-hover hover:bg-[#F1F0EC]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[#1F2230]">{job.title}</span>
          <span className="block truncate text-[12px] text-[#6B7080]">
            {[job.client, STATUS[job.status] ?? job.status].filter(Boolean).join(' · ')}
          </span>
        </span>
        <Badge tone={job.role === 'hiring_manager' ? 'purple' : 'neutral'}>{JOB_SEAT_LABEL[job.role] ?? 'Interviewer'}</Badge>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#8B8F9E]" aria-hidden />
      </Link>
    </li>
  )
}
