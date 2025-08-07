import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JobStagesManager } from './JobStagesManager'

export function JobSettingsManager() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Job Settings</h1>
        <p className="text-text-secondary mt-1">
          Configure job-related settings for the platform
        </p>
      </div>

      <JobStagesManager />
    </div>
  )
}