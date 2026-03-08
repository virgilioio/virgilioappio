import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabaseClient'

interface DeleteCandidateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  candidateName: string
  onConfirm: () => void
}

export function DeleteCandidateDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onConfirm,
}: DeleteCandidateDialogProps) {
  const [interviewCount, setInterviewCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !candidateId) {
      setInterviewCount(0)
      return
    }

    const fetchCount = async () => {
      setLoading(true)
      const { count } = await supabase
        .from('scheduled_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_id', candidateId)
        .in('status', ['confirmed', 'rescheduled'])

      setInterviewCount(count ?? 0)
      setLoading(false)
    }

    fetchCount()
  }, [open, candidateId])

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {candidateName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {loading ? (
              'Checking for scheduled interviews…'
            ) : interviewCount > 0 ? (
              <>
                Deleting <span className="font-medium text-foreground">{candidateName}</span> will
                also cancel{' '}
                <span className="font-medium text-foreground">
                  {interviewCount} scheduled interview{interviewCount > 1 ? 's' : ''}
                </span>
                . This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">{candidateName}</span>? This action
                cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
