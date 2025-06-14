import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export interface UserProfile {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
  title?: string
  phone?: string
  linkedin_url?: string
  avatar_url?: string
  timezone?: string
  organization_id?: string
  email?: string
  created_at: string
  updated_at: string
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getProfile = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching profile for user:', user.id)
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        console.error('Error fetching profile:', fetchError)
        throw fetchError
      }

      console.log('Fetched profile:', data)
      // Transform the data to match our interface by adding id field
      const profileData: UserProfile = {
        ...data,
        id: data.user_id
      }
      setProfile(profileData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile'
      console.error('Profile fetch error:', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Updating profile:', updates)
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('*')
        .single()

      if (error) {
        console.error('Error updating profile:', error)
        throw error
      }

      console.log('Updated profile:', data)
      // Transform the data to match our interface
      const profileData: UserProfile = {
        ...data,
        id: data.user_id
      }
      setProfile(profileData)
      return profileData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      console.error('Update profile error:', err)
      throw new Error(errorMessage)
    }
  }

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}.${fileExt}`
      const filePath = `avatars/${fileName}`

      console.log('Uploading avatar:', filePath)

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const avatarUrl = data.publicUrl

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: avatarUrl })

      return avatarUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload avatar'
      console.error('Upload avatar error:', err)
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    if (user) {
      getProfile()
    }
  }, [user])

  return {
    profile,
    isLoading,
    error,
    getProfile,
    updateProfile,
    uploadAvatar
  }
}
