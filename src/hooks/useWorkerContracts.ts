import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface WorkerContract {
  id: string
  worker_id: string
  organization_id: string
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
  department_id?: string
  department_name?: string
  manager_id?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
  manager_name?: string
}

export interface CreateWorkerContractData {
  worker_id: string
  organization_id: string
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
  department_id?: string
  manager_id?: string
  is_active?: boolean
}

export interface UpdateWorkerContractData {
  job_title?: string
  worker_type?: 'employee' | 'contractor'
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
  department_id?: string
  manager_id?: string
  is_active?: boolean
}

export function useWorkerContracts(workerId?: string) {
  const [contracts, setContracts] = useState<WorkerContract[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getContracts = async (targetWorkerId?: string) => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('worker_contracts' as any)
        .select(`
          *,
          departments!department_id (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (targetWorkerId || workerId) {
        query = query.eq('worker_id', targetWorkerId || workerId)
      }

      const { data: contractsData, error: contractsError } = await query

      if (contractsError) {
        console.error('Error fetching worker contracts:', contractsError)
        throw contractsError
      }

      if (!contractsData || contractsData.length === 0) {
        setContracts([])
        return
      }

      // Get manager names
      const managerIds = [...new Set(contractsData.map((c: any) => c.manager_id).filter(Boolean))]
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

      const contractsWithDetails = contractsData.map((contract: any) => ({
        ...contract,
        manager_name: contract.manager_id ? managersMap[contract.manager_id] : null,
        department_name: contract.departments?.name || null
      }))

      setContracts(contractsWithDetails)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch worker contracts'
      console.error('Worker contracts fetch error:', err)
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

  const createContract = async (data: CreateWorkerContractData) => {
    if (!user) throw new Error('User not authenticated')

    setIsLoading(true)
    setError(null)

    try {
      // If this is being set as active, deactivate other contracts for this worker
      if (data.is_active !== false) {
        await supabase
          .from('worker_contracts' as any)
          .update({ is_active: false })
          .eq('worker_id', data.worker_id)
      }

      const contractData = {
        ...data,
        is_active: data.is_active !== false, // Default to true
        created_by: user.id
      }

      const { data: newContract, error: createError } = await supabase
        .from('worker_contracts' as any)
        .insert([contractData])
        .select()
        .single()

      if (createError) {
        console.error('Error creating worker contract:', createError)
        throw createError
      }

      toast({
        title: 'Success',
        description: 'Worker contract created successfully'
      })

      await getContracts(data.worker_id)
      return newContract
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create worker contract'
      console.error('Worker contract creation error:', err)
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

  const updateContract = async (id: string, data: UpdateWorkerContractData) => {
    setIsLoading(true)
    setError(null)

    try {
      // If setting this contract as active, deactivate others for the same worker
      if (data.is_active === true) {
        const contract = contracts.find(c => c.id === id)
        if (contract) {
          await supabase
            .from('worker_contracts' as any)
            .update({ is_active: false })
            .eq('worker_id', contract.worker_id)
            .neq('id', id)
        }
      }

      const { data: updatedContract, error: updateError } = await supabase
        .from('worker_contracts' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating worker contract:', updateError)
        throw updateError
      }

      toast({
        title: 'Success',
        description: 'Worker contract updated successfully'
      })

      await getContracts()
      return updatedContract
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update worker contract'
      console.error('Worker contract update error:', err)
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

  const terminateContract = async (id: string) => {
    return updateContract(id, { 
      contract_status: 'terminated', 
      is_active: false,
      end_date: new Date().toISOString().split('T')[0]
    })
  }

  const activateContract = async (id: string) => {
    return updateContract(id, { 
      contract_status: 'active', 
      is_active: true 
    })
  }

  const getActiveContract = () => {
    return contracts.find(contract => contract.is_active)
  }

  useEffect(() => {
    if (user && workerId) {
      getContracts()
    }
  }, [user, workerId])

  return {
    contracts,
    isLoading,
    error,
    getContracts,
    createContract,
    updateContract,
    terminateContract,
    activateContract,
    getActiveContract
  }
}