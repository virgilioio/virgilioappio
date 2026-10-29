/**
 * First-load stand-in for the public reference pages (§6, §16): the shape of the
 * page's header and its first questions, in the same card, so the real form
 * crossfades in on top of it (`Loadable`) without moving anything.
 */
import { Skeleton } from '@/components/ui/skeleton'

export function PublicFormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-label="Loading" role="status">
      <Skeleton className="h-[14px] w-40 rounded-md" />
      <Skeleton className="mt-[10px] h-[30px] w-3/5 rounded-md" />
      <Skeleton className="mt-[12px] h-[14px] w-full rounded-md" />
      <Skeleton className="mt-[8px] h-[14px] w-4/5 rounded-md" />
      <Skeleton className="mt-[22px] h-[96px] w-full rounded-[12px]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ marginTop: 26 }}>
          <Skeleton className="h-[16px] w-1/2 rounded-md" />
          <Skeleton className="mt-[12px] h-[42px] w-full rounded-[9px]" />
        </div>
      ))}
    </div>
  )
}
