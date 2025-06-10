
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface CandidateComment {
  id: string
  candidate_id: string
  job_id: string
  organization_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface CreateCommentData {
  candidate_id: string
  job_id: string
  organization_id: string
  content: string
}

export function useCandidateComments(candidateId?: string) {
  const [comments, setComments] = useState<CandidateComment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getComments = async (targetCandidateId?: string) => {
    const queryCandidate = targetCandidateId || candidateId
    if (!user || !queryCandidate) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching comments for candidate:', queryCandidate)
      const { data, error: fetchError } = await supabase
        .from('candidate_comments')
        .select('*')
        .eq('candidate_id', queryCandidate)
        .order('created_at', { ascending: true })

      if (fetchError) {
        console.error('Error fetching comments:', fetchError)
        throw fetchError
      }

      console.log('Fetched comments:', data)
      setComments(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch comments'
      console.error('Comments fetch error:', err)
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

  const addComment = async (data: CreateCommentData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Adding comment:', data)
      const commentData = {
        ...data,
        author_id: user?.id
      }

      const { data: newComment, error: createError } = await supabase
        .from('candidate_comments')
        .insert([commentData])
        .select()
        .single()

      if (createError) {
        console.error('Error creating comment:', createError)
        throw createError
      }

      console.log('Created comment:', newComment)
      toast({
        title: 'Success',
        description: 'Comment added successfully'
      })

      await getComments(data.candidate_id)
      return newComment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment'
      console.error('Comment creation error:', err)
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

  const deleteComment = async (commentId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Deleting comment:', commentId)
      const { error: deleteError } = await supabase
        .from('candidate_comments')
        .delete()
        .eq('id', commentId)

      if (deleteError) {
        console.error('Error deleting comment:', deleteError)
        throw deleteError
      }

      console.log('Deleted comment:', commentId)
      toast({
        title: 'Success',
        description: 'Comment deleted successfully'
      })

      await getComments()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete comment'
      console.error('Comment deletion error:', err)
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
    if (user && candidateId) {
      getComments()
    }
  }, [user, candidateId])

  return {
    comments,
    isLoading,
    error,
    getComments,
    addComment,
    deleteComment
  }
}
