import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, ExternalLink, Facebook, Link2, Linkedin, Mail, MessageCircle, Sparkles, Twitter, type LucideIcon } from 'lucide-react'
import { FormSheet } from '@/components/references/FormSheet'
import { FormSection } from '@/components/references/FormSection'
import { Seg } from '@/components/sign/templates/parts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { IconSwap, makeSwapIcon } from '@/components/ui/icon-swap'
import { IconTip } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadError } from '@/components/empty/LoadError'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import {
  SHARE_CHANNELS,
  fillLink,
  shareIntent,
  shareLink,
  useApplySourceCounts,
  useSharePosts,
  useShareCode,
  type ShareChannel,
  type SharePosts,
  type ShareVoice,
} from '@/lib/jobShare'
import { CARD_CTA, CARD_H, CARD_W, VIRGILIO_LOGO, drawShareCard, loadCardFonts, loadCardImage } from '@/lib/shareCard'

/**
 * The share kit (job exposure, Phase 1; Allan, Go! 2026-11-12), from the job's Share
 * menu: who's posting (you, or the client's team), a LinkedIn post and a WhatsApp
 * message written by Gio in the job post's language, a link per channel tagged so each
 * application says where it came from, the job image to download, and the job's
 * applications by where they came from.
 */

export interface ShareKitPost {
  jobId: string
  /** The job post's workspace: its public name is the company the post shows. */
  tenantId: string
  title: string
  /** The live job post's public address, without tags. */
  url: string
  /** Place, work mode, type and pay as the job post shows them. */
  facts: string[]
}

const ICONS: Record<ShareChannel, LucideIcon> = {
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  x: Twitter,
  facebook: Facebook,
  email: Mail,
  anywhere: Link2,
}

type PostKind = 'linkedin' | 'whatsapp'

const CopySwap = makeSwapIcon(Copy, Check)

function useCopied(): [string | null, (key: string, text: string) => Promise<void>] {
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(null), 1600)
    return () => window.clearTimeout(t)
  }, [copied])
  return [copied, async (key, text) => {
    if (await copyToClipboardSilent(text)) setCopied(key)
  }]
}

export function JobShareKit({
  open,
  onOpenChange,
  post,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: ShareKitPost
}) {
  // The company as the public job post names it (get_public_tenant_info, as PublicJobPosting).
  const companyQuery = useQuery({
    queryKey: ['public-tenant-name', post.tenantId],
    enabled: open && !!post.tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_public_tenant_info', { p_tenant_id: post.tenantId })
      const row = Array.isArray(data) ? data[0] : null
      return (row?.name as string | undefined) ?? null
    },
  })
  const company = companyQuery.data || 'the company'
  const [voice, setVoice] = useState<ShareVoice>('team')
  const [kind, setKind] = useState<PostKind>('linkedin')
  // Gio's texts per voice, with {link} where each channel's link goes.
  const [posts, setPosts] = useState<Partial<Record<ShareVoice, SharePosts>>>({})
  const [copied, copy] = useCopied()

  const code = useShareCode(open)
  const by = voice === 'client' ? 'client' : code.data ?? null
  const counts = useApplySourceCounts(post.jobId, open)
  const write = useSharePosts(post.jobId)

  const linkFor = (channel: ShareChannel) => shareLink(post.url, channel, by)
  const current = posts[voice]
  const raw = current ? current[kind] : ''
  const shownLink = linkFor(kind)
  const shown = raw ? fillLink(raw, shownLink) : ''

  const askGio = () => {
    write.mutate(voice, {
      onSuccess: (p) => setPosts((all) => ({ ...all, [voice]: p })),
    })
  }

  const setShown = (text: string) => {
    if (!current) return
    const back = text.split(shownLink).join('{link}')
    setPosts((all) => ({ ...all, [voice]: { ...current, [kind]: back } }))
  }

  const textFor = (channel: ShareChannel) => {
    if (!current) return ''
    if (channel === 'whatsapp') return fillLink(current.whatsapp, linkFor('whatsapp'))
    if (channel === 'email') return fillLink(current.linkedin, linkFor('email'))
    return ''
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      eyebrow="Share"
      title="Share this job"
      subtitle={<span className="block truncate">{post.title} · {company}</span>}
    >
      <FormSection title="Who's posting" subtitle={voice === 'team' ? 'Links say the application came from your post.' : "For the client's team to post on their own channels."} bare>
        <Seg<ShareVoice>
          label="Who's posting"
          value={voice}
          onChange={setVoice}
          options={[
            { value: 'team', label: 'You' },
            { value: 'client', label: "The client's team" },
          ]}
        />
      </FormSection>

      <FormSection
        title="Post"
        subtitle="Gio writes it in the job post's language. Edit anything before you copy it."
        action={
          current ? (
            <Button variant="ghost" size="sm" icon={Sparkles} loading={write.isPending} onClick={askGio}>
              Write again
            </Button>
          ) : null
        }
      >
        {current ? (
          <div className="space-y-3">
            <Seg<PostKind>
              label="Which post"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'linkedin', label: 'LinkedIn post' },
                { value: 'whatsapp', label: 'WhatsApp message' },
              ]}
            />
            <Textarea
              aria-label={kind === 'linkedin' ? 'LinkedIn post' : 'WhatsApp message'}
              value={shown}
              onChange={(e) => setShown(e.target.value)}
              className="min-h-[160px] font-inter text-[13.5px] leading-[1.55]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="font-inter text-[12px] tabular-nums text-[#6B7080]">{shown.length.toLocaleString()} characters</span>
              <Button
                variant="secondary"
                size="sm"
                icon={CopySwap}
                data-swapped={copied === `post-${kind}` || undefined}
                onClick={() => copy(`post-${kind}`, shown)}
              >
                Copy post
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="font-inter text-[13px] leading-[1.5] text-[#3A3D48]">
              A LinkedIn post and a WhatsApp message about this job, {voice === 'team' ? 'as you sharing the search' : 'as the company announcing it'}, with this job's link in each.
            </p>
            <Button variant="primary" size="md" icon={Sparkles} loading={write.isPending} onClick={askGio}>
              Write with Gio
            </Button>
          </div>
        )}
        <div className="gio-field-message min-h-[18px] pt-1.5 font-inter text-[12px] leading-[18px] text-[#B91C1C]" role="status">
          {write.isError ? (
            <>
              {(write.error as Error).message}{' '}
              <button type="button" className="font-medium underline underline-offset-2" onClick={askGio}>
                Try again
              </button>
            </>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Links" subtitle="Each link tells us where an applicant came from." cardPadding={0}>
        <ul className="divide-y divide-[#EEEDE8]">
          {SHARE_CHANNELS.map((c) => {
            const Icon = ICONS[c.key]
            const link = linkFor(c.key)
            const intent = shareIntent(c.key, link, textFor(c.key), `${post.title} · ${company}`)
            const key = `link-${c.key}`
            return (
              <li key={c.key} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F4F3EF] text-[#1F2230]" aria-hidden>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-poppins text-[13.5px] font-medium text-[#1F2230]">{c.label}</div>
                  <div className="truncate font-inter text-[12px] text-[#6B7080]">{c.hint}</div>
                </div>
                {intent && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconRight={ExternalLink}
                    onClick={() => window.open(intent, '_blank', 'noopener')}
                  >
                    Open
                  </Button>
                )}
                <IconTip label={copied === key ? 'Copied' : 'Copy link'}>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Copy the ${c.label} link`}
                    disabled={voice === 'team' && !by && code.isLoading}
                    onClick={() => copy(key, link)}
                  >
                    <IconSwap swapped={copied === key} from={<Copy className="h-4 w-4" />} to={<Check className="h-4 w-4 text-[#1F7A45]" />} />
                  </Button>
                </IconTip>
              </li>
            )
          })}
        </ul>
      </FormSection>

      <FormSection title="Image" subtitle="1200 × 630, the size LinkedIn, X, Facebook and WhatsApp show in full.">
        <ShareImage post={post} company={company} />
      </FormSection>

      <FormSection title="Where applicants came from" subtitle="Applications to this job, by the link or site that sent them." cardPadding={0}>
        <SourceList query={counts} />
      </FormSection>
    </FormSheet>
  )
}

function ShareImage({ post, company }: { post: ShareKitPost; company: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setReady(false)
      await loadCardFonts()
      const brand = await loadCardImage(VIRGILIO_LOGO)
      const ctx = canvasRef.current?.getContext('2d')
      if (cancelled || !ctx) return
      drawShareCard(ctx, { title: post.title, facts: post.facts, cta: CARD_CTA, brand })
      setReady(true)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [post.title, post.facts])

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'job'}.png`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }, 'image/png')
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-[#E7E8EE]" style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}>
        {!ready && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          role="img"
          aria-label={`${post.title}, ${company}`}
          className={cn('block h-full w-full transition-opacity duration-200', ready ? 'opacity-100' : 'opacity-0')}
        />
      </div>
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" icon={Download} disabled={!ready} onClick={download}>
          Download image
        </Button>
      </div>
    </div>
  )
}

function SourceList({ query }: { query: ReturnType<typeof useApplySourceCounts> }) {
  if (query.isError) {
    return (
      <div className="p-4">
        <LoadError what="where applicants came from" onRetry={() => void query.refetch()} compact />
      </div>
    )
  }
  if (query.isLoading || !query.data) {
    return (
      <ul className="divide-y divide-[#EEEDE8]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex h-11 items-center justify-between px-4">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-6" />
          </li>
        ))}
      </ul>
    )
  }
  if (!query.data.length) {
    return <p className="px-4 py-3.5 font-inter text-[13px] text-[#6B7080]">No applications yet.</p>
  }
  const total = query.data.reduce((n, r) => n + r.count, 0)
  return (
    <>
      <ul className="divide-y divide-[#EEEDE8]">
        {query.data.map((r) => (
          <li key={r.key ?? 'untracked'} className="flex h-11 items-center gap-3 px-4">
            <span className={cn('min-w-0 flex-1 truncate font-inter text-[13px]', r.key ? 'text-[#1F2230]' : 'text-[#6B7080]')}>{r.label}</span>
            <span className="font-inter text-[13px] font-medium tabular-nums text-[#1F2230]">{r.count.toLocaleString()}</span>
            <span className="w-10 text-right font-inter text-[12px] tabular-nums text-[#6B7080]">{Math.round((r.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-[#EEEDE8] px-4 py-2.5 font-inter text-[12px] text-[#6B7080]">
        Counted from November 12, 2026. Earlier applications show as Not tracked.
      </p>
    </>
  )
}
