
import { useCreateActivity } from './useActivities'

export function useActivityLogger() {
  const createActivity = useCreateActivity()

  const logJobCreated = (jobTitle: string, jobId: string) => {
    createActivity.mutate({
      activity_type: 'job_created',
      title: `Created job "${jobTitle}"`,
      description: 'A new job posting has been created',
      entity_type: 'job',
      entity_id: jobId,
    })
  }

  const logJobUpdated = (jobTitle: string, jobId: string) => {
    createActivity.mutate({
      activity_type: 'job_updated',
      title: `Updated job "${jobTitle}"`,
      description: 'Job details have been modified',
      entity_type: 'job',
      entity_id: jobId,
    })
  }

  const logJobPublished = (jobTitle: string, jobId: string) => {
    createActivity.mutate({
      activity_type: 'job_published',
      title: `Published job "${jobTitle}"`,
      description: 'Job is now live and accepting applications',
      entity_type: 'job',
      entity_id: jobId,
    })
  }

  const logMemberInvited = (email: string) => {
    createActivity.mutate({
      activity_type: 'member_invited',
      title: `Invited ${email} to join`,
      description: 'A new member invitation has been sent',
      entity_type: 'member',
    })
  }

  const logMemberJoined = (memberName: string) => {
    createActivity.mutate({
      activity_type: 'member_joined',
      title: `${memberName} joined the organization`,
      description: 'New member has successfully joined',
      entity_type: 'member',
    })
  }

  const logJobRequestCreated = (jobTitle: string, requestId: string) => {
    createActivity.mutate({
      activity_type: 'job_request_created',
      title: `Requested new job: "${jobTitle}"`,
      description: 'A new job request has been submitted for approval',
      entity_type: 'job_request',
      entity_id: requestId,
    })
  }

  const logJobRequestApproved = (jobTitle: string, requestId: string) => {
    createActivity.mutate({
      activity_type: 'job_request_approved',
      title: `Approved job request: "${jobTitle}"`,
      description: 'Job request has been approved and is now being processed',
      entity_type: 'job_request',
      entity_id: requestId,
    })
  }

  const logCandidateAdded = (candidateName: string, jobTitle: string, candidateId: string) => {
    createActivity.mutate({
      activity_type: 'candidate_added',
      title: `Added candidate ${candidateName}`,
      description: `New candidate added for "${jobTitle}"`,
      entity_type: 'candidate',
      entity_id: candidateId,
    })
  }

  const logInvoiceCreated = (invoiceTitle: string, amount: number, invoiceId: string) => {
    createActivity.mutate({
      activity_type: 'invoice_created',
      title: `Created invoice: ${invoiceTitle}`,
      description: `New invoice for $${amount.toLocaleString()} has been created`,
      entity_type: 'invoice',
      entity_id: invoiceId,
    })
  }

  const logInvoicePaid = (invoiceTitle: string, amount: number, invoiceId: string) => {
    createActivity.mutate({
      activity_type: 'invoice_paid',
      title: `Payment received: ${invoiceTitle}`,
      description: `Invoice for $${amount.toLocaleString()} has been paid`,
      entity_type: 'invoice',
      entity_id: invoiceId,
    })
  }

  return {
    logJobCreated,
    logJobUpdated,
    logJobPublished,
    logMemberInvited,
    logMemberJoined,
    logJobRequestCreated,
    logJobRequestApproved,
    logCandidateAdded,
    logInvoiceCreated,
    logInvoicePaid,
    isLoading: createActivity.isPending,
  }
}
