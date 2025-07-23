import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

// Updated Worker interface - now only contains core worker identity
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
  worker_id?: number
  country?: string
  state_province?: string
  worker_entity_type?: 'business_entity' | 'individual' | 'not_specified'
  created_by?: string
  created_at: string
  updated_at: string
  organization_name?: string
  // Current active contract information (populated from worker_contracts)
  current_contract?: {
    id: string
    contract_number: string
    job_title?: string
    worker_type: 'employee' | 'contractor'
    contract_type?: 'permanent' | 'temporary' | 'freelance' | 'fixed_term' | 'seasonal'
    contract_status?: 'active' | 'pending' | 'expired' | 'terminated' | 'suspended'
    employment_terms?: 'full_time' | 'part_time' | 'temporary' | 'internship'
    employment_term?: 'indefinite' | 'definite'
    seniority_level?: 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp' | 'c_level'
    start_date?: string
    end_date?: string
    working_location?: string
    scope_of_work?: string
    currency?: string
    base_salary?: number
    payment_period?: 'annual' | 'monthly' | 'semimonthly' | 'biweekly' | 'weekly' | 'daily' | 'hourly'
    payment_frequency?: 'bi_monthly' | 'monthly' | 'custom'
    custom_pay_dates?: number[]
    next_payment_date?: string
    contractor_payment_type?: 'fixed_rate' | 'hourly_rate' | 'per_project'
    hourly_rate?: number
    monthly_fixed_amount?: number
    project_details?: string
    department?: string
    manager_id?: string
    manager_name?: string
  }
}

// Updated CreateWorkerData - now separated into worker and contract data
export interface CreateWorkerData {
  // Worker core data
  organization_id: string
  full_name: string
  legal_first_name?: string
  legal_last_name?: string
  citizenship?: string
  personal_email?: string
  work_email?: string
  personal_phone?: string
  worker_status?: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending'
  worker_id?: number
  country?: string
  state_province?: string
  worker_entity_type?: 'business_entity' | 'individual' | 'not_specified'
  
  // Contract data (will be separated in creation process)
  worker_type: 'employee' | 'contractor'
  job_title?: string
  seniority_level?: 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp' | 'c_level'
  contract_type?: 'permanent' | 'temporary' | 'freelance' | 'fixed_term' | 'seasonal'
  employment_terms?: 'full_time' | 'part_time' | 'temporary' | 'internship'
  contract_status?: 'active' | 'pending' | 'expired' | 'terminated' | 'suspended'
  working_location?: string
  scope_of_work?: string
  currency?: string
  base_salary?: number
  payment_period?: 'annual' | 'monthly' | 'semimonthly' | 'biweekly' | 'weekly' | 'daily' | 'hourly'
  employment_term?: 'indefinite' | 'definite'
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
  manager_id?: string
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
  worker_id?: number
  country?: string
  state_province?: string
  worker_entity_type?: 'business_entity' | 'individual' | 'not_specified'
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
      
      // Fetch workers with their active contracts
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

      if (!workersData || workersData.length === 0) {
        console.log('No workers found')
        setWorkers([])
        return
      }

      // Get active contracts for all workers
      const workerIds = workersData.map((w: any) => w.id)
      const { data: contractsData } = await supabase
        .from('worker_contracts' as any)
        .select('*')
        .in('worker_id', workerIds)
        .eq('is_active', true)

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

      // Get manager names from contracts
      const managerIds = contractsData ? [...new Set(contractsData.map((c: any) => c.manager_id).filter(Boolean))] : []
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

      // Combine workers with their active contracts
      const workersWithDetails = workersData.map((worker: any) => {
        const activeContract = contractsData?.find((c: any) => c.worker_id === worker.id)
        
        const typedWorker: Worker = {
          ...worker,
          worker_status: worker.worker_status as Worker['worker_status'],
          worker_entity_type: worker.worker_entity_type as Worker['worker_entity_type'],
          organization_name: organizationsMap[worker.organization_id] || null,
          current_contract: activeContract ? {
            ...activeContract,
            manager_name: activeContract.manager_id ? managersMap[activeContract.manager_id] : null
          } : undefined
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
      console.log('Creating worker with separated data:', data)
      
      // Separate worker and contract data
      const workerData = {
        organization_id: data.organization_id,
        full_name: data.full_name,
        legal_first_name: data.legal_first_name,
        legal_last_name: data.legal_last_name,
        citizenship: data.citizenship,
        personal_email: data.personal_email,
        work_email: data.work_email,
        personal_phone: data.personal_phone,
        worker_status: data.worker_status || 'pending',
        worker_id: data.worker_id,
        country: data.country,
        state_province: data.state_province,
        worker_entity_type: data.worker_entity_type,
        created_by: user.id
      }

      const contractData = {
        organization_id: data.organization_id,
        job_title: data.job_title,
        worker_type: data.worker_type,
        seniority_level: data.seniority_level,
        contract_type: data.contract_type,
        employment_terms: data.employment_terms,
        contract_status: data.contract_status || 'pending',
        working_location: data.working_location,
        scope_of_work: data.scope_of_work,
        currency: data.currency,
        base_salary: data.base_salary,
        payment_period: data.payment_period,
        employment_term: data.employment_term,
        start_date: data.start_date,
        end_date: data.end_date,
        payment_frequency: data.payment_frequency,
        custom_pay_dates: data.custom_pay_dates,
        next_payment_date: data.next_payment_date,
        contractor_payment_type: data.contractor_payment_type,
        hourly_rate: data.hourly_rate,
        monthly_fixed_amount: data.monthly_fixed_amount,
        project_details: data.project_details,
        department: data.department,
        manager_id: data.manager_id,
        is_active: true,
        created_by: user.id
      }

      // Create worker first
      const { data: newWorker, error: createWorkerError } = await supabase
        .from('workers' as any)
        .insert([workerData])
        .select()
        .single()

      if (createWorkerError) {
        console.error('Error creating worker:', createWorkerError)
        throw createWorkerError
      }

      // Create the worker's initial contract
      const { data: newContract, error: createContractError } = await supabase
        .from('worker_contracts' as any)
        .insert([{ ...contractData, worker_id: newWorker.id }])
        .select()
        .single()

      if (createContractError) {
        // If contract creation fails, we should clean up the worker
        await supabase.from('workers' as any).delete().eq('id', newWorker.id)
        console.error('Error creating worker contract:', createContractError)
        throw createContractError
      }

      console.log('Created worker with contract:', { worker: newWorker, contract: newContract })

      toast({
        title: 'Success',
        description: 'Worker and contract created successfully'
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
