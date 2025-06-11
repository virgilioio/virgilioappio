
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Edit, Trash2, FileText, UserPlus, Mail } from 'lucide-react'
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
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 h-[52px]">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-4 w-[60px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card hover>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-3">
          Candidates
          <Badge variant="secondary" interactive>{candidates.length}</Badge>
        </CardTitle>
        <PermissionGate permission="canManageCandidates">
          <Button onClick={onAddNew} size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Candidate
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No candidates added yet</p>
            <p className="text-sm">Add candidates to start tracking applicants for this job</p>
          </div>
        ) : (
          <div className="rounded-md border border-border">
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
                        className="flex items-center gap-2 text-primary hover:underline transition-all duration-150 ease-in-out hover:text-primary/80"
                      >
                        <Mail className="h-4 w-4" />
                        {candidate.candidate_email}
                      </a>
                    </TableCell>
                    <TableCell>
                      {candidate.notes ? (
                        <div className="max-w-xs truncate" title={candidate.notes}>
                          {candidate.notes}
                        </div>
                      ) : (
                        <span className="text-text-secondary">No notes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {candidate.resume_url ? (
                        <a 
                          href={candidate.resume_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline transition-all duration-150 ease-in-out hover:text-primary/80"
                        >
                          <FileText className="h-4 w-4" />
                          Resume
                        </a>
                      ) : (
                        <span className="text-text-secondary text-sm">No resume</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {new Date(candidate.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <PermissionGate permission="canManageCandidates">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(candidate)}
                            className="h-8 w-8 p-0 hover:bg-accent/50 hover:scale-110 transition-all duration-150 ease-in-out"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(candidate.id)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:scale-110 transition-all duration-150 ease-in-out"
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
