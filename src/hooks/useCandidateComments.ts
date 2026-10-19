import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

/**
 * A candidate's comments (2026-10-19): one shared query per candidate, so the
 * Comments card in the sidebar and its phone copy show the same list. The
 * database decides who reads what (shared with everyone who can see the
 * candidate, or private to the author) and notifies the people tagged.
 */
export interface CandidateComment {
  id: string
  candidate_id: string
  job_id: string | null
  organization_id: string | null
  author_id: string
  author_email: string
  content: string
  is_private: boolean
  created_at: string
  updated_at: string
  job: { id: string; title: string | null } | null
}

export interface CreateCommentData {
  candidate_id: string
  /** Null on the standalone profile: the comment belongs to the person, not a job. */
  job_id: string | null
  /** Filled by the database from the job or the author's workspace when null. */
  organization_id?: string | null
  content: string
  is_private: boolean
}

export interface CommentPerson {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
}

export const commentsKey = (candidateId: string | null | undefined) => ['candidate-comments', candidateId] as const

export function useCandidateComments(candidateId?: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = commentsKey(candidateId)

  const query = useQuery({
    queryKey: key,
    enabled: !!user && !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_comments')
        .select('id, candidate_id, job_id, organization_id, author_id, author_email, content, is_private, created_at, updated_at, job:jobs(id, title)')
        .eq('candidate_id', candidateId!)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as CandidateComment[]
    },
  })

  const add = useMutation({
    mutationFn: async (input: CreateCommentData) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('candidate_comments')
        .insert({
          candidate_id: input.candidate_id,
          job_id: input.job_id,
          organization_id: input.organization_id ?? null,
          content: input.content,
          is_private: input.is_private,
          author_id: user.id,
          author_email: user.email ?? '',
        } as never)
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: () => {
      // Never a raw server error (Block B §16); the draft stays in the box.
      toast({
        title: 'Couldn’t post the comment',
        description: 'Your text is still in the box; try again.',
        variant: 'destructive',
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('candidate_comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Comment deleted' })
      return qc.invalidateQueries({ queryKey: key })
    },
    onError: () => {
      toast({
        title: 'Couldn’t delete the comment',
        description: 'Nothing was removed; try again.',
        variant: 'destructive',
      })
    },
  })

  return {
    comments: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addComment: add.mutateAsync,
    isAdding: add.isPending,
    deleteComment: remove.mutateAsync,
  }
}

/** Teammates who can see the candidate (the "@" menu), without you. */
export function useCommentPeople(candidateId?: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['comment-people', candidateId],
    enabled: !!user && !!candidateId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('comment_people', { _candidate_id: candidateId! })
      if (error) throw error
      return (data ?? []) as CommentPerson[]
    },
  })
}
