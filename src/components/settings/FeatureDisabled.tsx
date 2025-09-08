import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface FeatureDisabledProps {
  title?: string
  description?: string
}

export function FeatureDisabled({ 
  title = "Feature Not Available",
  description = "This feature is currently disabled."
}: FeatureDisabledProps) {
  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}