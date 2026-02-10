
import { useState } from 'react';
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer';
import { markdownToHtml } from '@/utils/markdown';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { extractTextFromFile } from '@/utils/pdfText';
import { triggerBackgroundEnrichment } from '@/hooks/useCandidateEnrichment';

export type ParsedResume = {
  name?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  profileSummary?: string;
};

export type ParseMode = 'core' | 'full';

function uniquePush<T>(arr: T[] | null | undefined, value: T | null | undefined): T[] {
  const base = Array.isArray(arr) ? arr.slice() : [];
  if (value == null) return base;
  if (!base.includes(value)) base.push(value);
  return base;
}

function parseLocationString(location: string): { city?: string; state?: string; country?: string } {
  if (!location) return {};
  
  const parts = location.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length === 1) {
    return { country: parts[0] };
  } else if (parts.length === 2) {
    return { city: parts[0], country: parts[1] };
  } else if (parts.length >= 3) {
    return {
      city: parts[parts.length - 3],
      state: parts[parts.length - 2],
      country: parts[parts.length - 1]
    };
  }
  
  return {};
}

export function useResumeParsing() {
  const [isParsing, setIsParsing] = useState(false);

  /**
   * Internal function to parse resume with mode support
   */
  const parseResumeInternal = async (file: File, mode: ParseMode = 'full'): Promise<{ parsed: ParsedResume; resumeText: string } | null> => {
    if (!file) return null;

    let textContent = '';
    textContent = await extractTextFromFile(file);
    if (!textContent) {
      toast.info('Could not extract text from this file type. Try PDF or DOCX.');
      return null;
    }

    if (!textContent || textContent.length < 30) {
      toast.error('Could not extract enough text from the PDF to parse.');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('parse-resume', {
      body: {
        textContent,
        fileName: file.name,
        mimeType: file.type,
        mode,
      },
    });

    if (error) {
      console.error('parse-resume error:', error);
      toast.error('Failed to parse the resume.');
      return null;
    }

    console.log(`[useResumeParsing] Mode: ${mode}, Raw data from edge function:`, data);
    const parsed = (data || {}) as ParsedResume;
    
    return { parsed, resumeText: textContent };
  };

  /**
   * Parse a resume file (backward compatible - returns ParsedResume)
   * Uses full AI-powered parsing including profile summary
   */
  const parseResume = async (file: File): Promise<ParsedResume | undefined> => {
    if (!file) return undefined;
    setIsParsing(true);

    try {
      const result = await parseResumeInternal(file, 'full');
      if (!result) return undefined;
      
      console.log('[useResumeParsing] Full parse returning:', {
        name: result.parsed.name,
        email: result.parsed.email,
        phone: result.parsed.phone,
        linkedinUrl: result.parsed.linkedinUrl,
        location: result.parsed.location,
        profileSummary: result.parsed.profileSummary ? '(exists)' : '(missing)'
      });
      
      return result.parsed;
    } catch (err) {
      console.error('parseResume error:', err);
      toast.error('Resume parsing failed.');
      return undefined;
    } finally {
      setIsParsing(false);
    }
  };

  /**
   * Parse core fields from a resume using AI (fast, ~3-5 seconds)
   * Extracts: name, email, phone, linkedinUrl, location
   * Returns parsed data AND resumeText for background enrichment (skills + profile summary)
   */
  const parseResumeCoreFields = async (file: File): Promise<{ parsed: ParsedResume; resumeText: string } | null> => {
    if (!file) return null;
    setIsParsing(true);

    try {
      const result = await parseResumeInternal(file, 'core');
      if (!result) return null;
      
      console.log('[useResumeParsing] Core fields parse returning:', {
        name: result.parsed.name,
        email: result.parsed.email,
        phone: result.parsed.phone,
        linkedinUrl: result.parsed.linkedinUrl,
        location: result.parsed.location,
        hasResumeText: !!result.resumeText
      });
      
      return result;
    } catch (err) {
      console.error('parseResumeCoreFields error:', err);
      toast.error('Resume parsing failed.');
      return null;
    } finally {
      setIsParsing(false);
    }
  };

  /**
   * @deprecated Use parseResumeCoreFields instead
   * Kept for backward compatibility
   */
  const parseResumeQuick = parseResumeCoreFields;


  const parseAndUpdateCandidate = async (file: File, candidateId: string) => {
    if (!file || !candidateId) return;
    setIsParsing(true);

    try {
      let textContent = '';
      textContent = await extractTextFromFile(file);
      if (!textContent) {
        toast.info('Could not extract text from this file type. Try PDF or DOCX.');
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
      console.log('[Resume Parsing] Parsed data from edge function:', parsed);

      // Update only missing candidate fields
      const { data: existing, error: fetchErr } = await supabase
        .from('candidates')
        .select('id, candidate_name, contact_emails, contact_phones, profile_summary, linkedin_url, location_city, location_state, location_country')
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
            // Convert Markdown-ish content to sanitized HTML before saving
            const html = markdownToHtml(parsed.profileSummary)
            const sanitized = sanitizeHtmlForEditor(html)
            update.profile_summary = sanitized
          }
        if (parsed.email) {
          update.contact_emails = uniquePush<string>(existing.contact_emails, parsed.email);
        }
        if (parsed.phone) {
          update.contact_phones = uniquePush<string>(existing.contact_phones, parsed.phone);
        }
        if (parsed.linkedinUrl && !existing.linkedin_url) {
          update.linkedin_url = parsed.linkedinUrl;
        }
        if (parsed.location && (!existing.location_city || !existing.location_state || !existing.location_country)) {
          const locationParts = parseLocationString(parsed.location);
          console.log('[Resume Parsing] Location string:', parsed.location);
          console.log('[Resume Parsing] Parsed location parts:', locationParts);
          console.log('[Resume Parsing] Existing location:', { 
            city: existing.location_city, 
            state: existing.location_state, 
            country: existing.location_country 
          });
          
          if (locationParts.city && !existing.location_city) {
            update.location_city = locationParts.city;
          }
          if (locationParts.state && !existing.location_state) {
            update.location_state = locationParts.state;
          }
          if (locationParts.country && !existing.location_country) {
            update.location_country = locationParts.country;
          }
        }
      } else {
        // If we can't fetch, skip updating
        console.warn('Candidate not found or not accessible; skipping updates.');
      }

      console.log('[Resume Parsing] Update object to be sent:', update);

      if (Object.keys(update).length > 0) {
        const { error: upErr } = await supabase.from('candidates').update(update).eq('id', candidateId);
        console.log('[Resume Parsing] Database update result:', { success: !upErr, error: upErr });
        if (upErr) {
          console.error('Failed to update candidate with parsed data:', upErr);
          toast.error('Parsed the resume but failed to update the candidate record.');
        } else {
          toast.success('Resume parsed and candidate profile updated.');
        }
      } else {
        toast.success('Resume parsed; no updates were needed.');
      }

      // Trigger background enrichment if profile summary is missing/short
      const needsEnrichment = !existing?.profile_summary || existing.profile_summary.trim().length < 50;
      if (needsEnrichment && textContent) {
        console.log('[Resume Parsing] Triggering background enrichment for candidate', candidateId);
        triggerBackgroundEnrichment(candidateId, textContent, parsed.name);
      }

      return parsed;
    } catch (err) {
      console.error('parseAndUpdateCandidate error:', err);
      toast.error('Resume parsing failed.');
    } finally {
      setIsParsing(false);
    }
  };

  return { isParsing, parseResume, parseResumeCoreFields, parseResumeQuick, parseAndUpdateCandidate };
}
