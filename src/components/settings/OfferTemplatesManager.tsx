import { useState } from 'react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { EmailTemplateSheet } from './templates/EmailTemplateSheet'
import { RejectionReasonsManager } from './RejectionReasonsManager'
import { RejectionEmailTemplatesManager } from './RejectionEmailTemplatesManager'
import { OfferFormsManager } from './OfferFormsManager'
import { CandidateSourcesManager } from './CandidateSourcesManager'
import { LibraryCard } from './shared/LibraryCard'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { collapseRows, rowsById } from '@/lib/motion'
import { confirmDestructive } from '@/components/ui/confirm-dialog'

/** How many rows point at a template (null if the check failed). */
async function countUses(table: 'stage_automation_emails', column: string, id: string) {
  const { count, error } = await (supabase.from(table) as any).select('id', { count: 'exact', head: true }).eq(column, id)
  return error ? null : (count ?? 0)
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

type TabKey = 'offer-forms' | 'email-templates' | 'rejection-reasons' | 'rejection-templates' | 'candidate-sources'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'offer-forms', label: 'Offer forms' },
  { key: 'email-templates', label: 'Email templates' },
  { key: 'rejection-reasons', label: 'Rejection reasons' },
  { key: 'rejection-templates', label: 'Rejection templates' },
  { key: 'candidate-sources', label: 'Candidate sources' },
]

/**
 * Settings › Templates (2026-10-19): one library per kind, the shared rows and
 * Virgilio's own together, editable by workspace admins (library_editor).
 * The kinds are tabs with the moving pill (TabsList).
 */
export function OfferTemplatesManager() {
  const [tab, setTab] = useState<TabKey>('offer-forms')

  return (
    <div className="max-w-[860px]">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-[14px]">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'email-templates' && <EmailTemplatesSection />}
      {tab === 'offer-forms' && <OfferFormsManager />}
      {tab === 'rejection-reasons' && <RejectionReasonsManager />}
      {tab === 'rejection-templates' && <RejectionEmailTemplatesManager />}
      {tab === 'candidate-sources' && <CandidateSourcesManager />}
    </div>
  )
}

// ─── Email Templates ───
function EmailTemplatesSection() {
  const { templates, isLoading, loadError, deleteTemplate, refetchTemplates } = useEmailTemplates('organization')
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
      description: 'It\u2019s no longer offered when you write an email. Emails already sent with it stay. This can\u2019t be undone.',
      confirmLabel: 'Delete template',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([t.id]))
    await exit.done
    await deleteTemplate(t.id).catch(() => exit.revert())
  }

  return (
    <>
      <LibraryCard
        title="Email templates"
        description="Ready-made emails to start from when you write to a candidate."
        what="email templates"
        addLabel="New template"
        onAdd={() => setSheet({ open: true })}
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetchTemplates()}
        emptyTitle="No email templates yet"
        emptyBody="Write one you send often."
        onceKey="settings-email-templates"
        items={templates.map((t) => ({
          id: t.id,
          name: t.name,
          meta: t.subject,
          onEdit: () => setSheet({ open: true, id: t.id }),
          onDelete: () => void handleDelete({ id: t.id, name: t.name }),
        }))}
      />

      <EmailTemplateSheet
        open={sheet.open}
        onOpenChange={(o) => {
          setSheet({ open: o, id: undefined })
          if (!o) void refetchTemplates()
        }}
        templateId={sheet.id}
        context="organization"
      />
    </>
  )
}
