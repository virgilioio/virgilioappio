import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Users, Mail } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useSaaSCustomerMembers, SaaSMember } from '@/hooks/useSaaSCustomerMembers'
import { formatDistanceToNow } from 'date-fns'

interface MembersListProps {
  tenantId: string
}

export function MembersList({ tenantId }: MembersListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const { data: members, isLoading } = useSaaSCustomerMembers(tenantId)

  const filteredMembers = useMemo(() => {
    if (!members) return []
    if (!searchTerm) return members

    const search = searchTerm.toLowerCase()
    return members.filter((member: SaaSMember) => {
      const firstName = member.profile?.first_name?.toLowerCase() || ''
      const lastName = member.profile?.last_name?.toLowerCase() || ''
      const email = member.profile?.email?.toLowerCase() || member.invited_email?.toLowerCase() || ''
      const role = member.system_role?.toLowerCase() || ''

      return (
        firstName.includes(search) ||
        lastName.includes(search) ||
        email.includes(search) ||
        role.includes(search)
      )
    })
  }, [members, searchTerm])

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'default'
      case 'member':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (isLoading) {
    return (
      <Card className="shadow-calendly border-virgilio-border">
        <CardContent className="p-6">
          <div className="text-center py-8 text-virgilio-muted">Loading members...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Team Members<span className="text-virgilio-purple">.</span>
          </CardTitle>
          <Badge variant="outline" className="border-virgilio-border">
            <Users className="h-3 w-3 mr-1" />
            {members?.length || 0} members
          </Badge>
        </div>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-virgilio-border focus:border-virgilio-purple"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-virgilio-muted">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{searchTerm ? 'No members found' : 'No team members yet'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member: SaaSMember) => {
              // Handle both active members (with profile) and invited members (without profile)
              const hasProfile = !!member.profile
              const initials = hasProfile
                ? `${member.profile?.first_name?.[0] || ''}${member.profile?.last_name?.[0] || ''}`.toUpperCase() || 'U'
                : member.invited_email?.[0]?.toUpperCase() || 'I'
              const fullName = hasProfile
                ? `${member.profile?.first_name || ''} ${member.profile?.last_name || ''}`.trim() || 'Unknown User'
                : 'Pending Invitation'
              const displayEmail = member.profile?.email || member.invited_email

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-virgilio-border hover:border-virgilio-purple/30 transition-all"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback className={`text-white text-sm font-semibold ${hasProfile ? 'bg-virgilio-purple' : 'bg-virgilio-muted'}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${hasProfile ? 'text-virgilio-text' : 'text-virgilio-muted italic'}`}>
                        {fullName}
                      </p>
                      <Badge variant={getRoleBadgeVariant(member.system_role)} className="text-xs">
                        {member.system_role === 'admin' ? 'Admin' : 'Member'}
                      </Badge>
                    </div>
                    {displayEmail && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="h-3 w-3 text-virgilio-muted" />
                        <p className="text-xs text-virgilio-muted truncate">
                          {displayEmail}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <Badge 
                      variant={member.user_status === 'active' ? 'outline' : 'secondary'}
                      className={member.user_status === 'active' 
                        ? 'border-virgilio-success/20 text-virgilio-success bg-virgilio-success/10' 
                        : 'border-virgilio-muted/20 text-virgilio-muted bg-virgilio-muted/10'
                      }
                    >
                      {member.user_status}
                    </Badge>
                    <p className="text-xs text-virgilio-muted mt-1">
                      {formatDistanceToNow(new Date(member.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
