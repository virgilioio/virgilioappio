export type DupStatus = 'active' | 'offered' | 'rejected' | 'hired' | 'withdrawn'

export interface DupApplication {
  association_id: string
  job_id: string
  job_title: string
  job_status: string | null
  department: string | null
  location: string | null
  req_id: string
  stage_name: string | null
  status: DupStatus
  last_moved_at: string | null
  owner_initials: string
  owner_name: string | null
  scheduled_interview: { at: string; title: string } | null
  open_offer: { expires_at: string | null; sent_at: string | null } | null
  rejection_reason: string | null
  rejection_notes: string | null
  rejected_at: string | null
  rejected_by_name: string | null
}

export interface DupFlag {
  id: string
  tone: 'warning' | 'info'
  title: string
  body: string
}

export interface DupActivity {
  kind: 'email' | 'calendar' | 'file' | 'scorecard'
  text: string
  actor: string
  at: string
}

export interface DupField {
  key: string
  label: string
  existing: any
  incoming: any
  classification: 'conflict' | 'identical' | 'gap'
}

export interface DuplicateContext {
  candidate: Record<string, any>
  owner: string | null
  source: string | null
  created_at: string
  counts: {
    applications: number
    interviews: number
    scorecards: number
    notes: number
    files: number
    emails: number
  }
  applications: DupApplication[]
  flags: DupFlag[]
  activity: DupActivity[]
  match: { reasons: string[]; band: 'high' | 'medium' | 'low' }
  fields: DupField[]
  skills: { union: string[]; new: string[]; total: number }
  permissions: { can_merge: boolean; ask: string | null }
  viewer: { name: string | null }
}

export type Resolution = 'existing' | 'incoming'
