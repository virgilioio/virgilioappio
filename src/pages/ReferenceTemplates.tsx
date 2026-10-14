import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { usePermissions } from '@/hooks/usePermissions'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useClientOrganizations } from '@/components/references/templates/useClientOrganizations'
import { TemplateListTable } from '@/components/references/templates/TemplateListTable'
import { ReferencesNoAccess } from '@/components/references/ReferencesShell'
import { QUESTION_TYPES } from '@/lib/references/templateModel'

/** The answer types a template can use. A real Dialog: focus trap, Esc, §2 motion. */
function QuestionLibraryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const families: { key: 'standard' | 'reference'; label: string }[] = [
    { key: 'standard', label: 'Standard question types' },
    { key: 'reference', label: 'Reference-specific types' },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Question library</DialogTitle>
          <DialogDescription>The answer types available inside a reference template.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {families.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <p className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">{f.label}</p>
              {QUESTION_TYPES.filter((q) => q.family === f.key).map((q) => (
                <div key={q.type} className="rounded-lg border border-[#E7E8EE] bg-white px-2.5 py-2">
                  <p className="font-poppins text-[12.5px] font-medium text-text-primary">{q.label}</p>
                  {q.hint && <p className="font-inter text-[11.5px] text-text-tertiary">{q.hint}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** /references/templates — the template list, laid out like the Jobs list. */
export default function ReferenceTemplatesPage() {
  const navigate = useNavigate()
  const { canViewReferences } = usePermissions()
  const { templates, isLoading, isError, refetch, createTemplate } = useReferenceTemplates()
  const { clients } = useClientOrganizations()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(isLoading, retry)
  const loadError: 'failed' | 'timeout' | null = isError ? 'failed' : timedOut ? 'timeout' : null

  if (!canViewReferences) return <ReferencesNoAccess />

  // §13: the button keeps its width with a spinner, and double clicks are blocked.
  const handleNew = async () => {
    if (createTemplate.isPending) return
    try {
      const created = await createTemplate.mutateAsync(undefined)
      navigate(`/references/templates/${created.id}`)
    } catch {
      toast("Couldn't create a template. Try again.")
    }
  }

  const live = templates.filter((t) => t.is_live).length

  return (
    <ListPage
      title="Templates"
      count={templates.length}
      meta={
        <>
          <MetaDot color="#12B886">{live} live</MetaDot>
          <MetaDot color="#B5B9C4">{templates.length - live} drafts</MetaDot>
          <span>Owned by this workspace, never shared</span>
        </>
      }
      actions={
        <>
          <Button variant="secondary" size="md" icon={BookOpen} onClick={() => setLibraryOpen(true)}>
            Question library
          </Button>
          <Button variant="primary" size="md" icon={Plus} loading={createTemplate.isPending} onClick={handleNew}>
            New template
          </Button>
        </>
      }
    >
      <TemplateListTable
        templates={loadError ? [] : templates}
        clients={clients}
        isLoading={isLoading && !loadError}
        onOpen={(t) => navigate(`/references/templates/${t.id}`)}
        emptyState={
          loadError ? (
            <LoadError
              what="templates"
              timedOut={loadError === 'timeout'}
              onRetry={() => {
                setRetry((n) => n + 1)
                void refetch()
              }}
            />
          ) : (
            <AnimatedEmpty
              scene="candidates"
              onceKey="reference-templates"
              title="No reference templates yet"
              body="A template defines which referees you need, the questions they answer and the emails that go out."
              primary={{ label: 'New template', icon: <Plus size={16} />, onClick: () => void handleNew() }}
            />
          )
        }
      />

      <QuestionLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </ListPage>
  )
}
