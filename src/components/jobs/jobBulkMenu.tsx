import { ArrowRight, Briefcase, Copy, Download, Mail, Tag, UserX } from 'lucide-react'
import { downloadCsv } from '@/lib/csv'
import type { SelectionAction } from '@/components/shared/SelectionBar'
import { AddToJobPopover } from '@/components/candidates/bulk/AddToJobPopover'
import { AddTagPopover } from '@/components/candidates/tags/AddTagPopover'
import { supabase } from '@/integrations/supabase/client'
import { inChunks } from '@/lib/fetchAllRows'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { toast } from '@/hooks/use-toast'
import type { PipelineAssociation } from '@/hooks/usePipelineActions'
import { stageColor } from './pipelineVisuals'

export type JobStageMap = Record<string, { type: string; name: string; position: number }>

/** Stages a bulk move may target. Offers and hiring keep their own flows (offer, Mark hired). */
const MOVE_EXCLUDED_TYPES = new Set(['offer', 'onboarding'])

export interface JobBulkMenuOptions {
  jobId: string
  jobTitle?: string | null
  /** Selected candidate ids (the bar's selection). */
  candidateIds: string[]
  associations: PipelineAssociation[]
  stageMap: JobStageMap
  onEmail?: () => void
  /** Present: the menu offers "Move to stage". */
  onMoveToStage?: (stageJhsId: string) => void
  onReject?: () => void
  /** After a change made from a panel (added to a job, tagged). */
  onChanged?: () => void
}

/**
 * The ⋯ rows of a job's selection bar, shared by the Recruiting board and the
 * flat sections: Email, Move to stage ›, Add to another job, Add tag, Copy email
 * addresses, Export as CSV, then Reject last (§19). Rows are offered only when the
 * caller passes their handler.
 */
export function jobBulkMenu(o: JobBulkMenuOptions): SelectionAction[] {
  const rows: SelectionAction[] = []
  const selected = o.associations.filter((a) => o.candidateIds.includes(a.candidate_id))
  const names = selected.map((a) => a.candidate_name)

  if (o.onEmail) rows.push({ id: 'email-menu', label: 'Email…', icon: Mail, slot: 'overflow', onClick: o.onEmail })

  if (o.onMoveToStage) {
    const stages = Object.entries(o.stageMap)
      .filter(([, s]) => !MOVE_EXCLUDED_TYPES.has(s.type))
      .sort(([, a], [, b]) => a.position - b.position)
    // The tick marks the stage every selected candidate is already in.
    const shared = selected.length && selected.every((a) => a.current_stage_id === selected[0].current_stage_id)
      ? selected[0].current_stage_id
      : null
    rows.push({
      id: 'move-stage',
      label: 'Move to stage',
      icon: ArrowRight,
      slot: 'overflow',
      disabled: stages.length === 0,
      children: stages.map(([jhsId, s], i) => ({
        id: `stage-${jhsId}`,
        label: s.name,
        dot: stageColor(s.type, i),
        checked: jhsId === shared,
        disabled: jhsId === shared,
        onClick: () => o.onMoveToStage!(jhsId),
      })),
    })
  }

  rows.push({
    id: 'add-to-job',
    label: 'Add to another job…',
    icon: Briefcase,
    slot: 'overflow',
    panel: ({ open, onOpenChange, anchor }) => (
      <AddToJobPopover
        candidateIds={o.candidateIds}
        candidateNames={names}
        excludeJobId={o.jobId}
        open={open}
        onOpenChange={onOpenChange}
        trigger={anchor}
        onCompleted={o.onChanged}
      />
    ),
  })
  rows.push({
    id: 'add-tag',
    label: 'Add tag…',
    icon: Tag,
    slot: 'overflow',
    panel: ({ open, onOpenChange, anchor }) => (
      <AddTagPopover
        candidateIds={o.candidateIds}
        candidateNames={names}
        open={open}
        onOpenChange={onOpenChange}
        trigger={anchor}
      />
    ),
  })
  rows.push({
    id: 'copy-emails',
    label: 'Copy email addresses',
    icon: Copy,
    slot: 'overflow',
    onClick: () => void copyEmails(o.candidateIds),
  })
  rows.push({
    id: 'export',
    label: 'Export as CSV',
    icon: Download,
    slot: 'overflow',
    onClick: () => void exportCsv(o),
  })
  if (o.onReject) {
    rows.push({ id: 'reject-menu', label: 'Reject…', icon: UserX, slot: 'overflow', destructive: true, onClick: o.onReject })
  }
  return rows
}

interface ContactRow {
  id: string
  candidate_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  current_job_title: string | null
  company_current: string | null
}

async function fetchContacts(ids: string[]) {
  const wanted = new Set(ids)
  const rows = await inChunks<ContactRow>(ids, async (chunk) => {
    const { data, error } = await supabase
      .from('candidates')
      .select('id, candidate_name, email, phone, linkedin_url, current_job_title, company_current')
      .in('id', chunk)
    if (error) throw error
    return (data || []) as ContactRow[]
  })
  return rows.filter((r) => wanted.has(r.id))
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

async function copyEmails(ids: string[]) {
  let rows: ContactRow[]
  try {
    rows = await fetchContacts(ids)
  } catch {
    toast({ title: "Couldn't load the email addresses", variant: 'destructive' })
    return
  }
  const emails = Array.from(new Set(rows.map((r) => r.email?.trim()).filter(Boolean) as string[]))
  const missing = ids.length - rows.filter((r) => r.email?.trim()).length
  if (!emails.length) {
    toast({ title: ids.length === 1 ? 'This candidate has no email address' : 'None of these candidates has an email address' })
    return
  }
  const ok = await copyToClipboardSilent(emails.join(', '))
  if (!ok) {
    toast({ title: "Couldn't copy to the clipboard", variant: 'destructive' })
    return
  }
  toast({
    title: `${plural(emails.length, 'email address', 'email addresses')} copied`,
    description: missing > 0 ? `${plural(missing, 'candidate')} without an email ${missing === 1 ? 'was' : 'were'} left out.` : undefined,
  })
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '')

async function exportCsv(o: JobBulkMenuOptions) {
  let contacts: ContactRow[]
  try {
    contacts = await fetchContacts(o.candidateIds)
  } catch {
    toast({ title: "Couldn't export the candidates", variant: 'destructive' })
    return
  }
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const header = ['Name', 'Email', 'Phone', 'Stage', 'Status', 'Added', 'Gio Fit', 'Current role', 'Company', 'LinkedIn']
  const lines = o.candidateIds.map((id) => {
    const a = o.associations.find((x) => x.candidate_id === id)
    const c = byId.get(id)
    const stage = a?.current_stage_id ? o.stageMap[a.current_stage_id]?.name : ''
    return [
      c?.candidate_name || a?.candidate_name || 'Unnamed candidate',
      c?.email,
      c?.phone || a?.phone,
      stage,
      a?.status,
      day(a?.created_at),
      typeof a?.ai_fit_score === 'number' ? Math.round(a.ai_fit_score) : '',
      c?.current_job_title || a?.current_role,
      c?.company_current || a?.current_company,
      c?.linkedin_url || a?.linkedin_url,
    ]
  })
  downloadCsv(o.jobTitle || 'Candidates', header, lines)
  toast({ title: `${plural(o.candidateIds.length, 'candidate')} exported` })
}
