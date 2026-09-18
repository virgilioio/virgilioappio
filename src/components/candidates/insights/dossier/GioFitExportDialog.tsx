import { useEffect, useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Download, FileText, Link as LinkIcon, Mail, MapPin, Phone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { printDossier } from './printDossier'
import printCss from './dossierPrint.css?inline'
import { DossierPrintDocument, DOSSIER_PAGE_GEOMETRY, type DossierPageSize, type DossierPrintProps } from './DossierPrintDocument'

export interface DossierExportOptions {
  clientReady: boolean
  includeContact: boolean
  includeEvidence: boolean
  includeValidation: boolean
  pageSize: DossierPageSize
}

interface GioFitExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientReady: boolean
  hasContactDetails: boolean
  candidateName: string
  jobTitle: string | null
  outputLanguageName: string | null
  buildData: (options: DossierExportOptions) => DossierPrintProps
}

const LETTER_LOCALES = ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'DO', 'PR']

function localePageSize(): DossierPageSize {
  const region = typeof navigator !== 'undefined' ? (navigator.language.split('-')[1] || '').toUpperCase() : ''
  return LETTER_LOCALES.includes(region) ? 'letter' : 'a4'
}

const groupLabel = 'font-inter text-[10px] font-semibold uppercase tracking-[0.09em] text-fit-subtle'
const rule = 'my-4 h-px bg-fit-hairline'

function Segmented({
  value,
  options,
  onChange,
  small,
  label,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  small?: boolean
  label: string
}) {
  return (
    <div className="flex w-fit gap-[2px] rounded-lg bg-fit-chip p-[3px]" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md text-[12px] transition-colors',
              small ? 'px-3 py-[5px]' : 'px-3.5 py-1.5',
              active
                ? 'bg-surface-primary font-semibold text-fit-ink shadow-[0_1px_2px_rgba(13,13,9,0.08)]'
                : 'bg-transparent font-medium text-fit-subtle',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  last,
  children,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={cn('flex items-start gap-3 py-[11px]', !last && 'border-b border-fit-chip')}>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-fit-ink">{label}</p>
        <p className="mt-0.5 text-[11px] leading-[1.45] text-fit-subtle [text-wrap:pretty]">{description}</p>
        {children}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  )
}

export function GioFitExportDialog({
  open,
  onOpenChange,
  defaultClientReady,
  hasContactDetails,
  candidateName,
  jobTitle,
  outputLanguageName,
  buildData,
}: GioFitExportDialogProps) {
  const [clientReady, setClientReady] = useState(defaultClientReady)
  const [includeContact, setIncludeContact] = useState(!defaultClientReady && hasContactDetails)
  const [includeEvidence, setIncludeEvidence] = useState(true)
  const [includeValidation, setIncludeValidation] = useState(true)
  const [pageSize, setPageSize] = useState<DossierPageSize>(localePageSize)
  const [pageCount, setPageCount] = useState(1)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClientReady(defaultClientReady)
    setIncludeContact(!defaultClientReady && hasContactDetails)
    setError(null)
  }, [open, defaultClientReady, hasContactDetails])

  const options: DossierExportOptions = {
    clientReady,
    includeContact: includeContact && hasContactDetails && !clientReady,
    includeEvidence,
    includeValidation,
    pageSize,
  }

  const previewData = useMemo(
    () => buildData(options),
    // buildData is rebuilt on every tab render; the options are what actually change the document.
    [clientReady, options.includeContact, includeEvidence, includeValidation, pageSize],
  )

  const fileName = `${candidateName.trim().replace(/\s+/g, '-')}${jobTitle ? `_${jobTitle.trim().replace(/\s+/g, '-')}` : ''}_Gio-dossier.pdf`
  const geometry = DOSSIER_PAGE_GEOMETRY[pageSize]

  const handleVersion = (next: 'internal' | 'client') => {
    const nextClientReady = next === 'client'
    setClientReady(nextClientReady)
    // Client-ready never leaves the workspace with a phone number attached by default.
    if (nextClientReady) setIncludeContact(false)
  }

  const handleExport = async () => {
    setWorking(true)
    setError(null)
    try {
      await printDossier(previewData, fileName.replace(/\.pdf$/, ''))
      onOpenChange(false)
    } catch (caught) {
      console.error('Error exporting dossier:', caught)
      setError('The dossier could not be prepared. Nothing was downloaded — try again.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !working && onOpenChange(next)}>
      <DialogPortal>
        <DialogOverlay className="grid place-items-center bg-[rgba(13,13,9,0.44)] p-6" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[740px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[18px] bg-surface-primary shadow-[0_40px_80px_-24px_rgba(13,13,9,0.4),0_2px_8px_rgba(13,13,9,0.08)] duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* header */}
          <div className="flex items-start gap-3.5 border-b border-fit-hairline px-[22px] pb-4 pt-5">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-fit-violet-wash">
              <FileText className="h-[17px] w-[17px] text-virgilio-purple" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-poppins text-[17px] font-semibold tracking-[-0.03em] text-fit-ink">
                Export dossier
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-[3px] text-[12.5px] text-fit-muted">
                {[candidateName, jobTitle, outputLanguageName ? `written in ${outputLanguageName}` : null].filter(Boolean).join(' · ')}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fit-subtle transition-colors hover:bg-fit-paper"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </DialogPrimitive.Close>
          </div>

          {/* body */}
          <div className="grid grid-cols-[minmax(0,1fr)_240px]">
            <div className="border-r border-fit-hairline px-[22px] pb-5 pt-[18px]">
              <p className={groupLabel}>Version</p>
              <div className="mt-2">
                <Segmented
                  label="Dossier version"
                  value={clientReady ? 'client' : 'internal'}
                  onChange={(value) => handleVersion(value as 'internal' | 'client')}
                  options={[
                    { value: 'internal', label: 'Internal' },
                    { value: 'client', label: 'Client-ready' },
                  ]}
                />
              </div>
              <p className="mt-2 text-[11.5px] leading-[1.5] text-fit-subtle">
                {clientReady
                  ? 'Weights, points, the nulled dimension, and validation priorities are omitted. Safe to send outside the workspace.'
                  : 'Everything on the tab, including weights, score arithmetic, and validation priorities.'}
              </p>

              <div className={rule} />

              <p className={groupLabel}>Include</p>
              <div className="mt-1">
                <SwitchRow
                  label="Contact details"
                  description={
                    !hasContactDetails
                      ? 'No email or phone is on file for this candidate'
                      : clientReady
                        ? 'Off for client-ready exports by default'
                        : 'Email, phone, location, LinkedIn'
                  }
                  checked={options.includeContact}
                  onCheckedChange={setIncludeContact}
                >
                  {options.includeContact && (
                    <div className="mt-[7px] flex gap-1.5">
                      {[Mail, Phone, MapPin, LinkIcon].map((Icon, index) => (
                        <span key={index} className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-fit-chip">
                          <Icon className="h-[11px] w-[11px] text-fit-muted" strokeWidth={2} />
                        </span>
                      ))}
                    </div>
                  )}
                </SwitchRow>
                <SwitchRow
                  label="Dimension evidence"
                  description="Every match and gap, laid out in full — no accordions on paper"
                  checked={includeEvidence}
                  onCheckedChange={setIncludeEvidence}
                />
                <SwitchRow
                  last
                  label={clientReady ? 'Still to verify' : 'Validation points'}
                  description={clientReady ? 'The open questions, without internal priorities' : 'Questions, priority, and suggested stage'}
                  checked={includeValidation}
                  onCheckedChange={setIncludeValidation}
                />
              </div>

              <div className={rule} />

              <p className={groupLabel}>Page size</p>
              <div className="mt-2">
                <Segmented
                  small
                  label="Page size"
                  value={pageSize}
                  onChange={(value) => setPageSize(value as DossierPageSize)}
                  options={[
                    { value: 'letter', label: 'Letter' },
                    { value: 'a4', label: 'A4' },
                  ]}
                />
              </div>
            </div>

            {/* preview */}
            <div className="flex flex-col gap-2.5 bg-fit-paper p-[18px]">
              <p className={groupLabel}>Preview</p>
              <div className="relative h-[264px] w-[204px] overflow-hidden rounded-md border border-fit-row-border bg-surface-primary shadow-[0_8px_20px_-10px_rgba(13,13,9,0.22)]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 origin-top-left scale-[0.25]"
                  style={{ width: geometry.width, height: geometry.height }}
                >
                  <style dangerouslySetInnerHTML={{ __html: printCss }} />
                  <DossierPrintDocument data={previewData} onPageCount={setPageCount} />
                </div>
              </div>
              <p className="text-[11.5px] leading-[1.5] text-fit-muted">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {clientReady ? 'Client-ready' : 'Internal'} · {pageSize === 'a4' ? 'A4' : 'Letter'}
              </p>
              <p className="break-all font-mono text-[9.5px] leading-[1.5] text-fit-subtle">{fileName}</p>
            </div>
          </div>

          {error && (
            <p role="alert" className="border-t border-fit-risk-border bg-fit-warning-soft px-[22px] py-2.5 text-[11.5px] text-fit-risk-copy">
              {error}
            </p>
          )}

          {/* footer */}
          <div className="flex items-center gap-2.5 border-t border-fit-hairline bg-surface-primary px-[22px] py-3.5">
            <p className="flex-1 text-[11.5px] leading-[1.45] text-fit-subtle [text-wrap:pretty]">
              {clientReady
                ? 'Every page is stamped confidential and carries your workspace name.'
                : 'Internal exports are watermarked and should not be sent outside the workspace.'}
            </p>
            <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="md" icon={Download} loading={working} onClick={handleExport}>
              {working ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
