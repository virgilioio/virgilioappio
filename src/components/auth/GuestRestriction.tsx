
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock } from 'lucide-react'

interface GuestRestrictionProps {
  action: string
  suggestion?: string
}

export function GuestRestriction({ action, suggestion }: GuestRestrictionProps) {
  return (
    <Card>
      <CardContent className="py-8">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to {action}. 
            {suggestion && ` ${suggestion}`}
            {!suggestion && ' Please contact your administrator for access.'}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
