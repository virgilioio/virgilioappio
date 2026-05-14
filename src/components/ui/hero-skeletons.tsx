import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Hero card + stages bar skeletons.
 *
 * Mirrors the live chrome of `JobHero` / `ProfileHeroCard` and
 * `PipelineSectionTabs` / `ProfileStageStrip` so the page never reflows
 * between loading and ready states.
 */

interface HeroCardSkeletonProps {
  variant?: 'job' | 'candidate'
  className?: string
}

export function HeroCardSkeleton({ variant = 'job', className }: HeroCardSkeletonProps) {
  return (
    <section
      className={cn(
        'bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5 animate-in fade-in duration-300',
        className,
      )}
      aria-hidden
    >
      {/* Top strip */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {variant === 'candidate' && <Skeleton className="h-4 w-24 rounded-md" />}
          <Skeleton className="h-3.5 w-16 rounded-md" />
          {variant === 'candidate' && (
            <>
              <Skeleton className="h-3.5 w-28 rounded-md hidden md:block" />
              <Skeleton className="h-3.5 w-20 rounded-md hidden md:block" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {variant === 'candidate' ? (
            <>
              <Skeleton className="h-[34px] w-20 rounded-lg hidden sm:block" />
              <Skeleton className="h-9 w-40 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg hidden sm:block" />
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </>
          ) : (
            <>
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </>
          )}
        </div>
      </div>

      {/* Title row */}
      <div className="flex items-end gap-2">
        <Skeleton className="h-8 w-[280px] sm:w-[340px] rounded-md" />
        <span className="h-2 w-2 rounded-full bg-virgilio-purple/30 mb-1.5" />
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3.5 w-20 rounded-md" />
        <Skeleton className="h-3.5 w-24 rounded-md" />
        <Skeleton className="h-3.5 w-28 rounded-md" />
        {variant === 'job' && (
          <div className="flex items-center gap-2 ml-1">
            <Skeleton className="h-3.5 w-16 rounded-md" />
            <div className="flex -space-x-2">
              <Skeleton className="h-6 w-6 rounded-full ring-2 ring-background" />
              <Skeleton className="h-6 w-6 rounded-full ring-2 ring-background" />
              <Skeleton className="h-6 w-6 rounded-full ring-2 ring-background" />
            </div>
          </div>
        )}
      </div>

      {/* Tabs row, flush with card bottom */}
      <div className="mt-4 flex items-center gap-6 border-b-0 pb-3">
        {Array.from({ length: variant === 'candidate' ? 6 : 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20 rounded-md" />
        ))}
      </div>
    </section>
  )
}

/**
 * Skeleton for `<PipelineSectionTabs>` (Job page) — 6 colored section cells.
 */
export function PipelineSectionTabsSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6 animate-in fade-in duration-300',
        className,
      )}
      aria-hidden
    >
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 min-w-[140px] rounded-xl border border-dashed border-virgilio-border px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-3.5 w-20 rounded-md" />
            </div>
            <Skeleton className="mt-1.5 h-3 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Skeleton for `<ProfileStageStrip>` (Candidate profile) — horizontal stage chips.
 */
export function StageStripSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6 animate-in fade-in duration-300',
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-9 rounded-full shrink-0', i === 0 ? 'w-28' : 'w-24')}
          />
        ))}
      </div>
    </section>
  )
}
