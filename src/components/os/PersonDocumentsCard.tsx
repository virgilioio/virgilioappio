import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Download, FileText, MoreHorizontal, Pencil, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { LoadError } from '@/components/empty/LoadError'
import { CandidateFileViewer, FileTypeTile, type ViewerFile } from '@/components/candidates/profile/CandidateFileViewer'
import { ProfileCard } from '@/components/os/ProfileParts'
import { cn } from '@/lib/utils'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { undoToast } from '@/lib/undoToast'
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KINDS,
  documentError,
  documentLink,
  documentMeta,
  documentProblem,
  usePersonDocuments,
  useSetPersonDocumentRemoved,
  useUpdatePersonDocument,
  useUploadPersonDocument,
  type DocumentKind,
  type PersonDocument,
} from '@/lib/os/personDocuments'

const todayLocal = () => format(new Date(), 'yyyy-MM-dd')

const toViewer = (d: PersonDocument): ViewerFile => ({
  id: d.id,
  file_name: d.file_name,
  file_type: d.mime_type,
  file_size_bytes: d.size_bytes,
  created_at: d.created_at,
  file_url: d.storage_path,
})

/**
 * Files on a person's profile (Allan, 2026-11-19): agreements signed outside
 * Gio Sign. People & Access admins upload (drop or browse; the name and kind
 * start from the file name), edit the details and remove with Undo; the person
 * sees and downloads their own. Files open in the candidate file viewer on a
 * five-minute link.
 */
export function PersonDocumentsCard({
  tenantId,
  userId,
  firstName,
  canManage,
  self,
  nameOf,
}: {
  tenantId: string | undefined
  userId: string | null
  firstName: string
  /** People & Access admins on someone's profile: upload, edit, remove. */
  canManage: boolean
  self: boolean
  nameOf?: (id: string | null) => string
}) {
  const q = usePersonDocuments(tenantId, userId)
  const upload = useUploadPersonDocument(tenantId, userId)
  const setRemoved = useSetPersonDocumentRemoved(tenantId, userId)
  const [pending, setPending] = useState<{ key: string; name: string }[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [editing, setEditing] = useState<PersonDocument | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const docs = q.data ?? []

  const add = async (list: FileList | File[] | null) => {
    if (!list) return
    for (const file of Array.from(list)) {
      const problem = documentProblem(file)
      if (problem) {
        toast.error(problem)
        continue
      }
      const key = `${file.name}-${file.size}-${Math.random()}`
      setPending((p) => [...p, { key, name: file.name }])
      try {
        await upload.mutateAsync(file)
      } catch (e) {
        toast.error(`Couldn’t add ${file.name}`, { description: documentError(e, 'Nothing was added; try again.') })
      } finally {
        setPending((p) => p.filter((x) => x.key !== key))
      }
    }
  }

  const download = async (d: PersonDocument) => {
    const url = await documentLink(d, true)
    if (!url) {
      toast.error(`Couldn’t download ${d.name}`, { description: 'Try again in a moment.' })
      return
    }
    window.location.assign(url)
  }

  // Reversible (the file is kept), so it acts at once with Undo (§18).
  const remove = async (d: PersonDocument) => {
    const exit = collapseRows(rowsById([d.id]))
    await exit.done
    try {
      await setRemoved.mutateAsync({ id: d.id, removed: true })
    } catch (e) {
      exit.revert()
      toast.error(`Couldn’t remove ${d.name}`, { description: documentError(e, 'Nothing was changed; try again.') })
      return
    }
    undoToast(`${d.name} removed`, async () => {
      try {
        await setRemoved.mutateAsync({ id: d.id, removed: false })
        requestAnimationFrame(() => restoreRows(rowsById([d.id])))
      } catch {
        toast.error(`Couldn’t bring ${d.name} back`, { description: 'Try again from People & Access.' })
      }
    }, self ? undefined : `${firstName} no longer sees it. It stays in the records.`)
  }

  return (
    <ProfileCard id="card-files" title="Files" icon={FileText} tone="blue">
      {canManage && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void add(e.dataTransfer.files)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragOver(false)
          }}
          data-drag-over={dragOver || undefined}
          className="gio-dropzone mb-3 flex cursor-pointer items-center gap-3 rounded-[10px] px-4 py-3"
          style={{
            background: dragOver ? '#F5F0FF' : '#FAFAF7',
            border: '1.5px dashed',
            borderColor: dragOver ? '#6F3FF5' : '#D1D0CB',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={DOCUMENT_ACCEPT}
            onChange={(e) => {
              void add(e.target.files)
              e.target.value = ''
            }}
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: '#EDE4FF' }}>
            <UploadCloud className="h-4 w-4" style={{ color: '#6F3FF5' }} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 font-inter">
            <span className="block text-[13px] text-[#1F2230]">
              Drop signed agreements here, or <span className="font-semibold text-virgilio-purple">browse</span>
            </span>
            <span className="block text-[11.5px] text-[#6B7080]">PDF, Word or an image · up to 25 MB · {firstName} sees them on their profile</span>
          </span>
        </div>
      )}

      {q.isLoading ? (
        <div className="space-y-1.5" aria-hidden>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : q.isError ? (
        <LoadError what={self ? 'your files' : 'their files'} compact onRetry={() => void q.refetch()} />
      ) : docs.length === 0 && pending.length === 0 ? (
        <p className="font-inter text-[12.5px] text-[#6B7080]">
          {self
            ? 'Nothing here yet. Agreements Virgilio keeps for you show up here.'
            : canManage
              ? `No files yet. Upload ${firstName}’s signed agreements so they can open them anytime.`
              : 'No files yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {docs.map((d, i) => (
            <li key={d.id} data-row-id={d.id} className="flex items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3 py-2.5">
              <FileTypeTile file={toViewer(d) as never} size={28} />
              <button
                type="button"
                onClick={() => setViewing(i)}
                className="group/name min-w-0 flex-1 rounded-md text-left"
                aria-label={`Open ${d.name}`}
              >
                <span className="block truncate font-inter text-[12.5px] font-medium text-[#1F2230] underline-offset-2 group-hover/name:underline">
                  {d.name}
                </span>
                <span className="block truncate font-inter text-[11.5px] tabular-nums text-[#6B7080]">{documentMeta(d, nameOf)}</span>
              </button>
              {canManage ? (
                <DropdownMenu>
                  <IconTip label="Actions">
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${d.name} actions`}
                        className="gio-pressable inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#6B7080] transition-colors duration-hover hover:bg-[#ECEAE2] hover:text-[#1F2230] data-[state=open]:bg-[#ECEAE2]"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenuTrigger>
                  </IconTip>
                  <DropdownMenuContent align="end" className="w-[272px]">
                    <DropdownMenuItem onSelect={() => setEditing(d)}>
                      <Pencil />
                      <span className="truncate">Edit details</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void download(d)}>
                      <Download />
                      <span className="truncate">Download</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-danger onSelect={() => void remove(d)}>
                      <Trash2 />
                      <span className="truncate">Remove</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <IconTip label={`Download ${d.name}`}>
                  <button
                    type="button"
                    aria-label={`Download ${d.name}`}
                    onClick={() => void download(d)}
                    className="gio-pressable inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#6B7080] transition-colors duration-hover hover:bg-[#ECEAE2] hover:text-[#1F2230]"
                  >
                    <Download size={16} />
                  </button>
                </IconTip>
              )}
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="flex items-center gap-3 rounded-[10px] border border-dashed border-[#D1D0CB] px-3 py-2.5 font-inter">
              <span className="gio-spinner shrink-0" style={{ width: 13, height: 13, borderWidth: 1.5 }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#3f4451]">{p.name}</span>
              <span className="text-[11.5px] text-[#6B7080]">Uploading…</span>
            </li>
          ))}
        </ul>
      )}

      <CandidateFileViewer
        files={docs.map(toViewer)}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
        onDownload={(f) => {
          const d = docs.find((x) => x.id === f.id)
          if (d) void download(d)
        }}
        signedUrl={async (f) => {
          const d = docs.find((x) => x.id === f.id)
          return d ? documentLink(d) : null
        }}
      />

      <EditDocumentDialog
        doc={editing}
        tenantId={tenantId}
        userId={userId}
        onClose={() => setEditing(null)}
      />
    </ProfileCard>
  )
}

function EditDocumentDialog({
  doc,
  tenantId,
  userId,
  onClose,
}: {
  doc: PersonDocument | null
  tenantId: string | undefined
  userId: string | null
  onClose: () => void
}) {
  const update = useUpdatePersonDocument(tenantId, userId)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<DocumentKind>('agreement')
  const [signedOn, setSignedOn] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  if (doc && shown !== doc.id) {
    setShown(doc.id)
    setName(doc.name)
    setKind(doc.kind)
    setSignedOn(doc.signed_on)
    setError(null)
  }
  if (!doc && shown) setShown(null)

  const save = async () => {
    if (!doc) return
    if (!name.trim()) {
      setError('Give the file a name.')
      return
    }
    try {
      await update.mutateAsync({ id: doc.id, name, kind, signed_on: signedOn })
      onClose()
    } catch (e) {
      setError(documentError(e, 'Couldn’t save the details. Try again.'))
    }
  }

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription className="truncate">{doc?.file_name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label="Name" htmlFor="doc-name">
            <Input
              id="doc-name"
              value={name}
              maxLength={200}
              disabled={update.isPending}
              aria-invalid={error && !name.trim() ? true : undefined}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
            />
          </FormField>
          <FormField label="Kind" htmlFor="doc-kind">
            <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)} disabled={update.isPending}>
              <SelectTrigger id="doc-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Date signed (optional)" htmlFor="doc-signed">
            <DatePickerVirgilio
              id="doc-signed"
              value={signedOn ? parseISO(`${signedOn}T12:00:00`) : undefined}
              onChange={(d) => setSignedOn(format(d, 'yyyy-MM-dd'))}
              onClear={() => setSignedOn(null)}
              maxDate={parseISO(`${todayLocal()}T12:00:00`)}
              presets={false}
              placeholder="When it was signed"
            />
          </FormField>
        </div>
        <p className={cn('min-h-[18px] font-inter text-[11.5px]', error ? 'text-destructive' : 'text-transparent')} role={error ? 'alert' : undefined}>
          {error ?? '.'}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={update.isPending}>
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
