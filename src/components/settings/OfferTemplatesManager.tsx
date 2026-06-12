import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Settings as SettingsIcon, Loader2, FilePlus2 } from 'lucide-react'
import { useOfferTemplates } from '@/hooks/useOfferTemplates'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useContractTemplates } from '@/hooks/useContractTemplates'
import { OfferLetterSheet } from './templates/OfferLetterSheet'
import { EmailTemplateSheet } from './templates/EmailTemplateSheet'
import { ContractTemplateSheet } from './templates/ContractTemplateSheet'
import { OfferTemplateFieldsManager } from './OfferTemplateFieldsManager'
import { RejectionReasonsManager } from './RejectionReasonsManager'
import { RejectionEmailTemplatesManager } from './RejectionEmailTemplatesManager'
import { OfferFormsManager } from './OfferFormsManager'
import { CandidateSourcesManager } from './CandidateSourcesManager'
import { SpecCard } from './shared/SpecCard'
import { SpecRow, SpecEmpty, NOIR_BTN } from './shared/SpecRow'
import { SpecChip } from './shared/SpecChip'
import { cn } from '@/lib/utils'

interface OfferTemplatesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

type TabKey = 'offer-forms' | 'offer-letters' | 'email-templates' | 'contract-templates' | 'rejection-reasons' | 'rejection-templates' | 'candidate-sources'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'offer-forms', label: 'Offer forms' },
  { key: 'offer-letters', label: 'Offer letters' },
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
              className={cn(
                'font-inter transition-colors',
                active
                  ? 'bg-[#0d0d09] text-[#fffcf9] border-transparent'
                  : 'bg-white text-[#5A6072] border-[#E7E8EE] hover:bg-[#FAFAF7]'
              )}
              style={{ height: 28, padding: '0 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 500, borderWidth: 1, borderStyle: 'solid' }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'offer-letters' && <OfferLettersSection context={context} />}
      {tab === 'email-templates' && <EmailTemplatesSection context={context} />}
      {tab === 'contract-templates' && <ContractTemplatesSection context={context} />}
      {tab === 'offer-forms' && <div className="[&_.bg-white]:!shadow-none"><OfferFormsManager context={context} /></div>}
      {tab === 'rejection-reasons' && <div className="[&_.bg-white]:!shadow-none"><RejectionReasonsManager context={context} /></div>}
      {tab === 'rejection-templates' && <div className="[&_.bg-white]:!shadow-none"><RejectionEmailTemplatesManager context={context} /></div>}
      {tab === 'candidate-sources' && <div className="[&_.bg-white]:!shadow-none"><CandidateSourcesManager context={context} /></div>}
    </div>
  )
}

// ─── Offer Letters ───
function OfferLettersSection({ context }: { context: 'platform-defaults' | 'organization' }) {
  const { templates, isLoading, deleteTemplate, copyPlatformTemplate } = useOfferTemplates(context)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const [fieldsId, setFieldsId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)

  const platformItems = (templates || []).filter(t => t.source === 'platform')
  const tenantItems = (templates || []).filter(t => t.source === 'tenant')
  const list = context === 'organization' ? tenantItems : templates || []

  return (
    <>
      {context === 'organization' && platformItems.length > 0 && (
        <SpecCard title="Platform offer letters" description="Defaults provided by Gio. Copy to your library to customize.">
          {platformItems.map((t, i) => (
            <SpecRow key={t.id} last={i === platformItems.length - 1}>
              <div className="flex-1 min-w-0">
                <div className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: 11 }}>
                  {t.description || `Added ${new Date(t.created_at).toLocaleDateString()}`}
                </div>
              </div>
              <SpecChip tone="gray">Platform</SpecChip>
              <button type="button" className="text-[#8B8F9E] hover:text-[#0d0d09]" onClick={() => copyPlatformTemplate(t.id)} aria-label="Copy">
                <Plus size={13} />
              </button>
            </SpecRow>
          ))}
        </SpecCard>
      )}

      <SpecCard
        title="Offer letters"
        description="Manage offer letters for your organization."
        action={<button type="button" className={NOIR_BTN} style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setSheet({ open: true })}><Plus size={13} /> Create</button>}
      >
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : list.length === 0 ? (
          <SpecEmpty icon={FilePlus2} title="No offer letters yet" body="Create your first to get started." />
        ) : (
          list.map((t, i) => (
            <SpecRow key={t.id} last={i === list.length - 1}>
              <div className="flex-1 min-w-0">
                <div className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: 11 }}>
                  {t.description || `Updated ${new Date(t.created_at).toLocaleDateString()}`}
                </div>
              </div>
              <button type="button" className="text-[#8B8F9E] hover:text-[#0d0d09]" onClick={() => setFieldsId(t.id)} aria-label="Fields"><SettingsIcon size={13} /></button>
              <button type="button" className="text-[#8B8F9E] hover:text-[#0d0d09]" onClick={() => setSheet({ open: true, id: t.id })} aria-label="Edit"><Pencil size={13} /></button>
              <button type="button" className="text-[#8B8F9E] hover:text-[#B91C1C]" onClick={() => setToDelete({ id: t.id, name: t.name })} aria-label="Delete"><Trash2 size={13} /></button>
            </SpecRow>
          ))
        )}
      </SpecCard>

      <OfferLetterSheet open={sheet.open} onOpenChange={(o) => setSheet({ open: o, id: undefined })} templateId={sheet.id} context={context} onFieldsClick={(id) => setFieldsId(id)} />

      <Dialog open={!!fieldsId} onOpenChange={() => setFieldsId(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage template fields</DialogTitle></DialogHeader>
          {fieldsId && <OfferTemplateFieldsManager templateId={fieldsId} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template</AlertDialogTitle>
            <AlertDialogDescription>Delete "{toDelete?.name}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) { deleteTemplate(toDelete.id); setToDelete(null) } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Email Templates ───
function EmailTemplatesSection({ context }: { context: 'platform-defaults' | 'organization' }) {
  const { templates, isLoading, deleteTemplate } = useEmailTemplates(context)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)

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
                <button type="button" className="text-[#8B8F9E] hover:text-[#B91C1C] disabled:opacity-40" onClick={() => setToDelete({ id: t.id, name: t.name })} disabled={isPlatform} aria-label="Delete"><Trash2 size={13} /></button>
              </SpecRow>
            )
          })
        )}
      </SpecCard>

      <EmailTemplateSheet open={sheet.open} onOpenChange={(o) => setSheet({ open: o, id: undefined })} templateId={sheet.id} context={context} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template</AlertDialogTitle>
            <AlertDialogDescription>Delete "{toDelete?.name}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) { deleteTemplate(toDelete.id); setToDelete(null) } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Contract Templates ───
function ContractTemplatesSection({ context }: { context: 'platform-defaults' | 'organization' }) {
  const { templates, isLoading, deleteTemplate, copyPlatformTemplate } = useContractTemplates(context)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)

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
              <button type="button" className="text-[#8B8F9E] hover:text-[#B91C1C]" onClick={() => setToDelete({ id: t.id, name: t.name })} aria-label="Delete"><Trash2 size={13} /></button>
            </SpecRow>
          ))
        )}
      </SpecCard>

      <ContractTemplateSheet open={sheet.open} onOpenChange={(o) => setSheet({ open: o, id: undefined })} templateId={sheet.id} context={context} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contract</AlertDialogTitle>
            <AlertDialogDescription>Delete "{toDelete?.name}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) { deleteTemplate(toDelete.id); setToDelete(null) } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
