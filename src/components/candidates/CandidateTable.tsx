
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, UserPlus, MapPin, DollarSign, FileText, Search } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Candidate } from '@/hooks/useCandidates'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { NewBadge } from '@/components/ui/new-badge'

interface CandidateTableProps {
  candidates: Candidate[]
  isLoading: boolean
  onEdit: (candidate: Candidate) => void
  onDelete: (candidateId: string) => void
  onAddNew: () => void
  markCandidateAsViewed: (candidateId: string) => void
  isCandidateNewForUser: (candidate: Candidate) => boolean
}

export function CandidateTable({ 
  candidates, 
  isLoading, 
  onEdit, 
  onDelete, 
  onAddNew, 
  markCandidateAsViewed,
  isCandidateNewForUser 
}: CandidateTableProps) {
  const { id: jobId } = useParams<{ id: string }>()
  const permissions = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [salaryFilter, setSalaryFilter] = useState<string>('all')

  const handleDelete = (candidateId: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      onDelete(candidateId)
    }
  }

  const handleCandidateClick = (candidate: Candidate) => {
    markCandidateAsViewed(candidate.id)
  }

  const formatLocation = (candidate: Candidate) => {
    const parts = []
    if (candidate.location_city) parts.push(candidate.location_city)
    if (candidate.location_state) parts.push(candidate.location_state)
    if (candidate.location_country) {
      // Use country code abbreviations for common countries
      const countryAbbrev = getCountryAbbreviation(candidate.location_country)
      parts.push(countryAbbrev)
    }
    return parts.length > 0 ? parts.join(', ') : 'Not specified'
  }

  const getCountryAbbreviation = (country: string) => {
    const abbreviations: Record<string, string> = {
      'Mexico': 'MX',
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'UK',
      'Germany': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'Brazil': 'BR',
      'Argentina': 'AR'
    }
    return abbreviations[country] || country
  }

  const formatSalary = (candidate: Candidate) => {
    if (!candidate.salary_amount) return 'Not specified'
    
    const currency = candidate.salary_currency || 'USD'
    const amount = candidate.salary_amount.toLocaleString()
    const period = candidate.salary_period || 'annually'
    
    // Format as currency symbol + amount + period
    const currencySymbol = getCurrencySymbol(currency)
    const periodAbbrev = getPeriodAbbreviation(period)
    
    return `${currencySymbol}${amount} ${currency}${periodAbbrev}`
  }

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'MXN': '$',
      'CAD': '$',
      'AUD': '$'
    }
    return symbols[currency] || '$'
  }

  const getPeriodAbbreviation = (period: string) => {
    const abbreviations: Record<string, string> = {
      'hourly': '/hr',
      'monthly': '/mo',
      'annually': '/yr'
    }
    return abbreviations[period] || '/yr'
  }

  // Filter logic
  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.candidate_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLocation = locationFilter === 'all' || 
      (candidate.location_country && candidate.location_country.toLowerCase().includes(locationFilter.toLowerCase())) ||
      (candidate.location_city && candidate.location_city.toLowerCase().includes(locationFilter.toLowerCase()))
    
    const matchesSalary = salaryFilter === 'all' || 
      (salaryFilter === 'low' && candidate.salary_amount && candidate.salary_amount < 50000) ||
      (salaryFilter === 'medium' && candidate.salary_amount && candidate.salary_amount >= 50000 && candidate.salary_amount < 100000) ||
      (salaryFilter === 'high' && candidate.salary_amount && candidate.salary_amount >= 100000)
    
    return matchesSearch && matchesLocation && matchesSalary
  })

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardHeader>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-md">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[52px] bg-surface-secondary rounded-brand animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="MX">Mexico</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={salaryFilter} onValueChange={setSalaryFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Salary Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranges</SelectItem>
              <SelectItem value="low">Under $50K</SelectItem>
              <SelectItem value="medium">$50K - $100K</SelectItem>
              <SelectItem value="high">$100K+</SelectItem>
            </SelectContent>
          </Select>

          <PermissionGate permission="canManageCandidates">
            <div className="ml-auto">
              <Button onClick={onAddNew} size="sm" className="gap-sm h-[40px]">
                <UserPlus className="h-4 w-4" />
                Add Candidate
              </Button>
            </div>
          </PermissionGate>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-xl bg-surface-secondary rounded-brand border border-border/50">
            <FileText className="h-12 w-12 mx-auto mb-md text-text-secondary opacity-50" />
            <p className="text-md font-medium text-text-primary mb-sm">
              {candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
            </p>
            <p className="text-sm text-text-secondary">
              {candidates.length === 0 ? 'Add your first candidate to this job' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Salary Expectations</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => (
                    <TableRow 
                      key={candidate.id}
                      interactive
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <Link 
                          to={`/jobs/${jobId}/candidates/${candidate.id}`}
                          className="block w-full h-full"
                          onClick={() => handleCandidateClick(candidate)}
                        >
                          <div className="font-medium text-text-primary flex items-center">
                            {candidate.candidate_name}
                            <NewBadge show={isCandidateNewForUser(candidate)} />
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/jobs/${jobId}/candidates/${candidate.id}`}
                          className="block w-full h-full"
                          onClick={() => handleCandidateClick(candidate)}
                        >
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{formatLocation(candidate)}</span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/jobs/${jobId}/candidates/${candidate.id}`}
                          className="block w-full h-full"
                          onClick={() => handleCandidateClick(candidate)}
                        >
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <DollarSign className="h-3 w-3 shrink-0" />
                            <span>{formatSalary(candidate)}</span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/jobs/${jobId}/candidates/${candidate.id}`}
                          className="block w-full h-full"
                          onClick={() => handleCandidateClick(candidate)}
                        >
                          <div className="text-sm text-text-secondary">
                            {new Date(candidate.created_at).toLocaleDateString()}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <PermissionGate permission="canManageCandidates">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDelete(candidate.id)
                              }}
                              className="h-[36px] w-[36px] p-0 text-destructive hover:bg-destructive/10 hover:scale-110 transition-all duration-150"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-sm">
              {filteredCandidates.map((candidate) => (
                <Card key={candidate.id} className="bg-background border-border hover:shadow-sm transition-all duration-150">
                  <CardContent className="p-sm">
                    <Link 
                      to={`/jobs/${jobId}/candidates/${candidate.id}`} 
                      className="block"
                      onClick={() => handleCandidateClick(candidate)}
                    >
                      <div className="space-y-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-text-primary flex items-center">
                              {candidate.candidate_name}
                              <NewBadge show={isCandidateNewForUser(candidate)} />
                            </h4>
                            <div className="flex items-center gap-1 text-sm text-text-secondary mt-1">
                              <MapPin className="h-3 w-3" />
                              {formatLocation(candidate)}
                            </div>
                          </div>
                          <PermissionGate permission="canManageCandidates">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDelete(candidate.id)
                              }}
                              className="h-[40px] w-[40px] p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </div>

                        <div className="flex items-center gap-1 text-sm text-text-secondary">
                          <DollarSign className="h-3 w-3" />
                          {formatSalary(candidate)}
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
