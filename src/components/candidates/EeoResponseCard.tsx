import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, Shield } from 'lucide-react'
import { useCandidateEeoResponse, useCanViewEeo } from '@/hooks/useCandidateEeo'
import {
  EEO_GENDER_OPTIONS,
  EEO_RACE_OPTIONS,
  EEO_VETERAN_OPTIONS,
  EEO_DISABILITY_OPTIONS,
  labelFor,
} from '@/lib/eeo'

interface EeoResponseCardProps {
  candidateId: string | null | undefined
}

/**
 * Renders the candidate's confidential EEO self-identification responses.
 * Only mounted/rendered when the current user is allowed to view EEO data
 * (platform admin, workspace owner, or admin). NEVER use this in the in-job
 * candidate profile — it is restricted to the independent candidate profile.
 */
export function EeoResponseCard({ candidateId }: EeoResponseCardProps) {
  const canView = useCanViewEeo()
  const { data, isLoading } = useCandidateEeoResponse(canView ? candidateId : null)

  if (!canView) return null
  if (isLoading) return null
  // Hide the card entirely when nothing was collected — avoids implying the
  // candidate withheld data when in fact the posting didn't ask.
  if (!data) return null

  const rows: { label: string; value: string }[] = [
    { label: 'Gender', value: labelFor(EEO_GENDER_OPTIONS, data.gender) },
    { label: 'Race / Ethnicity', value: labelFor(EEO_RACE_OPTIONS, data.race_ethnicity) },
    { label: 'Veteran status', value: labelFor(EEO_VETERAN_OPTIONS, data.veteran_status) },
    { label: 'Disability status', value: labelFor(EEO_DISABILITY_OPTIONS, data.disability_status) },
  ]

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle>EEO (Self-Identification)</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1 text-[10.5px] uppercase tracking-wide">
            <Lock className="h-3 w-3" />
            Confidential
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 text-xs text-text-tertiary">
          Voluntary, confidential, and not used in hiring decisions. Visible only to admins and workspace owners.
        </p>
        <dl className="divide-y divide-border">
          {rows.map(row => (
            <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm text-right text-foreground max-w-[60%]">
                {row.value ? (
                  row.value
                ) : (
                  <span className="italic text-text-tertiary">Not collected</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-text-tertiary">
          Submitted {new Date(data.submitted_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  )
}
