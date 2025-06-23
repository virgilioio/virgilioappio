import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useMembers } from '@/hooks/useMembers'
import { supabase } from '@/integrations/supabase/client'
import { RefreshCw, Shield, Clock, Users } from 'lucide-react'

interface InviteStats {
  total_invites: number
  pending_invites: number
  expired_invites: number
  accepted_invites: number
}

export function InviteSystemDebug() {
  const { members, isLoading } = useMembers()
  const [stats, setStats] = useState<InviteStats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const calculateStats = () => {
    if (!members) return null

    const invitedMembers = members.filter(m => m.user_status === 'invited')
    const expiredInvites = invitedMembers.filter(m => 
      m.invite_expires_at && new Date(m.invite_expires_at) < new Date()
    )
    const acceptedInvites = members.filter(m => 
      m.user_status === 'active' && m.user_id
    )

    return {
      total_invites: invitedMembers.length,
      pending_invites: invitedMembers.length - expiredInvites.length,
      expired_invites: expiredInvites.length,
      accepted_invites: acceptedInvites.length
    }
  }

  useEffect(() => {
    if (members) {
      setStats(calculateStats())
    }
  }, [members])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      window.location.reload()
    } finally {
      setIsRefreshing(false)
    }
  }

  const testTokenValidation = async () => {
    const testToken = 'test-invalid-token'
    try {
      const { data, error } = await supabase.rpc('validate_invite_token', {
        token_input: testToken
      })
      console.log('Token validation test result:', data, error)
    } catch (error) {
      console.error('Token validation test error:', error)
    }
  }

  if (isLoading) {
    return <div className="text-center py-2 text-xs">Loading...</div>
  }

  return (
    <div className="space-y-3">
      {/* Compact Statistics */}
      {stats && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            Stats
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-blue-50 rounded text-xs">
              <div className="font-bold text-blue-600">{stats.total_invites}</div>
              <div className="text-blue-600">Total</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded text-xs">
              <div className="font-bold text-yellow-600">{stats.pending_invites}</div>
              <div className="text-yellow-600">Pending</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded text-xs">
              <div className="font-bold text-red-600">{stats.expired_invites}</div>
              <div className="text-red-600">Expired</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded text-xs">
              <div className="font-bold text-green-600">{stats.accepted_invites}</div>
              <div className="text-green-600">Accepted</div>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Compact Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-6 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={testTokenValidation}
          className="h-6 text-xs"
        >
          Test Token
        </Button>
      </div>

      {/* Active Invitations - Compact List */}
      <div>
        <h4 className="font-medium mb-2 flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Active ({members.filter(m => m.user_status === 'invited').length})
        </h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {members
            .filter(m => m.user_status === 'invited')
            .slice(0, 3)
            .map(member => {
              const isExpired = member.invite_expires_at && 
                new Date(member.invite_expires_at) < new Date()
              
              return (
                <div key={member.id} className="flex items-center justify-between p-1 bg-gray-50 rounded text-xs">
                  <div className="truncate">
                    <div className="font-medium truncate">{member.invited_email || 'No email'}</div>
                  </div>
                  <Badge variant={isExpired ? "destructive" : "secondary"} className="text-xs h-4">
                    {isExpired ? 'Exp' : 'Active'}
                  </Badge>
                </div>
              )
            })}
          {members.filter(m => m.user_status === 'invited').length === 0 && (
            <div className="text-center py-2 text-gray-500 text-xs">
              No active invitations
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
