import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Clock, CreditCard, XCircle, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface TimelineEvent {
  id: string
  type: 'trial_start' | 'trial_end' | 'first_payment' | 'renewal' | 'failed_payment' | 'suspension'
  date: string
  label: string
  description?: string
  status: 'completed' | 'upcoming' | 'failed'
}

interface SubscriptionTimelineProps {
  trialStartedAt: string | null
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEndAt: string | null
  lastPaymentFailedAt: string | null
  suspendedAt: string | null
  billingStatus: string | null
}

export function SubscriptionTimeline({
  trialStartedAt,
  trialEndsAt,
  currentPeriodStart,
  currentPeriodEndAt,
  lastPaymentFailedAt,
  suspendedAt,
  billingStatus,
}: SubscriptionTimelineProps) {
  const events: TimelineEvent[] = []
  const now = new Date()

  // Add trial start
  if (trialStartedAt) {
    events.push({
      id: 'trial-start',
      type: 'trial_start',
      date: trialStartedAt,
      label: 'Trial Started',
      status: 'completed',
    })
  }

  // Add trial end
  if (trialEndsAt) {
    const trialEndDate = new Date(trialEndsAt)
    events.push({
      id: 'trial-end',
      type: 'trial_end',
      date: trialEndsAt,
      label: trialEndDate > now ? 'Trial Ends' : 'Trial Ended',
      status: trialEndDate > now ? 'upcoming' : 'completed',
    })
  }

  // Add first payment / current period start
  if (currentPeriodStart && billingStatus !== 'trialing') {
    events.push({
      id: 'period-start',
      type: 'first_payment',
      date: currentPeriodStart,
      label: 'Current Period Started',
      description: 'Subscription billing period began',
      status: 'completed',
    })
  }

  // Add renewal date
  if (currentPeriodEndAt) {
    const renewalDate = new Date(currentPeriodEndAt)
    events.push({
      id: 'renewal',
      type: 'renewal',
      date: currentPeriodEndAt,
      label: renewalDate > now ? 'Next Renewal' : 'Period Ended',
      description: renewalDate > now ? 'Automatic renewal scheduled' : 'Billing period completed',
      status: renewalDate > now ? 'upcoming' : 'completed',
    })
  }

  // Add failed payment
  if (lastPaymentFailedAt) {
    events.push({
      id: 'failed-payment',
      type: 'failed_payment',
      date: lastPaymentFailedAt,
      label: 'Payment Failed',
      description: 'Last payment attempt unsuccessful',
      status: 'failed',
    })
  }

  // Add suspension
  if (suspendedAt) {
    events.push({
      id: 'suspension',
      type: 'suspension',
      date: suspendedAt,
      label: 'Account Suspended',
      description: 'Account access restricted',
      status: 'failed',
    })
  }

  // Sort events by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const getIcon = (type: TimelineEvent['type'], status: TimelineEvent['status']) => {
    if (status === 'failed') {
      return <XCircle className="h-5 w-5 text-destructive" />
    }
    if (status === 'upcoming') {
      return <Clock className="h-5 w-5 text-muted-foreground" />
    }

    switch (type) {
      case 'trial_start':
      case 'trial_end':
        return <Calendar className="h-5 w-5 text-primary" />
      case 'first_payment':
      case 'renewal':
        return <CreditCard className="h-5 w-5 text-success" />
      default:
        return <CheckCircle className="h-5 w-5 text-success" />
    }
  }

  if (events.length === 0) {
    return (
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Subscription Timeline<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-virgilio-muted">
            No subscription timeline data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
          Subscription Timeline<span className="text-virgilio-purple">.</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-[2px] bg-border" />
          
          {/* Timeline events */}
          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                {/* Icon */}
                <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-background border-2 border-border">
                  {getIcon(event.type, event.status)}
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-virgilio-text">{event.label}</div>
                      {event.description && (
                        <div className="text-sm text-virgilio-muted mt-0.5">{event.description}</div>
                      )}
                    </div>
                    <div className="text-sm text-virgilio-muted whitespace-nowrap">
                      {format(new Date(event.date), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
