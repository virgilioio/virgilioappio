import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Trash2, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useMembers } from '@/hooks/useMembers';
import { useTags } from '@/hooks/useTags';
import {
  ACTIONS, FAMILY_LABEL, TRIGGERS, TRIGGER_BY_KEY, ACTION_BY_KEY, DELAY_UNITS,
  defaultConfigFor, isEmailAction, restate, emptyEmailStep, recipeScreeningInvite,
  type AutomationAction, type AutomationTrigger, type AutomationTiming, type AutomationConfig,
  type ActionFamily, type AutomationEmailStep,
} from '@/lib/automations';
import type { StageAutomation, AutomationInput } from '@/hooks/useStageAutomations';
import { AutomationEmailComposer } from './AutomationEmailComposer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jhsId: string;
  stageName: string;
  automation?: StageAutomation | null;
  /** Prefill from the starter recipe. */
  recipe?: 'screening' | null;
  onSubmit: (input: AutomationInput) => Promise<unknown> | void;
  isSaving?: boolean;
}

const SECTION: React.CSSProperties = { fontSize: 11, color: '#8B8F9E', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 };
const FAMILIES: ActionFamily[] = ['candidate', 'team', 'pipeline'];
const NOTIFY_RECIPIENTS = [
  { key: 'hiring_team', label: 'Whole hiring team' },
  { key: 'recruiters', label: 'Recruiters' },
  { key: 'hiring_managers', label: 'Hiring managers' },
  { key: 'interviewers', label: 'Stage interviewers' },
  { key: 'job_owner', label: 'Job owner' },
];

export function AutomationBuilderSheet({ open, onOpenChange, jobId, jhsId, stageName, automation, recipe, onSubmit, isSaving }: Props) {
  const { identities } = useMailIdentities();
  const activeIdentities = useMemo(() => identities.filter((i) => i.is_active), [identities]);
  const { templates } = useEmailTemplates('organization');
  const { members } = useMembers();
  const { tags } = useTags();

  const { data: stages = [] } = useQuery({
    queryKey: ['job-hiring-stages-lite', jobId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('job_hiring_stages')
        .select('id, position, custom_stage_name, job_stages(stage_name)')
        .eq('job_id', jobId)
        .order('position', { ascending: true });
      return (data || []).map((s: any) => ({ id: s.id, name: s.custom_stage_name || s.job_stages?.stage_name || 'Stage' }));
    },
    enabled: open,
  });
  const { data: pools = [] } = useQuery({
    queryKey: ['candidate-lists-lite'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('candidate_lists').select('id, name').order('name');
      return (data || []) as { id: string; name: string }[];
    },
    enabled: open,
  });

  // ── Form state ───────────────────────────────────────────────
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('enter');
  const [triggerDays, setTriggerDays] = useState<number>(3);
  const [action, setAction] = useState<AutomationAction | null>(null);
  const [config, setConfig] = useState<AutomationConfig>({});
  const [timing, setTiming] = useState<AutomationTiming>('immediate');
  const [delayAmount, setDelayAmount] = useState<number>(1);
  const [delayUnit, setDelayUnit] = useState<string>('days');
  const [sendAt, setSendAt] = useState<string>('09:00');
  const [skipIfReplied, setSkipIfReplied] = useState(true);
  const [oncePerCandidate, setOncePerCandidate] = useState(true);
  const [touched, setTouched] = useState(false);

  const defaultFrom = activeIdentities[0]?.email_address || '';

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (automation) {
      setName(automation.name || '');
      setTrigger(automation.trigger);
      setTriggerDays(automation.trigger_days ?? 3);
      setAction(automation.action);
      setConfig({ ...defaultConfigFor(automation.action, defaultFrom), ...automation.config });
      setTiming(automation.timing || 'immediate');
      setDelayAmount(automation.delay_amount ?? 1);
      setDelayUnit(automation.delay_unit || 'days');
      setSendAt(automation.send_at ? automation.send_at.slice(0, 5) : '09:00');
      setSkipIfReplied(automation.skip_if_replied ?? true);
      setOncePerCandidate(automation.once_per_candidate ?? true);
    } else if (recipe === 'screening') {
      const r = recipeScreeningInvite(defaultFrom);
      setName(r.name); setTrigger(r.trigger); setTriggerDays(3); setAction(r.action); setConfig(r.config);
      setTiming('immediate'); setDelayAmount(1); setDelayUnit('days'); setSendAt('09:00');
      setSkipIfReplied(true); setOncePerCandidate(true);
    } else {
      setName(''); setTrigger('enter'); setTriggerDays(3); setAction(null); setConfig({});
      setTiming('immediate'); setDelayAmount(1); setDelayUnit('days'); setSendAt('09:00');
      setSkipIfReplied(true); setOncePerCandidate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, automation?.id, recipe]);

  // Once a mailbox loads, fill an empty From.
  useEffect(() => {
    if (action && isEmailAction(action) && !config.from && defaultFrom) setConfig((c) => ({ ...c, from: defaultFrom }));
  }, [defaultFrom, action, config.from]);

  const chooseAction = (key: AutomationAction) => {
    setAction(key);
    setConfig(defaultConfigFor(key, defaultFrom));
    if (!name.trim()) setName(ACTION_BY_KEY[key].label);
  };

  const patch = (p: Partial<AutomationConfig>) => setConfig((c) => ({ ...c, ...p }));
  const emails: AutomationEmailStep[] = Array.isArray(config.emails) ? config.emails : [];
  const setEmail = (i: number, next: AutomationEmailStep) => patch({ emails: emails.map((e, idx) => (idx === i ? next : e)) });

  // ── Validation ───────────────────────────────────────────────
  const errors = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('Give the automation a name.');
    if (!action) list.push('Choose what to do.');
    if (TRIGGER_BY_KEY[trigger]?.needsDays && (!triggerDays || triggerDays < 1)) list.push('Set how many days.');
    if (action && isEmailAction(action)) {
      if (!config.from) list.push('Choose a mailbox to send from.');
      emails.forEach((e, i) => {
        if (!e.subject?.trim()) list.push(`Email ${i + 1} needs a subject.`);
        if (!e.body_html?.replace(/<[^>]+>/g, '').trim()) list.push(`Email ${i + 1} needs a body.`);
      });
    }
    if (action === 'move' && !config.target_stage_id) list.push('Choose a stage to move to.');
    if (action === 'tag' && !config.tag_id) list.push('Choose a tag.');
    if (action === 'pool' && !config.pool_id) list.push('Choose a talent pool.');
    if (action === 'assign' && !config.assignee) list.push('Choose who to assign.');
    if (action === 'webhook' && !/^https:\/\//i.test(config.url || '')) list.push('Webhook URL must start with https://');
    if (action === 'notify' && !(config.recipients || []).length) list.push('Choose who to notify.');
    if (timing === 'delay' && (!delayAmount || delayAmount < 1)) list.push('Set a delay.');
    return list;
  }, [name, action, trigger, triggerDays, config, emails, timing, delayAmount]);

  const handleSave = async () => {
    setTouched(true);
    if (errors.length || !action) return;
    await onSubmit({
      name: name.trim(),
      action,
      trigger,
      trigger_days: TRIGGER_BY_KEY[trigger]?.needsDays ? triggerDays : null,
      timing,
      delay_amount: timing === 'delay' ? delayAmount : null,
      delay_unit: timing === 'delay' ? delayUnit : null,
      send_at: timing === 'at_time' ? `${sendAt}:00` : null,
      config,
      skip_if_replied: skipIfReplied,
      once_per_candidate: oncePerCandidate,
    });
  };

  const showSkipIfReplied = action ? isEmailAction(action) || trigger === 'noreply' || trigger === 'idle' : false;
  const activeMembers = members.filter((m) => m.user_status === 'active' && m.user_id);
  const memberLabel = (m: typeof members[number]) => [m.user_first_name, m.user_last_name].filter(Boolean).join(' ') || m.user_email || 'Member';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[880px] p-0 border-0 overflow-hidden z-[70] [&>button]:hidden"
        style={{ background: '#FAFAF7', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-4" style={{ borderBottom: '1px solid #F1F0EC', background: '#fff' }}>
            <div className="min-w-0">
              <div className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>{stageName} · Automations</div>
              <SheetTitle className="font-poppins tracking-[-0.04em]" style={{ fontSize: 20, fontWeight: 600, color: '#0d0d09' }}>
                {automation ? 'Edit automation' : 'New automation'}
              </SheetTitle>
              <SheetDescription className="sr-only">Configure when this automation runs, what it does, and its guardrails.</SheetDescription>
            </div>
            <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[#F1F0EC]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-8">
            {/* Name */}
            <section>
              <div style={SECTION} className="font-inter mb-2">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Screening invite" className="h-10 bg-white" maxLength={120} />
            </section>

            {/* WHEN */}
            <section>
              <div style={SECTION} className="font-inter mb-2">When</div>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGERS.map((t) => {
                  const selected = trigger === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTrigger(t.key)}
                      className={cn('text-left rounded-xl px-3.5 py-2.5 transition-colors font-inter', selected ? 'bg-[#0d0d09] text-[#FFFCF9]' : 'bg-white hover:bg-[#F1F0EC]')}
                      style={{ border: selected ? '1px solid #0d0d09' : '1px solid #E8E6E0', fontSize: 12.5 }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {TRIGGER_BY_KEY[trigger]?.needsDays && (
                <div className="mt-3 flex items-center gap-2 font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                  <span>After</span>
                  <Input type="number" min={1} max={90} value={triggerDays} onChange={(e) => setTriggerDays(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-[72px] bg-white text-center" />
                  <span>days {trigger === 'idle' ? 'in this stage' : 'without a reply'}</span>
                </div>
              )}
            </section>

            {/* DO */}
            <section>
              <div style={SECTION} className="font-inter mb-2">Do</div>
              <div className="space-y-4">
                {FAMILIES.map((fam) => (
                  <div key={fam}>
                    <div className="font-poppins mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#5A6072' }}>{FAMILY_LABEL[fam]}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {ACTIONS.filter((a) => a.family === fam).map((a) => {
                        const selected = action === a.key;
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.key}
                            type="button"
                            disabled={a.soon}
                            aria-pressed={selected}
                            onClick={() => chooseAction(a.key)}
                            className={cn('text-left rounded-xl p-3 flex items-start gap-3 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed', !a.soon && 'hover:bg-[#FAFAF7]')}
                            style={{ border: selected ? '2px solid #6F3FF5' : '1px solid #E8E6E0', padding: selected ? 11 : 12 }}
                          >
                            <span className="h-8 w-8 rounded-lg shrink-0 inline-flex items-center justify-center" style={{ background: a.bg, color: a.fg }}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-poppins truncate" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>
                                {a.label}{a.soon && <span className="ml-1.5 font-inter" style={{ fontSize: 10, color: '#8B8F9E', fontWeight: 500 }}>Soon</span>}
                              </span>
                              <span className="block font-inter" style={{ fontSize: 11.5, color: '#8B8F9E', lineHeight: 1.35 }}>{a.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Action settings */}
            {action && (
              <section>
                <div style={SECTION} className="font-inter mb-2">{ACTION_BY_KEY[action].label} · settings</div>

                {isEmailAction(action) && (
                  <div className="space-y-3">
                    {emails.map((e, i) => (
                      <div key={i} className="relative">
                        {action === 'sequence' && i > 0 && (
                          <div className="flex items-center gap-2 mb-2 font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                            <span>Send</span>
                            <Input type="number" min={1} max={60} value={e.delay_days} onChange={(ev) => setEmail(i, { ...e, delay_days: Math.max(1, Number(ev.target.value) || 1) })} className="h-8 w-[64px] bg-white text-center" />
                            <span>days after Email {i}</span>
                            <div className="flex-1" />
                            <button type="button" onClick={() => patch({ emails: emails.filter((_, idx) => idx !== i) })} className="inline-flex items-center gap-1 hover:underline" style={{ color: '#FA5252', fontSize: 12 }}>
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                          </div>
                        )}
                        <AutomationEmailComposer
                          step={e}
                          onChange={(next) => setEmail(i, next)}
                          from={config.from || ''}
                          onFromChange={(v) => patch({ from: v })}
                          identities={activeIdentities}
                          cc={config.cc || []}
                          bcc={config.bcc || []}
                          onCcChange={(v) => patch({ cc: v })}
                          onBccChange={(v) => patch({ bcc: v })}
                          templates={templates}
                          templateId={i === 0 ? (config.template_id ?? null) : null}
                          onTemplateChange={(id) => patch({ template_id: id })}
                          jobId={jobId}
                          automationKey={automation?.id || jhsId}
                          heading={action === 'sequence' ? `Email ${i + 1} of ${emails.length}` : undefined}
                          compact={i > 0}
                        />
                      </div>
                    ))}
                    {action === 'sequence' && emails.length < 5 && (
                      <Button variant="secondary" size="sm" icon={Plus} onClick={() => patch({ emails: [...emails, { ...emptyEmailStep(), delay_days: 3 }] })}>
                        Add another email
                      </Button>
                    )}
                    {activeIdentities.length === 0 && (
                      <div className="rounded-lg px-3 py-2 font-inter" style={{ background: '#FBF0DF', color: '#8A5A12', fontSize: 12.5 }}>
                        Connect a mailbox in Settings → Integrations before this automation can send.
                      </div>
                    )}
                  </div>
                )}

                {action === 'notify' && (
                  <Card>
                    <Field label="Who">
                      <div className="flex flex-wrap gap-1.5">
                        {NOTIFY_RECIPIENTS.map((r) => {
                          const on = (config.recipients || []).includes(r.key);
                          return (
                            <button key={r.key} type="button" aria-pressed={on} onClick={() => patch({ recipients: on ? (config.recipients || []).filter((x) => x !== r.key) : [...(config.recipients || []), r.key] })}
                              className={cn('h-7 px-2.5 rounded-full font-inter', on ? 'bg-[#0d0d09] text-[#FFFCF9]' : 'bg-white hover:bg-[#F1F0EC]')} style={{ fontSize: 12, border: on ? '1px solid #0d0d09' : '1px solid #E8E6E0' }}>
                              {r.label}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Message" hint="Variables like {{candidate.name}} and {{job.title}} work here.">
                      <Input value={config.message || ''} onChange={(e) => patch({ message: e.target.value })} placeholder="{{candidate.name}} just reached this stage" className="h-9 bg-white" />
                    </Field>
                  </Card>
                )}

                {action === 'task' && (
                  <Card>
                    <Field label="Assign to">
                      <Select value={config.assignee || 'job_owner'} onValueChange={(v) => patch({ assignee: v })}>
                        <SelectTrigger className="h-9 bg-white text-[12.5px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="job_owner">Job owner</SelectItem>
                          {activeMembers.map((m) => <SelectItem key={m.user_id!} value={m.user_id!}>{memberLabel(m)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Due">
                      <div className="flex items-center gap-2 font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                        <Input type="number" min={0} max={60} value={config.due_offset_days ?? 1} onChange={(e) => patch({ due_offset_days: Math.max(0, Number(e.target.value) || 0) })} className="h-8 w-[64px] bg-white text-center" />
                        <span>days after it runs</span>
                      </div>
                    </Field>
                    <Field label="Task">
                      <Input value={config.message || ''} onChange={(e) => patch({ message: e.target.value })} placeholder="Call {{candidate.name}} about next steps" className="h-9 bg-white" />
                    </Field>
                  </Card>
                )}

                {action === 'scorecard' && (
                  <Card>
                    <p className="font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                      Every interviewer assigned to this stage who hasn't submitted a scorecard for the candidate gets a reminder. Nothing else to set.
                    </p>
                  </Card>
                )}

                {action === 'assign' && (
                  <Card>
                    <Field label="Person">
                      <Select value={config.assignee || undefined} onValueChange={(v) => patch({ assignee: v })}>
                        <SelectTrigger className="h-9 bg-white text-[12.5px]"><SelectValue placeholder="Choose a team member" /></SelectTrigger>
                        <SelectContent>
                          {activeMembers.map((m) => <SelectItem key={m.user_id!} value={m.user_id!}>{memberLabel(m)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="As">
                      <Select value={config.role || 'interviewer'} onValueChange={(v) => patch({ role: v })}>
                        <SelectTrigger className="h-9 bg-white text-[12.5px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interviewer">Interviewer</SelectItem>
                          <SelectItem value="hiring_manager">Hiring manager</SelectItem>
                          <SelectItem value="recruiter">Recruiter</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </Card>
                )}

                {action === 'move' && (
                  <Card>
                    <Field label="Move to">
                      <Select value={config.target_stage_id || undefined} onValueChange={(v) => patch({ target_stage_id: v })}>
                        <SelectTrigger className="h-9 bg-white text-[12.5px]"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                        <SelectContent>
                          {stages.filter((s: any) => s.id !== jhsId).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  </Card>
                )}

                {action === 'reject' && (
                  <Card>
                    <p className="font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                      The candidate is marked rejected on this job with the reason "Automated · {name || 'this automation'}". No rejection email is sent — pair it with an email automation on the "Candidate is rejected here" trigger if you want one.
                    </p>
                  </Card>
                )}

                {action === 'tag' && (
                  <Card>
                    <Field label="Tag">
                      <Select value={config.tag_id || undefined} onValueChange={(v) => patch({ tag_id: v })}>
                        <SelectTrigger className="h-9 bg-white text-[12.5px]"><SelectValue placeholder="Choose a tag" /></SelectTrigger>
                        <SelectContent>
                          {tags.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  </Card>
                )}

                {action === 'pool' && (
                  <Card>
                    <Field label="Talent pool">
                      <Select value={config.pool_id || undefined} onValueChange={(v) => patch({ pool_id: v })}>
                        <SelectTrigger className="h-9 bg-white text-[12.5px]"><SelectValue placeholder="Choose a list" /></SelectTrigger>
                        <SelectContent>
                          {pools.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  </Card>
                )}

                {action === 'webhook' && (
                  <Card>
                    <Field label="URL" hint="We POST a JSON payload with the candidate, job and stage. HTTPS only.">
                      <Input value={config.url || ''} onChange={(e) => patch({ url: e.target.value })} placeholder="https://hooks.example.com/gio" className="h-9 bg-white font-mono text-[12.5px]" />
                    </Field>
                    <Field label="Signing secret" hint="Optional. Sent as X-Gio-Signature (HMAC-SHA256 of the body).">
                      <Input value={config.secret || ''} onChange={(e) => patch({ secret: e.target.value })} placeholder="Optional" className="h-9 bg-white font-mono text-[12.5px]" />
                    </Field>
                  </Card>
                )}
              </section>
            )}

            {/* TIMING */}
            <section>
              <div style={SECTION} className="font-inter mb-2">When to run</div>
              <div className="inline-flex rounded-lg p-1 gap-1" style={{ background: '#F1F0EC' }}>
                {([['immediate', 'Right away'], ['delay', 'After a delay'], ['at_time', 'At a time of day']] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={timing === k} onClick={() => setTiming(k)}
                    className={cn('h-7 px-3 rounded-md font-poppins', timing === k ? 'bg-white shadow-sm' : 'hover:bg-white/60')} style={{ fontSize: 12, fontWeight: 500, color: '#0d0d09' }}>
                    {l}
                  </button>
                ))}
              </div>
              {timing === 'delay' && (
                <div className="mt-3 flex items-center gap-2 font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                  <span>Wait</span>
                  <Input type="number" min={1} max={720} value={delayAmount} onChange={(e) => setDelayAmount(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-[72px] bg-white text-center" />
                  <Select value={delayUnit} onValueChange={setDelayUnit}>
                    <SelectTrigger className="h-8 w-[150px] bg-white text-[12.5px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{DELAY_UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {timing === 'at_time' && (
                <div className="mt-3 flex items-center gap-2 font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                  <span>Next</span>
                  <Input type="time" value={sendAt} onChange={(e) => setSendAt(e.target.value || '09:00')} className="h-8 w-[120px] bg-white" />
                  <span>in the job owner's timezone</span>
                </div>
              )}
              <p className="mt-2 font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
                Delayed and scheduled runs land on weekdays between 8:00 and 19:00. Anything else rolls to the next business morning.
              </p>
            </section>

            {/* GUARDRAILS */}
            <section>
              <div style={SECTION} className="font-inter mb-2">Guardrails</div>
              <div className="rounded-xl bg-white divide-y" style={{ border: '1px solid #E8E6E0' }}>
                <Guard title="Only once per candidate" hint="Never re-run for the same person on this job, even if they re-enter the stage." checked={oncePerCandidate} onChange={setOncePerCandidate} />
                {showSkipIfReplied && (
                  <Guard title="Skip if the candidate has replied" hint="Checked right before it runs, not when it's scheduled." checked={skipIfReplied} onChange={setSkipIfReplied} />
                )}
                <div className="px-4 py-3 font-inter" style={{ fontSize: 12, color: '#8B8F9E' }}>
                  Always skipped when the candidate has left this stage, been rejected or hired, or the job is closed.
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-7 py-4 flex items-center gap-4" style={{ borderTop: '1px solid #F1F0EC', background: '#fff' }}>
            <div className="min-w-0 flex-1">
              {action ? (
                <div className="flex items-center gap-2 font-inter truncate" style={{ fontSize: 12.5, color: '#5A6072' }}>
                  <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: '#6F3FF5' }} />
                  <span className="truncate">{restate(trigger, triggerDays, action, timing, delayAmount, delayUnit, sendAt)}</span>
                </div>
              ) : (
                <div className="font-inter" style={{ fontSize: 12.5, color: '#8B8F9E' }}>Pick a trigger and an action to see the summary.</div>
              )}
              {touched && errors.length > 0 && (
                <div className="mt-1 font-inter" style={{ fontSize: 11.5, color: '#FA5252' }}>{errors[0]}</div>
              )}
            </div>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={isSaving} icon={Check}>
              {automation ? 'Save changes' : 'Create automation'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-white p-4 space-y-3" style={{ border: '1px solid #E8E6E0' }}>{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-inter mb-1" style={{ fontSize: 11, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      {children}
      {hint && <div className="mt-1 font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>{hint}</div>}
    </div>
  );
}

function Guard({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <span>
        <span className="block font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>{title}</span>
        <span className="block font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>{hint}</span>
      </span>
    </label>
  );
}
