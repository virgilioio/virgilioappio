
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { CandidateTable } from '@/components/candidates/CandidateTable'

interface CandidateWithJob {
  id: string
  candidate_name: string
  location_country: string | null
  location_state: string | null
  location_city: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  profile_summary: string | null
  created_at: string
  first_viewed_by: Record<string, string> | null
  job: {
    id: string
    title: string
    organization: {
      name: string
    }
  }
}

export default function Candidates() {
  const { user, userType } = useAuth()
  const { canViewCandidates, isGuest } = usePermissions()

  const { data: candidates = [], isLoading, error } = useQuery({
    queryKey: ['global-candidates', userType],
    queryFn: async () => {
      console.log('Fetching candidates for user type:', userType)
      
      if (isGuest) {
        // Guest users can only see candidates for jobs they are assigned to
        console.log('Guest user - fetching candidates only for assigned jobs')
        
        // First get the jobs this guest user is assigned to
        const { data: jobAssignments, error: assignmentsError } = await supabase
          .from('job_assignments')
          .select('job_id')
          .eq('user_id', user?.id)

        if (assignmentsError) {
          console.error('Error fetching job assignments for guest:', assignmentsError)
          throw assignmentsError
        }

        const assignedJobIds = jobAssignments?.map(assignment => assignment.job_id) || []
        console.log('Guest user assigned job IDs:', assignedJobIds)

        if (assignedJobIds.length === 0) {
          console.log('Guest user has no assigned jobs, returning empty candidates list')
          return []
        }

        // Now fetch candidates only for those assigned jobs
        const { data, error } = await supabase
          .from('job_candidates')
          .select(`
            *,
            job:jobs!inner (
              id,
              title,
              organization:organizations!inner (
                name
              )
            )
          `)
          .in('job_id', assignedJobIds)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching candidates for guest:', error)
          throw error
        }

        console.log('Fetched candidates for guest user:', data)
        
        // Transform the data to ensure proper typing
        const transformedCandidates: CandidateWithJob[] = (data || []).map(candidate => ({
          ...candidate,
          first_viewed_by: candidate.first_viewed_by as Record<string, string> | null
        }))
        
        return transformedCandidates
      } else {
        // Non-guest users see all candidates they have access to
        console.log('Non-guest user - fetching all accessible candidates')
        
        const { data, error } = await supabase
          .from('job_candidates')
          .select(`
            *,
            job:jobs!inner (
              id,
              title,
              organization:organizations!inner (
                name
              )
            )
          `)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching candidates:', error)
          throw error
        }

        console.log('Fetched candidates:', data)
        
        // Transform the data to ensure proper typing
        const transformedCandidates: CandidateWithJob[] = (data || []).map(candidate => ({
          ...candidate,
          first_viewed_by: candidate.first_viewed_by as Record<string, string> | null
        }))
        
        return transformedCandidates
      }
    },
    enabled: !!user && canViewCandidates,
  })

  const markCandidateAsViewed = async (candidateId: string) => {
    if (!user) return

    try {
      // Find the candidate in our local data
      const candidate = candidates.find(c => c.id === candidateId)
      if (!candidate) return

      const currentViews = candidate.first_viewed_by || {}
      
      // If user hasn't viewed this candidate yet, add them
      if (!currentViews[user.id]) {
        await supabase
          .from('job_candidates')
          .update({ 
            first_viewed_by: {
              ...currentViews,
              [user.id]: new Date().toISOString()
            }
          })
          .eq('id', candidateId)
      }
    } catch (err) {
      console.error('Error marking candidate as viewed:', err)
    }
  }

  const isCandidateNewForUser = (candidate: CandidateWithJob): boolean => {
    if (!user || !candidate.first_viewed_by) return true
    return !candidate.first_viewed_by[user.id]
  }

  const handleEdit = (candidate: any) => {
    // Navigate to candidate profile for editing
    window.location.href = `/jobs/${candidate.job.id}/candidates/${candidate.id}`
  }

  const handleDelete = async (candidateId: string) => {
    // This would require additional permissions logic
    console.log('Delete candidate:', candidateId)
  }

  const handleAddNew = () => {
    // This would require job selection logic
    console.log('Add new candidate')
  }

  if (error) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-destructive">Error loading candidates</div>
            </div>
          </div>
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 sm:mb-8 lg:mb-12">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {isGuest ? "My Assigned Job Candidates" : "All Candidates"}
                </h1>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                {isGuest ? "View candidates for jobs you are assigned to" : "Manage candidates across all jobs and organizations"}
              </p>
            </div>

            <CandidateTable
              candidates={candidates}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddNew={handleAddNew}
              markCandidateAsViewed={markCandidateAsViewed}
              isCandidateNewForUser={isCandidateNewForUser}
              showJobInfo={true}
            />
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
