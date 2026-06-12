import { useMemo, useState } from 'react'
import {
  Plus,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Link as LinkIcon,
  Trash,
  Pause,
  Play,
  Eye,
  Sparkles,
  Zap,
  Globe,
  FileText,
} from 'lucide-react'
import { MetricStrip } from '@/components/ui/metric-strip'

import { formatDistanceToNowStrict } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { useJobPostings, JobPosting } from '@/hooks/useJobPostings'
import { useJobPostingMetrics } from '@/hooks/useJobPostingMetrics'
import { PostingSheet } from './postings/PostingSheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TableToolbar,
  TableSearch,
} from '@/components/ui/table-toolbar'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import {
  IdentityCell,
  StatusCell,
  ActionCell,
} from '@/components/ui/table-cells'
import {
  TableSkeleton,
  TableEmpty,
  TableFilteredEmpty,
} from '@/components/ui/table-states'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { copyToClipboard } from '@/utils/clipboard'
import { cn } from '@/lib/utils'
import { buildPostingPath, buildPostingUrl } from '@/lib/postingUrl'

interface JobPostingsTabProps {
  jobId: string
  jobTitle: string
  readOnly?: boolean
  organizationId?: string | null
  companySlug?: string | null
}

// ── Posting status helpers ──────────────────────────────────────────────────
type PostingStatus = 'live' | 'paused' | 'draft' | 'closed'

function getStatus(p: JobPosting): PostingStatus {
  const d = (p.details || {}) as any
  if (d.status === 'closed') return 'closed'
  if (d.status === 'draft' || !p.is_active && d.status === 'draft') return 'draft'
  if (!p.is_active) return 'paused'
  // never published explicitly?
  if (d.published_at == null && !p.is_active) return 'draft'
  return 'live'
}

const STATUS_TONE: Record<PostingStatus, 'green' | 'yellow' | 'neutral' | 'red'> = {
  live: 'green',
  paused: 'yellow',
  draft: 'neutral',
  closed: 'red',
}

const STATUS_LABEL: Record<PostingStatus, string> = {
  live: 'Live',
  paused: 'Paused',
  draft: 'Draft',
  closed: 'Closed',
}

function shortDistance(date: string | Date) {
  const txt = formatDistanceToNowStrict(new Date(date))
  // "5 days" → "5d", "2 hours" → "2h", "3 months" → "3mo"
  return txt
    .replace(/\s*seconds?$/, 's')
    .replace(/\s*minutes?$/, 'm')
    .replace(/\s*hours?$/, 'h')
    .replace(/\s*days?$/, 'd')
    .replace(/\s*weeks?$/, 'w')
    .replace(/\s*months?$/, 'mo')
    .replace(/\s*years?$/, 'y')
}

function statusHelper(p: JobPosting, status: PostingStatus) {
  if (status === 'live') return `Live since ${new Date(p.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  if (status === 'paused') return `Paused ${shortDistance(p.updated_at)} ago`
  if (status === 'draft') return 'Not yet published'
  return `Closed ${shortDistance(p.updated_at)} ago`
}

// ── Channel glyphs ──────────────────────────────────────────────────────────
const CHANNEL_META: Record<string, { letter: string; bg: string; fg: string; label: string }> = {
  internal: { letter: 'A', bg: 'bg-[#0d0d09]', fg: 'text-white', label: 'Apply page' },
  indeed: { letter: 'I', bg: 'bg-[#2164f3]', fg: 'text-white', label: 'Indeed' },
  wellfound: { letter: 'W', bg: 'bg-[#facc15]', fg: 'text-[#0d0d09]', label: 'Wellfound' },
  ziprecruiter: { letter: 'Z', bg: 'bg-[#22c55e]', fg: 'text-white', label: 'ZipRecruiter' },
  linkedin: { letter: 'L', bg: 'bg-[#0a66c2]', fg: 'text-white', label: 'LinkedIn' },
  hiringroom: { letter: 'H', bg: 'bg-[#ec4899]', fg: 'text-white', label: 'HiringRoom' },
  xing: { letter: 'X', bg: 'bg-[#0f766e]', fg: 'text-white', label: 'Xing' },
  talent: { letter: 'T', bg: 'bg-[hsl(var(--virgilio-purple))]', fg: 'text-white', label: 'Talent Network' },
}

function getChannels(p: JobPosting): string[] {
  const out: string[] = ['internal']
  const ext = (p.external_postings || {}) as Record<string, any>
  for (const k of Object.keys(ext)) {
    if (ext[k]) out.push(k)
  }
  if (p.publish_to_talent) out.push('talent')
  // dedupe preserve order
  return Array.from(new Set(out))
}

function ChannelChip({ k }: { k: string }) {
  const m = CHANNEL_META[k] || { letter: k[0]?.toUpperCase() || '?', bg: 'bg-[#6b7280]', fg: 'text-white', label: k }
  return (
    <span
      title={m.label}
      className={cn(
        'inline-flex h-[22px] w-[22px] items-center justify-center rounded-md font-poppins font-medium text-[11px]',
        m.bg,
        m.fg
      )}
    >
      {m.letter}
    </span>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  sub,
  dark,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  dark?: boolean
  icon?: any
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 border h-full flex flex-col justify-between',
        dark
          ? 'bg-[#0d0d09] border-[#0d0d09] text-[#FFFCF9]'
          : 'bg-white border-virgilio-border'
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-lg',
            dark ? 'bg-white/10 text-[#FFFCF9]' : 'bg-[#F1F0EC] text-text-secondary'
          )}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <span
          className={cn(
            'text-[10.5px] font-inter font-medium uppercase tracking-[0.06em]',
            dark ? 'text-[#FFFCF9]/60' : 'text-text-tertiary'
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-3">
        <div className={cn(
          'font-poppins font-semibold tracking-[-0.04em] text-[28px] leading-none',
          dark ? 'text-[#FFFCF9]' : 'text-text-primary'
        )}>
          {value}
        </div>
        {sub && (
          <div className={cn(
            'mt-1.5 text-[12px] font-inter',
            dark ? 'text-[#FFFCF9]/60' : 'text-text-tertiary'
          )}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export function JobPostingsTab({ jobId, jobTitle, readOnly, organizationId, companySlug }: JobPostingsTabProps) {
  const { toast } = useToast()
  const {
    postings,
    isLoading,
    refetch,
    updatePosting,
    deletePosting,
    duplicatePosting,
  } = useJobPostings(jobId)
  const postingIds = useMemo(() => postings.map((p) => p.id), [postings])
  const { metrics } = useJobPostingMetrics(jobId, postingIds)

  const [openSheet, setOpenSheet] = useState<{ mode: 'create' | 'edit'; postingId?: string } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [languageFilter, setLanguageFilter] = useState<string[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const enriched = useMemo(
    () =>
      postings.map((p) => {
        const status = getStatus(p)
        const channels = getChannels(p)
        const d = (p.details || {}) as any
        const language: string =
          d.language || d.locale || (p.title?.match(/\((EN|US|UK|EU|ES|FR|DE)\)/i)?.[1] ?? 'EN')
        const m = metrics[p.id] || { applications: 0, views: 0, applyRate: 0, newThisWeek: 0 }
        const applyRate = m.views > 0 ? Math.round((m.applications / m.views) * 1000) / 10 : 0
        return { posting: p, status, channels, language, metrics: { ...m, applyRate } }
      }),
    [postings, metrics]
  )

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { live: 0, paused: 0, draft: 0, closed: 0 }
    enriched.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1))
    return c
  }, [enriched])

  const langCounts = useMemo(() => {
    const c: Record<string, number> = {}
    enriched.forEach((r) => (c[r.language] = (c[r.language] || 0) + 1))
    return c
  }, [enriched])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter((r) => {
      if (statusFilter.length && !statusFilter.includes(r.status)) return false
      if (languageFilter.length && !languageFilter.includes(r.language)) return false
      if (q) {
        const hay = `${r.posting.title} ${r.posting.slug} ${r.language}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enriched, search, statusFilter, languageFilter])

  const totals = useMemo(() => {
    const apps = enriched.reduce((s, r) => s + r.metrics.applications, 0)
    const newThisWeek = enriched.reduce((s, r) => s + r.metrics.newThisWeek, 0)
    const views = enriched.reduce((s, r) => s + r.metrics.views, 0)
    const applyRate = views > 0 ? Math.round((apps / views) * 1000) / 10 : 0
    const live = statusCounts.live || 0
    const offline = (statusCounts.paused || 0) + (statusCounts.draft || 0)
    return { apps, newThisWeek, views, applyRate, live, offline, count: postings.length }
  }, [enriched, statusCounts, postings.length])

  const handleCreate = () => setOpenSheet({ mode: 'create' })
  const handleEdit = (id: string) => setOpenSheet({ mode: 'edit', postingId: id })

  const togglePause = async (p: JobPosting) => {
    await updatePosting(p.id, { is_active: !p.is_active })
    toast({ title: p.is_active ? 'Posting paused' : 'Posting resumed' })
    refetch()
  }

  const handleDuplicate = async (p: JobPosting) => {
    const newId = await duplicatePosting(p.id)
    if (newId) toast({ title: 'Duplicated', description: 'Posting duplicated with form layout' })
    refetch()
  }

  const handleDelete = async (id: string) => {
    await deletePosting(id)
    setConfirmDeleteId(null)
    refetch()
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter([])
    setLanguageFilter([])
  }

  const hasFilters = !!search || statusFilter.length > 0 || languageFilter.length > 0

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Postings"
          value={totals.count}
          sub={`${totals.live} live · ${totals.offline} drafts/paused`}
        />
        <Kpi
          label="Total applications"
          value={totals.apps}
          sub={
            totals.newThisWeek > 0 ? (
              <span className="text-[hsl(var(--virgilio-success,142_71%_45%))]">+{totals.newThisWeek} this week</span>
            ) : (
              'No new this week'
            )
          }
        />
        <Kpi
          label="Total views"
          value={totals.views || '—'}
          sub={totals.views > 0 ? `avg ${totals.applyRate}% apply rate` : 'Tracking starts at first view'}
        />
        {!readOnly && (
          <Kpi
            label="Monthly spend"
            value="$0"
            sub="Sponsored postings billed monthly"
            dark
            icon={Zap}
          />
        )}
      </div>

      {/* Toolbar */}
      <TableToolbar
        left={
          <>
            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Search postings…"
              className="w-[260px]"
            />
            <FilterChipPopover
              label="Status"
              options={[
                { value: 'live', label: 'Live', count: statusCounts.live || 0 },
                { value: 'paused', label: 'Paused', count: statusCounts.paused || 0 },
                { value: 'draft', label: 'Draft', count: statusCounts.draft || 0 },
                { value: 'closed', label: 'Closed', count: statusCounts.closed || 0 },
              ]}
              selectedValues={statusFilter}
              onSelectionChange={setStatusFilter}
            />
            <FilterChipPopover
              label="Language"
              options={Object.entries(langCounts).map(([v, c]) => ({ value: v, label: v, count: c }))}
              selectedValues={languageFilter}
              onSelectionChange={setLanguageFilter}
            />
          </>
        }
        right={
          <>
            <span className="hidden md:inline text-[12px] text-text-tertiary font-inter">
              Sorted by performance · descending
            </span>
            {!readOnly && (
              <Button variant="primary" size="sm" icon={Plus} onClick={handleCreate}>
                New posting
              </Button>
            )}
          </>
        }
      />

      {/* Table */}
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        <Table density="default">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[34%]">Posting</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[18%]">Distribution</TableHead>
              <TableHead className="w-[16%]">Performance</TableHead>
              <TableHead className="w-[14%]">Dates</TableHead>
              <TableHead className="w-[80px] text-right">{/* actions */}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={4} columns={6} />
            ) : postings.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title="No postings yet"
                description="Publish your first job posting to start receiving applications."
                ctaLabel={!readOnly ? 'New posting' : undefined}
                onCta={!readOnly ? handleCreate : undefined}
              />
            ) : filtered.length === 0 ? (
              <TableFilteredEmpty colSpan={6} query={search} onClearFilters={clearFilters} />
            ) : (
              filtered.map(({ posting: p, status, channels, language, metrics: m }, idx) => {
                const isPrimary = idx === 0 && status === 'live'
                return (
                  <TableRow
                    key={p.id}
                    interactive
                    onClick={() => handleEdit(p.id)}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-table-name text-text-primary truncate">{p.title}</div>
                          {isPrimary && (
                            <Badge tone="lilac" size="xs" className="shrink-0">Primary</Badge>
                          )}
                        </div>
                        <div className="font-mono text-[11.5px] text-text-tertiary truncate mt-0.5">
                          /jobs/{p.slug}
                        </div>
                        <div className="text-[11px] text-text-tertiary truncate mt-0.5">
                          {language} · {p.location || 'Any location'}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="leading-tight">
                        <StatusCell>
                          <Badge tone={STATUS_TONE[status]} size="sm" dot>
                            {STATUS_LABEL[status]}
                          </Badge>
                        </StatusCell>
                        <div className="text-[11px] text-text-tertiary mt-1">
                          {statusHelper(p, status)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {channels.slice(0, 5).map((c) => (
                          <ChannelChip key={c} k={c} />
                        ))}
                        <span className="text-[11.5px] text-text-tertiary ml-1 whitespace-nowrap">
                          {channels.length} {channels.length === 1 ? 'channel' : 'channels'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="leading-tight font-poppins tabular-nums">
                        <div className="text-[13px] text-text-primary">
                          {m.applications} <span className="text-text-tertiary font-inter text-[11.5px]">apps</span>
                          {m.applyRate > 0 && (
                            <span className="ml-2 text-[hsl(var(--virgilio-success,142_71%_45%))] text-[11.5px] font-inter">
                              {m.applyRate}% apply rate
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-text-tertiary flex items-center gap-1 mt-1 font-inter">
                          <Eye className="h-3 w-3" />
                          {m.views > 0 ? `${m.views.toLocaleString()} views` : '— views'}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="leading-tight">
                        <div className="text-[12px] text-text-primary">
                          Posted {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-[11px] text-text-tertiary mt-1">
                          Updated {shortDistance(p.updated_at)} ago
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ExternalLink}
                          iconOnly
                          aria-label="Open public posting"
                          onClick={() => window.open(buildPostingPath({ postingSlug: p.slug, organizationId, companySlug }), '_blank', 'noopener')}
                        />
                        {!readOnly && (
                          <>
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleEdit(p.id)}
                            >
                              Edit
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={MoreHorizontal}
                                  iconOnly
                                  aria-label="More actions"
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                                <DropdownMenuItem onClick={() => handleDuplicate(p)}>
                                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    copyToClipboard(buildPostingUrl({ postingSlug: p.slug, organizationId, companySlug }), 'Public link copied')
                                  }
                                >
                                  <LinkIcon className="h-3.5 w-3.5 mr-2" /> Copy URL
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => togglePause(p)}>
                                  {p.is_active ? (
                                    <>
                                      <Pause className="h-3.5 w-3.5 mr-2" /> Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3.5 w-3.5 mr-2" /> Resume
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setConfirmDeleteId(p.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash className="h-3.5 w-3.5 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </ActionCell>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Gio suggestion banner — placeholder heuristic */}
      {!readOnly && totals.live >= 2 && totals.live <= 3 && (
        <div className="rounded-2xl border border-[hsl(var(--virgilio-purple))]/20 bg-[#FAF8FF] p-4 flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--virgilio-purple))] text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-poppins font-medium text-text-primary">
              Gio suggests an additional posting
            </div>
            <div className="text-[12.5px] text-text-secondary mt-0.5">
              Your current postings cluster in a few regions. Adding a regional variant could surface more strong-fit candidates per month.
            </div>
          </div>
          <Button variant="purple" size="sm" onClick={handleCreate}>
            Create from suggestion →
          </Button>
        </div>
      )}

      {/* Sheet */}
      {openSheet && (
        <PostingSheet
          jobId={jobId}
          postingId={openSheet.postingId}
          open={!!openSheet}
          onOpenChange={(o) => !o && setOpenSheet(null)}
          onSaved={refetch}
          readOnly={readOnly}
          defaultTitle={`${jobTitle} – Job Posting`}
        />
      )}

      {/* Delete confirm — simple inline */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-[420px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-poppins font-semibold text-text-primary">
              Delete posting?
            </div>
            <div className="text-[13px] text-text-tertiary mt-1">
              This permanently removes the posting and breaks any public links.
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(confirmDeleteId)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
