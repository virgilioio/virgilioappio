import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ArrowLeft, Check, Copy, Lock, Share2, Sparkles, Users, X, Send, Eye, MessageSquare, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCreateCandidateList, useTenantMembersForShare, type ListAccess, type ReviewerDraft } from '@/hooks/useCandidateLists'

interface ShareListModalProps {
  candidateIds: string[]
  candidateNames: string[]
  trigger: ReactNode
}

type Step = 1 | 2 | 3 | 4

type Expiry = '7' | '14' | '30' | 'never'

interface ReviewerRow {
  key: string
  user_id?: string
  email?: string
  name: string
  avatar_url?: string | null
  access: ListAccess
  notify: boolean
}

const ACCESS_LABEL: Record<ListAccess, string> = {
  view: 'View only',
  comment: 'Comment',
  comment_score: 'Comment + score',
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ShareListModal({ candidateIds, candidateNames, trigger }: ShareListModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const finalIds = useMemo(() => candidateIds.filter(id => !removedIds.has(id)), [candidateIds, removedIds])

  const [reviewers, setReviewers] = useState<ReviewerRow[]>([])
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)

  const [expiry, setExpiry] = useState<Expiry>('14')
  const [blockScreenshots, setBlockScreenshots] = useState(false)
  const [notifyOnActivity, setNotifyOnActivity] = useState(true)
  const [message, setMessage] = useState('')
  const [rewriting, setRewriting] = useState(false)

  const [createdListId, setCreatedListId] = useState<string | null>(null)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)

  const { user } = useAuth()
  const { profile } = useUserProfile()
  const { data: members = [] } = useTenantMembersForShare()
  const createList = useCreateCandidateList()
  const navigate = useNavigate()

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1)
      setName('')
      setDescription('')
      setRemovedIds(new Set())
      setReviewers([])
      setExpiry('14')
      setBlockScreenshots(false)
      setNotifyOnActivity(true)
      setMessage('')
      setCreatedListId(null)
      setCreatedSlug(null)
    }
  }, [open])

  // Default name suggestion on first open of step 1
  useEffect(() => {
    if (open && !name) {
      setName(`Shortlist · ${todayLabel()}`)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const ownerName = useMemo(() => {
    const f = profile?.first_name ?? ''
    const l = profile?.last_name ?? ''
    const full = `${f} ${l}`.trim()
    return full || profile?.email || 'You'
  }, [profile])

  const availableMembers = useMemo(
    () => members.filter(m => !reviewers.some(r => r.user_id === m.user_id)),
    [members, reviewers]
  )

  const expiryToISO = (e: Expiry): string | null => {
    if (e === 'never') return null
    const d = new Date()
    d.setDate(d.getDate() + parseInt(e, 10))
    return d.toISOString()
  }

  const expiryDateLabel = (e: Expiry): string => {
    if (e === 'never') return 'No expiry'
    const d = new Date()
    d.setDate(d.getDate() + parseInt(e, 10))
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const slugPreview = useMemo(() => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'list'
    return `${base}-xxxxxx`
  }, [name])

  const shareUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/lists/${createdSlug ?? slugPreview}`
  }, [createdSlug, slugPreview])

  const addReviewer = (m: typeof members[number]) => {
    setReviewers(r => [
      ...r,
      {
        key: m.user_id,
        user_id: m.user_id,
        name: m.name,
        avatar_url: m.avatar_url,
        access: 'comment_score',
        notify: true,
      },
    ])
    setMemberPickerOpen(false)
  }

  const addEmailReviewer = (email: string) => {
    const clean = email.trim().toLowerCase()
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      toast({ title: 'Enter a valid email', variant: 'destructive' })
      return
    }
    if (reviewers.some(r => r.email === clean)) return
    setReviewers(r => [...r, { key: `email:${clean}`, email: clean, name: clean, access: 'comment_score', notify: true }])
  }

  const removeReviewer = (key: string) => setReviewers(r => r.filter(x => x.key !== key))
  const updateReviewer = (key: string, patch: Partial<ReviewerRow>) =>
    setReviewers(r => r.map(x => (x.key === key ? { ...x, ...patch } : x)))

  const invited = reviewers.filter(r => r.user_id).length
  const pending = reviewers.filter(r => r.email && !r.user_id).length

  const handleShare = async () => {
    if (reviewers.length === 0) {
      toast({ title: 'Add at least one reviewer', variant: 'destructive' })
      return
    }
    try {
      const payload: ReviewerDraft[] = reviewers.map(r => ({
        user_id: r.user_id ?? null,
        invited_email: r.email ?? null,
        access: r.access,
        notify_enabled: r.notify,
      }))
      const id = await createList.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        expires_at: expiryToISO(expiry),
        block_screenshots: blockScreenshots,
        notify_on_activity: notifyOnActivity,
        candidate_ids: finalIds,
        reviewers: payload,
        message: message.trim() || undefined,
      })
      setCreatedListId(id)
      // Fetch the actual slug to show real URL
      try {
        const { supabase } = await import('@/lib/supabaseClient')
        const { data } = await supabase.from('candidate_lists').select('slug').eq('id', id).maybeSingle()
        if (data?.slug) setCreatedSlug(data.slug)
      } catch {/* ignore */}
      setStep(4)
    } catch (e: any) {
      toast({ title: 'Failed to share list', description: e?.message ?? 'Try again', variant: 'destructive' })
    }
  }

  const handleRewrite = async () => {
    setRewriting(true)
    // Lightweight local rewrite: tighten tone + add list context. (Gio AI rewrite endpoint can be wired later.)
    await new Promise(r => setTimeout(r, 400))
    const reviewerFirst = reviewers[0]?.name?.split(' ')[0] ?? 'team'
    const base = message.trim() || `Sharing ${finalIds.length} candidates for your review.`
    setMessage(`Hi ${reviewerFirst} — ${base} Quick read this week if you can. Reply here with thoughts or scores.`)
    setRewriting(false)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({ title: 'Link copied' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const reset = () => {
    setStep(1)
    setReviewers([])
    setMessage('')
    setCreatedListId(null)
    setCreatedSlug(null)
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[640px] p-0 gap-0 overflow-hidden bg-background">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-black/5">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-virgilio-purple/10 text-virgilio-purple">
                  <Share2 className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-virgilio-purple">
                  New share list
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-muted-foreground tabular-nums">{step}/4</span>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <h2 className="text-h3 font-poppins font-semibold tracking-[-0.04em] text-foreground">
              {step === 1 && 'Bundle these candidates.'}
              {step === 2 && "Who's reviewing?"}
              {step === 3 && 'Compose the share.'}
              {step === 4 && `Shared with ${reviewers.length} ${reviewers.length === 1 ? 'teammate' : 'teammates'}`}
            </h2>
            {step !== 4 && (
              <p className="text-[13px] text-muted-foreground mt-1">
                {step === 1 && 'Give the list a clear, scannable name. You can change everything later.'}
                {step === 2 && 'Add anyone in the workspace. Permissions are per-person and changeable any time.'}
                {step === 3 && 'They get a notification + email. Link works in-app only — login required.'}
              </p>
            )}
            {/* Progress bar */}
            <div className="mt-4 flex gap-1.5">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={cn(
                    'h-[3px] flex-1 rounded-full transition-colors',
                    i <= step ? 'bg-foreground' : 'bg-black/8'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-form-label">List name</label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 80))}
                    autoFocus
                    placeholder="e.g. Designers for Maya · final round shortlist"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-form-label">
                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value.slice(0, 280))}
                    rows={3}
                    placeholder="Top 3 finalists for Sr. Product Designer. Maya, weigh in on whoever you'd onsite — final loop is locked for next Tuesday."
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-form-label">Candidates in this list</label>
                  </div>
                  <div className="rounded-lg border border-black/8 divide-y divide-black/5 max-h-[200px] overflow-y-auto">
                    {finalIds.length === 0 && (
                      <div className="px-3 py-4 text-[13px] text-muted-foreground text-center">No candidates left.</div>
                    )}
                    {finalIds.map(id => {
                      const idx = candidateIds.indexOf(id)
                      const cName = candidateNames[idx] ?? 'Unknown'
                      return (
                        <div key={id} className="px-3 py-2 flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] bg-virgilio-purple/10 text-virgilio-purple">
                              {initials(cName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{cName}</div>
                          </div>
                          <button
                            onClick={() => setRemovedIds(s => new Set(s).add(id))}
                            className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5"
                            aria-label="Remove from list"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-form-label">Add by name or email</label>
                  <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="w-full min-h-[44px] px-3 py-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background text-left hover:border-virgilio-purple/40 focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30"
                      >
                        {reviewers.map(r => (
                          <span
                            key={r.key}
                            className="inline-flex items-center gap-1.5 h-6 pl-1 pr-1.5 rounded-md bg-virgilio-purple/10 text-virgilio-purple text-[12px]"
                          >
                            <Avatar className="h-4 w-4">
                              {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                              <AvatarFallback className="text-[8px] bg-virgilio-purple/20 text-virgilio-purple">
                                {initials(r.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{r.name.split(' ')[0]}</span>
                            <button
                              onClick={e => { e.stopPropagation(); removeReviewer(r.key) }}
                              className="h-3.5 w-3.5 inline-flex items-center justify-center text-virgilio-purple/70 hover:text-virgilio-purple"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <span className="text-[13px] text-muted-foreground">
                          {reviewers.length === 0 ? 'Type a name or email…' : 'Add another…'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[540px] p-0">
                      <Command>
                        <CommandInput placeholder="Search teammates or type an email…" />
                        <CommandList>
                          <CommandEmpty>
                            <div className="px-3 py-2 text-[12.5px] text-muted-foreground">
                              No teammate found. Press Enter on an email to invite.
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {availableMembers.map(m => (
                              <CommandItem
                                key={m.user_id}
                                value={`${m.name} ${m.email}`}
                                onSelect={() => addReviewer(m)}
                              >
                                <Avatar className="h-5 w-5">
                                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                  <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12.5px] font-medium truncate">{m.name}</div>
                                  <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Reviewer table */}
                <div className="rounded-lg border border-black/8 overflow-hidden">
                  <div className="grid grid-cols-[1fr_180px_60px] px-3 py-2 bg-[#FAFAF7] text-table-header">
                    <span>Reviewer</span>
                    <span>Access</span>
                    <span className="text-right">Notify</span>
                  </div>
                  {/* Owner row */}
                  <div className="grid grid-cols-[1fr_180px_60px] items-center px-3 py-2.5 border-t border-black/5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                        <AvatarFallback className="text-[10px] bg-foreground/10">{initials(ownerName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{ownerName}</div>
                        <div className="text-[11px] text-muted-foreground">You're inviting</div>
                      </div>
                    </div>
                    <div className="text-[12px] text-muted-foreground">Owner</div>
                    <div className="text-right text-[12px] text-muted-foreground">—</div>
                  </div>
                  {reviewers.map(r => (
                    <div
                      key={r.key}
                      className="grid grid-cols-[1fr_180px_60px] items-center px-3 py-2.5 border-t border-black/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                          <AvatarFallback className="text-[10px] bg-virgilio-purple/10 text-virgilio-purple">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{r.name}</div>
                          {r.email && !r.user_id && (
                            <Badge tone="yellow" size="xs" className="mt-0.5">Pending invite</Badge>
                          )}
                        </div>
                      </div>
                      <Select value={r.access} onValueChange={(v: ListAccess) => updateReviewer(r.key, { access: v })}>
                        <SelectTrigger className="h-8 text-[12.5px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">
                            <span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> View only</span>
                          </SelectItem>
                          <SelectItem value="comment">
                            <span className="inline-flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Comment</span>
                          </SelectItem>
                          <SelectItem value="comment_score">
                            <span className="inline-flex items-center gap-2"><Star className="h-3.5 w-3.5" /> Comment + score</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex justify-end">
                        <Switch checked={r.notify} onCheckedChange={v => updateReviewer(r.key, { notify: v })} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Internal-only banner */}
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-[#FAFAF7] border border-black/5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    <span className="font-medium text-foreground">Internal only.</span>{' '}
                    External hiring managers? Use external share instead — different permission model.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {/* Share link card */}
                <div className="rounded-lg border border-black/8 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-[12px] font-medium">
                      <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Share link
                      <Badge tone="green" size="xs" dot>Active</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 text-[12px] font-mono bg-[#FAFAF7] rounded-md truncate">
                      {shareUrl}
                    </code>
                    <Button size="sm" variant="secondary" icon={Copy} onClick={copyLink}>Copy</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium">Access</div>
                      <div className="text-[12.5px] mt-0.5">Invited only</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium">Expires</div>
                      <Select value={expiry} onValueChange={(v: Expiry) => setExpiry(v)}>
                        <SelectTrigger className="h-7 text-[12.5px] mt-0.5 px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">In 7 days</SelectItem>
                          <SelectItem value="14">In 14 days</SelectItem>
                          <SelectItem value="30">In 30 days</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium">Block screenshots</div>
                      <div className="mt-1">
                        <Switch checked={blockScreenshots} onCheckedChange={setBlockScreenshots} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-form-label">Message to reviewers</label>
                    <Button
                      size="xs"
                      variant="purple"
                      icon={Sparkles}
                      loading={rewriting}
                      onClick={handleRewrite}
                    >
                      Rewrite with Gio
                    </Button>
                  </div>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 600))}
                    rows={4}
                    placeholder="Hi team — here are the candidates I'd push to onsite. Quick read this week if you can."
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={notifyOnActivity}
                    onCheckedChange={v => setNotifyOnActivity(!!v)}
                  />
                  <span className="text-[13px]">Notify me when reviewers comment or score</span>
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center pt-2">
                  <div className="h-12 w-12 rounded-full border border-black/8 inline-flex items-center justify-center mb-3">
                    <Check className="h-5 w-5 text-foreground" />
                  </div>
                  <p className="text-[13px] text-muted-foreground max-w-[420px]">
                    {reviewers.map(r => r.name.split(' ')[0]).join(', ')} will get a notification in-app and an email with your message.
                  </p>
                </div>
                <div className="rounded-lg border border-black/8 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {finalIds.length} candidates · {reviewers.length} reviewers · expires {expiryDateLabel(expiry)}
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {reviewers.slice(0, 4).map(r => (
                        <Avatar key={r.key} className="h-6 w-6 border-2 border-background">
                          {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                          <AvatarFallback className="text-[9px] bg-virgilio-purple/10 text-virgilio-purple">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-1.5 text-[11.5px] font-mono bg-[#FAFAF7] rounded-md truncate">
                      {shareUrl}
                    </code>
                    <Button size="xs" variant="secondary" icon={Copy} onClick={copyLink}>Copy</Button>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground text-center">
                  Find it later under <span className="font-medium text-foreground">Lists → Shared by me</span> in the left rail.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-black/5 flex items-center justify-between bg-[#FAFAF7]">
            <div className="text-[11.5px] text-muted-foreground">
              {step === 1 && `${finalIds.length} ${finalIds.length === 1 ? 'candidate' : 'candidates'} · auto-saved as draft`}
              {step === 2 && `${invited} invited · ${pending} pending`}
              {step === 3 && `Link · ${expiry === 'never' ? 'no expiry' : `${expiry}-day expiry`} · in-app only`}
              {step === 4 && 'Lives in Lists sidebar from now on.'}
            </div>
            <div className="flex items-center gap-2">
              {step === 1 && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => setStep(2)} disabled={!name.trim() || finalIds.length === 0}>
                    Next: who can see it
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setStep(1)}>Back</Button>
                  <Button size="sm" onClick={() => setStep(3)} disabled={reviewers.length === 0}>
                    Next: link & message
                  </Button>
                </>
              )}
              {step === 3 && (
                <>
                  <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setStep(2)}>Back</Button>
                  <Button size="sm" iconRight={Send} onClick={handleShare} loading={createList.isPending}>
                    Send &amp; share
                  </Button>
                </>
              )}
              {step === 4 && (
                <>
                  <Button variant="ghost" size="sm" onClick={reset}>Share another</Button>
                  <Button size="sm" onClick={() => { if (createdListId) navigate(`/lists/${createdListId}`); setOpen(false) }}>
                    Open list
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
