import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

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
    const { sourcing_project_id } = await req.json();

    if (!sourcing_project_id) {
      return new Response(JSON.stringify({ error: 'sourcing_project_id is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    console.log('Fetching conversation for project:', sourcing_project_id);

    // Fetch conversation with messages
    const { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('sourcing_project_id', sourcing_project_id)
      .single();

    if (convError) {
      if (convError.code === 'PGRST116') {
        // No conversation found - this is okay for older projects
        return new Response(JSON.stringify({ 
          conversation: null,
          messages: []
        }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      throw convError;
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    return new Response(JSON.stringify({
      conversation,
      messages: messages || []
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
