import { PartyPopper, ExternalLink, Briefcase } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBanner } from './StatusBanner';
import { useOnboardingTasks } from '@/hooks/useOnboardingTasks';
import { useOfferLetters } from '@/hooks/useOfferLetters';

interface HiredBannerSmartProps {
  applicationId: string | null;
  candidateId: string;
  jobId: string;
  candidateFirstName?: string;
  hiredAt: string | null;
  startDate?: string | null;
  jobTitle?: string;
  onOpenOnboarding?: () => void;
  onMarkReqClosed?: () => void;
}

function fmtMoney(v: any): string | null {
  if (v == null) return null;
  let parsed: any = v;
  if (typeof v === 'string') { try { parsed = JSON.parse(v); } catch { return v; } }
  const amount = parsed?.amount ?? parsed;
  const currency = parsed?.currency || 'USD';
  if (typeof amount === 'number' || (!isNaN(Number(amount)) && amount !== '')) {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
  return null;
}

export function HiredBannerSmart({
  applicationId,
  candidateId,
  jobId,
  candidateFirstName,
  hiredAt,
  startDate,
  jobTitle,
  onOpenOnboarding,
  onMarkReqClosed,
}: HiredBannerSmartProps) {
  const { tasks } = useOnboardingTasks(applicationId);
  const { offerLetters } = useOfferLetters(candidateId);
  const offer = offerLetters.find((ol) => ol.job_id === jobId);

  const daysSinceHired = hiredAt ? differenceInDays(new Date(), new Date(hiredAt)) : null;

  // Compose contextual sub fragments based on onboarding task state
  const findTask = (kw: string) => tasks.find((t) => t.label.toLowerCase().includes(kw));
  const welcome = findTask('welcome');
  const it = findTask('hardware') || findTask('it') || findTask('slack');
  const fragments: string[] = [];

  const base = offer?.field_values?.base_salary
    ? fmtMoney(offer.field_values.base_salary)
    : null;
  const headFragments: string[] = [];
  if (jobTitle) headFragments.push(jobTitle);
  if (base) headFragments.push(`${base} base`);
  if (hiredAt) headFragments.push(`signed ${format(new Date(hiredAt), 'MMM d')}`);
  if (headFragments.length) fragments.push(headFragments.join(' · '));
  if (welcome) fragments.push(welcome.done ? 'welcome packet sent' : 'welcome packet pending');
  if (it) fragments.push(it.done ? 'IT provisioning complete' : 'IT provisioning in progress');

  const startLabel = startDate ? `starts ${format(new Date(startDate), 'MMM d')}` : 'start date TBD';
  const meta = daysSinceHired != null
    ? daysSinceHired === 0
      ? 'Accepted offer today'
      : `Accepted offer ${daysSinceHired}d ago`
    : undefined;

  return (
    <StatusBanner
      tone="hired"
      icon={PartyPopper}
      eyebrow="Hired"
      meta={meta}
      title={<><strong className="font-semibold">{candidateFirstName || 'Candidate'}</strong> is hired — {startLabel}</>}
      sub={fragments.length ? fragments.join(' · ') : undefined}
      actions={
        <>
          {onOpenOnboarding && (
            <Button
              variant="secondary"
              size="md"
              icon={ExternalLink}
              onClick={onOpenOnboarding}
              style={{
                backgroundColor: 'rgba(255,252,249,0.12)',
                color: '#fffcf9',
                border: '1px solid rgba(255,252,249,0.22)',
              }}
            >
              Onboarding plan
            </Button>
          )}
          {onMarkReqClosed && (
            <Button
              variant="secondary"
              size="md"
              icon={Briefcase}
              onClick={onMarkReqClosed}
              style={{ backgroundColor: '#fffcf9', color: '#0B6E4F', border: 'none' }}
            >
              Mark req closed
            </Button>
          )}
        </>
      }
    />
  );
}
