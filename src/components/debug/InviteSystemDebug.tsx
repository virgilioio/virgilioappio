
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
      // Trigger a refresh of member data
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite System Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading debug info...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Invite System Debug
            </CardTitle>
            <CardDescription>
              Monitor invitation system health and statistics
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invitation Statistics */}
        {stats && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Invitation Statistics
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.total_invites}</div>
                <div className="text-sm text-blue-600">Total Invites</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending_invites}</div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.expired_invites}</div>
                <div className="text-sm text-red-600">Expired</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.accepted_invites}</div>
                <div className="text-sm text-green-600">Accepted</div>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Current Invitations */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Active Invitations
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {members
              .filter(m => m.user_status === 'invited')
              .map(member => {
                const isExpired = member.invite_expires_at && 
                  new Date(member.invite_expires_at) < new Date()
                
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{member.user_email || 'No email'}</div>
                      <div className="text-sm text-gray-500">
                        Role: {member.member_role} • Org: {member.organization_name}
                      </div>
                      {member.invite_expires_at && (
                        <div className="text-xs text-gray-400">
                          Expires: {new Date(member.invite_expires_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <Badge variant={isExpired ? "destructive" : "secondary"}>
                      {isExpired ? 'Expired' : 'Active'}
                    </Badge>
                  </div>
                )
              })}
            {members.filter(m => m.user_status === 'invited').length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No active invitations
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Security Test */}
        <div>
          <h4 className="font-medium mb-3">Security Tests</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={testTokenValidation}
          >
            Test Token Validation
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Check console for token validation test results
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
