
import { useEffect, useCallback } from 'react'
import { UseFormReturn } from 'react-hook-form'

interface UseFormPersistenceOptions {
  storageKey: string
  form: UseFormReturn<any>
  enabled?: boolean
  debounceMs?: number
}

export function useFormPersistence({ 
  storageKey, 
  form, 
  enabled = true,
  debounceMs = 500 
}: UseFormPersistenceOptions) {
  const { watch, reset, formState } = form

  // Load persisted data on mount
  useEffect(() => {
    if (!enabled) return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        reset(data)
        console.log('Form data restored from localStorage')
      }
    } catch (error) {
      console.warn('Failed to restore form data:', error)
      localStorage.removeItem(storageKey)
    }
  }, [storageKey, reset, enabled])

  // Save form data with debouncing
  useEffect(() => {
    if (!enabled || !formState.isDirty) return

    const subscription = watch((data) => {
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data))
        } catch (error) {
          console.warn('Failed to persist form data:', error)
        }
      }, debounceMs)

      return () => clearTimeout(timeoutId)
    })

    return () => subscription.unsubscribe()
  }, [watch, storageKey, enabled, formState.isDirty, debounceMs])

  const clearPersistedData = useCallback(() => {
    localStorage.removeItem(storageKey)
  }, [storageKey])

  return { clearPersistedData }
}
