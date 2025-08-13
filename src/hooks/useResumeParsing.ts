
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractTextFromPdf } from '@/utils/pdfText';

export type ParsedResume = {
  name?: string;
  email?: string;
  phone?: string;
  profileSummary?: string;
};

function uniquePush<T>(arr: T[] | null | undefined, value: T | null | undefined): T[] {
  const base = Array.isArray(arr) ? arr.slice() : [];
  if (value == null) return base;
  if (!base.includes(value)) base.push(value);
  return base;
}

export function useResumeParsing() {
  const [isParsing, setIsParsing] = useState(false);

  const parseResume = async (file: File) => {
    if (!file) return;
    setIsParsing(true);

    try {
      let textContent = '';
      if (file.type === 'application/pdf') {
        textContent = await extractTextFromPdf(file);
      } else {
        // For non-PDF files we currently skip local extraction.
        toast.info('Parsing currently supports PDFs. The file was added, but parsing was skipped.');
        return;
      }

      if (!textContent || textContent.length < 30) {
        toast.error('Could not extract enough text from the PDF to parse.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: {
          textContent,
          fileName: file.name,
          mimeType: file.type,
        },
      });

      if (error) {
        console.error('parse-resume error:', error);
        toast.error('Failed to parse the resume.');
        return;
      }

      return (data || {}) as ParsedResume;
    } catch (err) {
      console.error('parseResume error:', err);
      toast.error('Resume parsing failed.');
    } finally {
      setIsParsing(false);
    }
  };


  const parseAndUpdateCandidate = async (file: File, candidateId: string) => {
    if (!file || !candidateId) return;
    setIsParsing(true);

    try {
      let textContent = '';
      if (file.type === 'application/pdf') {
        textContent = await extractTextFromPdf(file);
      } else {
        // For non-PDF files we currently skip local extraction.
        // In a future step we can route these through Adobe PDF Services.
        toast.info('Parsing currently supports PDFs. The file was uploaded, but parsing was skipped.');
        return;
      }

      if (!textContent || textContent.length < 30) {
        toast.error('Could not extract enough text from the PDF to parse.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: {
          textContent,
          fileName: file.name,
          mimeType: file.type,
        },
      });

      if (error) {
        console.error('parse-resume error:', error);
        toast.error('Failed to parse the resume.');
        return;
      }

      const parsed = (data || {}) as ParsedResume;

      // Update only missing candidate fields
      const { data: existing, error: fetchErr } = await supabase
        .from('candidates')
        .select('id, candidate_name, contact_emails, contact_phones, profile_summary')
        .eq('id', candidateId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('Unable to fetch candidate to update (continuing without update):', fetchErr);
      }

      const update: Record<string, any> = {};
      if (existing) {
        if ((!existing.candidate_name || existing.candidate_name.trim().length === 0) && parsed.name) {
          update.candidate_name = parsed.name;
        }
        if ((!existing.profile_summary || existing.profile_summary.trim().length < 50) && parsed.profileSummary) {
          update.profile_summary = parsed.profileSummary;
        }
        if (parsed.email) {
          update.contact_emails = uniquePush<string>(existing.contact_emails, parsed.email);
        }
        if (parsed.phone) {
          update.contact_phones = uniquePush<string>(existing.contact_phones, parsed.phone);
        }
      } else {
        // If we can't fetch, skip updating
        console.warn('Candidate not found or not accessible; skipping updates.');
      }

      if (Object.keys(update).length > 0) {
        const { error: upErr } = await supabase.from('candidates').update(update).eq('id', candidateId);
        if (upErr) {
          console.error('Failed to update candidate with parsed data:', upErr);
          toast.error('Parsed the resume but failed to update the candidate record.');
        } else {
          toast.success('Resume parsed and candidate profile updated.');
        }
      } else {
        toast.success('Resume parsed; no updates were needed.');
      }

      return parsed;
    } catch (err) {
      console.error('parseAndUpdateCandidate error:', err);
      toast.error('Resume parsing failed.');
    } finally {
      setIsParsing(false);
    }
  };

  return { isParsing, parseResume, parseAndUpdateCandidate };
}
