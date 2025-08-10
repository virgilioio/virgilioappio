
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useJobPostings } from '@/hooks/useJobPostings'
import { PostingFieldsBuilder } from './PostingFieldsBuilder'
import { FormField } from '@/components/ui/form-field'

interface PostingSheetProps {
  jobId: string
  postingId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  readOnly?: boolean
  defaultTitle?: string
}

export function PostingSheet({
  jobId,
  postingId,
  open,
  onOpenChange,
  onSaved,
  readOnly,
  defaultTitle
}: PostingSheetProps) {
  const { toast } = useToast()
  const { getPosting, createPosting, updatePosting } = useJobPostings(jobId)

  const [localId, setLocalId] = useState<string | undefined>(postingId)
  const [title, setTitle] = useState<string>(defaultTitle || '')
  const [description, setDescription] = useState<string>('')
  const [isExternalUpdate, setIsExternalUpdate] = useState(false)

  useEffect(() => {
    setLocalId(postingId)
  }, [postingId])

  useEffect(() => {
    const load = async () => {
      if (postingId) {
        const p = await getPosting(postingId)
        if (p) {
          setTitle(p.title)
          setDescription(p.description || '')
          setIsExternalUpdate(true)
        }
      } else {
        setTitle(defaultTitle || '')
        setDescription('')
        setIsExternalUpdate(true)
      }
    }
    if (open) load()
  }, [open, postingId, getPosting, defaultTitle])

  const handleSaveBasics = async () => {
    if (!title?.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title', variant: 'destructive' })
      return
    }
    if (localId) {
      await updatePosting(localId, { title, description })
      toast({ title: 'Saved', description: 'Posting updated' })
    } else {
      const created = await createPosting({ title, description })
      if (created) {
        setLocalId(created.id)
        toast({ title: 'Created', description: 'Posting created' })
      }
    }
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{localId ? 'Edit Job Posting' : 'Create Job Posting'}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="basics" className="mt-4">
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="application-form" disabled={!localId}>Application Form</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="mt-4 space-y-4">
            <FormField label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter job posting title" />
            </FormField>
            <FormField label="Description">
              <RichTextEditor
                value={description}
                onChange={(html) => setDescription(html)}
                placeholder="Describe the role, responsibilities, etc."
                minHeight="200px"
                isExternalUpdate={isExternalUpdate}
                onExternalUpdateComplete={() => setIsExternalUpdate(false)}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              {!readOnly && (
                <Button onClick={handleSaveBasics}>
                  {localId ? 'Save' : 'Create'}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="application-form" className="mt-4">
            {localId && (
              <PostingFieldsBuilder postingId={localId} readOnly={readOnly} />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
