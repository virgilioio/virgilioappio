import { Building2, ChevronRight, Layers, Library, Plus, UserRoundCog } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/table-states'
import { ReferencesGlyph } from '@/components/icons/ReferencesGlyph'
import { cn } from '@/lib/utils'
import type { ReferenceTemplate, ReferenceTemplateScope } from '@/lib/references/templateModel'
import type { ClientOrg } from './useClientOrganizations'

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'

const SCOPE_META: Record<
  ReferenceTemplateScope,
  { label: string; icon: typeof Building2; bg: string; fg: string }
> = {
  client: { label: 'Client', icon: Building2, bg: '#DBEAFE', fg: '#1E40AF' },
  default: { label: 'Default', icon: Layers, bg: '#F1F0EC', fg: '#5A6072' },
  personalised: { label: 'Personalised', icon: UserRoundCog, bg: '#EDE4FF', fg: '#5B21B6' },
}

function ScopeBadge({ scope }: { scope: ReferenceTemplateScope }) {
  const meta = SCOPE_META[scope] ?? SCOPE_META.default
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-inter font-medium"
      style={{ background: meta.bg, color: meta.fg, fontSize: 11.5, padding: '3px 9px' }}
    >
      <Icon className="w-[12px] h-[12px]" strokeWidth={2} />
      {meta.label}
    </span>
  )
}

function GlyphTile({ live }: { live: boolean }) {
  return (
    <div
      className={cn(
        'shrink-0 grid place-items-center rounded-[10px]',
        live ? 'bg-[#0d0d09]' : 'bg-[#F1F0EC]',
      )}
      style={{ width: 34, height: 34 }}
      title={live ? undefined : 'Draft — not live'}
    >
      <ReferencesGlyph
        className={cn(
          'w-[18px] h-[18px]',
          live ? 'fill-[#fffcf9] [&_.accent]:fill-[#D7C5FB]' : 'fill-[#C9C7BF] [&_.accent]:fill-[#fffcf9]',
        )}
      />
    </div>
  )
}

function relativeDate(iso: string): string {
  const d = new Date(iso).getTime()
  const days = Math.floor((Date.now() - d) / 86_400_000)
  if (days <= 0) return 'Today'
  return `${days}d`
}

interface Props {
  templates: ReferenceTemplate[]
  clients: ClientOrg[]
  isLoading: boolean
  onOpen: (template: ReferenceTemplate) => void
  onNew: () => void
  onQuestionLibrary: () => void
}

export function TemplateListTable({
  templates,
  clients,
  isLoading,
  onOpen,
  onNew,
  onQuestionLibrary,
}: Props) {
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="font-poppins font-semibold text-[#0d0d09]"
          style={{ fontSize: 18, letterSpacing: '-0.04em' }}
        >
          Templates
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Library} onClick={onQuestionLibrary}>
            Question library
          </Button>
          <Button size="sm" icon={Plus} onClick={onNew}>
            New template
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <TableSkeleton rows={4} columns={7} />
        ) : templates.length === 0 ? (
          <div className="p-6">
            <EmptyState
              variant="page"
              title="No reference templates yet"
              description="A template defines what referees you need, which questions they answer, and the emails that go out."
              icon={Layers}
              action={{ label: 'New template', onClick: onNew }}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Referee rules</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Times used</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => {
                const asked = t.questions.filter((q) => q.ask_candidate_too).length
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpen(t)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GlyphTile live={t.is_live} />
                        <div className="min-w-0">
                          <div
                            className="font-poppins font-medium text-[#0d0d09] truncate"
                            style={{ fontSize: 13.5, letterSpacing: '-0.01em' }}
                          >
                            {t.name}
                          </div>
                          <div className="font-inter truncate" style={{ fontSize: 11.5, color: MUTED }}>
                            {t.scope === 'client'
                              ? clientName(t.client_id) || 'Client template'
                              : t.is_live
                                ? 'Live'
                                : 'Draft'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ScopeBadge scope={t.scope} />
                    </TableCell>
                    <TableCell className="font-inter text-[12.5px] text-[#5A6072]">
                      {t.min_referees}–{t.max_referees} referees
                      {t.relationship_rules.length > 0 && (
                        <span style={{ color: MUTED }}> · {t.relationship_rules.length} rule{t.relationship_rules.length > 1 ? 's' : ''}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-inter text-[12.5px] text-[#5A6072]">
                      {t.questions.length}
                      {asked > 0 && <span style={{ color: MUTED }}> · {asked} asked of candidate</span>}
                    </TableCell>
                    <TableCell className="font-inter text-[12.5px]">
                      {t.times_used === 0 ? (
                        <span style={{ color: MUTED }}>Never</span>
                      ) : (
                        <span className="font-poppins tabular-nums text-[#0d0d09]">{t.times_used}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-inter text-[12.5px] text-[#5A6072]">
                      {relativeDate(t.updated_at)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-[15px] h-[15px]" style={{ color: MUTED }} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p
        className="font-inter leading-relaxed"
        style={{ fontSize: 11.5, color: MUTED, borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10 }}
      >
        Templates are scoped to this workspace and are never shared across workspaces. When a
        candidate's job belongs to a client that has its own template, that client template is
        offered first.
      </p>
    </div>
  )
}
