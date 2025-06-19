
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Edit, Trash2, UserPlus, MapPin, DollarSign, FileText, MessageCircle, Eye } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Candidate } from '@/hooks/useCandidates'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'

interface CandidateTableProps {
  candidates: Candidate[]
  isLoading: boolean
  onEdit: (candidate: Candidate) => void
  onDelete: (candidateId: string) => void
  onAddNew: () => void
}

export function CandidateTable({ candidates, isLoading, onEdit, onDelete, onAddNew }: CandidateTableProps) {
  const { id: jobId } = useParams<{ id: string }>()
  const permissions = usePermissions()

  const handleDelete = (candidateId: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      onDelete(candidateId)
    }
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

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Candidates</CardTitle>
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-sm text-text-primary">
          Candidates
          <Badge variant="secondary" className="text-xs">
            {candidates.length}
          </Badge>
        </CardTitle>
        <PermissionGate permission="canManageCandidates">
          <Button onClick={onAddNew} size="sm" className="gap-sm h-[40px]">
            <UserPlus className="h-4 w-4" />
            Add Candidate
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <div className="text-center py-xl bg-surface-secondary rounded-brand border border-border/50">
            <FileText className="h-12 w-12 mx-auto mb-md text-text-secondary opacity-50" />
            <p className="text-md font-medium text-text-primary mb-sm">No candidates yet</p>
            <p className="text-sm text-text-secondary">Add your first candidate to this job</p>
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
                  {candidates.map((candidate) => (
                    <TableRow 
                      key={candidate.id}
                      interactive
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <Link 
                          to={`/jobs/${jobId}/candidates/${candidate.id}`}
                          className="block w-full h-full"
                        >
                          <div className="font-medium text-text-primary">
                            {candidate.candidate_name}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/jobs/${jobId}/candidates/${candidate.id}`}
                          className="block w-full h-full"
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
                        >
                          <div className="text-sm text-text-secondary">
                            {new Date(candidate.created_at).toLocaleDateString()}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/jobs/${jobId}/candidates/${candidate.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-[36px] w-[36px] p-0 hover:bg-accent/50 hover:scale-110 transition-all duration-150"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-[36px] w-[36px] p-0 hover:bg-accent/50 hover:scale-110 transition-all duration-150"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>

                          <PermissionGate permission="canManageCandidates">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onEdit(candidate)
                              }}
                              className="h-[36px] w-[36px] p-0 hover:bg-accent/50 hover:scale-110 transition-all duration-150"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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
              {candidates.map((candidate) => (
                <Card key={candidate.id} className="bg-background border-border hover:shadow-sm transition-all duration-150">
                  <CardContent className="p-sm">
                    <Link to={`/jobs/${jobId}/candidates/${candidate.id}`} className="block">
                      <div className="space-y-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-text-primary">{candidate.candidate_name}</h4>
                            <div className="flex items-center gap-1 text-sm text-text-secondary mt-1">
                              <MapPin className="h-3 w-3" />
                              {formatLocation(candidate)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-[40px] w-[40px] p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <PermissionGate permission="canManageCandidates">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onEdit(candidate)
                                }}
                                className="h-[40px] w-[40px] p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </div>
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
