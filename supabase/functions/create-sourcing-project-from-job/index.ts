import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RequestBody {
  job_id: string;
  name?: string;
}

// Map our internal job_level codes → Apollo seniority buckets
function levelToSeniorities(level?: string | null): string[] {
  if (!level) return [];
  const l = String(level).toLowerCase();
  if (l.startsWith('l1')) return ['entry', 'junior'];
  if (l.startsWith('l2')) return ['senior'];
  if (l.startsWith('l3')) return ['manager'];
  if (l.startsWith('l4')) return ['director'];
  if (l.startsWith('l5')) return ['vp', 'c_suite'];
  return [];
}

function uniq<T>(arr: (T | null | undefined)[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    if (v === null || v === undefined) continue;
    const k = typeof v === 'string' ? v.toLowerCase().trim() : JSON.stringify(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v as T);
  }
  return out;
}

serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    if (!body.job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency — return existing active project if one already exists
    const { data: existing } = await supabase
      .from('sourcing_projects')
      .select('id, job_id, name, status, organization_id')
      .eq('job_id', body.job_id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`♻️ Existing sourcing project for job ${body.job_id}: ${existing.id}`);
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load job context
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id, title, internal_title, description, department, location,
        additional_locations, work_mode, location_requirement, job_level,
        min_years_experience, max_years_experience, skills, must_have_skills,
        salary_min, salary_max, currency, organization_id, tenant_id
      `)
      .eq('id', body.job_id)
      .single();

    if (jobError || !job) {
      console.error('❌ Job not found:', jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build title_keywords
    const titleKeywords = uniq<string>([job.title, job.internal_title]).filter(t => !!t && t.length > 1);

    // Build locations
    const isRemote = (job.work_mode === 'remote') || (job.location_requirement === 'remote');
    const locations = isRemote && !job.location
      ? []
      : uniq<string>([job.location, ...((job.additional_locations as string[] | null) ?? [])]).filter(Boolean);

    const skills = uniq<string>((job.skills as string[] | null) ?? []);
    const mustHaves = uniq<string>((job.must_have_skills as string[] | null) ?? []);

    const seniorities = levelToSeniorities(job.job_level);

    const experience_years = (job.min_years_experience != null || job.max_years_experience != null)
      ? {
          min: job.min_years_experience ?? undefined,
          max: job.max_years_experience ?? undefined,
        }
      : undefined;

    const search_criteria: Record<string, any> = {
      skills,
      title_keywords: titleKeywords,
      locations,
      keywords: mustHaves.slice(0, 3),
      seniorities,
      experience_years,
      salary_min: job.salary_min ?? undefined,
      salary_max: job.salary_max ?? undefined,
      currency: job.currency ?? undefined,
    };

    const job_spec_data: Record<string, any> = {
      job_title: job.title,
      job_description: job.description ?? undefined,
      level: job.job_level ?? undefined,
      department: job.department ?? undefined,
      location: job.location ?? undefined,
      location_details: isRemote ? { is_remote: true } : undefined,
      salary_range: (job.salary_min || job.salary_max)
        ? {
            min: job.salary_min ?? 0,
            max: job.salary_max ?? 0,
            currency: job.currency ?? 'USD',
          }
        : undefined,
      skills,
    };

    const name = body.name?.trim() || `Sourcing — ${job.title}`;

    const { data: project, error: insertError } = await supabase
      .from('sourcing_projects')
      .insert({
        name,
        description: `Sourcing for ${job.title}`,
        job_id: job.id,
        organization_id: job.organization_id,
        created_by: user.id,
        search_criteria,
        job_spec_data,
        enabled_sources: ['internal', 'apollo'],
        status: 'active',
        is_public: false,
      })
      .select('id, job_id, name, status, organization_id')
      .single();

    if (insertError || !project) {
      console.error('❌ Failed to create sourcing project:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to create project: ${insertError?.message ?? 'unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Sourcing project created from job ${job.id}: ${project.id}`);

    // Fire-and-forget initial search (warms PDL/Apollo caches)
    const kickoff = supabase.functions.invoke('sourcing-search', {
      body: { sourcing_project_id: project.id, limit: 2000, pdl_limit: 5 },
      headers: authHeader ? { Authorization: authHeader } : undefined,
    }).then(({ error }) => {
      if (error) console.warn('⚠️ Initial sourcing-search failed:', error);
      else console.log(`🚀 Initial sourcing-search kicked off for ${project.id}`);
    }).catch((e) => console.warn('⚠️ Initial sourcing-search exception:', e));

    // @ts-ignore — EdgeRuntime is provided in Supabase Edge runtime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(kickoff);
    }

    return new Response(JSON.stringify(project), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ create-sourcing-project-from-job error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
