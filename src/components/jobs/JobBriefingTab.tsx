import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, RefreshCw, ArrowUp, ArrowUpRight, Sparkles, Info,
  Hourglass, Megaphone, Scale, Banknote, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

// ---- shapes mirroring the edge function payload --------------------------

type Severity = 'critical' | 'warning' | 'positive';
type Finding = {
  id: string;
  severity: Severity;
  evidence: Record<string, any>;
  actions: { label: string; prompt: string }[];
};
type Health = {
  status: 'stalled' | 'at_risk' | 'on_track' | 'ramping_up';
  label: string;
};
type Briefing = {
  paragraph: string;
  ranked_detector_ids: string[];
  status_reason_short: string;
  source: string;
};
type Snapshot = {
  job: {
    id: string;
    title: string;
    status: string;
    days_open: number;
    target_fill_date: string | null;
    budget: any;
  };
  pipeline: {
    active_count: number;
    rejected_count: number;
    withdrawn_count: number;
    hired_count: number;
    inbound_total: number;
    sourced_total: number;
    last_activity_at: string | null;
    stages: {
      stage: string;
      stage_type: string;
      position: number;
      active_count: number;
      median_days_in_stage: number | null;
      candidates: any[];
    }[];
    stages_from_offer: Record<string, number>;
  };
  composition: any;
  velocity: { median_days_to_rejection: number | null; transitions_last_7d: number };
};

type Payload = {
  snapshot: Snapshot;
  snapshot_hash: string;
  findings: Finding[];
  health: Health;
  briefing: Briefing;
  generated_at: string;
  cached: boolean;
};

// ---- helpers --------------------------------------------------------------

function relativeFromIso(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function askGio(
  prompt: string,
  jobId: string,
  jobTitle: string,
  toast: ReturnType<typeof useToast>['toast'],
) {
  const detail = { prompt, jobId, jobTitle };
  const evt = new CustomEvent('gio:ask', { detail });
  const dispatched = window.dispatchEvent(evt);
  const mounted = (window as any).__gioChatMounted === true;
  if (!mounted || !dispatched) {
    try {
      navigator.clipboard?.writeText(prompt);
    } catch {
      /* ignore */
    }
    toast({ title: 'Prompt copied', description: 'Paste it into Gio to continue.' });
  }
}

// Render a paragraph with **bold** segments → <strong> at weight 600.
function renderParagraph(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-[#0d0d09]">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// Evidence text with candidate names → links to profile.
function renderEvidence(
  text: string,
  candidates: { id?: string; name: string }[],
  onClickCandidate: (id: string) => void,
) {
  if (!candidates.length) return text;
  const sorted = [...candidates].sort((a, b) => b.name.length - a.name.length);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${sorted.map((c) => escape(c.name)).join('|')})`, 'g');
  const parts = text.split(re);
  return parts.map((part, i) => {
    const match = candidates.find((c) => c.name === part);
    if (match && match.id) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onClickCandidate(match.id!)}
          className="text-[#0d0d09] underline decoration-[#E0DDD3] underline-offset-2 hover:decoration-[#6F3FF5]"
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ---- detector → card copy (templated, NOT LLM) ----------------------------

type IssueTone = 'red' | 'amber';
type IssueIcon = typeof Hourglass;
type CardCopy = {
  tone: IssueTone;
  icon: IssueIcon;
  title: string;
  body: string;
  candidates: { id?: string; name: string }[];
};

function evidenceCard(f: Finding): CardCopy {
  const sev: IssueTone = f.severity === 'critical' ? 'red' : 'amber';
  switch (f.id) {
    case 'stalled_near_offer': {
      const e = f.evidence as {
        candidates: { id?: string; name: string; stage: string; days_in_stage: number }[];
        total: number;
        near_offer_stage: string;
      };
      const top = e.candidates.slice(0, 3);
      const names =
        top.length === 1
          ? top[0].name
          : top.length === 2
            ? `${top[0].name} and ${top[1].name}`
            : `${top[0].name}, ${top[1].name} and ${top[2].name}`;
      const days = top.map((c) => `${c.days_in_stage}`).join(', ');
      const more = e.total > 3 ? ` Plus ${e.total - 3} more waiting.` : '';
      return {
        tone: sev,
        icon: Hourglass,
        title: 'Final review is the bottleneck',
        body: `${names} have been in ${e.near_offer_stage} for ${days} days. These are the candidates closest to an offer.${more}`,
        candidates: top,
      };
    }
    case 'dead_posting': {
      const e = f.evidence as { days_open: number; inbound_total: number; sourced_total: number };
      const head =
        e.inbound_total === 0
          ? `Zero inbound applications in ${e.days_open} days open.`
          : `No inbound applications in the last 30 days.`;
      return {
        tone: sev,
        icon: Megaphone,
        title: "The posting isn't producing candidates",
        body: `${head} The pipeline is surviving on manual sourcing (${e.sourced_total} sourced).`,
        candidates: [],
      };
    }
    case 'salary_misalignment': {
      const e = f.evidence as {
        mode: string;
        median: number;
        p10: number;
        p90: number;
        spread_ratio: number | null;
        budget: any;
      };
      const fmt = (n: number) => new Intl.NumberFormat().format(Math.round(n));
      if (e.mode === 'over_budget' && e.budget) {
        const gap = Math.round(((e.median - e.budget.max) / e.budget.max) * 100);
        return {
          tone: sev,
          icon: Banknote,
          title: 'Pipeline expectations exceed the budget',
          body: `Median expectation ${fmt(e.median)} ${e.budget.currency} vs cap ${fmt(e.budget.max)} (+${gap}%). Without a band adjustment, this job will die at offer stage.`,
          candidates: [],
        };
      }
      return {
        tone: sev,
        icon: Scale,
        title: 'Salary expectations are incoherent',
        body: `Spread ${e.spread_ratio?.toFixed(1)}× between p10 ${fmt(e.p10)} and p90 ${fmt(e.p90)}. A spread this wide usually means the role mixes mid and senior profiles, and no budget band is set.`,
        candidates: [],
      };
    }
    case 'thin_pipeline': {
      const e = f.evidence as { active_pre_interview: number; active_total: number };
      return {
        tone: sev,
        icon: AlertTriangle,
        title: 'Not enough candidates at the top',
        body: `Only ${e.active_pre_interview} active candidate${e.active_pre_interview === 1 ? '' : 's'} before interviews. Even perfect conversion can't produce a hire from this funnel.`,
        candidates: [],
      };
    }
    case 'no_activity': {
      const e = f.evidence as {
        variant: string;
        days_since_last_activity: number;
        active_count: number;
      };
      if (e.variant === 'empty_pipeline') {
        return {
          tone: sev,
          icon: AlertTriangle,
          title: 'Empty pipeline on an open job',
          body: `No active candidates and no transitions in the last 7 days.`,
          candidates: [],
        };
      }
      return {
        tone: sev,
        icon: AlertTriangle,
        title: 'No movement this week',
        body: `${e.active_count} active candidate${e.active_count === 1 ? '' : 's'} but zero stage transitions in the last 7 days. Something is stuck.`,
        candidates: [],
      };
    }
    default:
      return { tone: sev, icon: AlertTriangle, title: f.id, body: '', candidates: [] };
  }
}

// ---- status pill ----------------------------------------------------------

function StatusPill({ health, reason }: { health: Health; reason: string }) {
  const palette = {
    stalled:    { bg: '#FEE2E2', fg: '#C92A2A', dot: '#E03131' },
    at_risk:    { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
    on_track:   { bg: '#D1FAE5', fg: '#065F46', dot: '#12B886' },
    ramping_up: { bg: '#F1F0EC', fg: '#5A6072', dot: '#9CA3AF' },
  }[health.status];

  const label =
    health.status === 'stalled'
      ? `Stalled${reason ? ` — ${reason}` : ''}`
      : health.status === 'at_risk'
        ? `At risk${reason ? ` — ${reason}` : ''}`
        : health.status === 'on_track'
          ? 'On track'
          : 'Ramping up';

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full"
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        padding: '6px 12px',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12.5,
        fontWeight: 500,
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 7, height: 7, backgroundColor: palette.dot, display: 'inline-block' }}
      />
      <span>
        <strong style={{ fontWeight: 600 }}>{label.split(' — ')[0]}</strong>
        {label.includes(' — ') ? ` — ${label.split(' — ')[1]}` : ''}
      </span>
    </span>
  );
}

// ---- stat tile -----------------------------------------------------------

type TileTone = 'neutral' | 'amber' | 'red' | 'green';
const TILE_TONE: Record<TileTone, string> = {
  neutral: '#8B8F9E',
  amber:   '#B45309',
  red:     '#C92A2A',
  green:   '#0B7A52',
};

function StatTile({
  label,
  value,
  qualifier,
  tone = 'neutral',
  empty,
}: {
  label: string;
  value: string;
  qualifier: string;
  tone?: TileTone;
  empty?: boolean;
}) {
  return (
    <div
      className="bg-white"
      style={{
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        padding: '14px 16px 13px',
        boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
      }}
    >
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11.5,
          fontWeight: 500,
          color: '#8B8F9E',
        }}
      >
        {label}
      </div>
      <div
        className="mt-1 tabular-nums"
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: 27,
          letterSpacing: '-0.04em',
          color: empty ? '#B5B9C4' : '#0d0d09',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11.5,
          lineHeight: 1.45,
          color: TILE_TONE[tone],
        }}
      >
        {qualifier}
      </div>
    </div>
  );
}

// ---- main -----------------------------------------------------------------

interface JobBriefingTabProps {
  jobId: string;
  jobTitle: string;
  jobLocation?: string | null;
  companyName?: string | null;
}

export function JobBriefingTab({ jobId, jobTitle }: JobBriefingTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ask, setAsk] = useState('');

  const load = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const { data: res, error } = await supabase.functions.invoke('generate-job-briefing', {
          body: { job_id: jobId, force },
        });
        if (error) throw error;
        setData(res as Payload);
      } catch (err: any) {
        toast({
          title: 'Briefing unavailable',
          description: err?.message ?? 'Could not generate briefing.',
          variant: 'destructive' as any,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [jobId, toast],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const ranked = useMemo(() => {
    if (!data) return [];
    const order = data.briefing.ranked_detector_ids?.length
      ? data.briefing.ranked_detector_ids
      : data.findings.filter((f) => f.severity !== 'positive').map((f) => f.id);
    const byId = new Map(data.findings.map((f) => [f.id, f] as const));
    return order
      .map((id) => byId.get(id))
      .filter((f): f is Finding => !!f && f.severity !== 'positive')
      .slice(0, 3);
  }, [data]);

  const positive = useMemo(
    () => data?.findings.find((f) => f.id === 'fast_decisions') ?? null,
    [data],
  );

  if (loading || !data) {
    return (
      <div
        className="mx-auto"
        style={{
          maxWidth: 768,
          padding: '24px 28px 56px',
          backgroundColor: 'transparent',
        }}
      >
        <div className="space-y-4 animate-pulse">
          <div className="h-7 w-32 rounded bg-[#EDEDE6]" />
          <div className="h-40 rounded-[14px] bg-[#EDEDE6]" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 rounded-[12px] bg-[#EDEDE6]" />
            <div className="h-24 rounded-[12px] bg-[#EDEDE6]" />
            <div className="h-24 rounded-[12px] bg-[#EDEDE6]" />
          </div>
        </div>
      </div>
    );
  }

  const s = data.snapshot;

  // Closest-to-offer tile (within 2 stages of offer)
  const closestList = s.pipeline.stages.flatMap((st) => {
    const dist = s.pipeline.stages_from_offer[st.stage] ?? 99;
    if (dist > 2 || st.stage_type === 'offer' || st.stage_type === 'onboarding') return [];
    return st.candidates.map((c: any) => ({ ...c, stage: st.stage }));
  });
  const closestCount = closestList.length;
  const maxWait = closestList.reduce(
    (m: number, c: any) => Math.max(m, c.days_in_stage ?? 0),
    0,
  );

  // Active candidates split
  const inbound = s.pipeline.inbound_total;
  const sourced = s.pipeline.sourced_total;
  const activeSplit =
    s.pipeline.active_count === 0
      ? { text: 'no candidates yet', tone: 'neutral' as TileTone }
      : inbound === 0
        ? { text: 'all sourced, none inbound', tone: 'amber' as TileTone }
        : sourced === 0
          ? { text: 'all inbound', tone: 'neutral' as TileTone }
          : { text: `${inbound} inbound · ${sourced} sourced`, tone: 'neutral' as TileTone };

  // Closest qualifier
  const closestQualifier =
    closestCount === 0
      ? { text: 'no one near offer yet', tone: 'neutral' as TileTone }
      : maxWait >= 7
        ? { text: `waiting ${maxWait}d in final review`, tone: 'red' as TileTone }
        : { text: 'within 2 stages of offer', tone: 'neutral' as TileTone };

  // Projected fill
  let projected: { value: string; qualifier: string; tone: TileTone; empty: boolean };
  if (!s.job.target_fill_date) {
    projected = {
      value: '—',
      qualifier: 'no target set',
      tone: 'neutral',
      empty: true,
    };
  } else {
    const days = Math.ceil(
      (new Date(s.job.target_fill_date).getTime() - Date.now()) / 86_400_000,
    );
    const noMovement = s.velocity.transitions_last_7d === 0 && s.pipeline.active_count > 0;
    if (days < 0) {
      projected = {
        value: `${Math.abs(days)}d over`,
        qualifier: 'past target fill date',
        tone: 'red',
        empty: false,
      };
    } else if (noMovement) {
      projected = {
        value: '—',
        qualifier: 'no forecast without movement',
        tone: 'red',
        empty: true,
      };
    } else if (data.health.status === 'on_track') {
      projected = {
        value: `${days}d`,
        qualifier: 'on target',
        tone: 'green',
        empty: false,
      };
    } else {
      projected = {
        value: `${days}d`,
        qualifier: 'to target fill date',
        tone: 'neutral',
        empty: false,
      };
    }
  }

  // Sparse data note for salary
  const salaryDatapoints =
    (s.composition?.salary?.datapoints as number | undefined) ?? 0;
  const salaryTotal =
    (s.composition?.salary?.total_candidates as number | undefined) ?? s.pipeline.active_count;
  const showSparseSalary =
    salaryDatapoints > 0 &&
    salaryTotal > 0 &&
    salaryDatapoints < 3 &&
    salaryDatapoints / salaryTotal < 0.5;

  const openCandidate = (id: string) => navigate(`/candidates/${id}`);

  const suggestions = [
    {
      label: 'Full funnel',
      prompt: `Show me the full hiring funnel for ${jobTitle} with stage-by-stage conversion.`,
    },
    {
      label: 'Source quality',
      prompt: `Which sources are producing the best candidates for ${jobTitle}?`,
    },
    {
      label: 'What changed this week',
      prompt: `What changed on ${jobTitle} in the last 7 days?`,
    },
  ];

  return (
    <div
      className="mx-auto w-full"
      style={{
        maxWidth: 768,
        padding: '24px 28px 56px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Top row: status pill aligned right (header itself lives outside this tab) */}
      <div className="flex justify-end mb-3">
        <StatusPill health={data.health} reason={data.briefing.status_reason_short} />
      </div>

      {/* 2 · Briefing card (cream hero) */}
      <div
        style={{
          backgroundColor: '#fffcf9',
          border: '1px solid #E7E8EE',
          borderRadius: 14,
          padding: '26px 28px 0',
          boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
        }}
      >
        {/* Byline */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: '#E9DEFE',
            }}
          >
            <Sparkles size={12} color="#6F3FF5" strokeWidth={2} />
          </span>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              color: '#5A6072',
            }}
          >
            Gio's read
          </span>
        </div>

        {/* Paragraph */}
        <p
          className="mt-[14px]"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 16.5,
            lineHeight: 1.7,
            letterSpacing: '-0.006em',
            color: '#1F2230',
            textWrap: 'pretty' as any,
          }}
        >
          {data.briefing.paragraph
            ? renderParagraph(data.briefing.paragraph)
            : 'Briefing unavailable right now. The evidence below is still accurate.'}
        </p>

        {/* Footer */}
        <div
          className="flex items-center justify-between mt-4"
          style={{
            borderTop: '1px solid #F1F0EC',
            padding: '10px 0 12px',
          }}
        >
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 11.5,
              color: '#8B8F9E',
            }}
          >
            Updated {relativeFromIso(data.generated_at)} from pipeline activity
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh briefing"
            className="inline-flex items-center justify-center hover:text-[#1F2230] disabled:opacity-50"
            style={{ color: '#8B8F9E', padding: 4, background: 'transparent', border: 'none' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 3 · Three stat tiles */}
      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}
      >
        <StatTile
          label="Active candidates"
          value={String(s.pipeline.active_count)}
          qualifier={activeSplit.text}
          tone={activeSplit.tone}
        />
        <StatTile
          label="Closest to offer"
          value={String(closestCount)}
          qualifier={closestQualifier.text}
          tone={closestQualifier.tone}
        />
        <StatTile
          label="Projected fill"
          value={projected.value}
          qualifier={projected.qualifier}
          tone={projected.tone}
          empty={projected.empty}
        />
      </div>

      {/* Sparse data note */}
      {showSparseSalary && (
        <div
          className="flex items-center gap-2"
          style={{ marginTop: 14, color: '#8B8F9E', fontSize: 12 }}
        >
          <Info size={13} color="#B5B9C4" strokeWidth={2} />
          <span>
            Salary fit unavailable — only {salaryDatapoints} of {salaryTotal} candidates have salary
            data.
          </span>
        </div>
      )}

      {/* 4 · Needs attention */}
      {ranked.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: '0.08em',
                color: '#8B8F9E',
                textTransform: 'uppercase',
              }}
            >
              Needs attention
            </span>
            <span
              className="inline-flex items-center justify-center"
              style={{
                backgroundColor: '#F1F0EC',
                color: '#5A6072',
                borderRadius: 999,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 10.5,
                padding: '2px 7px',
              }}
            >
              {ranked.length}
            </span>
          </div>
          <div className="flex flex-col" style={{ gap: 10 }}>
            {ranked.map((f) => {
              const copy = evidenceCard(f);
              const Icon = copy.icon;
              const isRed = copy.tone === 'red';
              return (
                <div
                  key={f.id}
                  className="bg-white"
                  style={{
                    border: '1px solid #E7E8EE',
                    borderRadius: 12,
                    padding: '16px 18px',
                    boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
                    display: 'flex',
                    gap: 12,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center shrink-0"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      backgroundColor: isRed ? '#FEE2E2' : '#FEF3C7',
                    }}
                  >
                    <Icon size={14} color={isRed ? '#C92A2A' : '#B45309'} strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: '#0d0d09',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {copy.title}
                    </h3>
                    {copy.body && (
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 12.5,
                          lineHeight: 1.6,
                          color: '#5A6072',
                          marginTop: 4,
                          overflowWrap: 'break-word',
                          wordBreak: 'break-word',
                        }}
                      >
                        {renderEvidence(copy.body, copy.candidates, openCandidate)}
                      </p>
                    )}
                    {f.actions.length > 0 && (
                      <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                        {f.actions.slice(0, 2).map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => askGio(a.prompt, jobId, jobTitle, toast)}
                            className="inline-flex items-center bg-white hover:bg-[#FAFAF7] transition-colors"
                            style={{
                              height: 30,
                              padding: '0 11px',
                              borderRadius: 8,
                              border: '1px solid #E0DDD3',
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 500,
                              fontSize: 12.5,
                              color: '#1F2230',
                              gap: 8,
                            }}
                          >
                            <Sparkles size={13} color="#6F3FF5" strokeWidth={2} />
                            <span>{a.label}</span>
                            <ArrowUpRight size={12} color="#B5B9C4" strokeWidth={2} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5 · Working well (only when no critical issues) */}
      {positive && ranked.length === 0 && (
        <div className="flex items-center gap-2" style={{ marginTop: 18 }}>
          <Check size={14} color="#12B886" strokeWidth={2} />
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12.5,
              color: '#5A6072',
            }}
          >
            Screening decisions are fast — rejected candidates got an answer in{' '}
            {(positive.evidence as any).median_days_to_rejection}d median.
          </span>
        </div>
      )}

      {/* 6 · Ask box */}
      <div style={{ marginTop: 34 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = ask.trim();
            if (!text) return;
            askGio(text, jobId, jobTitle, toast);
            setAsk('');
          }}
          className="flex items-center bg-white"
          style={{
            border: '1px solid #E0DDD3',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(13,13,9,0.05)',
            padding: 6,
            gap: 8,
          }}
        >
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: '#E9DEFE',
            }}
          >
            <Sparkles size={14} color="#6F3FF5" strokeWidth={2} />
          </span>
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Ask anything about this job…"
            className="flex-1 bg-transparent outline-none border-0"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13.5,
              color: '#1F2230',
            }}
          />
          <button
            type="submit"
            aria-label="Send"
            className="inline-flex items-center justify-center shrink-0"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: '#0d0d09',
              color: '#fffcf9',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ArrowUp size={15} color="#fffcf9" strokeWidth={2} />
          </button>
        </form>
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
          {suggestions.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => askGio(c.prompt, jobId, jobTitle, toast)}
              className="bg-white hover:bg-[#FAFAF7] transition-colors"
              style={{
                border: '1px solid #E7E8EE',
                borderRadius: 999,
                padding: '5px 11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: 11.5,
                color: '#5A6072',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
