import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Briefcase, CircleDot, IdCard, PencilLine, Star, User, Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricStrip } from '@/components/ui/metric-strip'
import { LoadError } from '@/components/empty/LoadError'
import { JobPreview } from '@/components/previews/EntityPreview'
import { GoogleStatus } from '@/components/os/PeopleBits'
import { PersonalDetailsForm } from '@/components/os/PersonalDetailsForm'
import { LoadBar, RatingForm, WorkProfileForm } from '@/components/os/WorkProfile'
import { CopyValue, EditToggle, InfoRow, InfoRows, ProfileCard, ValueChips } from '@/components/os/ProfileParts'
import { COUNTRIES } from '@/constants/countries'
import { JOB_SEAT_LABEL, usePersonDetails, type Person, type PersonJob } from '@/lib/os/peopleAccess'
import {
  RATING_WORDS,
  segmentLabel,
  specialtyLabel,
  takesSegments,
  useRating,
  useWorkProfile,
} from '@/lib/os/workProfile'

const countryName = (code: string | null) => (code ? COUNTRIES.find((c) => c.value === code)?.label ?? code : null)

function dateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 py-1">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[18px] w-full" />
      ))}
    </div>
  )
}

/** Role: job role, ATS role, the load against capacity, segments and specialties. */
export function RoleCard({
  tenantId,
  person,
  jobRole,
  openJobs,
  jobsReady,
  editable,
}: {
  tenantId: string
  person: Person
  jobRole: string | null
  openJobs: number
  jobsReady: boolean
  editable: boolean
}) {
  const [editing, setEditing] = useState(false)
  const work = useWorkProfile(tenantId, person.user_id)
  const segments = takesSegments(jobRole) || (work.data?.segments.length ?? 0) > 0

  return (
    <ProfileCard
      title="Role"
      icon={Briefcase}
      aside={work.isSuccess && editable ? <EditToggle editing={editing} onChange={setEditing} label="role" /> : undefined}
    >
      {editing && person.user_id ? (
        <WorkProfileForm
          tenantId={tenantId}
          userId={person.user_id}
          jobRole={jobRole}
          openJobs={openJobs}
          jobsReady={jobsReady}
          editable
        />
      ) : work.isError ? (
        <LoadError what="their work profile" compact onRetry={() => void work.refetch()} />
      ) : !work.data ? (
        <RowsSkeleton rows={5} />
      ) : (
        <>
          <div className="pb-3">
            {jobsReady ? <LoadBar open={openJobs} max={work.data.max_open_jobs} /> : <Skeleton className="h-[34px] w-full" />}
          </div>
          <InfoRows>
            <InfoRow label="Job role" empty="No job role">
              {jobRole}
            </InfoRow>
            <InfoRow label="In the ATS">{person.system_role === 'admin' ? 'Admin, sees every job' : 'Member, sees the jobs they are on'}</InfoRow>
            {segments && (
              <InfoRow label="Segments" empty="None set">
                {work.data.segments.length > 0 && <ValueChips values={work.data.segments.map(segmentLabel)} />}
              </InfoRow>
            )}
            <InfoRow label="Specialties" empty="None set">
              {work.data.specialties.length > 0 && <ValueChips values={work.data.specialties.map(specialtyLabel)} />}
            </InfoRow>
            <InfoRow label="Capacity" empty="Not set">
              {work.data.max_open_jobs != null && <span className="tabular-nums">{work.data.max_open_jobs} open jobs</span>}
            </InfoRow>
          </InfoRows>
        </>
      )}
    </ProfileCard>
  )
}

/** Current work: seat counts and the open jobs, each with its seat and client. */
export function CurrentWorkCard({
  person,
  jobs,
  loading,
  error,
  onRetry,
  onSeeAll,
}: {
  person: Person
  jobs: PersonJob[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onSeeAll: () => void
}) {
  const open = jobs.filter((j) => j.status === 'open')
  const draft = jobs.filter((j) => j.status === 'draft').length
  const closed = jobs.length - open.length - draft
  return (
    <ProfileCard
      title="Current work"
      icon={Workflow}
      aside={
        jobs.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onSeeAll}>
            See all {jobs.length}
          </Button>
        ) : undefined
      }
    >
      {!person.user_id ? (
        <p className="font-inter text-[12.5px] text-[#6B7080]">No jobs until they accept their invitation.</p>
      ) : loading ? (
        <RowsSkeleton rows={4} />
      ) : error ? (
        <LoadError what="their jobs" compact onRetry={onRetry} />
      ) : jobs.length === 0 ? (
        <p className="font-inter text-[12.5px] text-[#6B7080]">
          Not on any job. {person.system_role === 'admin' ? 'Admins see every job without a seat.' : "Seat them from a job's Hiring team."}
        </p>
      ) : (
        <>
          <div className="pb-3">
            <MetricStrip
              id={`os-work-${person.member_id}`}
              items={[
                { label: 'Open', value: open.length, icon: CircleDot, tone: 'green' },
                { label: 'Draft', value: draft, icon: PencilLine, tone: 'yellow' },
                { label: 'Closed', value: closed, icon: Archive, tone: 'neutral' },
              ]}
            />
          </div>
          {open.length === 0 ? (
            <p className="font-inter text-[12.5px] text-[#6B7080]">No open jobs right now.</p>
          ) : (
            <ul className="-my-1 divide-y divide-[#F1F0EC]">
              {open.slice(0, 6).map((j) => (
                <li key={`${j.job_id}-${j.role}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <JobPreview jobId={j.job_id}>
                      <Link
                        to={`/jobs/${j.job_id}`}
                        className="block truncate font-inter text-[12.5px] font-medium text-[#1F2230] transition-colors duration-hover hover:text-[#6F3FF5]"
                      >
                        {j.title}
                      </Link>
                    </JobPreview>
                    {j.client && <p className="truncate font-inter text-[11.5px] text-[#6B7080]">{j.client}</p>}
                  </div>
                  <span className="shrink-0 font-inter text-[11.5px] text-[#6B7080]">{JOB_SEAT_LABEL[j.role] ?? j.role}</span>
                </li>
              ))}
            </ul>
          )}
          {open.length > 6 && (
            <p className="pt-2 font-inter text-[12px] tabular-nums text-[#6B7080]">and {open.length - 6} more open</p>
          )}
        </>
      )}
    </ProfileCard>
  )
}

/** Personal: what only admins and the person see. Reads first; Edit opens the autosaving form. */
export function PersonalCard({ tenantId, person, isSelf }: { tenantId: string; person: Person; isSelf: boolean }) {
  const [editing, setEditing] = useState(false)
  const details = usePersonDetails(tenantId, person.user_id)
  const first = (person.first_name || person.email || 'They').split(/[ @]/)[0]
  const d = details.data

  return (
    <ProfileCard
      title="Personal"
      icon={User}
      aside={person.user_id && details.isSuccess ? <EditToggle editing={editing} onChange={setEditing} label="personal details" /> : undefined}
    >
      {!person.user_id ? (
        <p className="font-inter text-[12.5px] text-[#6B7080]">They can be added once they accept their invitation.</p>
      ) : editing ? (
        <PersonalDetailsForm tenantId={tenantId} userId={person.user_id} self={isSelf} />
      ) : details.isError ? (
        <LoadError what="their personal details" compact onRetry={() => void details.refetch()} />
      ) : details.isLoading ? (
        <RowsSkeleton rows={4} />
      ) : (
        <InfoRows>
          <InfoRow label="Personal email">{d?.personal_email && <CopyValue value={d.personal_email} label="personal email" />}</InfoRow>
          <InfoRow label="Personal phone">{d?.personal_phone && <CopyValue value={d.personal_phone} label="personal phone" />}</InfoRow>
          <InfoRow label="Lives in">{[d?.city, d?.region, countryName(d?.country_code ?? null)].filter(Boolean).join(', ')}</InfoRow>
        </InfoRows>
      )}
      <p className="pt-3 font-inter text-[11.5px] text-[#6B7080]">
        Only People &amp; Access admins and {isSelf ? 'you' : first} see these
        {isSelf ? '.' : `. ${first} can also update them in Settings › Profile.`}
      </p>
    </ProfileCard>
  )
}

/** General: work identity and sign-in. */
export function GeneralCard({ person }: { person: Person }) {
  return (
    <ProfileCard title="General" icon={IdCard}>
      <InfoRows>
        <InfoRow label="Work email">{person.email && <CopyValue value={person.email} label="work email" />}</InfoRow>
        <InfoRow label="Google">
          <span className="inline-flex flex-col items-end">
            <GoogleStatus person={person} />
            {person.google_email && person.google_email !== person.email && (
              <span className="max-w-full truncate text-[11.5px] text-[#6B7080]">{person.google_email}</span>
            )}
          </span>
        </InfoRow>
        <InfoRow label="Last signed in" empty="Never">
          {person.last_sign_in_at && dateOnly(person.last_sign_in_at)}
        </InfoRow>
      </InfoRows>
    </ProfileCard>
  )
}

/** Rating: a manager's 1-5 with the note behind it (admins only, never your own). */
export function RatingCard({
  tenantId,
  person,
  isSelf,
  nameOf,
}: {
  tenantId: string
  person: Person
  isSelf: boolean
  nameOf: (userId: string | null) => string
}) {
  const [editing, setEditing] = useState(false)
  const rating = useRating(tenantId, person.user_id, !isSelf)
  const first = (person.first_name || 'They').split(' ')[0]
  const r = rating.data

  return (
    <ProfileCard
      title="Rating"
      icon={Star}
      aside={!isSelf && rating.isSuccess ? <EditToggle editing={editing} onChange={setEditing} label="rating" /> : undefined}
    >
      {isSelf ? (
        <p className="font-inter text-[12.5px] text-[#6B7080]">You can't rate yourself. Another admin can.</p>
      ) : editing && person.user_id ? (
        <RatingForm tenantId={tenantId} userId={person.user_id} firstName={first} isSelf={false} nameOf={nameOf} />
      ) : rating.isError ? (
        <LoadError what="the rating" compact onRetry={() => void rating.refetch()} />
      ) : rating.isLoading ? (
        <RowsSkeleton rows={2} />
      ) : !r?.rating ? (
        <p className="font-inter text-[12.5px] text-[#6B7080]">Not rated yet. Only People &amp; Access admins see ratings.</p>
      ) : (
        <div className="font-inter">
          <div className="flex items-baseline gap-2">
            <span className="font-poppins text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-[#1F2230]">{r.rating}</span>
            <span className="text-[12.5px] text-[#6B7080]">of 5</span>
            <span className="ml-1 text-[12.5px] font-medium text-[#1F2230]">{RATING_WORDS[r.rating]}</span>
          </div>
          {r.note && <p className="mt-2 whitespace-pre-line text-[12.5px] leading-[1.5] text-[#1F2230]">{r.note}</p>}
          {r.rated_at && (
            <p className="mt-2 text-[11.5px] text-[#6B7080]">
              {nameOf(r.rated_by)} · {dateOnly(r.rated_at)}
            </p>
          )}
        </div>
      )}
    </ProfileCard>
  )
}
