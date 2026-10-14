import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useTalentPoolAccess } from '@/hooks/useTalentPoolAccess'

/**
 * Pages that work on the whole talent pool (Find, Candidates, Reference
 * checks, Analytics) when someone has no TA or Sourcer seat on an open job.
 * The database already returns nothing to them; this explains why.
 */
export function TalentPoolOnly({ what, children }: { what: string; children: ReactNode }) {
  const access = useTalentPoolAccess()
  if (access !== false) return <>{children}</>
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE4FF] text-[#6F3FF5]">
        <Users className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="font-poppins text-[18px] font-semibold tracking-[-0.02em] text-[#0d0d09]">
        {what} opens with a TA or Sourcer seat
      </h1>
      <p className="mt-2 max-w-[420px] font-inter text-[13px] leading-[1.5] text-[#5A6072]">
        You see the jobs you're on. An admin adds TA and Sourcers to a job's hiring team, and that opens {what} for as long as
        the job is open.
      </p>
      <Link
        to="/jobs"
        className="gio-pressable mt-5 inline-flex h-9 items-center justify-center rounded-[10px] bg-[#0d0d09] px-4 font-poppins text-[13px] font-semibold text-[#fffcf9]"
      >
        Go to your jobs
      </Link>
    </div>
  )
}
