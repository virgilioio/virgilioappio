
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { ExternalLink, Pencil, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useJobPostings } from '@/hooks/useJobPostings'
import { PostingSheet } from './postings/PostingSheet'

interface JobPostingsTabProps {
  jobId: string
  jobTitle: string
  readOnly?: boolean
}

export function JobPostingsTab({ jobId, jobTitle, readOnly }: JobPostingsTabProps) {
  const { toast } = useToast()
  const { postings, isLoading, refetch, createPosting, updatePosting } = useJobPostings(jobId)
  const [openSheet, setOpenSheet] = useState<{ mode: 'create' | 'edit', postingId?: string } | null>(null)

  const handleCreate = async () => {
    setOpenSheet({ mode: 'create' })
  }

  const handleEdit = (id: string) => {
    setOpenSheet({ mode: 'edit', postingId: id })
  }

  const handleToggle = async (id: string, checked: boolean) => {
    await updatePosting(id, { is_active: checked })
    toast({ title: 'Updated', description: `Posting ${checked ? 'activated' : 'deactivated'}.` })
    refetch()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Job Postings</CardTitle>
        {!readOnly && (
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> Create Posting
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : postings.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">No postings yet.</p>
            {!readOnly && (
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" /> Create your first posting
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postings.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.slug}</TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(c) => handleToggle(p.id, !!c)}
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(p.id)} disabled={readOnly}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/p/${p.slug}`, '_blank')}
                        disabled={!p.is_active}
                        title={p.is_active ? 'Open public link' : 'Activate to open'}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Right-side sheet for create/edit */}
      {openSheet && (
        <PostingSheet
          jobId={jobId}
          postingId={openSheet.postingId}
          open={!!openSheet}
          onOpenChange={(o) => !o && setOpenSheet(null)}
          onSaved={refetch}
          readOnly={readOnly}
          defaultTitle={`${jobTitle} – Job Posting`}
        />
      )}
    </Card>
  )
}
