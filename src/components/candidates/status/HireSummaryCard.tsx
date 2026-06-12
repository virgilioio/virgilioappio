import { ReactNode } from 'react';
import { format, differenceInDays } from 'date-fns';
import { useOfferLetters } from '@/hooks/useOfferLetters';
import { useOfferFormFields } from '@/hooks/useOfferFormFields';

interface HireSummaryCardProps {
  candidateId: string;
  jobId: string;
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

function fmtLocation(v: any): string | null {
  if (!v) return null;
  let parsed: any = v;
  if (typeof v === 'string') { try { parsed = JSON.parse(v); } catch { return v; } }
  if (typeof parsed === 'string') return parsed;
  const parts = [parsed?.city, parsed?.state, parsed?.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b last:border-b-0" style={{ borderColor: '#F1F0EC' }}>
      <span
        className="font-inter uppercase shrink-0"
        style={{ fontSize: 10.5, letterSpacing: '0.06em', color: '#8B8F9E' }}
      >
        {label}
      </span>
      <span className="font-inter text-right" style={{ fontSize: 12.5, color: '#1F2230' }}>{value}</span>
    </div>
  );
}

export function HireSummaryCard({ candidateId, jobId }: HireSummaryCardProps) {
  const { offerLetters } = useOfferLetters(candidateId);
  const offer = offerLetters.find((ol) => ol.job_id === jobId);
  const { fields } = useOfferFormFields(offer?.form_id || undefined);
  if (!offer) return null;
  const fv = offer.field_values || {};

  // Pick known fields by name heuristics
  const pickByType = (type: string) => fields.filter((f) => f.field_type === type);
  const salaryFields = pickByType('salary');
  const locationFields = pickByType('location');
  const dateFields = pickByType('date');

  const startDate = (() => {
    const f = dateFields.find((x) => /start/i.test(x.field_label) || /start/i.test(x.field_name));
    return f ? fv[f.field_name] : null;
  })();
  const title = fv.title || fv.job_title || null;
  const baseSalary = (() => {
    const f = salaryFields.find((x) => /base/i.test(x.field_label));
    return f ? fmtMoney(fv[f.field_name]) : null;
  })();
  const ote = (() => {
    const f = salaryFields.find((x) => /ote|total/i.test(x.field_label));
    return f ? fmtMoney(fv[f.field_name]) : null;
  })();
  const location = locationFields[0] ? fmtLocation(fv[locationFields[0].field_name]) : null;

  const hasAny = startDate || title || baseSalary || ote || location;
  if (!hasAny) return null;

  return (
    <section className="bg-white rounded-[14px] border" style={{ borderColor: '#E7E8EE' }}>
      <header className="px-5 pt-4 pb-3">
        <h3 className="font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 13, letterSpacing: '-0.02em' }}>
          Hire summary
        </h3>
      </header>
      <div className="px-5 pb-4">
        <Row label="Start date" value={startDate ? format(new Date(startDate), 'MMM d, yyyy') : null} />
        <Row label="Title" value={title} />
        <Row label="Location" value={location} />
        <Row label="Base" value={baseSalary} />
        <Row label="Total Y1" value={ote} />
      </div>
    </section>
  );
}

interface TimeToHireCardProps {
  appliedAt: string | null;
  hiredAt: string | null;
}

export function TimeToHireCard({ appliedAt, hiredAt }: TimeToHireCardProps) {
  if (!appliedAt || !hiredAt) return null;
  const days = differenceInDays(new Date(hiredAt), new Date(appliedAt));
  if (days < 0) return null;
  return (
    <section
      className="rounded-[14px] border p-5"
      style={{ backgroundColor: '#FAF8FF', borderColor: '#EDE4FF' }}
    >
      <p
        className="font-inter uppercase mb-1"
        style={{ fontSize: 10.5, letterSpacing: '0.06em', color: '#6F3FF5' }}
      >
        Time to hire
      </p>
      <p
        className="font-poppins font-semibold"
        style={{ fontSize: 32, color: '#6F3FF5', letterSpacing: '-0.04em', lineHeight: 1 }}
      >
        {days}<span style={{ fontSize: 20 }}>d</span>
      </p>
      <p className="font-inter mt-1" style={{ fontSize: 12, color: '#5A6072' }}>
        Application → Hired
      </p>
    </section>
  );
}
