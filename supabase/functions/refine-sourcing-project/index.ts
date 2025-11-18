import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { project_id, user_message, conversation_history } = await req.json();

    if (!project_id || !user_message) {
      return new Response(JSON.stringify({ error: 'project_id and user_message are required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    console.log('Refining sourcing project:', project_id);

    // Fetch current project
    const { data: project, error: projectError } = await supabase
      .from('sourcing_projects')
      .select('*, ai_conversations!inner(id)')
      .eq('id', project_id)
      .single();

    if (projectError) throw projectError;

    const conversationId = project.ai_conversations.id;
    const currentCriteria = project.search_criteria;

    // Build conversation for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are Gio, an AI talent sourcing assistant. The user is refining their search criteria for a sourcing project.

Current search criteria:
- Skills: ${currentCriteria.skills?.join(', ') || 'None'}
- Locations: ${currentCriteria.locations?.join(', ') || 'None'}
- Title keywords: ${currentCriteria.title_keywords?.join(', ') || 'None'}
- Experience: ${currentCriteria.experience_years?.min || 0} - ${currentCriteria.experience_years?.max || 0} years
- Education: ${currentCriteria.education_level || 'Not specified'}

Based on the user's message, update the search criteria and provide updated JSON in this exact format:
{
  "skills": ["skill1", "skill2"],
  "locations": ["city,state,country"],
  "title_keywords": ["keyword1"],
  "experience_years": { "min": 0, "max": 10 },
  "education_level": "Bachelor's"
}

Also provide a friendly explanation of what you changed.`
      },
      ...(conversation_history || []),
      {
        role: 'user',
        content: user_message
      }
    ];

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices[0].message.content;

    console.log('AI response:', assistantMessage);

    // Extract JSON from response
    const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
    let updatedCriteria = currentCriteria;
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        updatedCriteria = {
          skills: parsed.skills || currentCriteria.skills,
          locations: parsed.locations || currentCriteria.locations,
          title_keywords: parsed.title_keywords || currentCriteria.title_keywords,
          experience_years: parsed.experience_years || currentCriteria.experience_years,
          education_level: parsed.education_level || currentCriteria.education_level
        };
      } catch (e) {
        console.warn('Failed to parse JSON from AI response:', e);
      }
    }

    // Update project search criteria
    const { error: updateError } = await supabase
      .from('sourcing_projects')
      .update({ 
        search_criteria: updatedCriteria,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id);

    if (updateError) throw updateError;

    // Save messages to conversation
    await supabase
      .from('conversation_messages')
      .insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: user_message,
          metadata: {}
        },
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantMessage,
          metadata: { updated_criteria: updatedCriteria }
        }
      ]);

    // Re-run candidate matching
    const { data: matchingResults, error: matchingError } = await supabase.functions.invoke(
      'get-job-matching-candidates',
      {
        body: {
          sourcing_project_id: project_id,
          limit: 100
        }
      }
    );

    if (matchingError) {
      console.warn('Failed to refresh candidates:', matchingError);
    }

    return new Response(JSON.stringify({
      updated_criteria: updatedCriteria,
      assistant_message: assistantMessage,
      candidate_count: matchingResults?.candidates?.length || 0
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error refining project:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
