import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  UserRoundX, X, Plus, Mail, Send, Clock, Calendar as CalendarIcon,
  Check, ChevronDown, History, TriangleAlert, Loader2, Eye, EyeOff,
} from 'lucide-react';
import { addDays } from 'date-fns';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { useRejectionReasons } from '@/hooks/useRejectionReasons';
import { useRejectCandidate } from '@/hooks/useRejectCandidate';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';
import { cn } from '@/lib/utils';

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associationId: string;
  candidateName: string;
  candidateEmail: string;
  candidateId?: string;
  jobId?: string;
  jobTitle?: string;
  onSuccess?: () => void;
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
  open, onOpenChange, associationId, candidateName, candidateEmail,
  candidateId, jobId, jobTitle, onSuccess,
}: RejectionDialogProps) {
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

  const firstName = (candidateName || 'Candidate').trim().split(/\s+/)[0];
  const jobLabel = jobTitle || 'this job';

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

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

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

  const emailComplete = !!(fromEmail && toEmail && subjectHtml && bodyHtml);
  const canSubmit = !!rejectionReasonId && (!sendEmail || emailComplete);
  const scheduleFor = sendEmail && sendOption === 'later' ? resolvePresetDate(preset, customDateTime) : undefined;
  const isScheduled = !!scheduleFor;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const emailData = sendEmail && emailComplete ? {
        fromEmail,
        toEmails: toEmail.split(/[,;]/).map((e) => e.trim()).filter(Boolean),
        subject: convertHtmlToPlaceholders(subjectHtml),
        bodyHtml: convertHtmlToPlaceholders(bodyHtml),
        candidateId,
        jobId,
      } : undefined;

      await rejectCandidate.mutateAsync({
        associationId,
        rejectionReasonId,
        rejectionNotes: rejectionNotes.trim() || undefined,
        sendEmail: !!emailData,
        emailData,
        scheduleFor,
      });

      // Persist prefs + recent
      const nextRecent = [rejectionReasonId!, ...recentReasonIds.filter((id) => id !== rejectionReasonId)].slice(0, MAX_RECENT);
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

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(13,13,9,0.34)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex flex-col bg-white w-[600px] max-w-full"
        style={{
          borderRadius: 18,
          boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          maxHeight: 'calc(100vh - 48px)',
        }}
      >
        {/* Header */}
        <div className="relative flex-shrink-0" style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#FEECEC' }}
            >
              <UserRoundX size={18} style={{ color: '#DC2626' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-inter uppercase"
                style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', color: '#8B8F9E' }}
              >
                CANDIDATE · {jobLabel}
              </div>
              <div
                className="font-poppins whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.035em', color: '#0d0d09', marginTop: 2 }}
              >
                Reject {candidateName}<span style={{ color: '#D7C5FB' }}>.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="flex items-center justify-center hover:bg-[#F1F0EC] rounded-md transition"
              style={{ width: 30, height: 30, color: '#8B8F9E' }}
            >
              <X size={17} />
            </button>
          </div>
          <p className="font-inter" style={{ fontSize: 12.5, color: '#5A6072', lineHeight: 1.5, marginTop: 12 }}>
            Removes {firstName} from <span style={{ color: '#1F2230', fontWeight: 600 }}>{jobLabel}</span>. Their profile and history stay in your talent pool.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 24 }}>
          <div className="flex flex-col" style={{ gap: 20 }}>
            {/* 1. Rejection reason */}
            <section className="flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <label className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}>
                  Rejection reason
                </label>
                <span className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
                  Internal only — never shown to the candidate
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
                    Send rejection email
                  </div>
                  <div className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 1 }}>
                    {sendEmail ? `${firstName} will be notified about your decision.` : `${firstName} won't be notified.`}
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
                      <div className="grid grid-cols-2" style={{ gap: 12 }}>
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
                        <div style={{ border: '1px solid #E0DDD3', borderRadius: 9, overflow: 'hidden' }}>
                          <div
                            className="flex items-center gap-0.5"
                            style={{ backgroundColor: '#FBFAF7', borderBottom: '1px solid #EDECE6', padding: '4px 6px' }}
                          >
                            <ToolbarGlyph><Bold size={13} /></ToolbarGlyph>
                            <ToolbarGlyph><Italic size={13} /></ToolbarGlyph>
                            <ToolbarGlyph><Underline size={13} /></ToolbarGlyph>
                            <span style={{ width: 1, height: 16, backgroundColor: '#EDECE6', margin: '0 4px' }} />
                            <ToolbarGlyph><List size={13} /></ToolbarGlyph>
                            <ToolbarGlyph><ListOrdered size={13} /></ToolbarGlyph>
                          </div>
                          <BodyTemplateEditor
                            value={bodyHtml}
                            onChange={setBodyHtml}
                            placeholder="Write your rejection email…"
                            minHeight="124px"
                          />
                        </div>
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
                  Add a recipient and subject to send the rejection email.
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
              {sendEmail ? 'Candidate will be emailed' : "Candidate won't be notified"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="font-poppins hover:bg-[#F1F0EC] transition"
            style={{ height: 34, padding: '0 14px', borderRadius: 9, fontSize: 13, fontWeight: 500, color: '#1F2230' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || rejectCandidate.isPending}
            className={cn('inline-flex items-center gap-1.5 font-poppins transition', (!canSubmit || rejectCandidate.isPending) && 'pointer-events-none')}
            style={{
              height: 34, padding: '0 14px', borderRadius: 9,
              fontSize: 13, fontWeight: 500,
              backgroundColor: '#DC2626', color: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(220,38,38,0.30)',
              opacity: (!canSubmit || rejectCandidate.isPending) ? 0.4 : 1,
            }}
          >
            {rejectCandidate.isPending ? (
              <><Loader2 size={13} className="animate-spin" /> Rejecting…</>
            ) : isScheduled ? (
              <><Clock size={13} /> Reject & schedule email</>
            ) : sendEmail ? (
              <><Send size={13} /> Reject & send email</>
            ) : (
              <><UserRoundX size={13} /> Reject candidate</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-poppins mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}>
      {children}
    </div>
  );
}

function ToolbarGlyph({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded-md transition hover:bg-[#F1F0EC]"
      style={{ width: 28, height: 28, color: '#5A6072' }}
    >
      {children}
    </button>
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
