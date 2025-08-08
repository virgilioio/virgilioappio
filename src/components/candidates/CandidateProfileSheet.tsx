import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { ExternalLink } from 'lucide-react'

interface CandidateProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  jobId: string
}

export default function CandidateProfileSheet({ open, onOpenChange, candidateId, jobId }: CandidateProfileSheetProps) {
  const { organizationId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [candidate, setCandidate] = useState<any | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!open || !candidateId) return
      setLoading(true)
      try {
        const { data } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single()
        setCandidate(data || null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, candidateId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[80vw] sm:max-w-none h-full p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="p-6 border-b">
            <SheetTitle className="text-xl flex items-center gap-3">
              <span>{candidate?.candidate_name || 'Candidate'}</span>
              {candidate?.status && <Badge variant="secondary">{candidate.status}</Badge>}
            </SheetTitle>
            {candidate?.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm inline-flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" /> View LinkedIn
              </a>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="text-text-secondary text-sm">Loading profile…</div>
            ) : !candidate ? (
              <div className="text-text-secondary text-sm">No data available.</div>
            ) : (
              <>
                {/* Quick facts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-text-tertiary">Location</div>
                    <div className="text-sm text-text-primary">
                      {[candidate.location_city, candidate.location_state, candidate.location_country]
                        .filter(Boolean)
                        .join(', ') || 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-tertiary">Salary</div>
                    <div className="text-sm text-text-primary">
                      {candidate.salary_amount ? `${candidate.salary_currency || 'USD'} ${candidate.salary_amount.toLocaleString()} ${candidate.salary_period || ''}` : 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-tertiary">Skills</div>
                    <div className="text-sm text-text-primary truncate">
                      {candidate.skills?.join(', ') || '—'}
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                <CandidateAttachments candidateId={candidateId!} />

                {/* Comments */}
                {organizationId && (
                  <CandidateComments candidateId={candidateId!} jobId={jobId} organizationId={organizationId} />
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
