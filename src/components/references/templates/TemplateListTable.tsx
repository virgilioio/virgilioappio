import { BookOpen, ChevronRight, Info, Layers, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-states'
import { Table, TableBody } from '@/components/ui/table'
import { RefGlyph } from '@/components/references/RefGlyph'
import { ScopeChip } from '@/components/references/ScopeChip'
import type { ReferenceTemplate } from '@/lib/references/templateModel'
import type { ClientOrg } from './useClientOrganizations'

const GRID = 'minmax(0,2.2fr) 120px minmax(0,1.4fr) 90px 110px 100px 40px'
const MUTED = '#8B8F9E'

/** e.g. 12 Aug 2026 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const HEAD = ['Template', 'Scope', 'Referee rules', 'Questions', 'Times used', 'Updated', '']

interface Props {
  templates: ReferenceTemplate[]
  clients: ClientOrg[]
  isLoading: boolean
  selectedId?: string | null
  onOpen: (template: ReferenceTemplate) => void
  onNew: () => void
}

export function TemplateListTable({
  templates,
  clients,
  isLoading,
  selectedId,
  onOpen,
  onNew,
}: Props) {
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name

  return (
    <div>


      <Card className="overflow-hidden p-0" style={{ boxShadow: '0 1px 2px rgba(13,13,9,0.03)' }}>
        {isLoading ? (
          <Table>
            <TableBody>
              <TableSkeleton rows={4} columns={7} />
            </TableBody>
          </Table>
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
          <div>
            {/* Header row */}
            <div
              className="grid items-center"
              style={{
                gridTemplateColumns: GRID,
                gap: 12,
                padding: '10px 18px',
                background: '#FAFAF7',
                borderBottom: '1px solid #E7E8EE',
              }}
            >
              {HEAD.map((h, i) => (
                <span
                  key={i}
                  className="font-inter uppercase"
                  style={{ fontSize: 10.5, fontWeight: 600, color: MUTED, letterSpacing: '0.06em' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {templates.map((t, i) => {
              const selected = selectedId === t.id
              const client = t.scope === 'client' ? clientName(t.client_id) : null
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onOpen(t)
                  }}
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: GRID,
                    gap: 12,
                    padding: '13px 18px',
                    cursor: 'pointer',
                    background: selected ? '#FAF8FF' : '#fff',
                    borderBottom: i === templates.length - 1 ? 'none' : '1px solid #F1F0EC',
                  }}
                >
                  {/* Template */}
                  <div className="flex items-center min-w-0" style={{ gap: 10 }}>
                    <span
                      className="grid place-items-center shrink-0"
                      style={{ width: 30, height: 30, borderRadius: 9, background: '#0d0d09' }}
                      title={t.is_live ? undefined : 'Draft — not live'}
                    >
                      <RefGlyph
                        size={17}
                        color="#fffcf9"
                        accent={t.is_live ? '#D7C5FB' : 'rgba(255,252,249,0.72)'}
                      />
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block font-poppins truncate"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#1F2230',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.name || 'Untitled template'}
                      </span>
                      {client && (
                        <span
                          className="block font-inter truncate"
                          style={{ fontSize: 11, color: MUTED, marginTop: 1 }}
                        >
                          {client}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Scope */}
                  <span>
                    <ScopeChip scope={t.scope} />
                  </span>

                  {/* Referee rules */}
                  <span
                    className="font-inter"
                    style={{ fontSize: 11.5, color: '#5A6072', lineHeight: 1.4 }}
                  >
                    {t.min_referees}–{t.max_referees} referees
                    {t.relationship_rules.length > 0 &&
                      t.relationship_rules
                        .map((r) => `, ${r.count} ${r.relationship.toLowerCase()}`)
                        .join('')}
                  </span>

                  {/* Questions */}
                  <span
                    className="font-inter tabular-nums"
                    style={{ fontSize: 12, color: '#1F2230' }}
                  >
                    {t.questions.length}
                  </span>

                  {/* Times used */}
                  <span className="font-inter tabular-nums" style={{ fontSize: 12 }}>
                    {t.times_used === 0 ? (
                      <span style={{ color: '#B5B9C4' }}>Never</span>
                    ) : (
                      <span style={{ color: '#1F2230' }}>{t.times_used}</span>
                    )}
                  </span>

                  {/* Updated */}
                  <span className="font-inter" style={{ fontSize: 11.5, color: MUTED }}>
                    {formatDate(t.updated_at)}
                  </span>

                  {/* Chevron */}
                  <span className="flex justify-end">
                    <ChevronRight size={15} style={{ color: '#B5B9C4' }} />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div
        className="flex items-center font-inter"
        style={{ marginTop: 12, gap: 8, fontSize: 11.5, color: MUTED }}
      >
        <Info size={13} className="shrink-0" />
        <span>
          Templates are scoped to this tenant. A client template is offered first when the
          candidate's job belongs to that client.
        </span>
      </div>
    </div>
  )
}
