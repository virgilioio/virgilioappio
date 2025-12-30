import { supabase } from '@/lib/supabaseClient'
import { withAuthRetry } from '@/lib/authUtils'
import { log } from '@/lib/logger'

export interface ContactEmail {
  type: 'work' | 'personal' | 'other'
  email: string
  status?: string | null
}

export interface ContactPhone {
  type: 'work' | 'mobile' | 'other'
  number: string
  raw_number?: string | null
}

export interface CandidateData {
  candidate_name: string
  email?: string | null
  phone?: string | null
  contact_emails?: ContactEmail[] | null
  contact_phones?: ContactPhone[] | null
  location_country?: string | null
  location_state?: string | null
  location_city?: string | null
  salary_amount?: number | null
  salary_currency?: string | null
  salary_period?: string | null
  profile_summary?: string | null
  linkedin_url?: string | null
  resume_url?: string | null
  skills?: string[] | null
  status?: string
  source?: string
  organization_id: string
  created_by: string
}

export interface ExistingCandidate {
  id: string
  candidate_name: string
  email: string | null
  linkedin_url: string | null
  [key: string]: any
}

export interface DuplicateCheckResult {
  isDuplicate: true
  existingCandidate: ExistingCandidate
  incomingData: Partial<CandidateData>
  mergedData: any
}

/**
 * Smart merge helper - prioritizes more complete information
 */
export const smartMerge = (existing: any, incoming: any): any => {
  const merged = { ...existing }
  
  Object.keys(incoming).forEach(key => {
    const existingValue = existing[key]
    const incomingValue = incoming[key]
    
    // Skip undefined or null incoming values
    if (incomingValue === undefined || incomingValue === null) return
    
    // If existing is null/empty, use incoming
    if (!existingValue || existingValue === '') {
      merged[key] = incomingValue
    } 
    // For arrays (like skills), merge and deduplicate
    else if (Array.isArray(incomingValue) && Array.isArray(existingValue)) {
      merged[key] = [...new Set([...existingValue, ...incomingValue])]
    }
    // For strings, prefer the longer value (more detail)
    else if (typeof incomingValue === 'string' && typeof existingValue === 'string') {
      if (incomingValue.length > existingValue.length) {
        merged[key] = incomingValue
      }
    }
    // For numbers, prefer the incoming value if it's greater
    else if (typeof incomingValue === 'number' && typeof existingValue === 'number') {
      if (incomingValue > existingValue) {
        merged[key] = incomingValue
      }
    }
    // For any other case, prefer incoming value if existing is falsy
    else if (!existingValue) {
      merged[key] = incomingValue
    }
  })
  
  return merged
}

/**
 * Check for duplicate candidates and return merge info if found
 */
export async function checkForDuplicateCandidate(
  candidateData: Partial<CandidateData>,
  organizationId: string
): Promise<DuplicateCheckResult | null> {
  log.debug('Checking for duplicate candidate:', { email: candidateData.email, name: candidateData.candidate_name })

  if (!candidateData.email && !candidateData.candidate_name) {
    return null
  }

  const duplicateQuery = candidateData.email 
    ? async () => await supabase.from('candidates').select('*')
        .eq('email', candidateData.email!)
        .eq('organization_id', organizationId)
        .limit(1)
    : async () => await supabase.from('candidates').select('*')
        .eq('candidate_name', candidateData.candidate_name!)
        .eq('organization_id', organizationId)
        .is('email', null)
        .limit(1)
  
  const result = await withAuthRetry(duplicateQuery)

  if (result.error) {
    log.error('Error checking for duplicates:', result.error)
    return null
  }
  
  if (result.data && result.data.length > 0) {
    const existingCandidate = result.data[0] as ExistingCandidate
    const mergedData = smartMerge(existingCandidate, candidateData)
    
    log.debug('Duplicate candidate found:', existingCandidate.id)
    return {
      isDuplicate: true,
      existingCandidate,
      incomingData: candidateData,
      mergedData
    }
  }

  return null
}

/**
 * Create a new candidate in the database
 */
export async function createCandidate(candidateData: CandidateData) {
  log.debug('Creating new candidate:', candidateData.candidate_name)

  // Fetch tenant_id from organization_id for defense-in-depth
  let tenantId: string | null = null
  if (candidateData.organization_id) {
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('tenant_id')
      .eq('id', candidateData.organization_id)
      .single()
    
    if (!orgError && orgData) {
      tenantId = orgData.tenant_id
    }
  }

  const { data: newCandidate, error: createError } = await withAuthRetry(async () =>
    await supabase
      .from('candidates')
      .insert([{
        candidate_name: candidateData.candidate_name,
        email: candidateData.email,
        phone: candidateData.phone,
        contact_emails: candidateData.contact_emails?.map(e => JSON.stringify(e)) || [],
        contact_phones: candidateData.contact_phones?.map(p => JSON.stringify(p)) || [],
        location_country: candidateData.location_country,
        location_state: candidateData.location_state,
        location_city: candidateData.location_city,
        salary_amount: candidateData.salary_amount,
        salary_currency: candidateData.salary_currency,
        salary_period: candidateData.salary_period,
        profile_summary: candidateData.profile_summary,
        linkedin_url: candidateData.linkedin_url,
        resume_url: candidateData.resume_url,
        skills: candidateData.skills,
        status: candidateData.status || 'available',
        source: candidateData.source || 'direct',
        created_by: candidateData.created_by,
        organization_id: candidateData.organization_id,
        tenant_id: tenantId,
      }])
      .select()
      .single()
  )

  if (createError) {
    log.error('Error creating candidate:', createError)
    
    // Provide more helpful error messages for RLS violations
    if (createError.code === '42501') {
      throw new Error('Permission denied: You do not have the required permissions to create candidates in this organization. Please verify you are an active recruiter or admin.')
    }
    
    throw createError
  }

  log.debug('Created candidate:', newCandidate.id)
  return newCandidate
}

/**
 * Merge candidate data into an existing candidate
 */
export async function mergeCandidate(existingCandidateId: string, candidateData: Partial<CandidateData>) {
  log.debug('Merging candidate data:', { candidateId: existingCandidateId })

  const { data: existingCandidate, error: fetchError } = await withAuthRetry(async () =>
    await supabase
      .from('candidates')
      .select('*')
      .eq('id', existingCandidateId)
      .single()
  )

  if (fetchError || !existingCandidate) {
    log.error('Error fetching existing candidate:', fetchError)
    throw fetchError || new Error('Existing candidate not found')
  }

  const mergedData = smartMerge(existingCandidate, candidateData)
  
  // Remove fields that shouldn't be updated or don't exist in candidates table
  const { 
    id, 
    created_at, 
    created_by, 
    // Form-only fields that don't exist in candidates table
    assignedJobId,
    assignedStageId,
    job_id,
    notes,
    ...updateFields 
  } = mergedData

  const { data: updatedCandidate, error: updateError } = await withAuthRetry(async () =>
    await supabase
      .from('candidates')
      .update(updateFields)
      .eq('id', existingCandidateId)
      .select()
      .single()
  )

  if (updateError) {
    log.error('Error merging candidate:', updateError)
    throw updateError
  }

  log.debug('Merged candidate:', updatedCandidate.id)
  return updatedCandidate
}

/**
 * Create a job-candidate association
 */
export async function createJobAssociation(
  jobId: string,
  candidateId: string,
  notes?: string | null,
  stageId?: string | null,
  status: 'active' | 'rejected' | 'hired' | 'offer' = 'active',
  addedBy?: string
) {
  log.debug('Creating job association:', { jobId, candidateId })

  const { error: assocError } = await withAuthRetry(async () =>
    await supabase
      .from('job_candidate_associations')
      .insert([{
        job_id: jobId,
        candidate_id: candidateId,
        notes: notes || null,
        current_stage_id: stageId || null,
        status,
        added_by: addedBy
      }])
  )

  if (assocError) {
    log.error('Error creating job association:', assocError)
    throw assocError
  }

  log.debug('Created job association')
}
