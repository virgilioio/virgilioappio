import { useMemo } from 'react'
import { AlertTriangle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { postingReach, reachSentence } from '@/lib/postingPlaces'
import { PAY_RANGE_NOTE, needsPayNote } from '@/lib/payNote'

/**
 * Says where job boards and Google will list a post, as its locations are typed, or
 * what's missing for them to list it at all (a country). It reads the same resolver the
 * feed and the Google markup use, so the line and what goes out never disagree. The line
 * keeps its space (two lines) so the fields under it don't move. Given `showsPay`, a post
 * that reaches the US or Canada without showing pay also gets a reminder (PAY_RANGE_NOTE).
 */
export function PostingReachLine({
  location,
  additional,
  locationType,
  showsPay,
  className,
}: {
  location: string
  additional: string[]
  locationType: string | null | undefined
  /** Whether the post shows its pay range in public; leave out to skip the pay reminder. */
  showsPay?: boolean
  className?: string
}) {
  const reach = useMemo(
    () => postingReach({ location, additional, locationType }),
    [location, additional, locationType],
  )
  const sentence = useMemo(() => reachSentence(reach), [reach])
  const payNote = sentence.ok && needsPayNote(reach.countries, showsPay)
  const Icon = sentence.ok ? MapPin : AlertTriangle
  return (
    <div className={className}>
      <p
        data-posting-reach={sentence.ok ? 'ok' : 'missing'}
        aria-live="polite"
        className={cn(
          'flex items-start gap-1.5 text-[12.5px] leading-[18px] min-h-[36px]',
          sentence.ok ? 'text-text-secondary' : 'text-amber-700',
        )}
      >
        <Icon className="h-3.5 w-3.5 mt-[2px] shrink-0" aria-hidden="true" />
        <span>{sentence.text}</span>
      </p>
      {payNote && (
        <p data-posting-pay-note className="flex items-start gap-1.5 text-[12.5px] leading-[18px] text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 mt-[2px] shrink-0" aria-hidden="true" />
          <span>{PAY_RANGE_NOTE}</span>
        </p>
      )}
    </div>
  )
}
