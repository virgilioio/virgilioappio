
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, FileText, UserPlus } from 'lucide-react'
import { Candidate } from '@/hooks/useCandidates'
import { PermissionGate } from '@/components/auth/PermissionGate'

interface CandidateTableProps {
  candidates: Candidate[]
  isLoading: boolean
  onEdit: (candidate: Candidate) => void
  onDelete: (candidateId: string) => void
  onAddNew: () => void
}

export function CandidateTable({ candidates, isLoading, onEdit, onDelete, onAddNew }: CandidateTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDelete = (candidateId: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      onDelete(candidateId)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-xl">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-md">
          Candidates
          <Badge variant="secondary">{candidates.length}</Badge>
        </CardTitle>
        <PermissionGate permission="canManageCandidates">
          <Button onClick={onAddNew} size="sm" className="gap-1">
            <UserPlus className="h-4 w-4" />
            Add Candidate
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <div className="text-center py-xl text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-md opacity-50" />
            <p>No candidates added yet</p>
            <p className="text-sm">Add candidates to start tracking applicants for this job</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium">
                      {candidate.candidate_name}
                    </TableCell>
                    <TableCell>
                      <a 
                        href={`mailto:${candidate.candidate_email}`}
                        className="text-primary hover:underline"
                      >
                        {candidate.candidate_email}
                      </a>
                    </TableCell>
                    <TableCell>
                      {candidate.notes ? (
                        <div className="max-w-xs truncate" title={candidate.notes}>
                          {candidate.notes}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No notes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {candidate.resume_url ? (
                        <a 
                          href={candidate.resume_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          Resume
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">No resume</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(candidate.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <PermissionGate permission="canManageCandidates">
                        <div className="flex items-center justify-end gap-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(candidate)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(candidate.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
