import { useState } from 'react'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useOfferForms } from '@/hooks/useOfferForms'
import { formSections } from '@/lib/offerSections'
import { OfferFormSheet } from './offerForms/OfferFormSheet'
import { LibraryCard } from './shared/LibraryCard'
import { SpecChip } from './shared/SpecChip'

/**
 * Settings › Templates › Offer forms (2026-10-19): every form recruiters can
 * pick, in one list (before, the shared ones only showed under Job Defaults).
 */
export function OfferFormsManager() {
  const { forms, isLoading, loadError, deleteForm, createForm, refetchForms } = useOfferForms('organization')
  const [formSheet, setFormSheet] = useState({ open: false, formId: undefined as string | undefined })

  // S15 (Block B §16). A form used by an offer can't be deleted
  // (offer_letters.form_id has no ON DELETE), so that is blocked up front
  // (2026-10-13); otherwise type the form's name.
  const handleDelete = async (form: { id: string; name: string }) => {
    const { count, error } = await supabase
      .from('offer_letters')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', form.id)
    if (error) {
      toast({ title: `Couldn\u2019t check whether offers use ${form.name}`, description: 'Nothing was deleted; try again.', variant: 'destructive' })
      return
    }
    const usedBy = count ?? 0
    if (usedBy > 0) {
      await confirmDestructive({
        variant: 'blocked',
        title: `${form.name} is in use`,
        description: `${usedBy} offer${usedBy === 1 ? ' was' : 's were'} made with this form, and they need it to show their answers, so it stays.`,
        confirmLabel: '',
      })
      return
    }
    await confirmDestructive({
      title: `Delete ${form.name}?`,
      description: 'No offer uses it. Its fields are deleted with it. This can\u2019t be undone.',
      confirmLabel: 'Delete form',
      typeToConfirm: form.name,
      onConfirm: async () => {
        try {
          await deleteForm(form.id, { quiet: true })
        } catch {
          throw new Error(`Couldn\u2019t delete ${form.name}. Nothing was removed; try again.`)
        }
      },
    })
  }

  return (
    <>
      <LibraryCard
        title="Offer forms"
        description="What recruiters fill in when they write an offer, in sections."
        what="offer forms"
        addLabel="New form"
        onAdd={() => setFormSheet({ open: true, formId: undefined })}
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetchForms()}
        emptyTitle="No offer forms yet"
        emptyBody="Create the form recruiters fill in for an offer."
        onceKey="settings-offer-forms"
        items={forms.map((form) => {
          const n = formSections(form).length
          return {
            id: form.id,
            name: form.name,
            meta: form.description || `${n} ${n === 1 ? 'section' : 'sections'}`,
            chips: form.is_active ? <SpecChip tone="green">Active</SpecChip> : <SpecChip tone="gray">Inactive</SpecChip>,
            onEdit: () => setFormSheet({ open: true, formId: form.id }),
            onDelete: () => void handleDelete({ id: form.id, name: form.name }),
          }
        })}
      />

      <OfferFormSheet
        open={formSheet.open}
        onOpenChange={(open) => setFormSheet({ open, formId: undefined })}
        formId={formSheet.formId}
        createForm={createForm}
        onChanged={() => void refetchForms()}
      />
    </>
  )
}
