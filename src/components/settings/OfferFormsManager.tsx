import { useRef, useState } from 'react'
import { CirclePause, CirclePlay, Copy } from 'lucide-react'
import { undoToast } from '@/lib/undoToast'
import { copyName } from '@/lib/copyName'
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
 * Each row's ⋯ has Edit, Duplicate, Make inactive / Make active and Delete
 * (2026-11-18).
 */
export function OfferFormsManager() {
  const { forms, isLoading, loadError, deleteForm, createForm, duplicateForm, setFormActive, refetchForms } = useOfferForms('organization')
  const [formSheet, setFormSheet] = useState({ open: false, formId: undefined as string | undefined })
  const copying = useRef(false)

  // The whole form is copied by the database in one go (sections, fields and
  // dropdown options). The copy starts inactive and opens in the editor.
  const handleDuplicate = async (form: { id: string; name: string }) => {
    if (copying.current) return
    copying.current = true
    const name = copyName(form.name, forms.map((f) => f.name))
    try {
      const id = await duplicateForm(form.id, name)
      toast({ title: `${name} created`, description: 'It starts inactive. Make it active when it\u2019s ready.' })
      setFormSheet({ open: true, formId: id })
    } catch (e) {
      const code = (e as { code?: string } | null)?.code
      toast({
        title: `Couldn\u2019t duplicate ${form.name}`,
        description:
          code === 'GOF01' ? 'That form isn\u2019t there any more. Refresh the list.'
          : code === 'GOF02' ? 'Only workspace admins can copy an offer form.'
          : 'Nothing was added; try again.',
        variant: 'destructive',
      })
    } finally {
      copying.current = false
    }
  }

  // A status change: it happens at once, with Undo (§18).
  const handleActive = async (form: { id: string; name: string }, active: boolean) => {
    const word = active ? 'active' : 'inactive'
    try {
      await setFormActive(form.id, active)
    } catch {
      toast({ title: `Couldn\u2019t make ${form.name} ${word}`, description: 'Nothing was changed; try again.', variant: 'destructive' })
      return
    }
    undoToast(
      `${form.name} is ${word}`,
      async () => {
        try {
          await setFormActive(form.id, !active)
        } catch {
          toast({ title: `Couldn\u2019t undo that`, description: `${form.name} is still ${word}; try again from its menu.`, variant: 'destructive' })
        }
      },
      active ? 'Recruiters can pick it for new offers.' : 'Hidden from new offers. Offers made with it keep it.',
    )
  }

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
            actions: [
              { label: 'Duplicate', icon: Copy, onSelect: () => void handleDuplicate(form) },
              form.is_active
                ? { label: 'Make inactive', icon: CirclePause, onSelect: () => void handleActive(form, false) }
                : { label: 'Make active', icon: CirclePlay, onSelect: () => void handleActive(form, true) },
            ],
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
