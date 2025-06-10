
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { MembersTable } from '@/components/members/MembersTable'

export function MembersTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members
        </CardTitle>
        <CardDescription>
          Manage your organization's team members and their roles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MembersTable />
      </CardContent>
    </Card>
  )
}
