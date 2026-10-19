import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/** Initials from the name, else the email's first letter, else "?" (§10). */
function initialsOf(name: string | null | undefined, email: string | null | undefined) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length) return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
  return ((email ?? '').trim()[0] ?? '?').toUpperCase()
}

/** A teammate's round avatar in the comments: the photo fades in over same-size initials. */
export function PersonAvatar({ name, email, url, className }: { name?: string | null; email?: string | null; url?: string | null; className?: string }) {
  return (
    <Avatar aria-hidden className={cn('h-6 w-6', className)}>
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback className="bg-[#EDE4FF] font-poppins text-[9.5px] font-semibold text-virgilio-purple">{initialsOf(name, email)}</AvatarFallback>
    </Avatar>
  )
}
