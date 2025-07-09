import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const coresignalApiKey = Deno.env.get('CORESIGNAL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Mapping for consistent job title normalization
const JOB_TITLE_MAPPINGS: Record<string, string> = {
  'software engineer': 'Software Engineer',
  'software developer': 'Software Developer', 
  'full stack developer': 'Full Stack Developer',
  'frontend developer': 'Frontend Developer',
  'backend developer': 'Backend Developer',
  'data scientist': 'Data Scientist',
  'product manager': 'Product Manager',
  'project manager': 'Project Manager',
  'sales representative': 'Sales Representative',
  'account executive': 'Account Executive',
  'marketing manager': 'Marketing Manager',
  'hr manager': 'Human Resources Manager',
  'devops engineer': 'DevOps Engineer',
  'ux designer': 'UX Designer',
  'ui designer': 'UI Designer'
};

// Location mappings for consistent country/city normalization
const LOCATION_MAPPINGS: Record<string, { country: string, city?: string }> = {
  'san francisco': { country: 'United States', city: 'San Francisco' },
  'new york': { country: 'United States', city: 'New York' },
  'austin': { country: 'United States', city: 'Austin' },
  'seattle': { country: 'United States', city: 'Seattle' },
  'denver': { country: 'United States', city: 'Denver' },
  'mexico city': { country: 'Mexico', city: 'Mexico City' },
  'guadalajara': { country: 'Mexico', city: 'Guadalajara' },
  'são paulo': { country: 'Brazil', city: 'São Paulo' },
  'rio de janeiro': { country: 'Brazil', city: 'Rio de Janeiro' },
  'bogotá': { country: 'Colombia', city: 'Bogotá' },
  'medellín': { country: 'Colombia', city: 'Medellín' },
  'buenos aires': { country: 'Argentina', city: 'Buenos Aires' },
  'united states': { country: 'United States' },
  'mexico': { country: 'Mexico' },
  'brazil': { country: 'Brazil' },
  'colombia': { country: 'Colombia' },
  'argentina': { country: 'Argentina' }
};

function normalizeJobTitle(title: string): string {
  const normalized = title.toLowerCase().trim();
  return JOB_TITLE_MAPPINGS[normalized] || title;
}

function normalizeLocation(location: string): { country: string, city?: string } {
  const normalized = location.toLowerCase().trim();
  return LOCATION_MAPPINGS[normalized] || { country: location };
}

function determineCurrency(country: string): string {
  const currencyMap: Record<string, string> = {
    'united states': 'USD',
    'mexico': 'MXN',
    'brazil': 'BRL',
    'colombia': 'COP',
    'argentina': 'ARS',
    'canada': 'CAD',
    'united kingdom': 'GBP',
    'germany': 'EUR',
    'france': 'EUR',
    'spain': 'EUR'
  };
  
  return currencyMap[country.toLowerCase()] || 'USD';
}

function determineMarketCompetitiveness(salaryData: any): string {
  // Logic to determine market competitiveness based on salary data
  if (!salaryData.salary_median) return 'moderate';
  
  const median = salaryData.salary_median;
  const range = (salaryData.salary_max || median * 1.5) - (salaryData.salary_min || median * 0.7);
  const variance = range / median;
  
  if (variance > 0.8) return 'very_high';
  if (variance > 0.5) return 'high';
  if (variance > 0.3) return 'moderate';
  return 'low';
}

async function searchCoreSignalSalaries(jobTitle: string, location: string): Promise<any> {
  console.log(`🔍 Searching CoreSignal for: ${jobTitle} in ${location}`);
  
  const normalizedLocation = normalizeLocation(location);
  
  try {
    // CoreSignal Jobs API endpoint for salary data
    const searchUrl = new URL('https://api.coresignal.com/cdapi/v1/professional_network/job/search/filter');
    
    const searchBody = {
      title: jobTitle,
      country: normalizedLocation.country,
      ...(normalizedLocation.city && { location: normalizedLocation.city }),
      created_date_from: '2023-01-01', // Recent data only
      limit: 100 // Get more samples for better insights
    };

    console.log('CoreSignal search params:', searchBody);

    const response = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${coresignalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      console.error('CoreSignal API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    console.log(`📊 CoreSignal returned ${data.length || 0} jobs`);
    
    return data;
  } catch (error) {
    console.error('Error calling CoreSignal API:', error);
    return null;
  }
}

function processSalaryData(coreSignalData: any[], country: string): any {
  if (!coreSignalData || coreSignalData.length === 0) {
    return null;
  }

  // Extract salary information from job postings
  const salaries: number[] = [];
  
  coreSignalData.forEach((job: any) => {
    // CoreSignal salary data processing - this may need adjustment based on actual API response
    if (job.salary_min && job.salary_max) {
      const avgSalary = (job.salary_min + job.salary_max) / 2;
      salaries.push(avgSalary);
    } else if (job.salary) {
      salaries.push(job.salary);
    }
  });

  if (salaries.length === 0) {
    return null;
  }

  // Calculate percentiles
  const sortedSalaries = salaries.sort((a, b) => a - b);
  const len = sortedSalaries.length;
  
  const percentile25 = sortedSalaries[Math.floor(len * 0.25)];
  const percentile50 = sortedSalaries[Math.floor(len * 0.5)]; // median
  const percentile75 = sortedSalaries[Math.floor(len * 0.75)];
  const percentile90 = sortedSalaries[Math.floor(len * 0.9)];
  
  const salary_min = Math.min(...sortedSalaries);
  const salary_max = Math.max(...sortedSalaries);
  
  return {
    salary_min: Math.round(salary_min),
    salary_max: Math.round(salary_max),
    salary_median: Math.round(percentile50),
    percentile_25: Math.round(percentile25),
    percentile_75: Math.round(percentile75),
    percentile_90: Math.round(percentile90),
    sample_size: len,
    currency: determineCurrency(country),
    market_competitiveness: determineMarketCompetitiveness({
      salary_min,
      salary_max,
      salary_median: percentile50
    })
  };
}

async function getCachedSalaryData(jobTitle: string, locationCountry: string, locationCity?: string): Promise<any> {
  const { data, error } = await supabase
    .from('salary_market_data')
    .select('*')
    .eq('job_title', jobTitle)
    .eq('location_country', locationCountry)
    .eq('location_city', locationCity || null)
    .gt('expires_at', new Date().toISOString())
    .order('cached_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching cached salary data:', error);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

async function cacheSalaryData(salaryData: any, jobTitle: string, locationCountry: string, locationCity?: string): Promise<void> {
  const cacheData = {
    job_title: jobTitle,
    location_country: locationCountry,
    location_city: locationCity || null,
    ...salaryData,
    data_source: 'coresignal',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  };

  const { error } = await supabase
    .from('salary_market_data')
    .upsert(cacheData, {
      onConflict: 'job_title,location_country,location_city'
    });

  if (error) {
    console.error('Error caching salary data:', error);
  } else {
    console.log('✅ Salary data cached successfully');
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobTitle, location, useCache = true } = await req.json();
    
    if (!jobTitle || !location) {
      return new Response(JSON.stringify({ 
        error: 'jobTitle and location are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Salary research request: ${jobTitle} in ${location}`);

    const normalizedTitle = normalizeJobTitle(jobTitle);
    const normalizedLocation = normalizeLocation(location);
    
    // Check cache first if requested
    let salaryData = null;
    if (useCache) {
      salaryData = await getCachedSalaryData(
        normalizedTitle, 
        normalizedLocation.country, 
        normalizedLocation.city
      );
      
      if (salaryData) {
        console.log('📚 Using cached salary data');
        return new Response(JSON.stringify({ 
          salaryData,
          source: 'cache',
          location: normalizedLocation
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // No cache hit or cache disabled - call CoreSignal API
    if (!coresignalApiKey) {
      return new Response(JSON.stringify({ 
        error: 'CoreSignal API key not configured',
        salaryData: null,
        source: 'error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const coreSignalData = await searchCoreSignalSalaries(normalizedTitle, location);
    
    if (!coreSignalData) {
      console.log('❌ No data from CoreSignal API');
      return new Response(JSON.stringify({ 
        salaryData: null,
        source: 'api_error',
        location: normalizedLocation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process the salary data
    const processedSalaryData = processSalaryData(coreSignalData, normalizedLocation.country);
    
    if (processedSalaryData) {
      // Cache the processed data
      await cacheSalaryData(
        processedSalaryData, 
        normalizedTitle, 
        normalizedLocation.country, 
        normalizedLocation.city
      );
      
      console.log('✅ Fresh salary data processed and cached');
      
      return new Response(JSON.stringify({ 
        salaryData: processedSalaryData,
        source: 'coresignal_api',
        location: normalizedLocation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log('❌ No salary data could be processed');
      return new Response(JSON.stringify({ 
        salaryData: null,
        source: 'no_salary_data',
        location: normalizedLocation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in coresignal-salary-research function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      salaryData: null,
      source: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});