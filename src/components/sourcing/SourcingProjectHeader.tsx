import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  Edit2, MoreHorizontal, RefreshCw, Archive, Trash2, 
  MapPin, DollarSign, Target, Award, Coins, Loader2 
} from 'lucide-react'
import { useCoresignalUsage } from '@/hooks/useCoresignalUsage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SourcingProject, SourcingProjectFilters, SearchCriteria } from '@/types/sourcing'
import { EditableSearchCriteria } from './EditableSearchCriteria'
import { cn } from '@/lib/utils'

interface SourcingProjectHeaderProps {
  project: SourcingProject
  breakdown: {
    excellent: number
    good: number
    fair: number
    minimal: number
    localCandidates?: number
    coreSignalCandidates?: number
    creditsUsed?: number
    collectCreditsUsed?: number
  }
  onRefresh: () => void
  onArchive: () => void
  onDelete: () => void
  onNameUpdate: (name: string) => void
}

export function SourcingProjectHeader({
  project,
  breakdown,
  onRefresh,
  onArchive,
  onDelete,
  onNameUpdate
}: SourcingProjectHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(project.name)
  const { data: usage } = useCoresignalUsage()

  const handleSaveName = () => {
    if (editedName.trim()) {
      onNameUpdate(editedName)
      setIsEditingName(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Project Name & Actions */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input 
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="max-w-md"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveName}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-h3-mobile sm:text-h3-desktop font-poppins font-bold text-foreground tracking-page-title">
                {project.name}<span className="text-purple-period">.</span>
              </h1>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0"
                onClick={() => {
                  setEditedName(project.name)
                  setIsEditingName(true)
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
            {project.last_search_at && (
              <span className="text-sm text-muted-foreground">
                Last updated {formatDistanceToNow(new Date(project.last_search_at))} ago
              </span>
            )}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Results
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {project.status === 'active' ? 'Archive' : 'Unarchive'} Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Match Breakdown & Stats */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Match Quality */}
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Matches:</span>
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30">
            {breakdown.excellent} Excellent
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30 hover:bg-blue-500/30">
            {breakdown.good} Good
          </Badge>
          <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/30">
            {breakdown.fair} Fair
          </Badge>
          <Badge variant="secondary">
            {breakdown.minimal} Minimal
          </Badge>
        </div>

        {/* Source Breakdown */}
        {(breakdown.localCandidates !== undefined || breakdown.coreSignalCandidates !== undefined) && (
          <>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sources:</span>
              {breakdown.localCandidates !== undefined && (
                <Badge variant="default" className="text-xs">
                  {breakdown.localCandidates} Local
                </Badge>
              )}
              {breakdown.coreSignalCandidates !== undefined && breakdown.coreSignalCandidates > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {breakdown.coreSignalCandidates} CoreSignal
                </Badge>
              )}
            </div>
          </>
        )}

        {/* Credit Usage */}
        {usage && (breakdown.creditsUsed !== undefined || breakdown.collectCreditsUsed !== undefined) && (
          <>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {usage.search_credits_used}/{usage.search_credits_limit} search, {usage.collect_credits_used}/{usage.collect_credits_limit} collect
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
