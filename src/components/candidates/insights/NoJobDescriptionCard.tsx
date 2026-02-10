import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

interface NoJobDescriptionCardProps {
  jobId: string
}

export function NoJobDescriptionCard({ jobId }: NoJobDescriptionCardProps) {
  return (
    <Card className="bg-surface-primary border-border">
      <CardContent className="flex flex-col items-center text-center py-10 px-6 space-y-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Add a Job Description for AI Insights</h3>
          <p className="text-sm text-text-secondary mt-1">
            For accurate candidate matching, add a detailed job description in Job Setup with requirements, skills, and expectations.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/jobs/${jobId}/setup`}>Go to Job Setup</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
