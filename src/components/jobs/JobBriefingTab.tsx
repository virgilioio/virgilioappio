import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, MessageCircleQuestion, RefreshCw, Send,
  TrendingDown, Users, Timer, CalendarClock, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

// ---- shapes mirroring the edge function payload --------------------------

type Severity = 'critical' | 'warning' | 'positive';
type Finding = { id: string; severity: Severity; evidence: Record<string, any>; actions: { label: string; prompt: string }[] };
type Health = { status: 'stalled' | 'at_risk' | 'on_track' | 'ramping_up'; label: string };
type Briefing = { paragraph: string; ranked_detector_ids: string[]; status_reason_short: string; source: string };
type Snapshot = {
  job: { id: string; title: string; status: string; days_open: number; target_fill_date: string | null; budget: any };
  pipeline: {
    active_count: number; rejected_count: number; withdrawn_count: number; hired_count: number;
    inbound_total: number; sourced_total: number; last_activity_at: string | null;
    stages: { stage: string; stage_type: string; position: number; active_count: number; median_days_in_stage: number | null; candidates: any[] }[];
    stages_from_offer: Record<string, number>;
  };
  composition: any;
  velocity: { median_days_to_rejection: number | null; transitions_last_7d: number };
};

type Payload = {
  snapshot: Snapshot; snapshot_hash: string; findings: Finding[];
  health: Health; briefing: Briefing; generated_at: string; cached: boolean;
};

// ---- helpers --------------------------------------------------------------

function relativeFromIso(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function askGio(prompt: string, jobId: string, jobTitle: string, toast: ReturnType<typeof useToast>['toast']) {
  // Dispatch a typed event for the (future) Gio chat surface to consume.
  const detail = { prompt, jobId, jobTitle };
  const evt = new CustomEvent('gio:ask', { detail });
  const handled = !window.dispatchEvent(evt) || (window as any).__gioChatMounted === true;
  if (!handled) {
    // Graceful fallback while the global Gio panel isn't wired here yet.
    try { navigator.clipboard?.writeText(prompt); } catch { /* ignore */ }
    toast({ title: 'Prompt copied', description: 'Paste it into Gio to continue.' });
  }
}

// ---- detector card copy (templated, NOT LLM) ------------------------------

type CardCopy = { icon: typeof AlertTriangle; title: string; body: string };

function evidenceCard(f: Finding, s: Snapshot): CardCopy {
  switch (f.id) {
    case 'stalled_near_offer': {
      const e = f.evidence as { candidates: { name: string; stage: string; days_in_stage: number }[]; total: number; near_offer_stage: string };
      const names = e.candidates.slice(0, 3).map((c) => `${c.name} (${c.days_in_stage}d)`).join(', ');
      const more = e.total > 3 ? ` and ${e.total - 3} more` : '';
      return {
        icon: Timer,
        title: 'Final review is the bottleneck',
        body: `${e.total} candidate${e.total === 1 ? '' : 's'} waiting in ${e.near_offer_stage}: ${names}${more}. These are the closest to an offer.`,
      };
    }
    case 'dead_posting': {
      const e = f.evidence as { days_open: number; inbound_total: number; sourced_total: number };
      const head = e.inbound_total === 0
        ? `Zero inbound applications in ${e.days_open} days open.`
        : `No inbound applications in the last 30 days.`;
      return {
        icon: TrendingDown,
        title: "The posting isn't producing candidates",
        body: `${head} The pipeline is surviving on manual sourcing (${e.sourced_total} sourced).`,
      };
    }
    case 'salary_misalignment': {
      const e = f.evidence as { mode: string; median: number; p10: number; p90: number; spread_ratio: number | null; budget: any };
      const fmt = (n: number) => new Intl.NumberFormat().format(Math.round(n));
      if (e.mode === 'over_budget' && e.budget) {
        const gap = Math.round(((e.median - e.budget.max) / e.budget.max) * 100);
        return {
          icon: AlertTriangle,
          title: 'Pipeline expectations exceed the budget',
          body: `Median expectation ${fmt(e.median)} ${e.budget.currency} vs cap ${fmt(e.budget.max)} (+${gap}%). Without a band adjustment, this job will die at offer stage.`,
        };
      }
      return {
        icon: AlertTriangle,
        title: 'Salary expectations are incoherent',
        body: `Spread ${e.spread_ratio?.toFixed(1)}× between p10 ${fmt(e.p10)} and p90 ${fmt(e.p90)}. A spread this wide usually means the role mixes mid and senior profiles. No budget band is set.`,
      };
    }
    case 'thin_pipeline': {
      const e = f.evidence as { active_pre_interview: number; active_total: number };
      return {
        icon: Users,
        title: 'Not enough candidates at the top',
        body: `Only ${e.active_pre_interview} active candidate${e.active_pre_interview === 1 ? '' : 's'} before interviews. Even perfect conversion can't produce a hire from this funnel.`,
      };
    }
    case 'no_activity': {
      const e = f.evidence as { variant: string; days_since_last_activity: number; active_count: number };
      if (e.variant === 'empty_pipeline') {
        return {
          icon: AlertTriangle,
          title: 'Empty pipeline on an open job',
          body: `No active candidates and no transitions in the last 7 days.`,
        };
      }
      return {
        icon: AlertTriangle,
        title: 'No movement this week',
        body: `${e.active_count} active candidate${e.active_count === 1 ? '' : 's'} but zero stage transitions in the last 7 days. Something is stuck.`,
      };
    }
    default:
      return { icon: AlertTriangle, title: f.id, body: '' };
  }
}

// ---- status pill ----------------------------------------------------------

function StatusPill({ health, reason }: { health: Health; reason: string }) {
  const tone =
    health.status === 'stalled' ? 'red' :
    health.status === 'at_risk' ? 'orange' :
    health.status === 'on_track' ? 'green' : 'neutral';
  const label = health.status === 'stalled' && reason
    ? `Stalled — ${reason}`
    : health.label;
  return <Badge tone={tone as any} size="md" dot bordered>{label}</Badge>;
}

// ---- main -----------------------------------------------------------------

interface JobBriefingTabProps {
  jobId: string;
  jobTitle: string;
  jobLocation?: string | null;
  companyName?: string | null;
}

export function JobBriefingTab({ jobId, jobTitle, jobLocation, companyName }: JobBriefingTabProps) {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ask, setAsk] = useState('');

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-job-briefing', {
        body: { job_id: jobId, force },
      });
      if (error) throw error;
      setData(res as Payload);
    } catch (err: any) {
      toast({ title: 'Briefing unavailable', description: err?.message ?? 'Could not generate briefing.', variant: 'destructive' as any });
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [jobId, toast]);

  useEffect(() => { load(false); }, [load]);

  // Auto-regenerate when generated_at is older than 12h.
  useEffect(() => {
    if (!data?.generated_at) return;
    const ageMs = Date.now() - new Date(data.generated_at).getTime();
    if (ageMs > 12 * 60 * 60 * 1000 && !refreshing) load(true);
  }, [data?.generated_at, load, refreshing]);

  const ranked = useMemo(() => {
    if (!data) return [];
    const idOrder = data.briefing.ranked_detector_ids?.length
      ? data.briefing.ranked_detector_ids
      : data.findings.filter((f) => f.severity !== 'positive').map((f) => f.id);
    const byId = new Map(data.findings.map((f) => [f.id, f] as const));
    return idOrder.map((id) => byId.get(id)).filter((f): f is Finding => !!f && f.severity !== 'positive').slice(0, 3);
  }, [data]);

  const positive = useMemo(
    () => data?.findings.find((f) => f.id === 'fast_decisions') ?? null,
    [data],
  );

  if (loading || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const s = data.snapshot;
  const metaParts = [companyName, jobLocation, `open ${s.job.days_open}d`].filter(Boolean);

  // Closest-to-offer tile
  const closest = s.pipeline.stages.flatMap((st) => {
    const dist = s.pipeline.stages_from_offer[st.stage] ?? 99;
    if (dist > 2 || st.stage_type === 'offer' || st.stage_type === 'onboarding') return [];
    return st.candidates.map((c) => ({ ...c, stage: st.stage }));
  });
  const closestCount = closest.length;
  const maxWait = closest.reduce((m, c) => Math.max(m, c.days_in_stage ?? 0), 0);

  // Projected fill
  let projected: { title: string; subtitle: string } = { title: '—', subtitle: 'no forecast' };
  if (s.job.target_fill_date) {
    const days = Math.ceil((new Date(s.job.target_fill_date).getTime() - Date.now()) / 86_400_000);
    projected = {
      title: days >= 0 ? `${days}d` : `${Math.abs(days)}d over`,
      subtitle: days >= 0 ? 'to target fill date' : 'past target fill date',
    };
  }

  // Inbound/sourced subtitle
  const total = s.pipeline.inbound_total + s.pipeline.sourced_total;
  const splitSubtitle = total === 0
    ? 'no inbound or sourced yet'
    : (s.pipeline.inbound_total === 0
        ? 'all sourced'
        : `${s.pipeline.inbound_total} inbound / ${s.pipeline.sourced_total} sourced`);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-poppins font-semibold text-[22px] tracking-[-0.04em] text-[#0d0d09] truncate">
            {jobTitle}
          </h1>
          <p className="font-inter text-[12.5px] text-[#5A6072] mt-0.5">
            {metaParts.join(' · ')}
          </p>
        </div>
        <StatusPill health={data.health} reason={data.briefing.status_reason_short} />
      </div>

      {/* Briefing card */}
      <div className="rounded-[14px] bg-[#FAFAF7] border border-[#E7E8EE] px-5 py-4">
        {data.briefing.paragraph
          ? (
            <p className="font-inter text-[14px] leading-[1.55] text-[#1F2230]">
              {data.briefing.paragraph}
            </p>
          )
          : (
            <p className="font-inter text-[12.5px] text-[#8B8F9E] italic">
              Briefing paragraph unavailable. Findings below are still accurate.
            </p>
          )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F1F0EC]">
          <span className="font-inter text-[11.5px] text-[#8B8F9E]">
            Updated {relativeFromIso(data.generated_at)} from pipeline activity
            {data.cached ? ' · cached' : ''}
          </span>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label="Refresh briefing"
            onClick={() => load(true)}
            loading={refreshing}
            icon={RefreshCw}
          />
        </div>
      </div>

      {/* Three stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Active candidates"
          value={String(s.pipeline.active_count)}
          subtitle={splitSubtitle}
        />
        <StatTile
          label="Closest to offer"
          value={String(closestCount)}
          subtitle={closestCount > 0 && ranked.some((f) => f.id === 'stalled_near_offer')
            ? `max wait ${maxWait}d`
            : 'within 2 stages of offer'}
        />
        <StatTile
          label="Projected fill"
          value={projected.title}
          subtitle={projected.subtitle}
        />
      </div>

      {/* Needs attention */}
      {ranked.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-poppins font-semibold text-[13px] tracking-[-0.02em] text-[#0d0d09] uppercase">
            Needs attention
          </h2>
          {ranked.map((f) => {
            const copy = evidenceCard(f, s);
            const Icon = copy.icon;
            const tone =
              f.severity === 'critical' ? 'border-l-[3px] border-l-[#E5484D]' :
              'border-l-[3px] border-l-[#F5A524]';
            return (
              <div key={f.id} className={`rounded-[14px] bg-white border border-[#E7E8EE] ${tone} px-5 py-4`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${f.severity === 'critical' ? 'text-[#E5484D]' : 'text-[#F5A524]'}`}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-poppins font-semibold text-[14px] text-[#0d0d09]">{copy.title}</h3>
                    {copy.body && (
                      <p className="font-inter text-[13px] leading-[1.55] text-[#1F2230] mt-1">{copy.body}</p>
                    )}
                    {f.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {f.actions.map((a, i) => (
                          <Button
                            key={i}
                            variant={i === 0 ? 'purple' : 'secondary'}
                            size="sm"
                            onClick={() => askGio(a.prompt, jobId, jobTitle, toast)}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Working well */}
      {positive && (
        <div className="flex items-center gap-2 px-1">
          <Check size={14} className="text-[#30A46C]" />
          <span className="font-inter text-[12.5px] text-[#5A6072]">
            Working well — rejection decisions are fast (median {(positive.evidence as any).median_days_to_rejection}d).
          </span>
        </div>
      )}

      {/* Ask box */}
      <div className="rounded-[14px] bg-white border border-[#E7E8EE] px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-[#6E56CF]" />
          <span className="font-poppins font-semibold text-[12px] text-[#0d0d09] uppercase tracking-[-0.02em]">
            Ask Gio about this job
          </span>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = ask.trim();
            if (!text) return;
            askGio(`${text} (${jobTitle} role)`, jobId, jobTitle, toast);
            setAsk('');
          }}
        >
          <Input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Ask anything about this job…"
            className="flex-1"
          />
          <Button type="submit" variant="purple" size="md" icon={Send} aria-label="Send" />
        </form>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: 'Full funnel', prompt: `Show me the full hiring funnel for ${jobTitle} with stage-by-stage conversion.` },
            { label: 'Source quality', prompt: `Which sources are producing the best candidates for ${jobTitle}?` },
            { label: 'What changed this week', prompt: `What changed on ${jobTitle} in the last 7 days?` },
          ].map((c) => (
            <Button
              key={c.label}
              variant="ghost"
              size="xs"
              icon={MessageCircleQuestion}
              onClick={() => askGio(c.prompt, jobId, jobTitle, toast)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-[14px] bg-white border border-[#E7E8EE] px-5 py-4">
      <div className="font-inter text-[11px] uppercase tracking-[0.06em] text-[#8B8F9E]">{label}</div>
      <div className="font-poppins font-semibold text-[28px] tracking-[-0.04em] text-[#0d0d09] mt-1 tabular-nums">
        {value}
      </div>
      <div className="font-inter text-[12px] text-[#5A6072] mt-0.5">{subtitle}</div>
    </div>
  );
}
