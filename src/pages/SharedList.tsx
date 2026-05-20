import { useParams, Link } from 'react-router-dom'
import { useCandidateList } from '@/hooks/useCandidateLists'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Share2, Users } from 'lucide-react'
import { GioLoader } from '@/components/ui/GioLoader'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
}

export default function SharedList() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useCandidateList(id)

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <GioLoader />
      </div>
    )
  }

  if (!data?.list) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-h2 font-poppins font-semibold tracking-[-0.04em]">List not found</h1>
        <p className="text-[13px] text-muted-foreground mt-2">
          This list may have been deleted or you may not have access.
        </p>
        <Link to="/candidates" className="inline-block mt-6">
          <Button variant="secondary" size="sm" icon={ArrowLeft}>Back to candidates</Button>
        </Link>
      </div>
    )
  }

  const { list, items, reviewers, messages } = data
  const expiresLabel = list.expires_at
    ? new Date(list.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No expiry'

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link to="/candidates" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to candidates
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 mb-2">
            <Share2 className="h-3.5 w-3.5 text-virgilio-purple" />
            <span className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-virgilio-purple">
              Shared list
            </span>
            {list.share_link_active && <Badge tone="green" size="xs" dot>Active</Badge>}
          </div>
          <h1 className="text-h1 font-poppins font-semibold tracking-[-0.04em] truncate">{list.name}</h1>
          {list.description && (
            <p className="text-[13px] text-muted-foreground mt-2 max-w-2xl">{list.description}</p>
          )}
          <div className="text-[11.5px] text-muted-foreground mt-3 inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" /> {items.length} candidates</span>
            <span>·</span>
            <span>{reviewers.length} reviewers</span>
            <span>·</span>
            <span>Expires {expiresLabel}</span>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="rounded-lg border border-black/8 bg-[#FAFAF7] p-4 mb-6">
          <div className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-muted-foreground mb-2">
            Message
          </div>
          {messages.map(m => (
            <p key={m.id} className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-muted-foreground">
          Candidates
        </h2>
        <div className="rounded-lg border border-black/8 divide-y divide-black/5">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">No candidates in this list.</div>
          )}
          {items.map((it: any) => {
            const c = it.candidates
            const name = c?.candidate_name ?? 'Unknown'
            return (
              <Link
                key={it.id}
                to={`/candidates?openCandidate=${it.candidate_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF7] transition-colors"
              >
                <Avatar className="h-8 w-8">
                  {c?.photo_url && <AvatarImage src={c.photo_url} />}
                  <AvatarFallback className="text-[11px] bg-virgilio-purple/10 text-virgilio-purple">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{name}</div>
                  {(c?.current_role || c?.current_company) && (
                    <div className="text-[11.5px] text-muted-foreground truncate">
                      {[c?.current_role, c?.current_company].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="space-y-3 mt-8">
        <h2 className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-muted-foreground">
          Reviewers
        </h2>
        <div className="rounded-lg border border-black/8 divide-y divide-black/5">
          {reviewers.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">
                  {initials(r.invited_email ?? 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {r.invited_email ?? r.user_id?.slice(0, 8)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.access === 'view' ? 'View only' : r.access === 'comment' ? 'Comment' : 'Comment + score'}
                </div>
              </div>
              <Badge tone={r.status === 'active' ? 'green' : 'yellow'} size="xs">{r.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
