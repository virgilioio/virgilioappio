export type HealthStatus = 'healthy' | 'at-risk' | 'churn-risk' | 'inactive'

export interface HealthReason {
  passed: boolean
  label: string
  detail: string
}

export interface CustomerHealthResult {
  status: HealthStatus
  reasons: HealthReason[]
  recommendation: string
}

interface CustomerMetrics {
  status: string
  last_active_at: string | null
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
}

export function calculateCustomerHealth(metrics: CustomerMetrics): CustomerHealthResult {
  const reasons: HealthReason[] = []
  
  // Check if suspended
  if (metrics.status === 'suspended') {
    return {
      status: 'inactive',
      reasons: [{
        passed: false,
        label: 'Account Status',
        detail: 'Account is suspended'
      }],
      recommendation: 'Review suspension reason and contact customer if appropriate.'
    }
  }

  // Calculate days since last activity
  const daysSinceActive = metrics.last_active_at 
    ? (Date.now() - new Date(metrics.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999

  // Activity check
  if (daysSinceActive <= 7) {
    reasons.push({
      passed: true,
      label: 'Recent Activity',
      detail: 'Active within the last 7 days'
    })
  } else if (daysSinceActive <= 14) {
    reasons.push({
      passed: true,
      label: 'Recent Activity',
      detail: `Last active ${Math.round(daysSinceActive)} days ago`
    })
  } else if (daysSinceActive <= 30) {
    reasons.push({
      passed: false,
      label: 'Declining Activity',
      detail: `Last active ${Math.round(daysSinceActive)} days ago`
    })
  } else {
    reasons.push({
      passed: false,
      label: 'No Recent Activity',
      detail: metrics.last_active_at ? `Last active over 30 days ago` : 'No activity recorded'
    })
  }

  // Jobs created check
  if (metrics.jobs_created_30d >= 2) {
    reasons.push({
      passed: true,
      label: 'Jobs Created',
      detail: `${metrics.jobs_created_30d} jobs created in last 30 days`
    })
  } else if (metrics.jobs_created_30d === 1) {
    reasons.push({
      passed: true,
      label: 'Jobs Created',
      detail: '1 job created in last 30 days'
    })
  } else {
    reasons.push({
      passed: false,
      label: 'No Jobs Created',
      detail: 'No jobs created in last 30 days'
    })
  }

  // Candidates added check
  if (metrics.candidates_added_30d >= 5) {
    reasons.push({
      passed: true,
      label: 'Candidates Added',
      detail: `${metrics.candidates_added_30d} candidates added in last 30 days`
    })
  } else if (metrics.candidates_added_30d > 0) {
    reasons.push({
      passed: true,
      label: 'Candidates Added',
      detail: `${metrics.candidates_added_30d} candidate${metrics.candidates_added_30d > 1 ? 's' : ''} added in last 30 days`
    })
  } else {
    reasons.push({
      passed: false,
      label: 'No Candidates Added',
      detail: 'No candidates added in last 30 days'
    })
  }

  // Active members check
  if (metrics.members_active_count >= 2) {
    reasons.push({
      passed: true,
      label: 'Team Size',
      detail: `${metrics.members_active_count} active team members`
    })
  } else if (metrics.members_active_count === 1) {
    reasons.push({
      passed: true,
      label: 'Team Size',
      detail: '1 active team member'
    })
  } else {
    reasons.push({
      passed: false,
      label: 'No Active Members',
      detail: 'No active team members'
    })
  }

  // Determine overall health status
  const passedCount = reasons.filter(r => r.passed).length
  const hasUsage = metrics.jobs_created_30d > 0 || metrics.candidates_added_30d > 0

  let status: HealthStatus
  let recommendation: string

  if (daysSinceActive > 30) {
    status = 'churn-risk'
    recommendation = 'Immediate outreach recommended. Customer has not been active for over 30 days.'
  } else if (daysSinceActive > 14 || !hasUsage) {
    status = 'at-risk'
    recommendation = 'Schedule a check-in call to understand blockers and provide support.'
  } else if (passedCount >= 3) {
    status = 'healthy'
    recommendation = 'Customer is actively engaged. Consider upsell opportunities.'
  } else {
    status = 'at-risk'
    recommendation = 'Monitor engagement and offer onboarding support if needed.'
  }

  return { status, reasons, recommendation }
}
