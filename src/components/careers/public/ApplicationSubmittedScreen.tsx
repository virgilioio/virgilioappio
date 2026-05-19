import { useState } from 'react'
import { Check, Bell, Share2, Copy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useToast } from '@/components/ui/use-toast'

interface Step {
  n: number
  title: string
  description: string
  right: string
  rightTone?: 'muted' | 'purple'
  state: 'done' | 'current' | 'upcoming'
}

interface Props {
  firstName: string
  roleName: string
  email: string
  referenceId: string
  recruiterFirstName: string
  postingUrl: string
}

export function ApplicationSubmittedScreen({
  firstName,
  roleName,
  email,
  referenceId,
  recruiterFirstName,
  postingUrl,
}: Props) {
  const { toast } = useToast()
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertEmail, setAlertEmail] = useState(email || '')

  const recruiter = recruiterFirstName || 'Our team'
  const hasRecruiter = !!recruiterFirstName

  const steps: Step[] = [
    {
      n: 1,
      title: 'Application received',
      description: `Just now · ${referenceId}`,
      right: '✓',
      rightTone: 'muted',
      state: 'done',
    },
    {
      n: 2,
      title: 'Recruiter review',
      description: hasRecruiter
        ? `${recruiter} from our team will read every word — promise.`
        : 'Our team will read every word — promise.',
      right: 'Within 48h',
      rightTone: 'purple',
      state: 'current',
    },
    {
      n: 3,
      title: 'Intro chat',
      description:
        "If there's a fit, we'll send 3 calendar slots within 24h of the reply.",
      right: '~ next week',
      rightTone: 'muted',
      state: 'upcoming',
    },
    {
      n: 4,
      title: 'Decision',
      description:
        "Whichever way it goes, you'll hear from us with notes. We don't ghost.",
      right: '~ 2–3 weeks',
      rightTone: 'muted',
      state: 'upcoming',
    },
  ]

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postingUrl)
      toast({ title: 'Link copied', description: 'Posting URL copied to clipboard.' })
    } catch {
      toast({ title: 'Unable to copy', description: 'Copy the URL from your browser bar.' })
    }
  }

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!alertEmail.trim()) return
    setAlertOpen(false)
    toast({
      title: "You're on the list",
      description: `We'll email ${alertEmail} when we open similar roles.`,
    })
  }

  return (
    <main className="flex-1 w-full animate-in fade-in-50 duration-500">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-600" strokeWidth={2.5} />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-black/5 px-3 py-1.5 shadow-sm">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#8B8F9E]">
                Reference
              </span>
              <span className="font-mono text-[12px] text-[#1F2230]">
                {referenceId}
              </span>
            </div>
          </div>

          <h1 className="font-poppins font-bold tracking-page-title text-[#1F2230] text-[40px] sm:text-[56px] leading-[1.05]">
            Got it, {firstName} — thanks
            <span className="text-virgilio-purple">.</span>
          </h1>

          <p className="mt-5 text-[15px] sm:text-[16px] text-[#5A6072] max-w-xl leading-relaxed">
            Your application for{' '}
            <span className="font-semibold text-[#1F2230]">{roleName}</span> is
            in. We sent a confirmation to{' '}
            <span className="font-semibold text-[#1F2230]">{email}</span>.
          </p>
        </div>

        {/* What happens next */}
        <Card className="mt-12 p-6 sm:p-8 bg-white border-black/5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="font-poppins font-semibold text-[15px] text-[#1F2230] tracking-[-0.01em] mb-6">
            What happens next
          </h2>
          <ol className="relative">
            {steps.map((s, i) => {
              const isLast = i === steps.length - 1
              const circleClasses =
                s.state === 'done'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : s.state === 'current'
                  ? 'bg-virgilio-purple text-white border-virgilio-purple'
                  : 'bg-white text-[#8B8F9E] border-[#E7E8EE]'
              return (
                <li key={s.n} className="relative pl-12 pb-7 last:pb-0">
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-[15px] top-8 bottom-0 w-px bg-[#E7E8EE]"
                    />
                  )}
                  <span
                    className={`absolute left-0 top-0 h-8 w-8 rounded-full border flex items-center justify-center text-[12px] font-semibold ${circleClasses}`}
                  >
                    {s.state === 'done' ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      s.n
                    )}
                  </span>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-poppins font-semibold text-[14px] text-[#1F2230]">
                        {s.title}
                      </div>
                      <div className="mt-1 text-[13.5px] text-[#5A6072] leading-relaxed">
                        {s.description}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-[12.5px] font-medium whitespace-nowrap ${
                        s.rightTone === 'purple'
                          ? 'text-virgilio-purple'
                          : 'text-[#8B8F9E]'
                      }`}
                    >
                      {s.right}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>

        {/* Action cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Set alerts */}
          <Card className="p-6 bg-white border-black/5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#EDE4FF] flex items-center justify-center">
                <Bell className="h-4 w-4 text-virgilio-purple" />
              </div>
              <div className="font-poppins font-semibold text-[14px] text-[#1F2230]">
                Set alerts for similar roles
              </div>
            </div>
            <p className="text-[13px] text-[#5A6072] leading-relaxed mb-4">
              Get notified when we open another role like this. One email, only
              when it's relevant.
            </p>
            <Popover open={alertOpen} onOpenChange={setAlertOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm" icon={Bell}>
                  Set up alerts
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-3">
                <form onSubmit={handleAlertSubmit} className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#8B8F9E]">
                    Email
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    className="h-9 text-[13px]"
                  />
                  <Button type="submit" size="sm" className="w-full">
                    Notify me
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          </Card>

          {/* Share */}
          <Card className="p-6 bg-white border-black/5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#EDE4FF] flex items-center justify-center">
                <Share2 className="h-4 w-4 text-virgilio-purple" />
              </div>
              <div className="font-poppins font-semibold text-[14px] text-[#1F2230]">
                Share the role
              </div>
            </div>
            <p className="text-[13px] text-[#5A6072] leading-relaxed mb-4">
              Know someone great? Send them the posting — we love thoughtful
              referrals.
            </p>
            <Button variant="secondary" size="sm" icon={Copy} onClick={handleCopyLink}>
              Copy link
            </Button>
          </Card>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-[13px] text-[#5A6072]">
          Need to change something?{' '}
          <a
            href={`mailto:?subject=Re: My application ${referenceId}`}
            className="font-medium text-[#1F2230] underline underline-offset-2 hover:text-virgilio-purple"
          >
            Reply to your confirmation email
          </a>{' '}
          — it goes straight to {recruiter}.
        </p>
      </div>
    </main>
  )
}
