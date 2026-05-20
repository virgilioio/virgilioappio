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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  ArrowLeft, Check, Clock, Copy, EyeOff, Info, Link2, Lock, MoreHorizontal, Plus,
  Send, Share2, Sparkles, UserPlus, Users, X, Eye, MessageSquare, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCreateCandidateList, useTenantMembersForShare, type ListAccess, type ReviewerDraft } from '@/hooks/useCandidateLists'

export interface ShareCandidateInfo {
  id: string
  name: string
  company?: string | null
  stage?: string | null
  score?: number | null
}

interface ShareListModalProps {
  candidateIds: string[]
  /** Legacy fallback. Prefer `candidates` for richer rows. */
  candidateNames?: string[]
  candidates?: ShareCandidateInfo[]
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
  role?: string | null
  access: ListAccess
  notify: boolean
  justAdded?: boolean
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Reviewer',
  member: 'Member',
  sales: 'Sales',
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ShareListModal({ candidateIds, candidateNames, candidates: candidateInfos, trigger }: ShareListModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const finalIds = useMemo(() => candidateIds.filter(id => !removedIds.has(id)), [candidateIds, removedIds])

  const [reviewers, setReviewers] = useState<ReviewerRow[]>([])
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')

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

  useEffect(() => {
    if (!open) {
      setStep(1); setName(''); setDescription(''); setRemovedIds(new Set())
      setReviewers([]); setEmailDraft('')
      setExpiry('14'); setBlockScreenshots(false); setNotifyOnActivity(true)
      setMessage(''); setCreatedListId(null); setCreatedSlug(null)
    }
  }, [open])

  useEffect(() => {
    if (open && !name) setName(`Shortlist · ${todayLabel()}`)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const candidateMap = useMemo(() => {
    const m = new Map<string, ShareCandidateInfo>()
    if (candidateInfos) candidateInfos.forEach(c => m.set(c.id, c))
    else candidateIds.forEach((id, i) => m.set(id, { id, name: candidateNames?.[i] ?? 'Unknown' }))
    return m
  }, [candidateInfos, candidateIds, candidateNames])

  const ownerName = useMemo(() => {
    const f = profile?.first_name ?? ''
    const l = profile?.last_name ?? ''
    return `${f} ${l}`.trim() || profile?.email || 'You'
  }, [profile])

  const availableMembers = useMemo(
    () => members.filter(m => !reviewers.some(r => r.user_id === m.user_id)),
    [members, reviewers]
  )

  const expiryToISO = (e: Expiry): string | null => {
    if (e === 'never') return null
    const d = new Date(); d.setDate(d.getDate() + parseInt(e, 10))
    return d.toISOString()
  }

  const expiryDateLabel = (e: Expiry): string => {
    if (e === 'never') return 'No expiry'
    const d = new Date(); d.setDate(d.getDate() + parseInt(e, 10))
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
    setReviewers(r => [...r, {
      key: m.user_id, user_id: m.user_id, name: m.name, avatar_url: m.avatar_url,
      role: m.role, access: 'comment_score', notify: true, justAdded: true,
    }])
    setMemberPickerOpen(false)
  }

  const addEmailReviewer = (email: string) => {
    const clean = email.trim().toLowerCase()
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      toast({ title: 'Enter a valid email', variant: 'destructive' }); return
    }
    if (reviewers.some(r => r.email === clean)) return
    setReviewers(r => [...r, {
      key: `email:${clean}`, email: clean, name: clean,
      access: 'comment_score', notify: true, justAdded: true,
    }])
    setEmailDraft('')
  }

  const removeReviewer = (key: string) => setReviewers(r => r.filter(x => x.key !== key))
  const updateReviewer = (key: string, patch: Partial<ReviewerRow>) =>
    setReviewers(r => r.map(x => (x.key === key ? { ...x, ...patch } : x)))

  const invited = reviewers.filter(r => r.user_id).length
  const pending = reviewers.filter(r => r.email && !r.user_id).length

  const handleShare = async () => {
    if (reviewers.length === 0) {
      toast({ title: 'Add at least one reviewer', variant: 'destructive' }); return
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
    await new Promise(r => setTimeout(r, 400))
    const reviewerFirst = reviewers[0]?.name?.split(' ')[0] ?? 'team'
    const base = message.trim() || `Sharing ${finalIds.length} candidates for your review.`
    setMessage(`Hi ${reviewerFirst} — ${base} Quick read this week if you can. Reply here with thoughts or scores.`)
    setRewriting(false)
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast({ title: 'Link copied' }) }
    catch { toast({ title: 'Copy failed', variant: 'destructive' }) }
  }

  const reset = () => {
    setStep(1); setReviewers([]); setMessage('')
    setCreatedListId(null); setCreatedSlug(null)
  }

  const TitleWithDot = ({ children }: { children: ReactNode }) => (
    <h2 className="text-h3 font-poppins font-semibold tracking-[-0.04em] text-foreground">
      {children}<span className="text-virgilio-purple">.</span>
    </h2>
  )

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[640px] p-0 gap-0 overflow-hidden bg-[#FAFAF7]">
          {/* Header (white) */}
          <div className="px-6 pt-5 pb-4 bg-background border-b border-black/5">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-virgilio-purple/10 text-virgilio-purple">
                  <Share2 className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.08em] text-virgilio-purple">
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
            <TitleWithDot>
              {step === 1 && 'Bundle these candidates'}
              {step === 2 && "Who's reviewing?"}
              {step === 3 && 'Compose the share'}
              {step === 4 && `Shared with ${reviewers.length} ${reviewers.length === 1 ? 'teammate' : 'teammates'}`}
            </TitleWithDot>
            {step !== 4 && (
              <p className="text-[13px] text-muted-foreground mt-1">
                {step === 1 && 'Give the list a clear, scannable name. You can change everything later.'}
                {step === 2 && 'Add anyone in the workspace. Permissions are per-person and changeable any time.'}
                {step === 3 && 'They get a notification + email. Link works in-app only — login required.'}
              </p>
            )}
            <div className="mt-4 flex gap-1.5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={cn(
                  'h-[3px] flex-1 rounded-full transition-colors',
                  i <= step ? 'bg-foreground' : 'bg-[#E8E6E0]'
                )}/>
              ))}
            </div>
          </div>

          {/* Body (cream) */}
          <div className="px-6 py-5 max-h-[62vh] overflow-y-auto bg-[#FAFAF7]">
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
                    <button
                      type="button"
                      onClick={() => toast({ title: 'Coming soon', description: 'Add more from this modal.' })}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-virgilio-purple hover:opacity-80"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add more
                    </button>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-background divide-y divide-black/5 max-h-[220px] overflow-y-auto">
                    {finalIds.length === 0 && (
                      <div className="px-3 py-4 text-[13px] text-muted-foreground text-center">No candidates left.</div>
                    )}
                    {finalIds.map(id => {
                      const c = candidateMap.get(id)
                      const cName = c?.name ?? 'Unknown'
                      const sub = [c?.company, c?.stage].filter(Boolean).join(' · ')
                      return (
                        <div key={id} className="px-3 py-2.5 flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[10.5px] bg-virgilio-purple/10 text-virgilio-purple font-medium">
                              {initials(cName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{cName}</div>
                            {sub && <div className="text-[11.5px] text-muted-foreground truncate">{sub}</div>}
                          </div>
                          {typeof c?.score === 'number' && (
                            <span className="text-[13px] font-poppins font-semibold tabular-nums text-emerald-600">
                              {c.score}
                            </span>
                          )}
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
                      <button className="w-full min-h-[44px] px-2 py-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background text-left hover:border-virgilio-purple/40 focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30 ring-1 ring-transparent data-[state=open]:ring-virgilio-purple/40">
                        {reviewers.map(r => (
                          <span key={r.key} className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-md bg-background border border-virgilio-purple/30 text-foreground text-[12px]">
                            <Avatar className="h-5 w-5">
                              {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                              <AvatarFallback className="text-[8.5px] bg-virgilio-purple text-white font-medium">
                                {initials(r.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{r.name}</span>
                            <button
                              onClick={e => { e.stopPropagation(); removeReviewer(r.key) }}
                              className="h-3.5 w-3.5 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <span className="text-[13px] text-muted-foreground px-1">
                          {reviewers.length === 0 ? 'Type a name or email…' : 'Type a name or email…'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[560px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search teammates or type an email…"
                          value={emailDraft}
                          onValueChange={setEmailDraft}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && emailDraft.includes('@') && !availableMembers.some(m => m.email === emailDraft)) {
                              e.preventDefault(); addEmailReviewer(emailDraft); setMemberPickerOpen(false)
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="px-3 py-2 text-[12.5px] text-muted-foreground">
                              No teammate found. Press Enter on an email to invite.
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {availableMembers.map(m => (
                              <CommandItem key={m.user_id} value={`${m.name} ${m.email}`} onSelect={() => addReviewer(m)}>
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

                {/* Reviewer table (white card) */}
                <div className="rounded-lg border border-black/8 bg-background overflow-hidden">
                  <div className="grid grid-cols-[1fr_170px_56px_32px] px-3 py-2 bg-[#FAFAF7] text-table-header border-b border-black/5">
                    <span>Reviewer</span>
                    <span>Access</span>
                    <span className="text-center">Notify</span>
                    <span />
                  </div>
                  {reviewers.length === 0 && (
                    <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground inline-flex flex-col items-center gap-2 w-full">
                      <UserPlus className="h-4 w-4 text-muted-foreground/60" />
                      Add teammates above to start.
                    </div>
                  )}
                  {reviewers.map(r => {
                    const roleLabel = r.role ? (ROLE_LABEL[r.role] ?? r.role) : (r.email && !r.user_id ? 'External' : null)
                    return (
                      <div key={r.key} className="grid grid-cols-[1fr_170px_56px_32px] items-center px-3 py-2.5 border-t border-black/5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8">
                            {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                            <AvatarFallback className="text-[10px] bg-virgilio-purple text-white font-medium">
                              {initials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-semibold truncate">{r.name}</span>
                              {r.justAdded && (
                                <span className="inline-flex items-center h-[18px] px-1.5 rounded-md bg-black/[0.06] text-[10.5px] font-medium text-muted-foreground">
                                  You're inviting
                                </span>
                              )}
                            </div>
                            {roleLabel && <div className="text-[11.5px] text-muted-foreground truncate">{roleLabel}</div>}
                            {r.email && !r.user_id && <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>}
                          </div>
                        </div>
                        <Select value={r.access} onValueChange={(v: ListAccess) => updateReviewer(r.key, { access: v })}>
                          <SelectTrigger className="h-8 text-[12.5px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view"><span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> View only</span></SelectItem>
                            <SelectItem value="comment"><span className="inline-flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Comment</span></SelectItem>
                            <SelectItem value="comment_score"><span className="inline-flex items-center gap-2"><Star className="h-3.5 w-3.5" /> Comment + score</span></SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex justify-center">
                          <Switch checked={r.notify} onCheckedChange={v => updateReviewer(r.key, { notify: v })} />
                        </div>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => removeReviewer(r.key)} className="text-destructive focus:text-destructive">
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Internal-only banner (amber) */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#FEF7E6] border border-[#F5E3B3]">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-[#F5E3B3]/60 text-[#7A5A14] shrink-0">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[12.5px] text-[#5C4612] leading-snug">
                    <span className="font-semibold text-[#3D2F0A] block mb-0.5">Internal only</span>
                    External hiring managers? Use{' '}
                    <a href="#" onClick={e => e.preventDefault()} className="text-virgilio-purple font-medium hover:underline">External share</a>{' '}
                    instead — different permission model.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {/* Share link card */}
                <div className="rounded-lg border border-black/8 bg-background p-4 space-y-3">
                  <div className="inline-flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-virgilio-purple" />
                    <span className="text-[13px] font-semibold">Share link</span>
                    <Badge tone="green" size="xs" dot>Active</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 text-[12.5px] font-mono bg-[#FAFAF7] border border-black/5 rounded-md truncate">
                      {shareUrl}
                    </code>
                    <Button size="sm" variant="primary" icon={Copy} onClick={copyLink}>Copy</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-[12.5px]">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> Invited reviewers only
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Expires
                      <Select value={expiry} onValueChange={(v: Expiry) => setExpiry(v)}>
                        <SelectTrigger className="h-6 px-1.5 border-0 bg-transparent shadow-none text-[12.5px] font-medium text-foreground gap-0.5 hover:bg-black/5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">in 7 days</SelectItem>
                          <SelectItem value="14">in 14 days</SelectItem>
                          <SelectItem value="30">in 30 days</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </span>
                    <button
                      type="button"
                      onClick={() => setBlockScreenshots(v => !v)}
                      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Block screenshots
                      <span className={cn('font-medium', blockScreenshots ? 'text-virgilio-purple' : 'text-muted-foreground')}>
                        ({blockScreenshots ? 'on' : 'off'})
                      </span>
                    </button>
                  </div>
                </div>

                {/* Message card */}
                <div className="space-y-1.5">
                  <label className="text-form-label">Message to reviewers</label>
                  <div className="relative">
                    <Textarea
                      value={message}
                      onChange={e => setMessage(e.target.value.slice(0, 600))}
                      rows={5}
                      className="pr-3 pb-12 resize-none"
                      placeholder="Hi team — here are the candidates I'd push to onsite. Quick read this week if you can."
                    />
                    <div className="absolute right-2 bottom-2">
                      <Button size="sm" variant="purple" icon={Sparkles} loading={rewriting} onClick={handleRewrite}>
                        Rewrite with Gio
                      </Button>
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={notifyOnActivity} onCheckedChange={v => setNotifyOnActivity(!!v)} />
                  <span className="text-[13px]">Notify me when reviewers comment or score</span>
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center pt-1">
                  <div className="h-14 w-14 rounded-full bg-background border border-black/8 inline-flex items-center justify-center mb-4 shadow-sm">
                    <Check className="h-6 w-6 text-emerald-500" strokeWidth={2.5} />
                  </div>
                  <p className="text-[13.5px] text-muted-foreground max-w-[420px] leading-relaxed">
                    {reviewers.map(r => r.name.split(' ')[0]).slice(0, 3).join(', ')}
                    {reviewers.length > 3 ? ` +${reviewers.length - 3} more` : ''} will get a notification in-app and an email with your message.
                  </p>
                </div>
                <div className="rounded-lg border border-black/8 bg-background p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-virgilio-purple/10 text-virgilio-purple shrink-0">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {finalIds.length} candidates · {reviewers.length} reviewers · expires {expiryDateLabel(expiry)}
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {reviewers.slice(0, 4).map(r => (
                        <Avatar key={r.key} className="h-7 w-7 border-2 border-background">
                          {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                          <AvatarFallback className="text-[9.5px] bg-virgilio-purple text-white font-medium">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-1.5 text-[11.5px] font-mono bg-[#FAFAF7] border border-black/5 rounded-md truncate">
                      {shareUrl}
                    </code>
                    <Button size="sm" variant="secondary" icon={Copy} onClick={copyLink}>Copy</Button>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-black/8 bg-background">
                  <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[12.5px] text-muted-foreground">
                    Find it later under <span className="font-semibold text-foreground">Lists → Shared by me</span> in the left rail.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-black/5 flex items-center justify-between bg-[#FAFAF7]">
            <div className="text-[11.5px] text-muted-foreground">
              {step === 1 && `${finalIds.length} ${finalIds.length === 1 ? 'candidate' : 'candidates'} · auto-saved as draft`}
              {step === 2 && `${invited} invited · ${pending} pending`}
              {step === 3 && `Link · ${expiry === 'never' ? 'no expiry' : `${expiry}-day expiry`} · in-app only`}
            </div>
            <div className="flex items-center gap-2">
              {step === 1 && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" iconRight={ArrowLeft} className="[&>svg]:rotate-180" onClick={() => setStep(2)} disabled={!name.trim() || finalIds.length === 0}>
                    Next: who can see it
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setStep(1)}>Back</Button>
                  <Button size="sm" iconRight={ArrowLeft} className="[&>svg]:rotate-180" onClick={() => setStep(3)} disabled={reviewers.length === 0}>
                    Next: link &amp; message
                  </Button>
                </>
              )}
              {step === 3 && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setStep(2)}>Back</Button>
                  <Button size="sm" iconRight={Send} onClick={handleShare} loading={createList.isPending}>
                    Send &amp; share
                  </Button>
                </>
              )}
              {step === 4 && (
                <>
                  <Button variant="secondary" size="sm" onClick={reset}>Share another</Button>
                  <Button size="sm" iconRight={ArrowLeft} className="[&>svg]:rotate-180" onClick={() => { if (createdListId) navigate(`/lists/${createdListId}`); setOpen(false) }}>
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
