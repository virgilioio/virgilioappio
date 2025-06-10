
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface UserProfile {
  user_id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  phone: string | null
  linkedin_url: string | null
  timezone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UpdateProfileData {
  first_name?: string
  last_name?: string
  title?: string
  phone?: string
  linkedin_url?: string
  timezone?: string
  avatar_url?: string
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getMyProfile = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching user profile for:', user.id)
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        console.error('Error fetching profile:', fetchError)
        throw fetchError
      }

      if (!data) {
        // Create profile if it doesn't exist
        const newProfile = {
          user_id: user.id,
          first_name: user.user_metadata?.first_name || null,
          last_name: user.user_metadata?.last_name || null,
          timezone: 'UTC'
        }

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single()

        if (createError) {
          console.error('Error creating profile:', createError)
          throw createError
        }

        setProfile(createdProfile)
      } else {
        setProfile(data)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile'
      console.error('Profile fetch error:', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const updateMyProfile = async (data: UpdateProfileData) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating profile:', data)
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(data)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating profile:', updateError)
        throw updateError
      }

      console.log('Updated profile:', updatedProfile)
      setProfile(updatedProfile)
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully'
      })

      return updatedProfile
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      console.error('Profile update error:', err)
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

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    setIsLoading(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      console.log('Uploading avatar:', fileName)
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError)
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const avatarUrl = urlData.publicUrl

      // Update profile with new avatar URL
      await updateMyProfile({ avatar_url: avatarUrl })

      console.log('Avatar uploaded and profile updated:', avatarUrl)
      
      toast({
        title: 'Success',
        description: 'Avatar uploaded successfully'
      })

      return avatarUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload avatar'
      console.error('Avatar upload error:', err)
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
      getMyProfile()
    }
  }, [user])

  return {
    profile,
    isLoading,
    error,
    getMyProfile,
    updateMyProfile,
    uploadAvatar
  }
}
