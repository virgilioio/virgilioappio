import React from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Mail, Phone, MapPin, Briefcase, DollarSign } from 'lucide-react'

interface CandidateMergeDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  existingCandidate: any
  newCandidate: any
  mergedCandidate: any
}

export function CandidateMergeDialog({
  isOpen,
  onConfirm,
  onCancel,
  existingCandidate,
  newCandidate,
  mergedCandidate
}: CandidateMergeDialogProps) {
  const renderField = (label: string, existing: any, incoming: any, merged: any, icon: React.ReactNode) => {
    const isUpdated = merged !== existing && merged === incoming
    
    return (
      <div className="grid grid-cols-3 gap-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-sm">
          {existing || <span className="text-muted-foreground italic">Empty</span>}
        </div>
        <div className="text-sm font-medium flex items-center gap-2">
          {merged || <span className="text-muted-foreground italic">Empty</span>}
          {isUpdated && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        </div>
      </div>
    )
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-yellow-500" />
            Duplicate Candidate Detected
          </AlertDialogTitle>
          <AlertDialogDescription>
            A candidate with the same name and email already exists. We'll merge the information and keep the most complete data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 py-2 bg-muted/50 rounded-lg px-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Field</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">Existing</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">After Merge</div>
          </div>

          {renderField('Email', existingCandidate.email, newCandidate.email, mergedCandidate.email, <Mail className="h-4 w-4" />)}
          {renderField('Phone', existingCandidate.phone, newCandidate.phone, mergedCandidate.phone, <Phone className="h-4 w-4" />)}
          {renderField('Location', 
            [existingCandidate.location_city, existingCandidate.location_country].filter(Boolean).join(', '),
            [newCandidate.location_city, newCandidate.location_country].filter(Boolean).join(', '),
            [mergedCandidate.location_city, mergedCandidate.location_country].filter(Boolean).join(', '),
            <MapPin className="h-4 w-4" />
          )}
          {renderField('Current Role', existingCandidate.role_current, newCandidate.role_current, mergedCandidate.role_current, <Briefcase className="h-4 w-4" />)}
          {renderField('Salary', 
            existingCandidate.salary_amount ? `${existingCandidate.salary_currency} ${existingCandidate.salary_amount}` : null,
            newCandidate.salary_amount ? `${newCandidate.salary_currency} ${newCandidate.salary_amount}` : null,
            mergedCandidate.salary_amount ? `${mergedCandidate.salary_currency} ${mergedCandidate.salary_amount}` : null,
            <DollarSign className="h-4 w-4" />
          )}

          {/* Skills comparison */}
          <div className="space-y-2 pt-4">
            <div className="text-sm font-medium">Skills</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-2">Existing ({existingCandidate.skills?.length || 0})</div>
                <div className="flex flex-wrap gap-1">
                  {existingCandidate.skills?.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  )) || <span className="text-sm text-muted-foreground italic">None</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">After Merge ({mergedCandidate.skills?.length || 0})</div>
                <div className="flex flex-wrap gap-1">
                  {mergedCandidate.skills?.map((skill: string) => (
                    <Badge 
                      key={skill} 
                      variant={existingCandidate.skills?.includes(skill) ? "secondary" : "default"}
                      className="text-xs"
                    >
                      {skill}
                      {!existingCandidate.skills?.includes(skill) && <CheckCircle2 className="ml-1 h-3 w-3" />}
                    </Badge>
                  )) || <span className="text-sm text-muted-foreground italic">None</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>
            Merge
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
