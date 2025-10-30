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
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Mail, Phone, MapPin, Briefcase, DollarSign, AlertCircle, ArrowRight } from 'lucide-react'

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
  const renderComparisonField = (
    label: string,
    icon: React.ReactNode,
    existingValue: any,
    mergedValue: any
  ) => {
    const isUpdated = mergedValue && mergedValue !== existingValue && String(mergedValue).trim() !== String(existingValue || '').trim()
    const hasValue = (val: any) => val && String(val).trim() !== ''

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 text-virgilio-muted font-poppins font-semibold text-sm">
          {icon}
          {label}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Existing Value */}
          <Card className="border-virgilio-border">
            <CardContent className="p-4">
              {hasValue(existingValue) ? (
                <p className="text-virgilio-text font-medium">{existingValue}</p>
              ) : (
                <p className="text-virgilio-muted italic text-sm">Empty</p>
              )}
            </CardContent>
          </Card>

          {/* Merged Value */}
          <Card className={isUpdated ? "border-2 border-virgilio-purple/30 bg-virgilio-purple/5" : "border-virgilio-border"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                {hasValue(mergedValue) ? (
                  <p className="text-virgilio-text font-semibold">{mergedValue}</p>
                ) : (
                  <p className="text-virgilio-muted italic text-sm">Empty</p>
                )}
                {isUpdated && (
                  <CheckCircle2 className="h-4 w-4 text-virgilio-success shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const existingLocation = [existingCandidate.location_city, existingCandidate.location_country].filter(Boolean).join(', ')
  const mergedLocation = [mergedCandidate.location_city, mergedCandidate.location_country].filter(Boolean).join(', ')
  
  const existingSalary = existingCandidate.salary_amount 
    ? `${existingCandidate.salary_currency} ${existingCandidate.salary_amount}` 
    : ''
  const mergedSalary = mergedCandidate.salary_amount 
    ? `${mergedCandidate.salary_currency} ${mergedCandidate.salary_amount}` 
    : ''

  const newSkillsCount = mergedCandidate.skills?.filter(
    (skill: string) => !existingCandidate.skills?.includes(skill)
  ).length || 0

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-5xl max-h-[85vh] overflow-hidden animate-fade-in">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-h3-mobile md:text-h3-desktop font-poppins font-bold text-virgilio-text">
            <AlertCircle className="text-virgilio-purple h-6 w-6" />
            Duplicate Candidate Detected<span className="text-virgilio-purple">.</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-virgilio-muted text-base">
            A matching candidate already exists in your database. Review the comparison below and merge to keep the most complete information.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-200px)] pr-2 space-y-6">
          {/* Column Headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/50 rounded-lg border border-virgilio-border">
              <h3 className="font-poppins font-semibold text-virgilio-text text-sm">Existing Candidate</h3>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 bg-virgilio-purple/5 rounded-lg border-2 border-virgilio-purple/20">
              <ArrowRight className="h-4 w-4 text-virgilio-purple hidden md:block" />
              <h3 className="font-poppins font-semibold text-virgilio-text text-sm">After Merge</h3>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="font-poppins font-bold text-virgilio-text mb-4 text-base">Contact Information</h4>
            {renderComparisonField(
              'Email',
              <Mail className="h-4 w-4" />,
              existingCandidate.email,
              mergedCandidate.email
            )}
            {renderComparisonField(
              'Phone',
              <Phone className="h-4 w-4" />,
              existingCandidate.phone,
              mergedCandidate.phone
            )}
          </div>

          {/* Location & Professional Details */}
          <div>
            <h4 className="font-poppins font-bold text-virgilio-text mb-4 text-base">Professional Details</h4>
            {renderComparisonField(
              'Location',
              <MapPin className="h-4 w-4" />,
              existingLocation,
              mergedLocation
            )}
            {renderComparisonField(
              'Current Role',
              <Briefcase className="h-4 w-4" />,
              existingCandidate.role_current,
              mergedCandidate.role_current
            )}
            {renderComparisonField(
              'Salary',
              <DollarSign className="h-4 w-4" />,
              existingSalary,
              mergedSalary
            )}
          </div>

          {/* Skills Comparison */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-poppins font-bold text-virgilio-text text-base">Skills</h4>
              {newSkillsCount > 0 && (
                <Badge className="bg-virgilio-purple text-white text-xs">
                  +{newSkillsCount} new
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Existing Skills */}
              <Card className="border-virgilio-border">
                <CardContent className="p-4">
                  <div className="text-xs text-virgilio-muted mb-3 font-medium">
                    {existingCandidate.skills?.length || 0} skills
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {existingCandidate.skills && existingCandidate.skills.length > 0 ? (
                      existingCandidate.skills.map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-virgilio-muted italic text-sm">No skills listed</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Merged Skills */}
              <Card className={newSkillsCount > 0 ? "border-2 border-virgilio-purple/30 bg-virgilio-purple/5" : "border-virgilio-border"}>
                <CardContent className="p-4">
                  <div className="text-xs text-virgilio-muted mb-3 font-medium">
                    {mergedCandidate.skills?.length || 0} skills
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mergedCandidate.skills && mergedCandidate.skills.length > 0 ? (
                      mergedCandidate.skills.map((skill: string) => {
                        const isNew = !existingCandidate.skills?.includes(skill)
                        return (
                          <Badge
                            key={skill}
                            className={isNew ? "bg-virgilio-purple text-white text-xs" : "text-xs"}
                            variant={isNew ? "default" : "secondary"}
                          >
                            {skill}
                            {isNew && <span className="ml-1 text-[10px] opacity-80">NEW</span>}
                          </Badge>
                        )
                      })
                    ) : (
                      <p className="text-virgilio-muted italic text-sm">No skills listed</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="border-virgilio-border text-virgilio-text hover:bg-virgilio-purple/5"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            className="bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-poppins font-semibold shadow-calendly"
          >
            Merge Candidate
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
