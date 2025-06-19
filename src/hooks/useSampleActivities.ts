
import { useEffect } from 'react'
import { useCreateActivity } from './useActivities'
import { useUserProfile } from './useUserProfile'

export function useSampleActivities() {
  const createActivity = useCreateActivity()
  const { profile } = useUserProfile()

  useEffect(() => {
    // Only create sample activities if user has organization and we haven't created them before
    if (!profile?.organization_id) return

    const hasCreatedSamples = localStorage.getItem(`sample-activities-${profile.organization_id}`)
    if (hasCreatedSamples) return

    // Create some sample activities to demonstrate the feature
    const sampleActivities = [
      {
        activity_type: 'job_created',
        title: 'Created job "Senior Software Engineer"',
        description: 'A new job posting has been created',
        entity_type: 'job',
      },
      {
        activity_type: 'member_invited',
        title: 'Invited user@example.com to join',
        description: 'A new member invitation has been sent',
        entity_type: 'member',
      },
      {
        activity_type: 'job_request_created',
        title: 'Requested new job: "Product Manager"',
        description: 'A new job request has been submitted for approval',
        entity_type: 'job_request',
      }
    ]

    // Add sample activities with small delays
    sampleActivities.forEach((activity, index) => {
      setTimeout(() => {
        createActivity.mutate(activity)
      }, index * 500)
    })

    // Mark that we've created sample activities for this organization
    localStorage.setItem(`sample-activities-${profile.organization_id}`, 'true')
  }, [profile?.organization_id, createActivity])
}
