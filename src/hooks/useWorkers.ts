import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Worker {
  id: string
  organization_id: string
  full_name: string
  legal_first_name?: string
  legal_last_name?: string
  citizenship?: string
  personal_email?: string
  work_email?: string
  personal_phone?: string
  worker_status: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending'
  worker_type: 'employee' | 'contractor'
  worker_id?: number
  job_title?: string
  seniority_level?: 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp' | 'c_level'
  contract_type?: 'permanent' | 'temporary' | 'freelance'
  employment_term?: 'full_time' | 'part_time' | 'temporary' | 'internship'
  contract_status?: 'active' | 'pending' | 'expired' | 'terminated' | 'suspended'
  country?: string
  working_location?: string
  scope_of_work?: string
  currency?: string
  base_salary?: number
  payment_period?: 'annual' | 'monthly' | 'semimonthly' | 'biweekly' | 'weekly' | 'daily' | 'hourly'
  employment_terms?: 'indefinite' | 'definite'
  entity?: string
  events?: any
  manager_id?: string
  reports?: any[]
  state_province?: string
  worker_entity_type?: 'business_entity' | 'individual' | 'not_specified'
  start_date?: string
  end_date?: string
  payment_frequency?: 'bi_monthly' | 'monthly' | 'custom'
  custom_pay_dates?: number[]
  next_payment_date?: string
  contractor_payment_type?: 'fixed_rate' | 'hourly_rate' | 'per_project'
  hourly_rate?: number
  monthly_fixed_amount?: number
  project_details?: string
  department?: string
  roles_department?: string
  created_by?: string
  created_at: string
  updated_at: string
  organization_name?: string
  manager_name?: string
}

export interface CreateWorkerData {
  organization_id: string
  full_name: string
  legal_first_name?: string
  legal_last_name?: string
  citizenship?: string
  personal_email?: string
  work_email?: string
  personal_phone?: string
  worker_status?: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending'
  worker_type: 'employee' | 'contractor'
  worker_id?: number
  job_title?: string
  seniority_level?: 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp' | 'c_level'
  contract_type?: 'permanent' | 'temporary' | 'freelance'
  employment_term?: 'full_time' | 'part_time' | 'temporary' | 'internship'
  contract_status?: 'active' | 'pending' | 'expired' | 'terminated' | 'suspended'
  country?: string
  working_location?: string
  scope_of_work?: string
  currency?: string
  base_salary?: number
  payment_period?: 'annual' | 'monthly' | 'semimonthly' | 'biweekly' | 'weekly' | 'daily' | 'hourly'
  employment_terms?: 'indefinite' | 'definite'
  entity?: string
  events?: any
  manager_id?: string
  reports?: any[]
  state_province?: string
  worker_entity_type?: 'business_entity' | 'individual' | 'not_specified'
  start_date?: string
  end_date?: string
  payment_frequency?: 'bi_monthly' | 'monthly' | 'custom'
  custom_pay_dates?: number[]
  next_payment_date?: string
  contractor_payment_type?: 'fixed_rate' | 'hourly_rate' | 'per_project'
  hourly_rate?: number
  monthly_fixed_amount?: number
  project_details?: string
  department?: string
  roles_department?: string
}

export interface UpdateWorkerData {
  full_name?: string
  legal_first_name?: string
  legal_last_name?: string
  citizenship?: string
  personal_email?: string
  work_email?: string
  personal_phone?: string
  worker_status?: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending'
  worker_type?: 'employee' | 'contractor'
  worker_id?: number
  job_title?: string
  seniority_level?: 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp' | 'c_level'
  contract_type?: 'permanent' | 'temporary' | 'freelance'
  employment_term?: 'full_time' | 'part_time' | 'temporary' | 'internship'
  contract_status?: 'active' | 'pending' | 'expired' | 'terminated' | 'suspended'
  country?: string
  working_location?: string
  scope_of_work?: string
  currency?: string
  base_salary?: number
  payment_period?: 'annual' | 'monthly' | 'semimonthly' | 'biweekly' | 'weekly' | 'daily' | 'hourly'
  employment_terms?: 'indefinite' | 'definite'
  entity?: string
  events?: any
  manager_id?: string
  reports?: any[]
  state_province?: string
  worker_entity_type?: 'business_entity' | 'individual' | 'not_specified'
  start_date?: string
  end_date?: string
  payment_frequency?: 'bi_monthly' | 'monthly' | 'custom'
  custom_pay_dates?: number[]
  next_payment_date?: string
  contractor_payment_type?: 'fixed_rate' | 'hourly_rate' | 'per_project'
  hourly_rate?: number
  monthly_fixed_amount?: number
  project_details?: string
  department?: string
  roles_department?: string
}

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getWorkers = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching workers for user:', user.id)
      
      // Use type casting since workers table is not yet in types
      const { data: workersData, error: workersError } = await supabase
        .from('workers' as any)
        .select('*')
        .order('created_at', { ascending: false })

      if (workersError) {
        console.error('Error fetching workers:', workersError)
        if (workersError.message.includes('row-level security')) {
          console.warn('RLS policy blocked access - user may not have permission to view workers')
          setWorkers([])
          return
        }
        throw workersError
      }

      console.log('Fetched workers:', workersData)

      if (!workersData || workersData.length === 0) {
        console.log('No workers found')
        setWorkers([])
        return
      }

      // Get organization names
      const orgIds = [...new Set(workersData.map((w: any) => w.organization_id).filter(Boolean))]
      let organizationsMap: Record<string, string> = {}
      
      if (orgIds.length > 0) {
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds)
        
        if (orgsData) {
          organizationsMap = Object.fromEntries(orgsData.map(org => [org.id, org.name]))
        }
      }

      // Get manager names
      const managerIds = [...new Set(workersData.map((w: any) => w.manager_id).filter(Boolean))]
      let managersMap: Record<string, string> = {}
      
      if (managerIds.length > 0) {
        const { data: managersData } = await supabase
          .from('workers' as any)
          .select('id, full_name')
          .in('id', managerIds)
        
        if (managersData) {
          managersMap = Object.fromEntries(managersData.map((manager: any) => [manager.id, manager.full_name]))
        }
      }

      const workersWithDetails = workersData.map((worker: any) => {
        const typedWorker: Worker = {
          ...worker,
          worker_status: worker.worker_status as Worker['worker_status'],
          worker_type: worker.worker_type as Worker['worker_type'],
          contract_type: worker.contract_type as Worker['contract_type'],
          contract_status: worker.contract_status as Worker['contract_status'],
          worker_entity_type: worker.worker_entity_type as Worker['worker_entity_type'],
          organization_name: organizationsMap[worker.organization_id] || null,
          manager_name: worker.manager_id ? managersMap[worker.manager_id] : null
        }
        
        return typedWorker
      })

      console.log('Final workers with details:', workersWithDetails)
      setWorkers(workersWithDetails)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workers'
      console.error('Workers fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createWorker = async (data: CreateWorkerData) => {
    if (!user) throw new Error('User not authenticated')
    
    if (!data.organization_id) {
      throw new Error('Organization is required for worker creation')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating worker with organization_id:', data.organization_id, 'Full data:', data)
      
      const workerData = {
        ...data,
        created_by: user.id
      }

      console.log('Inserting worker data:', workerData)

      const { data: newWorker, error: createError } = await supabase
        .from('workers' as any)
        .insert([workerData])
        .select()
        .single()

      if (createError) {
        console.error('Error creating worker:', createError)
        throw createError
      }

      console.log('Created worker:', newWorker)

      toast({
        title: 'Success',
        description: 'Worker added successfully'
      })

      await getWorkers()
      return newWorker
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create worker'
      console.error('Worker creation error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateWorker = async (id: string, data: UpdateWorkerData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating worker:', id, data)
      const { data: updatedWorker, error: updateError } = await supabase
        .from('workers' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating worker:', updateError)
        throw updateError
      }

      console.log('Updated worker:', updatedWorker)
      toast({
        title: 'Success',
        description: 'Worker updated successfully'
      })

      await getWorkers()
      return updatedWorker
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update worker'
      console.error('Worker update error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteWorker = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Deleting worker:', id)
      const { error: deleteError } = await supabase
        .from('workers' as any)
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting worker:', deleteError)
        throw deleteError
      }

      console.log('Deleted worker:', id)
      toast({
        title: 'Success',
        description: 'Worker deleted successfully'
      })

      await getWorkers()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete worker'
      console.error('Worker deletion error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      getWorkers()
    }
  }, [user])

  return {
    workers,
    isLoading,
    error,
    getWorkers,
    createWorker,
    updateWorker,
    deleteWorker
  }
}