import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, FilePlus2, LayoutTemplate, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { EnvelopesTable } from '@/components/sign/EnvelopesTable'
import { EnvelopeSheet } from '@/components/sign/EnvelopeSheet'
import { useEnvelopeActions } from '@/components/sign/envelopeActions'
import { SendSheet, type SendDraft } from '@/components/sign/SendSheet'
import { TemplateWizard } from '@/components/sign/templates/TemplateWizard'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useEnvelopes } from '@/lib/sign/api'
import { ENVELOPE_FILTERS, type EnvelopeFilter } from '@/lib/sign/status'
import { newDraft, setTemplateArchived, type TplDraft } from '@/lib/sign/templates'

/** A one-off envelope starts from an upload, as in DocuSign; Write in Gio is one tick away. */
const newEnvelopeDraft = (): TplDraft => ({ ...newDraft('standalone'), use_written: false, use_uploads: true })

/** Sign › Envelopes (admins only): every envelope, filtered by status tab, type and "Waiting on me". */
export default function SignEnvelopes() {
  const { user, organizationId } = useAuth()
  const qc = useQueryClient()
  const q = useEnvelopes()
  const timedOut = useLoadTimeout(q.isLoading, q.dataUpdatedAt)
  const [params, setParams] = useSearchParams()
  const raw = params.get('status') as EnvelopeFilter | null
  const filter: EnvelopeFilter = raw && ENVELOPE_FILTERS.some((f) => f.value === raw) ? raw : 'all'
  const setFilter = (f: EnvelopeFilter) =>
    setParams(
      (p) => {
        if (f === 'all') p.delete('status')
        else p.set('status', f)
        return p
      },
      { replace: true },
    )

  const envelopes = q.data ?? []
  const selectedId = params.get('envelope')
  const selected = envelopes.find((e) => e.id === selectedId) ?? null
  // Keep the last envelope on screen while the sheet slides out.
  const lastShown = useRef(selected)
  if (selected) lastShown.current = selected
  const setSelected = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('envelope', id)
        else p.delete('envelope')
        return p
      },
      { replace: true },
    )
  const { actionsFor, dialogs } = useEnvelopeActions()

  // New envelope (2026-11-06): a General agreement from a template, or a one-off written or uploaded here.
  const [send, setSend] = useState<{ open: boolean; templateId: string | null; restore: SendDraft | null }>({ open: false, templateId: null, restore: null })
  const [oneOff, setOneOff] = useState<{ open: boolean; draft: TplDraft | null }>({ open: false, draft: null })
  const sentOneOff = useRef(false)
  const startOneOff = () => {
    setSend({ open: false, templateId: null, restore: null })
    setOneOff({ open: true, draft: newEnvelopeDraft() })
  }
  // A one-off closed without sending: its hidden template has nothing left to do.
  const closeSend = (o: boolean) => {
    if (o) return
    const id = send.templateId
    setSend((s) => ({ ...s, open: false }))
    if (id && !sentOneOff.current) void setTemplateArchived(id, true).catch(() => {})
  }
  // Undo after a send reopens the sheet with what was entered (a one-off's template comes back first).
  useEffect(() => {
    const onReopen = async (ev: Event) => {
      const detail = (ev as CustomEvent<{ sourceId: string; templateId?: string | null; draft: SendDraft }>).detail
      if (!organizationId || detail?.sourceId !== organizationId) return
      const isOneOff = !!detail.templateId && detail.templateId === send.templateId
      if (isOneOff) {
        try {
          await setTemplateArchived(detail.templateId!, false)
          await qc.invalidateQueries({ queryKey: ['sign'] })
        } catch {
          return
        }
      }
      sentOneOff.current = false
      setSend({ open: true, templateId: isOneOff ? detail.templateId! : null, restore: detail.draft })
    }
    window.addEventListener('gio-sign-reopen', onReopen)
    return () => window.removeEventListener('gio-sign-reopen', onReopen)
  }, [organizationId, send.templateId, qc])
  // The database archives a one-off's template when it's sent; closing without sending archives it here.
  useEffect(() => {
    if (!send.open) return
    sentOneOff.current = false
  }, [send.open])
  const count = (s: string) => envelopes.filter((e) => e.status === s).length
  const out = count('sent') + count('queued')

  return (
    <ListPage
      title="Envelopes"
      count={q.data ? envelopes.length : undefined}
      meta={
        q.data && (
          <>
            <button type="button" onClick={() => setFilter('sent')} className="hover:text-text-primary transition-colors duration-hover">
              <MetaDot color="#E0891A">{out} out for signature</MetaDot>
            </button>
            <button type="button" onClick={() => setFilter('scheduled')} className="hover:text-text-primary transition-colors duration-hover">
              <MetaDot color="#8B5CF6">{count('scheduled')} scheduled</MetaDot>
            </button>
            <button type="button" onClick={() => setFilter('completed')} className="hover:text-text-primary transition-colors duration-hover">
              <MetaDot color="#12B886">{count('completed')} completed</MetaDot>
            </button>
            <button type="button" onClick={() => setFilter('draft')} className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors duration-hover">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-dashed border-[#8B8F9E]" />
              {count('draft')} draft{count('draft') === 1 ? '' : 's'}
            </button>
          </>
        )
      }
      actions={
        organizationId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button icon={Plus}>
                New envelope
                <ChevronDown className="-mr-1 h-4 w-4 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-[300px]">
              <DropdownMenuItem className="items-start" onSelect={startOneOff}>
                <FilePlus2 />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Upload or write a document</span>
                  <span className="block text-[12px] leading-5 text-[hsl(var(--menu-group-color))]">Sent once, not saved as a template</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start" onSelect={() => setSend({ open: true, templateId: null, restore: null })}>
                <LayoutTemplate />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Use a General template</span>
                  <span className="block text-[12px] leading-5 text-[hsl(var(--menu-group-color))]">NDAs, policies and other agreements you reuse</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    >
      <EnvelopesTable
        envelopes={envelopes}
        isLoading={q.isLoading}
        loadError={q.isError ? 'failed' : timedOut ? 'timeout' : null}
        onRetry={() => q.refetch()}
        filter={filter}
        onFilterChange={setFilter}
        myEmail={user?.email ?? null}
        myId={user?.id ?? null}
        selectedId={selectedId}
        onOpen={setSelected}
        actionsFor={actionsFor}
      />
      <EnvelopeSheet
        envelope={selected ?? lastShown.current}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        myEmail={user?.email ?? null}
      />
      {dialogs}
      {organizationId && (
        <SendSheet
          open={send.open}
          onOpenChange={closeSend}
          source={{ type: 'standalone', id: organizationId, templateId: send.templateId }}
          recordLabel={send.templateId ? 'Not tied to a candidate, member or deal' : 'General agreements aren’t tied to a candidate, member or deal'}
          isAdmin
          restore={send.restore}
          onSent={() => (sentOneOff.current = true)}
          onEditOneOff={
            send.templateId
              ? () => {
                  setSend((s) => ({ ...s, open: false }))
                  setOneOff((o) => ({ ...o, open: true }))
                }
              : undefined
          }
        />
      )}
      <TemplateWizard
        open={oneOff.open}
        init={oneOff.draft}
        mode="envelope"
        onClose={() => {
          setOneOff((o) => ({ ...o, open: false }))
          // Closed from Edit document: the saved one-off isn't needed any more.
          if (send.templateId && !send.open) void setTemplateArchived(send.templateId, true).catch(() => {})
        }}
        onEnvelopeReady={(d) => {
          setOneOff({ open: false, draft: d })
          setSend({ open: true, templateId: d.id, restore: null })
        }}
      />
    </ListPage>
  )
}
