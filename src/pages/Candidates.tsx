
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  const { user } = useAuth()
  const { canViewCandidates } = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')

  const { data: candidates = [], isLoading, error } = useQuery({
    queryKey: ['global-candidates'],
    queryFn: async () => {
      console.log('Fetching all candidates for global view')
      
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
          title="All Candidates" 
          description="Manage candidates across all jobs and organizations"
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

        <div className="grid gap-4">
          {filteredCandidates.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-gray-500">
                  {searchTerm ? 'No candidates found matching your search.' : 'No candidates found.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCandidates.map((candidate) => (
              <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{candidate.candidate_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Briefcase className="h-4 w-4 text-gray-500" />
                        <Link 
                          to={`/jobs/${candidate.job.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {candidate.job.title}
                        </Link>
                        <span className="text-sm text-gray-500">at</span>
                        <Badge variant="outline" className="text-xs">
                          {candidate.job.organization.name}
                        </Badge>
                      </div>
                    </div>
                    <Link to={`/jobs/${candidate.job.id}/candidates/${candidate.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {candidate.profile_summary && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {candidate.profile_summary}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        {formatLocation(candidate.location_country, candidate.location_state, candidate.location_city)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        {formatSalary(candidate.salary_amount, candidate.salary_currency, candidate.salary_period)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Added {new Date(candidate.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PermissionGate>
  )
}
