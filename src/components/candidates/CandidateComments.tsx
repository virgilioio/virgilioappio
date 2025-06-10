
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Trash2, MessageSquare, Send } from 'lucide-react'
import { useCandidateComments } from '@/hooks/useCandidateComments'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'

interface CandidateCommentsProps {
  candidateId: string
  jobId: string
  organizationId: string
}

export function CandidateComments({ candidateId, jobId, organizationId }: CandidateCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useAuth()
  const permissions = usePermissions()
  const {
    comments,
    isLoading,
    addComment,
    deleteComment
  } = useCandidateComments(candidateId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setIsSubmitting(true)
    try {
      await addComment({
        candidate_id: candidateId,
        job_id: jobId,
        organization_id: organizationId,
        content: newComment.trim()
      })
      setNewComment('')
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      await deleteComment(commentId)
    }
  }

  const canDelete = (comment: any) => {
    return comment.author_id === user?.id || permissions.isPlatformAdmin
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="w-full sm:w-auto"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </form>

        <Separator />

        {/* Comments List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No comments yet</p>
              <p className="text-sm">Be the first to add a comment</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-muted/20 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">User</span>
                      <span>•</span>
                      <span>{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                  {canDelete(comment) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
