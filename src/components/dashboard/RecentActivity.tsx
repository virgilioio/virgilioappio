
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export function RecentActivity() {
  // Placeholder for future activity tracking
  const activities: never[] = []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <Clock className="h-12 w-12 mx-auto mb-4 text-text-tertiary" />
            <h3 className="font-medium mb-2">No recent activity</h3>
            <p className="text-sm">
              Activity will appear here as you use the platform
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Future: Map through activities */}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
