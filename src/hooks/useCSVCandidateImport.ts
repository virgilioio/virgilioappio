import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { toast } from '@/hooks/use-toast'
import { CandidateField } from '@/lib/csvParser'

export interface ImportProgress {
  total: number
  processed: number
  created: number
  duplicates: number
  errors: number
  isRunning: boolean
}

const BATCH_SIZE = 50

export function useCSVCandidateImport() {
  const { user, organizationId } = useAuth()
  const { tenant } = useTenant()
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0, processed: 0, created: 0, duplicates: 0, errors: 0, isRunning: false,
  })
  const abortRef = useRef(false)

  const importRows = useCallback(async (
    rows: string[][],
    mapping: Record<number, CandidateField>,
  ) => {
    if (!user || !organizationId || !tenant?.id) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' })
      return
    }

    abortRef.current = false

    // Build mapped rows
    const mappedRows = rows.map(row => {
      const candidate: Record<string, any> = {}
      Object.entries(mapping).forEach(([colIndexStr, field]) => {
        if (field === '__skip__') return
        const colIndex = parseInt(colIndexStr, 10)
        const value = row[colIndex]?.trim()
        if (!value) return

        if (field === 'skills') {
          candidate[field] = value.split(',').map(s => s.trim()).filter(Boolean)
        } else {
          candidate[field] = value
        }
      })
      return candidate
    }).filter(c => c.candidate_name) // Name is required

    setProgress({
      total: mappedRows.length, processed: 0, created: 0, duplicates: 0, errors: 0, isRunning: true,
    })

    let created = 0
    let duplicates = 0
    let errors = 0

    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      if (abortRef.current) break

      const batch = mappedRows.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (candidate) => {
          // Check for duplicate by email
          if (candidate.email) {
            const { data: existing } = await supabase
              .from('candidates')
              .select('id')
              .eq('email', candidate.email)
              .eq('organization_id', organizationId)
              .is('deleted_at', null)
              .maybeSingle()

            if (existing) {
              return 'duplicate'
            }
          }

          // Insert candidate
          const insertData = {
            candidate_name: candidate.candidate_name as string,
            email: candidate.email || null,
            phone: candidate.phone || null,
            linkedin_url: candidate.linkedin_url || null,
            resume_url: candidate.resume_url || null,
            location_city: candidate.location_city || null,
            location_state: candidate.location_state || null,
            location_country: candidate.location_country || null,
            profile_summary: candidate.profile_summary || null,
            skills: candidate.skills || null,
            organization_id: organizationId,
            tenant_id: tenant.id,
            created_by: user.id,
            source: (candidate.source as string) || 'csv_import',
            status: 'new',
            enrichment_status: candidate.resume_url ? 'pending' : null,
          }

          const { error } = await supabase
            .from('candidates')
            .insert(insertData)

          if (error) throw error
          return 'created'
        })
      )

      results.forEach(r => {
        if (r.status === 'fulfilled') {
          if (r.value === 'created') created++
          else if (r.value === 'duplicate') duplicates++
        } else {
          errors++
        }
      })

      setProgress(prev => ({
        ...prev,
        processed: Math.min(i + BATCH_SIZE, mappedRows.length),
        created,
        duplicates,
        errors,
      }))

      // Small delay between batches
      if (i + BATCH_SIZE < mappedRows.length) {
        await new Promise(r => setTimeout(r, 100))
      }
    }

    setProgress(prev => ({ ...prev, isRunning: false }))

    toast({
      title: 'CSV Import Complete',
      description: `${created} created, ${duplicates} duplicates skipped, ${errors} errors`,
    })

    return { created, duplicates, errors }
  }, [user, organizationId, tenant])

  const abort = useCallback(() => {
    abortRef.current = true
  }, [])

  const reset = useCallback(() => {
    setProgress({ total: 0, processed: 0, created: 0, duplicates: 0, errors: 0, isRunning: false })
  }, [])

  return { progress, importRows, abort, reset }
}
