
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, MapPin, DollarSign, Calendar, Briefcase } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGate } from '@/components/auth/PermissionGate'

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
  const [searchTerm, setSearchTerm] = useState('')

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
        return data as CandidateWithJob[]
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
        return data as CandidateWithJob[]
      }
    },
    enabled: !!user && canViewCandidates,
  })

  const filteredCandidates = candidates.filter(candidate =>
    candidate.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.job.organization.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatLocation = (country: string | null, state: string | null, city: string | null) => {
    const parts = [city, state, country].filter(Boolean)
    return parts.join(', ') || 'Not specified'
  }

  const formatSalary = (amount: number | null, currency: string | null, period: string | null) => {
    if (!amount) return 'Not specified'
    return `${currency || 'USD'} ${amount.toLocaleString()}${period ? `/${period}` : ''}`
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading candidates...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Error loading candidates</div>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate permission="canViewCandidates">
      <div className="container mx-auto px-4 py-8">
        <PageHeader 
          title={isGuest ? "My Assigned Job Candidates" : "All Candidates"}
          subtitle={isGuest ? "View candidates for jobs you are assigned to" : "Manage candidates across all jobs and organizations"}
        />

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search candidates, jobs, or organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate Name</TableHead>
                <TableHead>Job & Organization</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Salary Expectations</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-gray-500">
                      {searchTerm 
                        ? 'No candidates found matching your search.' 
                        : isGuest 
                          ? 'No candidates found for your assigned jobs.'
                          : 'No candidates found.'
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCandidates.map((candidate) => (
                  <TableRow key={candidate.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {candidate.candidate_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-gray-500" />
                        <div>
                          <Link 
                            to={`/jobs/${candidate.job.id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {candidate.job.title}
                          </Link>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-sm text-gray-500">at</span>
                            <Badge variant="outline" className="text-xs">
                              {candidate.job.organization.name}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {formatLocation(candidate.location_country, candidate.location_state, candidate.location_city)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {formatSalary(candidate.salary_amount, candidate.salary_currency, candidate.salary_period)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(candidate.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/jobs/${candidate.job.id}/candidates/${candidate.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PermissionGate>
  )
}
