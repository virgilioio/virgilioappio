import { useMemo } from 'react'
import { AlertTriangle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { postingReach, reachSentence } from '@/lib/postingPlaces'

/**
 * Says where job boards and Google will list a post, as its locations are typed, or
 * what's missing for them to list it at all (a country). It reads the same resolver the
 * feed and the Google markup use, so the line and what goes out never disagree. The line
 * keeps its space (two lines) so the fields under it don't move.
 */
export function PostingReachLine({
  location,
  additional,
  locationType,
  className,
}: {
  location: string
  additional: string[]
  locationType: string | null | undefined
  className?: string
}) {
  const sentence = useMemo(
    () => reachSentence(postingReach({ location, additional, locationType })),
    [location, additional, locationType],
  )
  const Icon = sentence.ok ? MapPin : AlertTriangle
  return (
    <p
      data-posting-reach={sentence.ok ? 'ok' : 'missing'}
      aria-live="polite"
      className={cn(
        'flex items-start gap-1.5 text-[12.5px] leading-[18px] min-h-[36px]',
        sentence.ok ? 'text-text-secondary' : 'text-amber-700',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 mt-[2px] shrink-0" aria-hidden="true" />
      <span>{sentence.text}</span>
    </p>
  )
}
