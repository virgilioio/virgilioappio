import { useState, useEffect, useMemo, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  UserRoundX, Plus, Mail, Send, Clock, Calendar as CalendarIcon,
  Check, History, TriangleAlert, EyeOff,
} from 'lucide-react';
import { addDays } from 'date-fns';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { useRejectionReasons } from '@/hooks/useRejectionReasons';
import { useRejectCandidate } from '@/hooks/useRejectCandidate';
import { useBulkRejectCandidates } from '@/hooks/useBulkRejectCandidates';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associationId?: string;
  candidateIds?: string[];
  candidateName?: string;
  candidateEmail?: string;
  candidateId?: string;
  jobId?: string;
  jobTitle?: string;
  onSuccess?: () => void;
  /** Extra consequence shown under the description (e.g. offer letters that go). */
  notice?: React.ReactNode;
  /**
   * The job is being closed or archived (2026-10-13): everyone still in its
   * pipeline has to be rejected first, so the form says so and its button
   * does both. The caller changes the job's status in `onSuccess`.
   */
  closingJob?: 'close' | 'archive';
}

const STORAGE_KEY = 'rejection-dialog-prefs';
const MAX_RECENT = 4;

type Prefs = {
  rejectionReasonId?: string;
  sendEmail?: boolean;
  recentReasons?: string[];
};

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Prefs;
  } catch {}
  return {};
}

type SchedulePreset = 'tomorrow' | '2days' | '3days' | '1week' | 'custom';

const PRESET_DAYS: Record<Exclude<SchedulePreset, 'custom'>, number> = {
  tomorrow: 1, '2days': 2, '3days': 3, '1week': 7,
};

function resolvePresetDate(preset: SchedulePreset, custom?: string): Date | undefined {
  if (preset === 'custom') {
    if (!custom) return undefined;
    const d = new Date(custom);
    if (Number.isNaN(d.getTime())) return undefined;
    return d;
  }
  const days = PRESET_DAYS[preset];
  const d = addDays(new Date(), days);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function RejectionDialog({
  open, onOpenChange, associationId, candidateIds = [], candidateName = 'Candidate', candidateEmail = '',
  candidateId, jobId, jobTitle, onSuccess, notice, closingJob,
}: RejectionDialogProps) {
  const isBulk = candidateIds.length > 0;
  const candidateCount = isBulk ? candidateIds.length : 1;
  // "Reject 1 candidates" read wrong; one selected reads as one (2026-10-13).
  const many = candidateCount !== 1;
  const prefs = useMemo(readPrefs, [open]);

  const [rejectionReasonId, setRejectionReasonId] = useState<string | undefined>(prefs.rejectionReasonId);
  const [recentReasonIds, setRecentReasonIds] = useState<string[]>(prefs.recentReasons || []);
  const [showNote, setShowNote] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(prefs.sendEmail ?? true);

  // Email composer state
  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useRejectionEmailTemplates('organization');
  const activeIdentities = useMemo(() => identities.filter((i) => i.is_active), [identities]);

  const [fromEmail, setFromEmail] = useState('');
  const [toEmail, setToEmail] = useState(candidateEmail || '');
  const [subjectHtml, setSubjectHtml] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__none__');

  const [sendOption, setSendOption] = useState<'now' | 'later'>('now');
  const [preset, setPreset] = useState<SchedulePreset>('tomorrow');
  const [customDateTime, setCustomDateTime] = useState('');

  const { reasons } = useRejectionReasons('organization');
  const rejectCandidate = useRejectCandidate();
  const bulkReject = useBulkRejectCandidates();
  const [bulkAssociationIds, setBulkAssociationIds] = useState<string[]>([]);
  const [bulkNames, setBulkNames] = useState<string[]>([]);
  const [upcoming, setUpcoming] = useState(0);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const firstName = (candidateName || 'Candidate').trim().split(/\s+/)[0];
  const jobLabel = jobTitle || 'this job';
  const mutationPending = isBulk ? bulkReject.isPending : rejectCandidate.isPending;

  useEffect(() => {
    if (!open || !isBulk || !jobId) return;
    let active = true;
    setBulkAssociationIds([]);
    setBulkNames([]);
    void supabase
      .from('job_candidate_associations')
      .select('id, candidates(candidate_name)')
      .eq('job_id', jobId)
      .in('candidate_id', candidateIds)
      .not('status', 'eq', 'rejected')
      .not('status', 'eq', 'hired')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Failed to load candidates for bulk rejection:', error);
          return;
        }
        setBulkAssociationIds((data || []).map((row) => row.id));
        setBulkNames((data || []).map((row) => {
          const c = (row as { candidates?: { candidate_name?: string | null } | null }).candidates;
          return c?.candidate_name?.trim() || 'Unnamed candidate';
        }));
      });
    return () => { active = false; };
  }, [open, isBulk, jobId, candidateIds]);

  // Rejecting cancels upcoming interviews for this job (with emails), so say so.
  useEffect(() => {
    if (!open || !jobId) return;
    const ids = isBulk ? candidateIds : candidateId ? [candidateId] : [];
    if (!ids.length) return;
    let active = true;
    setUpcoming(0);
    void supabase
      .from('scheduled_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .in('candidate_id', ids.slice(0, 200))
      .in('status', ['confirmed', 'rescheduled'])
      .gt('scheduled_end', new Date().toISOString())
      .then(({ count }) => { if (active) setUpcoming(count ?? 0); });
    return () => { active = false; };
  }, [open, isBulk, jobId, candidateId, candidateIds]);

  // Reset per-candidate state when opening
  useEffect(() => {
    if (open) {
      setToEmail(candidateEmail || '');
      setRejectionNotes('');
      setShowNote(false);
      setCustomDateTime('');
      setSendOption('now');
      setPreset('tomorrow');
    }
  }, [open, candidateEmail]);

  useEffect(() => {
    if (activeIdentities.length > 0 && !fromEmail) {
      setFromEmail(activeIdentities[0].email_address);
    }
  }, [activeIdentities, fromEmail]);

  // ⌘Enter submits (Esc and the backdrop are handled by the dialog).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit && !mutationPending) {
        e.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const recruiterReasons = reasons.filter((r) => r.category === 'recruiter_rejected');
  const candidateReasons = reasons.filter((r) => r.category === 'candidate_declined');

  const reasonById = useMemo(() => {
    const m = new Map<string, typeof reasons[number]>();
    reasons.forEach((r) => m.set(r.id, r));
    return m;
  }, [reasons]);

  const recentChips = recentReasonIds
    .map((id) => reasonById.get(id))
    .filter(Boolean)
    .slice(0, MAX_RECENT) as typeof reasons;

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (id === '__none__') return;
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubjectHtml(convertHtmlToPlaceholders(t.subject));
      setBodyHtml(convertHtmlToPlaceholders(t.body));
    }
  };

  const emailComplete = !!(fromEmail && (isBulk || toEmail) && subjectHtml && bodyHtml);
  const hasTargets = isBulk ? bulkAssociationIds.length > 0 : !!associationId;
  const canSubmit = hasTargets && !!rejectionReasonId && (!sendEmail || emailComplete);
  const scheduleFor = sendEmail && sendOption === 'later' ? resolvePresetDate(preset, customDateTime) : undefined;
  const isScheduled = !!scheduleFor;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const emailData = sendEmail && emailComplete ? {
        fromEmail,
        toEmails: isBulk ? [] : toEmail.split(/[,;]/).map((e) => e.trim()).filter(Boolean),
        subject: convertHtmlToPlaceholders(subjectHtml),
        bodyHtml: convertHtmlToPlaceholders(bodyHtml),
        candidateId,
        jobId,
      } : undefined;

      if (isBulk) {
        await bulkReject.mutateAsync({
          associationIds: bulkAssociationIds,
          rejectionReasonId,
          rejectionNotes: rejectionNotes.trim() || undefined,
          sendEmail: !!emailData,
          emailData: emailData ? {
            fromEmail: emailData.fromEmail,
            subject: emailData.subject,
            bodyHtml: emailData.bodyHtml,
          } : undefined,
          scheduleFor,
        });
      } else if (associationId) {
        await rejectCandidate.mutateAsync({
          associationId,
          rejectionReasonId,
          rejectionNotes: rejectionNotes.trim() || undefined,
          sendEmail: !!emailData,
          emailData,
          scheduleFor,
        });
      }

      // Persist prefs + recent
      const nextRecent = rejectionReasonId
        ? [rejectionReasonId, ...recentReasonIds.filter((id) => id !== rejectionReasonId)].slice(0, MAX_RECENT)
        : recentReasonIds;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          rejectionReasonId,
          sendEmail,
          recentReasons: nextRecent,
        } satisfies Prefs));
      } catch {}
      setRecentReasonIds(nextRecent);

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Rejection failed:', err);
    }
  };

  const progressPercent = bulkReject.progress.total > 0
    ? ((bulkReject.progress.completed + bulkReject.progress.failed) / bulkReject.progress.total) * 100
    : 0;

  // A row's Reject goes through the bulk path with one id: still name the person.
  const soloName = (isBulk ? bulkNames[0] ?? '' : candidateName).trim();
  const soloFirst = soloName.split(/\s+/)[0] || 'This candidate';
  const who = isBulk && many ? `${candidateCount} candidates` : soloName || 'this candidate';
  const title = closingJob
    ? `${closingJob === 'archive' ? 'Archive' : 'Close'} ${jobLabel} and reject ${who}?`
    : isBulk && many ? `Reject ${candidateCount} candidates?` : `Reject ${soloName || 'this candidate'}?`;
  const whoStays = isBulk && many ? 'Their profiles and histories stay' : 'Their profile and history stay';
  const interviews = upcoming > 0
    ? ` ${upcoming} upcoming interview${upcoming === 1 ? ' is' : 's are'} cancelled and everyone on ${upcoming === 1 ? 'it' : 'them'} is emailed.`
    : '';
  const shownNames = bulkNames.slice(0, 3);
  const moreNames = candidateCount - shownNames.length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o && !mutationPending) onOpenChange(false); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[100] gio-dialog-overlay"
          style={{ backgroundColor: 'rgba(13,13,9,0.34)' }}
          onClick={() => { if (!mutationPending) onOpenChange(false); }}
        />
        <DialogPrimitive.Content
          aria-describedby="rejection-dialog-desc"
          className="fixed left-[50%] top-[50%] z-[100] [translate:-50%_-50%] flex flex-col bg-white w-[600px] max-w-[calc(100vw-32px)] gio-dialog"
          style={{
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
            maxHeight: 'calc(100vh - 48px)',
          }}
          onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}
          onEscapeKeyDown={(e) => { if (mutationPending) e.preventDefault(); }}
          // Clicks on the backdrop close it (above); nothing else outside does.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
        {/* Header (Block B §16: badge, the title names who, the description says what goes and what stays) */}
        <div className="relative flex-shrink-0" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
          <div className="flex items-start gap-[14px]">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
            >
              <UserRoundX className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                {title}
              </DialogPrimitive.Title>
              {closingJob ? (
                <p id="rejection-dialog-desc" className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                  {isBulk && many ? `The ${candidateCount} candidates still in its pipeline are` : `${soloFirst}, still in its pipeline, is`} rejected first.{interviews}{' '}
                  <span className="font-medium text-text-primary">Rejecting can’t be undone.</span> {whoStays} in your talent pool.{' '}
                  {closingJob === 'archive'
                    ? 'The job moves to Jobs › Archived and its postings go offline.'
                    : 'The job stops taking applications and its postings go offline; you can reopen it from Edit job › Status.'}
                </p>
              ) : (
                <p id="rejection-dialog-desc" className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                  {isBulk && many ? `They’re` : `${soloFirst} is`} removed from <span className="font-medium text-text-primary">{jobLabel}</span>.{interviews} {whoStays} in your talent pool, and you can reactivate them later.
                  {notice ? <> {notice}</> : null}
                </p>
              )}
              {isBulk && many && shownNames.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {shownNames.map((n, i) => (
                    <span key={`${n}-${i}`} className="max-w-[180px] truncate rounded-full bg-[#F4F3EF] px-2.5 py-[3px] text-[12px] font-medium text-text-primary">{n}</span>
                  ))}
                  {moreNames > 0 && (
                    <span className="rounded-full bg-[#F4F3EF] px-2.5 py-[3px] text-[12px] font-medium text-text-secondary">+{moreNames} more</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 24 }}>
          <div className="flex flex-col" style={{ gap: 20 }}>
            {isBulk && bulkReject.isPending && (
              <div className="flex-shrink-0" style={{ backgroundColor: '#FAFAF7', border: '1px solid #EDECE6', borderRadius: 10, padding: '10px 12px' }}>
                <div className="flex items-center justify-between font-inter mb-2" style={{ fontSize: 11.5, color: '#5A6072' }}>
                  <span>Processing rejections…</span>
                  <span>{bulkReject.progress.completed + bulkReject.progress.failed}/{bulkReject.progress.total}</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>
            )}
            {/* 1. Rejection reason */}
            <section className="flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <label className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}>
                  Rejection reason
                </label>
                <span className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
                  Internal only — never shown to {isBulk ? 'candidates' : 'the candidate'}
                </span>
              </div>

              {recentChips.length > 0 && (
                <div className="mb-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <History size={11} style={{ color: '#A8ACB8' }} />
                    <span
                      className="font-inter uppercase"
                      style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', color: '#A8ACB8' }}
                    >
                      Recently used
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentChips.map((r) => {
                      const selected = rejectionReasonId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRejectionReasonId(r.id)}
                          className="inline-flex items-center font-inter transition"
                          style={{
                            height: 30,
                            borderRadius: 999,
                            padding: '0 11px',
                            fontSize: 12,
                            gap: 6,
                            backgroundColor: selected ? '#F5EFFF' : '#FFFFFF',
                            border: `1px solid ${selected ? '#DFCBFB' : '#E7E8EE'}`,
                            boxShadow: selected ? 'inset 0 0 0 1px #DFCBFB' : undefined,
                            color: selected ? '#5B21B6' : '#4A4F60',
                          }}
                        >
                          {selected && <Check size={12} style={{ color: '#6F3FF5' }} />}
                          <span className="truncate max-w-[200px]">{r.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Select value={rejectionReasonId} onValueChange={setRejectionReasonId}>
                <SelectTrigger
                  className="w-full font-inter"
                  style={{ height: 40, borderRadius: 9, borderColor: '#E0DDD3', fontSize: 13, color: '#1F2230' }}
                >
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent
                  style={{ border: '1px solid #EDECE6', borderRadius: 11, boxShadow: '0 16px 40px -8px rgba(13,13,9,0.24)', padding: 5, maxHeight: 240 }}
                >
                  {recruiterReasons.length > 0 && (
                    <SelectGroup>
                      <SelectLabel
                        className="font-inter uppercase"
                        style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', color: '#A8ACB8', padding: '6px 10px 4px' }}
                      >
                        We rejected them
                      </SelectLabel>
                      {recruiterReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="rounded-lg" style={{ padding: '8px 10px', fontSize: 13 }}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {candidateReasons.length > 0 && (
                    <SelectGroup>
                      <SelectLabel
                        className="font-inter uppercase"
                        style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', color: '#A8ACB8', padding: '6px 10px 4px' }}
                      >
                        They declined
                      </SelectLabel>
                      {candidateReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="rounded-lg" style={{ padding: '8px 10px', fontSize: 13 }}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>

              {/* Note disclosure */}
              {!showNote ? (
                <button
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="inline-flex items-center gap-1.5 mt-3 font-poppins hover:underline transition"
                  style={{ fontSize: 12.5, fontWeight: 500, color: '#6F3FF5' }}
                >
                  <Plus size={13} />
                  Add a note for the hiring team
                </button>
              ) : (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-poppins" style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}>
                      Note for the hiring team <span style={{ color: '#8B8F9E', fontWeight: 400 }}>· optional</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowNote(false); setRejectionNotes(''); }}
                      className="font-inter hover:underline"
                      style={{ fontSize: 11.5, color: '#8B8F9E' }}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    placeholder="Add context about why this candidate is being rejected…"
                    rows={3}
                    className="w-full font-inter focus:outline-none focus:ring-2 focus:ring-virgilio-purple/20"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E0DDD3',
                      borderRadius: 9,
                      padding: '10px 12px',
                      fontSize: 13,
                      color: '#1F2230',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
            </section>

            {/* 2. Email toggle card */}
            <section
              className="flex-shrink-0"
              style={{
                border: `1px solid ${sendEmail ? '#E7DFFB' : '#EDECE6'}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex items-center gap-3"
                style={{ padding: '13px 15px', backgroundColor: sendEmail ? '#FAF8FF' : '#FBFAF7' }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    backgroundColor: sendEmail ? '#EDE4FF' : '#F1F0EC',
                    color: sendEmail ? '#6F3FF5' : '#8B8F9E',
                  }}
                >
                  <Mail size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-poppins" style={{ fontSize: 13, fontWeight: 600, color: '#1F2230' }}>
                    Send rejection {isBulk ? 'emails' : 'email'}
                  </div>
                  <div className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 1 }}>
                    {sendEmail
                      ? (isBulk ? 'Each candidate will receive a personalized email.' : `${firstName} will be notified about your decision.`)
                      : (isBulk ? "Candidates won't be notified." : `${firstName} won't be notified.`)}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sendEmail}
                  onClick={() => setSendEmail((v) => !v)}
                  className="relative flex-shrink-0 transition-colors"
                  style={{
                    width: 42, height: 24, borderRadius: 999,
                    backgroundColor: sendEmail ? '#6F3FF5' : '#D4D2CA',
                  }}
                >
                  <span
                    className="absolute top-1/2 -translate-y-1/2 bg-white rounded-full transition-all"
                    style={{
                      width: 18, height: 18,
                      left: sendEmail ? 21 : 3,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>

              {sendEmail && (
                <div style={{ padding: 15, borderTop: '1px solid #EDE4FF', backgroundColor: '#FFFFFF' }}>
                  {loadingIdentities ? (
                    <Skeleton className="h-64 w-full" />
                  ) : activeIdentities.length === 0 ? (
                    <div className="text-center py-6 font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                      Connect an email account to send rejection emails.
                    </div>
                  ) : (
                    <div className="flex flex-col" style={{ gap: 14 }}>
                      {/* Template */}
                      <FieldLabel>Template</FieldLabel>
                      <Select value={selectedTemplateId} onValueChange={handleTemplateSelect} disabled={loadingTemplates}>
                        <SelectTrigger className="w-full font-inter" style={{ height: 38, borderRadius: 9, borderColor: '#E0DDD3', fontSize: 13, marginTop: -8 }}>
                          <SelectValue placeholder="No template" />
                        </SelectTrigger>
                        <SelectContent style={{ border: '1px solid #EDECE6', borderRadius: 11, padding: 5 }}>
                          <SelectItem value="__none__" style={{ padding: '8px 10px', fontSize: 13 }}>No template</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id} style={{ padding: '8px 10px', fontSize: 13 }}>
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span>{t.name}</span>
                                {t.source === 'platform' && (
                                  <span
                                    className="font-inter"
                                    style={{ backgroundColor: '#F1F0EC', color: '#5A6072', borderRadius: 6, fontSize: 10, padding: '1px 6px' }}
                                  >
                                    Platform
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* From + To */}
                      <div className={isBulk ? '' : 'grid grid-cols-2'} style={{ gap: 12 }}>
                        <div>
                          <FieldLabel>From</FieldLabel>
                          <Select value={fromEmail} onValueChange={setFromEmail}>
                            <SelectTrigger className="w-full font-inter" style={{ height: 38, borderRadius: 9, borderColor: '#E0DDD3', fontSize: 13 }}>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent style={{ border: '1px solid #EDECE6', borderRadius: 11, padding: 5 }}>
                              {activeIdentities.map((id) => (
                                <SelectItem key={id.id} value={id.email_address} style={{ padding: '8px 10px', fontSize: 13 }}>
                                  {id.display_name} ({id.email_address})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {!isBulk && (
                          <div>
                            <FieldLabel>To</FieldLabel>
                            <input
                              type="email"
                              value={toEmail}
                              onChange={(e) => setToEmail(e.target.value)}
                              placeholder="recipient@example.com"
                              className="w-full font-inter focus:outline-none focus:ring-2 focus:ring-virgilio-purple/20"
                              style={{ height: 38, border: '1px solid #E0DDD3', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#1F2230' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Subject */}
                      <div>
                        <FieldLabel>Subject</FieldLabel>
                        <SubjectTemplateEditor
                          value={subjectHtml}
                          onChange={setSubjectHtml}
                          placeholder="Update on your application"
                        />
                      </div>

                      {/* Message */}
                      <div>
                        <FieldLabel>Message</FieldLabel>
                        <BodyTemplateEditor
                          value={bodyHtml}
                          onChange={setBodyHtml}
                          placeholder="Write your rejection email…"
                          minHeight="124px"
                        />
                      </div>

                      {/* When to send */}
                      <div>
                        <FieldLabel>When to send</FieldLabel>
                        <div className="flex" style={{ gap: 8 }}>
                          <WhenCard
                            selected={sendOption === 'now'}
                            onClick={() => setSendOption('now')}
                            icon={<Send size={14} />}
                            title="Send immediately"
                            subtitle="As soon as you confirm"
                          />
                          <WhenCard
                            selected={sendOption === 'later'}
                            onClick={() => setSendOption('later')}
                            icon={<Clock size={14} />}
                            title="Schedule for later"
                            subtitle="Pick a delivery time"
                          />
                        </div>

                        {sendOption === 'later' && (
                          <div style={{ marginTop: 10, backgroundColor: '#FBFAF7', border: '1px solid #EDECE6', borderRadius: 11, padding: 12 }}>
                            <div className="flex" style={{ gap: 6 }}>
                              <PresetChip selected={preset === 'tomorrow'} onClick={() => setPreset('tomorrow')} title="Tomorrow" subtitle="9:00 AM" />
                              <PresetChip selected={preset === '2days'} onClick={() => setPreset('2days')} title="In 2 days" subtitle="9:00 AM" />
                              <PresetChip selected={preset === '3days'} onClick={() => setPreset('3days')} title="In 3 days" subtitle="9:00 AM" />
                              <PresetChip selected={preset === '1week'} onClick={() => setPreset('1week')} title="Next week" subtitle="Mon 9:00 AM" />
                              <PresetChip
                                selected={preset === 'custom'}
                                onClick={() => setPreset('custom')}
                                title="Custom"
                                subtitle="Pick date"
                                icon={<CalendarIcon size={11} style={{ color: preset === 'custom' ? '#5B21B6' : '#8B8F9E' }} />}
                              />
                            </div>
                            {preset === 'custom' && (
                              <input
                                type="datetime-local"
                                value={customDateTime}
                                onChange={(e) => setCustomDateTime(e.target.value)}
                                className="w-full font-inter mt-2 focus:outline-none focus:ring-2 focus:ring-virgilio-purple/20"
                                style={{ height: 38, border: '1px solid #E0DDD3', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#1F2230' }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 3. Validation strip */}
            {sendEmail && !emailComplete && (
              <div
                className="flex items-start gap-2 flex-shrink-0"
                style={{ backgroundColor: '#FFF9EE', border: '1px solid #F5E4BE', borderRadius: 10, padding: '10px 12px' }}
              >
                <TriangleAlert size={14} style={{ color: '#B45309', marginTop: 1, flexShrink: 0 }} />
                <span className="font-inter" style={{ fontSize: 12, color: '#7A5510', lineHeight: 1.45 }}>
                  {isBulk ? 'Choose a sender and add a subject and message to email the selected candidates.' : 'Add a recipient and subject to send the rejection email.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center gap-3"
          style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', backgroundColor: '#FAFAF7', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
            {sendEmail ? <Mail size={12} /> : <EyeOff size={12} />}
            <span className="truncate">
              {sendEmail ? (isBulk ? `${candidateCount} personalized emails will be sent` : 'Candidate will be emailed') : (isBulk ? "Candidates won't be notified" : "Candidate won't be notified")}
            </span>
          </div>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={mutationPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="dangerSolid"
            size="md"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={mutationPending}
            className={cn(!canSubmit && 'pointer-events-none')}
          >
            {closingJob ? (
              <><UserRoundX size={13} /> Reject {isBulk && many ? candidateCount : ''}{isBulk && many ? ' ' : ''}and {closingJob === 'archive' ? 'archive' : 'close'} job</>
            ) : isScheduled ? (
              <><Clock size={13} /> Reject & schedule {isBulk ? 'emails' : 'email'}</>
            ) : sendEmail ? (
              <><Send size={13} /> Reject & send {isBulk ? 'emails' : 'email'}</>
            ) : (
              <><UserRoundX size={13} /> Reject {isBulk && many ? `${candidateCount} candidates` : 'candidate'}</>
            )}
          </Button>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-poppins mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}>
      {children}
    </div>
  );
}

function WhenCard({
  selected, onClick, icon, title, subtitle,
}: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 transition text-left"
      style={{
        flex: 1,
        padding: '11px 12px',
        borderRadius: 11,
        backgroundColor: selected ? '#F5EFFF' : '#FFFFFF',
        border: `1px solid ${selected ? '#DFCBFB' : '#EDECE6'}`,
        boxShadow: selected ? 'inset 0 0 0 1px #DFCBFB' : undefined,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 30, height: 30, borderRadius: 8,
          backgroundColor: selected ? '#EDE4FF' : '#F1F0EC',
          color: selected ? '#6F3FF5' : '#5A6072',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: selected ? '#5B21B6' : '#1F2230' }}>
          {title}
        </div>
        <div className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 1 }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

function PresetChip({
  selected, onClick, title, subtitle, icon,
}: { selected: boolean; onClick: () => void; title: string; subtitle: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition"
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '7px 8px',
        borderRadius: 9,
        backgroundColor: selected ? '#FFFFFF' : 'transparent',
        border: `1px solid ${selected ? '#DFCBFB' : '#E7E8EE'}`,
        boxShadow: selected ? 'inset 0 0 0 1px #DFCBFB' : undefined,
      }}
    >
      <div className="flex items-center gap-1 font-poppins truncate" style={{ fontSize: 12, fontWeight: 500, color: selected ? '#5B21B6' : '#1F2230' }}>
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <div className="font-inter truncate" style={{ fontSize: 10, color: '#8B8F9E', marginTop: 1 }}>
        {subtitle}
      </div>
    </button>
  );
}
