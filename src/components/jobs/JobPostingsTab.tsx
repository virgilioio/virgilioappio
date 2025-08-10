
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { ExternalLink, Pencil, Plus, MoreVertical, Copy, Trash, Link as LinkIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useJobPostings, JobPosting } from '@/hooks/useJobPostings'
import { PostingSheet } from './postings/PostingSheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { copyToClipboard } from '@/utils/clipboard'

interface JobPostingsTabProps {
  jobId: string
  jobTitle: string
  readOnly?: boolean
}

export function JobPostingsTab({ jobId, jobTitle, readOnly }: JobPostingsTabProps) {
  const { toast } = useToast()
  const { postings, isLoading, refetch, createPosting, updatePosting, deletePosting } = useJobPostings(jobId)
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

  const handleDuplicate = async (p: JobPosting) => {
    const created = await createPosting({
      title: `${p.title} (Copy)`,
      description: p.description || undefined,
      details: p.details || {},
    })
    if (created) {
      toast({ title: 'Duplicated', description: 'Posting duplicated' })
    }
  }

  const handleDelete = async (id: string) => {
    await deletePosting(id)
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
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postings.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{p.slug}</TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(c) => handleToggle(p.id, !!c)}
                          disabled={readOnly}
                        />
                        {p.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/p/${p.slug}`, '_blank')}
                            title="Open public link"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Open</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" aria-label="Actions" className="data-[state=open]:bg-muted">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50 w-40 bg-popover">
                            <DropdownMenuItem onClick={() => handleEdit(p.id)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(p)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyToClipboard(`${window.location.origin}/p/${p.slug}`, 'Public link copied')}>
                              <LinkIcon className="h-4 w-4 mr-2" /> Copy public link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive">
                              <Trash className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
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
