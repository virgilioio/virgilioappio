
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useJobAssignments } from './useJobAssignments'

export function useIsAssignedToJob(jobId: string) {
  const [isAssigned, setIsAssigned] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const { checkUserAssignment } = useJobAssignments()

  useEffect(() => {
    const checkAssignment = async () => {
      if (!user || !jobId) {
        setIsAssigned(false)
        setIsLoading(false)
        return
      }

      try {
        const assigned = await checkUserAssignment(user.id, jobId)
        setIsAssigned(assigned)
      } catch (error) {
        console.error('Error checking job assignment:', error)
        setIsAssigned(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAssignment()
  }, [user, jobId, checkUserAssignment])

  return { isAssigned, isLoading }
}
