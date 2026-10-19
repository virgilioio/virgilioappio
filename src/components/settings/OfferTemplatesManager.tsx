import { useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, FilePlus2 } from 'lucide-react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useContractTemplates } from '@/hooks/useContractTemplates'
import { EmailTemplateSheet } from './templates/EmailTemplateSheet'
import { ContractTemplateSheet } from './templates/ContractTemplateSheet'
import { RejectionReasonsManager } from './RejectionReasonsManager'
import { RejectionEmailTemplatesManager } from './RejectionEmailTemplatesManager'
import { OfferFormsManager } from './OfferFormsManager'
import { CandidateSourcesManager } from './CandidateSourcesManager'
import { SpecCard } from './shared/SpecCard'
import { SpecRow, SpecEmpty, NOIR_BTN } from './shared/SpecRow'
import { SpecChip } from './shared/SpecChip'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { IconTip } from '@/components/ui/tooltip'
import { confirmDestructive } from '@/components/ui/confirm-dialog'

/** How many rows point at a template (null if the check failed). */
async function countUses(table: 'stage_automation_emails', column: string, id: string) {
  const { count, error } = await (supabase.from(table) as any).select('id', { count: 'exact', head: true }).eq(column, id)
  return error ? null : (count ?? 0)
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const libraryLine = (context: 'platform-defaults' | 'organization') =>
  context === 'platform-defaults' ? 'It\u2019s removed from the defaults every organization inherits.' : ''

function DeleteIcon({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <IconTip label={label}>
      <button type="button" className="text-[#8B8F9E] hover:text-[#B91C1C] disabled:opacity-40" onClick={onClick} disabled={disabled} aria-label={label}>
        <Trash2 size={13} />
      </button>
    </IconTip>
  )
}

interface OfferTemplatesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

type TabKey = 'offer-forms' | 'email-templates' | 'contract-templates' | 'rejection-reasons' | 'rejection-templates' | 'candidate-sources'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'offer-forms', label: 'Offer forms' },
  { key: 'email-templates', label: 'Email templates' },
  { key: 'contract-templates', label: 'Contracts' },
  { key: 'rejection-reasons', label: 'Rejection reasons' },
  { key: 'rejection-templates', label: 'Rejection templates' },
  { key: 'candidate-sources', label: 'Candidate sources' },
]

export function OfferTemplatesManager({ context = 'organization' }: OfferTemplatesManagerProps) {
  const [tab, setTab] = useState<TabKey>('offer-forms')

  return (
    <div className="max-w-[860px]">
      {/* Pill sub-nav */}
      <div className="flex flex-wrap gap-1.5 mb-[14px]">
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="font-inter transition-colors"
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 500,
                borderWidth: 1,
                borderStyle: 'solid',
                background: active ? '#EDE4FF' : '#FFFFFF',
                color: active ? '#5B21B6' : '#5A6072',
                borderColor: active ? '#D7C5FB' : '#E7E8EE',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'email-templates' && <EmailTemplatesSection context={context} />}
      {tab === 'contract-templates' && <ContractTemplatesSection context={context} />}
      {tab === 'offer-forms' && <div className="[&_.bg-white]:!shadow-none"><OfferFormsManager context={context} /></div>}
      {tab === 'rejection-reasons' && <div className="[&_.bg-white]:!shadow-none"><RejectionReasonsManager context={context} /></div>}
      {tab === 'rejection-templates' && <div className="[&_.bg-white]:!shadow-none"><RejectionEmailTemplatesManager context={context} /></div>}
      {tab === 'candidate-sources' && <div className="[&_.bg-white]:!shadow-none"><CandidateSourcesManager context={context} /></div>}
    </div>
  )
}

// ─── Email Templates ───
function EmailTemplatesSection({ context }: { context: 'platform-defaults' | 'organization' }) {
  const { templates, isLoading, deleteTemplate } = useEmailTemplates(context)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })

  // S12 (Block B §16): stage automations hold the template (the database
  // refuses the delete), so a template in use is blocked.
  const handleDelete = async (t: { id: string; name: string }) => {
    const usedBy = await countUses('stage_automation_emails', 'email_template_id', t.id)
    if (usedBy === null) {
      toast({ title: `Couldn\u2019t check whether automations use ${t.name}`, description: 'Nothing was deleted; try again.', variant: 'destructive' })
      return
    }
    if (usedBy > 0) {
      await confirmDestructive({
        variant: 'blocked',
        title: `${t.name} is in use`,
        description: `${plural(usedBy, 'stage automation')} ${usedBy === 1 ? 'sends' : 'send'} this template. Remove it from ${usedBy === 1 ? 'that automation' : 'those automations'} in the job\u2019s pipeline first, then delete it.`,
        confirmLabel: '',
      })
      return
    }
    const ok = await confirmDestructive({
      title: `Delete ${t.name}?`,
      description: `It\u2019s no longer offered when you write an email. Emails already sent with it stay. ${libraryLine(context)} This can\u2019t be undone.`.replace('  ', ' '),
      confirmLabel: 'Delete template',
    })
    if (ok) deleteTemplate(t.id).catch(() => {})
  }

  return (
    <>
      <SpecCard
        title="Email templates"
        description="Manage email templates for your organization."
        action={<button type="button" className={NOIR_BTN} style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setSheet({ open: true })}><Plus size={13} /> Create</button>}
      >
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : templates.length === 0 ? (
          <SpecEmpty icon={FilePlus2} title="No email templates yet" body="Create your first to get started." />
        ) : (
          templates.map((t, i) => {
            const isPlatform = context === 'organization' && t.source === 'platform'
            return (
              <SpecRow key={t.id} last={i === templates.length - 1}>
                <div className="flex-1 min-w-0">
                  <div className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                  <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: 11 }}>{t.subject}</div>
                </div>
                {isPlatform && <SpecChip tone="gray">Inherited</SpecChip>}
                <button type="button" className="text-[#8B8F9E] hover:text-[#0d0d09] disabled:opacity-40" onClick={() => setSheet({ open: true, id: t.id })} disabled={isPlatform} aria-label="Edit"><Pencil size={13} /></button>
                <DeleteIcon label={`Delete ${t.name}`} onClick={() => void handleDelete({ id: t.id, name: t.name })} disabled={isPlatform} />
              </SpecRow>
            )
          })
        )}
      </SpecCard>

      <EmailTemplateSheet open={sheet.open} onOpenChange={(o) => setSheet({ open: o, id: undefined })} templateId={sheet.id} context={context} />

    </>
  )
}

// ─── Contract Templates ───
function ContractTemplatesSection({ context }: { context: 'platform-defaults' | 'organization' }) {
  const { templates, isLoading, deleteTemplate, copyPlatformTemplate } = useContractTemplates(context)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })

  // S13 (Block B §16). Nothing references a contract template.
  const handleDelete = async (t: { id: string; name: string }) => {
    const ok = await confirmDestructive({
      title: `Delete ${t.name}?`,
      description: `It\u2019s removed from your contracts and can\u2019t be used again. ${libraryLine(context)} This can\u2019t be undone.`.replace('  ', ' '),
      confirmLabel: 'Delete contract',
    })
    if (ok) deleteTemplate(t.id).catch(() => {})
  }

  const platformItems = (templates || []).filter(t => t.source === 'platform')
  const tenantItems = (templates || []).filter(t => t.source === 'tenant')
  const list = context === 'organization' ? tenantItems : templates || []

  return (
    <>
      {context === 'organization' && platformItems.length > 0 && (
        <SpecCard title="Platform contracts" description="Defaults provided by Gio. Copy to your library to customize.">
          {platformItems.map((t, i) => (
            <SpecRow key={t.id} last={i === platformItems.length - 1}>
              <div className="flex-1 min-w-0">
                <div className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: 11 }}>{t.description || ''}</div>
              </div>
              <button type="button" className="text-[#8B8F9E] hover:text-[#0d0d09]" onClick={() => copyPlatformTemplate(t.id)} aria-label="Copy"><Plus size={13} /></button>
            </SpecRow>
          ))}
        </SpecCard>
      )}

      <SpecCard
        title="Contracts"
        description="Manage contracts for your organization."
        action={<button type="button" className={NOIR_BTN} style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setSheet({ open: true })}><Plus size={13} /> Create</button>}
      >
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : list.length === 0 ? (
          <SpecEmpty icon={FilePlus2} title="No contracts yet" body="Create your first to get started." />
        ) : (
          list.map((t, i) => (
            <SpecRow key={t.id} last={i === list.length - 1}>
              <div className="flex-1 min-w-0">
                <div className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: 11 }}>{t.description || `Updated ${new Date(t.created_at).toLocaleDateString()}`}</div>
              </div>
              <button type="button" className="text-[#8B8F9E] hover:text-[#0d0d09]" onClick={() => setSheet({ open: true, id: t.id })} aria-label="Edit"><Pencil size={13} /></button>
              <DeleteIcon label={`Delete ${t.name}`} onClick={() => void handleDelete({ id: t.id, name: t.name })} />
            </SpecRow>
          ))
        )}
      </SpecCard>

      <ContractTemplateSheet open={sheet.open} onOpenChange={(o) => setSheet({ open: o, id: undefined })} templateId={sheet.id} context={context} />

    </>
  )
}
