import { useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ProfileSidebar, SidebarBlock } from '@/components/candidates/profile/primitives/ProfileSidebar'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCandidateComments, useCommentPeople, type CandidateComment } from '@/hooks/useCandidateComments'
import { draftHasTag, encodeMentions, parseComment, type MentionPerson } from '@/lib/mentions'
import { collapseRows, rowsById } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { MentionComposer, type MentionComposerHandle } from './MentionComposer'
import { CommentReminders } from './CommentReminders'
import { PersonAvatar } from './PersonAvatar'

/**
 * The Comments card (2026-10-19), above Details on both candidate profiles,
 * replacing the Comments tab. Comments are shared with everyone who can see
 * the candidate, or private to the author; tagging someone ("@") shares it,
 * so Private turns itself off while the box holds a tag (the database
 * refuses a private comment with a tag too). Reminders sit in a row under the
 * box. Newest first; the three latest show, the rest open in place.
 */

const SHOWN = 3

interface Props {
  candidateId: string
  /** The job this profile is in; null on the standalone profile. */
  jobId: string | null
  organizationId?: string | null
  className?: string
}

export function CommentsCard({ candidateId, jobId, organizationId, className }: Props) {
  const { user } = useAuth()
  const permissions = usePermissions()
  const { profile } = useUserProfile()
  const myName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null
  const { comments, isLoading, isError, refetch, addComment, isAdding, deleteComment } = useCandidateComments(candidateId)
  const { data: people = [] } = useCommentPeople(candidateId)
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<MentionPerson[]>([])
  const [wantsPrivate, setWantsPrivate] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const composer = useRef<MentionComposerHandle>(null)

  const tagged = draftHasTag(draft, picked)
  const isPrivate = wantsPrivate && !tagged
  const canPost = !!draft.trim() && !isAdding

  const names = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of people) m.set(p.user_id, p.name)
    return m
  }, [people])
  const authorName = (c: CandidateComment) =>
    c.author_id === user?.id ? 'You' : names.get(c.author_id) || c.author_email || 'Someone'

  const submit = async () => {
    if (!canPost) return
    try {
      await addComment({
        candidate_id: candidateId,
        job_id: jobId,
        organization_id: organizationId ?? null,
        content: encodeMentions(draft.trim(), picked),
        is_private: isPrivate,
      })
      setDraft('')
      setPicked([])
      setWantsPrivate(false)
    } catch {
      composer.current?.focus() // the hook says it couldn't post; the text stays
    }
  }

  // §18 Pattern 1: quote the comment so it's clear which one goes.
  const remove = async (c: CandidateComment) => {
    const mine = c.author_id === user?.id
    const text = parseComment(c.content)
      .map((p) => (p.kind === 'mention' ? `@${p.name}` : p.text))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    const quote = text.length > 90 ? `${text.slice(0, 90).trimEnd()}…` : text
    const ok = await confirmDestructive({
      title: mine ? 'Delete your comment?' : `Delete ${authorName(c)}’s comment?`,
      description: `${quote ? `“${quote}” ` : 'It '}is deleted for everyone who can see it. Other comments stay. This can’t be undone.`,
      confirmLabel: 'Delete comment',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([c.id]))
    await exit.done
    try {
      await deleteComment(c.id)
    } catch {
      exit.revert()
    }
  }

  const note = tagged
    ? 'Tagged comments can\u2019t be private.'
    : isPrivate
      ? 'Only you will see this comment.'
      : 'Everyone who can see this candidate will see it.'

  const latest = comments.slice(0, SHOWN)
  const older = comments.slice(SHOWN)

  return (
    <ProfileSidebar className={className}>
      <SidebarBlock label={isLoading ? 'Comments' : `Comments${comments.length ? ` (${comments.length})` : ''}`}>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <MentionComposer
            ref={composer}
            id={`comment-${candidateId}`}
            value={draft}
            onChange={setDraft}
            people={people}
            picked={picked}
            onPick={(p) => setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]))}
            onSubmit={() => void submit()}
            disabled={isAdding}
            placeholder="Add a comment. Type @ to tag a teammate."
            aria-describedby={`comment-note-${candidateId}`}
          />
          <div className="flex items-center gap-2">
            <label
              className={cn('inline-flex items-center gap-1.5 font-inter text-[12px] text-[#5A6072]', tagged ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
            >
              <Switch
                checked={isPrivate}
                disabled={tagged || isAdding}
                onCheckedChange={setWantsPrivate}
                aria-describedby={`comment-note-${candidateId}`}
                className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
              />
              <Lock className="h-3 w-3" aria-hidden />
              Private
            </label>
            <Button type="submit" variant="primary" size="sm" className="ml-auto" disabled={!draft.trim()} loading={isAdding}>
              Comment
            </Button>
          </div>
          <p id={`comment-note-${candidateId}`} className="min-h-[18px] font-inter text-[11px] leading-[1.4] text-[#8B8F9E]">
            {note}
          </p>
        </form>

        <CommentReminders candidateId={candidateId} jobId={jobId} />

        <div className="mt-3">
          {isLoading ? (
            <div className="space-y-3" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="font-inter text-[12px] text-[#5A6072]">
              Couldn’t load the comments.{' '}
              <button type="button" className="font-medium text-virgilio-purple hover:underline" onClick={() => void refetch()}>
                Retry
              </button>
            </p>
          ) : comments.length === 0 ? (
            <p className="font-inter text-[12px] text-[#8B8F9E]">No comments on this candidate yet.</p>
          ) : (
            <>
              <ul>
                {latest.map((c) => (
                  <CommentRow key={c.id} c={c} me={user?.id} jobId={jobId} author={authorName(c)} canDelete={c.author_id === user?.id || permissions.isPlatformAdmin} onDelete={remove} people={people} myName={myName} />
                ))}
              </ul>
              {older.length > 0 && (
                <Collapsible open={showAll} onOpenChange={setShowAll}>
                  <CollapsibleContent>
                    <ul>
                      {older.map((c) => (
                        <CommentRow key={c.id} c={c} me={user?.id} jobId={jobId} author={authorName(c)} canDelete={c.author_id === user?.id || permissions.isPlatformAdmin} onDelete={remove} people={people} myName={myName} />
                      ))}
                    </ul>
                  </CollapsibleContent>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="xs" className="mt-1 -ml-2 text-[#5A6072]">
                      {showAll ? 'Show fewer' : `Show ${older.length} older comment${older.length === 1 ? '' : 's'}`}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              )}
            </>
          )}
        </div>
      </SidebarBlock>
    </ProfileSidebar>
  )
}

function CommentRow({
  c,
  me,
  jobId,
  author,
  canDelete,
  onDelete,
  people,
  myName,
}: {
  c: CandidateComment
  me?: string
  jobId: string | null
  author: string
  canDelete: boolean
  onDelete: (c: CandidateComment) => void
  people: { user_id: string; name: string; email: string; avatar_url: string | null }[]
  myName: string | null
}) {
  const person = people.find((p) => p.user_id === c.author_id)
  const at = new Date(c.created_at)
  // Comments from another job (or any job, on the standalone profile) say where they were left.
  const where = c.job_id && c.job_id !== jobId ? c.job?.title : null
  return (
    <li data-row-id={c.id} className="border-t border-[#F6F5F1] py-2.5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2">
        <PersonAvatar name={c.author_id === me ? myName : person?.name ?? null} email={c.author_email} url={person?.avatar_url} className="mt-px" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 font-inter text-[11.5px] text-[#8B8F9E]">
            <span className="truncate font-medium text-[#1F2230]">{author}</span>
            <time dateTime={c.created_at} title={format(at, 'MMM d, yyyy, h:mm a')} className="shrink-0 tabular-nums">
              {formatDistanceToNowStrict(at, { addSuffix: true })}
            </time>
            {c.is_private && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[#5A6072]">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                Private
              </span>
            )}
            {canDelete && (
              <IconTip label="Delete comment">
                <button
                  type="button"
                  aria-label="Delete comment"
                  onClick={() => onDelete(c)}
                  className="gio-pressable ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#B5B9C4] transition-colors duration-hover hover:bg-[#FEF2F2] hover:text-[#C2372B]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </IconTip>
            )}
          </div>
          {where && <div className="truncate font-inter text-[11px] text-[#8B8F9E]">on {where}</div>}
          <p className="mt-0.5 whitespace-pre-wrap break-words font-inter text-[13px] leading-[1.5] text-[#1F2230]">
            {parseComment(c.content).map((p, i) =>
              p.kind === 'mention' ? (
                <span key={i} className="gio-mention" data-me={p.id === me || undefined}>
                  @{p.name}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
        </div>
      </div>
    </li>
  )
}
