import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Plus, CheckCircle2, Loader2, MapPin, Linkedin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

interface MatchedCandidate {
  id: string
  candidate_name: string
  current_role?: string
  current_company?: string
  location_city?: string
  location_country?: string
  linkedin_url?: string
  match_score: number
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal'
  skills?: string[]
  years_experience?: number
}

interface SourcingCandidateCardProps {
  candidate: MatchedCandidate
  jobId?: string | null
}

export function SourcingCandidateCard({ candidate, jobId }: SourcingCandidateCardProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  
  // Check if candidate is already in pipeline
  useEffect(() => {
    if (!jobId) return
    
    const checkExisting = async () => {
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('id')
        .eq('job_id', jobId)
        .eq('candidate_id', candidate.id)
        .maybeSingle()
      
      setIsAdded(!!data)
    }
    
    checkExisting()
  }, [jobId, candidate.id])
  
  const handleAddToPipeline = async () => {
    if (!jobId) {
      toast({
        title: 'No job linked',
        description: 'This project is not linked to a job yet.',
        variant: 'destructive'
      })
      return
    }
    
    setIsAdding(true)
    try {
      const { error } = await supabase
        .from('job_candidate_associations')
        .insert({
          job_id: jobId,
          candidate_id: candidate.id,
          stage: 'sourced'
        })
      
      if (error) throw error
      
      setIsAdded(true)
      toast({
        title: 'Added to pipeline',
        description: `${candidate.candidate_name} has been added.`
      })
    } catch (error: any) {
      toast({
        title: 'Failed to add candidate',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsAdding(false)
    }
  }
  
  const getMatchTierColor = (tier: string) => {
    switch (tier) {
      case 'excellent': return 'bg-success/20 text-success-foreground border-success/30'
      case 'good': return 'bg-info/20 text-info-foreground border-info/30'
      case 'fair': return 'bg-muted text-muted-foreground border-border'
      case 'minimal': return 'bg-muted text-muted-foreground border-border'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }
  
  return (
    <Card className="hover:shadow-lg transition-shadow group">
      <CardContent className="p-4 space-y-3">
        {/* Header: Avatar + Name + LinkedIn */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-accent/20 text-accent-foreground font-semibold">
              {candidate.candidate_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm truncate text-foreground">
                {candidate.candidate_name}
              </h3>
              {candidate.linkedin_url && (
                <a 
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
            </div>
            
            {/* Current Role */}
            {candidate.current_role && (
              <p className="text-xs text-muted-foreground truncate">
                {candidate.current_role}
                {candidate.current_company && ` @ ${candidate.current_company}`}
              </p>
            )}
            
            {/* Location */}
            {candidate.location_city && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {candidate.location_city}, {candidate.location_country}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Match Score Badge */}
        <div>
          <Badge 
            variant="outline" 
            className={cn("text-xs", getMatchTierColor(candidate.match_tier))}
          >
            {candidate.match_score}% Match • {candidate.match_tier}
          </Badge>
        </div>
        
        {/* Skills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {candidate.skills.slice(0, 5).map(skill => (
              <Badge 
                key={skill} 
                variant="secondary" 
                className="text-xs px-2 py-0.5 bg-accent/10 text-accent-foreground border-accent/20"
              >
                {skill}
              </Badge>
            ))}
            {candidate.skills.length > 5 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                +{candidate.skills.length - 5}
              </Badge>
            )}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button 
            size="sm" 
            variant="outline"
            className="flex-1"
            onClick={() => navigate(`/candidates/${candidate.id}`)}
          >
            <Eye className="h-3 w-3 mr-1" />
            View Profile
          </Button>
          
          {isAdded ? (
            <Button 
              size="sm" 
              variant="secondary"
              className="flex-1"
              disabled
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Added
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="default"
              className="flex-1"
              onClick={handleAddToPipeline}
              disabled={isAdding || !jobId}
            >
              {isAdding ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Add to Pipeline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
