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
    const { userMessage, conversationId } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`Chat with Gio - User: ${user.id}, Message: ${userMessage.substring(0, 50)}...`);

    // Get user's tenant_id
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('tenant_id, organization_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single();

    if (memberError || !memberData) {
      throw new Error('User membership not found');
    }

    let conversation;
    let messages = [];

    // If conversationId provided, fetch existing conversation and messages
    if (conversationId) {
      const { data: existingConv, error: convError } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('tenant_id', memberData.tenant_id)
        .eq('status', 'draft')
        .single();

      if (convError || !existingConv) {
        // Improved error message for used conversations
        if (convError?.code === 'PGRST116') {
          throw new Error('This conversation has already been used to create a job spec. Please start a new conversation.');
        }
        throw convError || new Error('Conversation not found or not accessible');
      }

      conversation = existingConv;

      // Fetch existing messages
      const { data: existingMessages, error: msgError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!msgError && existingMessages) {
        messages = existingMessages;
      }
    } else {
      // Create new draft conversation
      const { data: newConv, error: createError } = await supabase
        .from('ai_conversations')
        .insert({
          tenant_id: memberData.tenant_id,
          created_by: user.id,
          initial_prompt: userMessage,
          status: 'draft',
          sourcing_project_id: null,
          is_ready_for_creation: false
        })
        .select()
        .single();

      if (createError || !newConv) {
        throw new Error('Failed to create conversation');
      }

      conversation = newConv;
    }

    // Insert user message
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage,
        metadata: {}
      });

    // Build conversation history for OpenAI
    const conversationHistory = [
      {
        role: 'system',
        content: `You are Gio, a friendly AI assistant helping recruiters create job specifications. Your role is to gather enough information to create a comprehensive job spec.

CRITICAL: You MUST assess readiness in EVERY response.

Information needed for a complete job spec:
1. Job title or role type (REQUIRED)
2. Required skills or technologies (REQUIRED - at least 2)
3. Location (REQUIRED - city, country, or remote preference)
4. Optional but helpful: experience level, salary range, department

Readiness Assessment Rules:
- Set ready_for_creation: true ONLY when you have:
  * A clear job title
  * At least 2 specific skills or technologies
  * Location information (city/country or "remote")
- Set ready_for_creation: false if ANY required field is missing
- After gathering all required info, explicitly tell the user you have enough to create job specs

Keep responses conversational, friendly, and concise. Ask follow-up questions when needed.

Your response MUST end with a JSON metadata block on a new line:
{"ready_for_creation": true/false}

Example responses:
"Great! What specific skills should they have?" 
{"ready_for_creation": false}

"Perfect! I now have all the information needed to create a comprehensive job specification for a Senior Backend Engineer with Python & AWS, remote in LATAM. Would you like me to generate the detailed job specs?"
{"ready_for_creation": true}`
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    // Call OpenAI with streaming enabled
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationHistory,
        max_tokens: 500,
        temperature: 0.7,
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const conversationIdToSend = conversation.id;
    
    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              if (!trimmedLine.startsWith('data: ')) continue;

              try {
                const json = JSON.parse(trimmedLine.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullContent += content;
                  // Send delta to client
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: content })}\n\n`));
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }

          // Process any remaining buffer
          if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
            if (buffer.trim().startsWith('data: ')) {
              try {
                const json = JSON.parse(buffer.trim().slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: content })}\n\n`));
                }
              } catch (e) {
                // Skip
              }
            }
          }

          console.log('Full assistant response:', fullContent);

          // Parse readiness from full response
          let isReadyForCreation = false;
          let cleanMessage = fullContent;

          const jsonMatch = fullContent.match(/\{[^}]*"ready_for_creation":\s*(true|false)[^}]*\}/);
          if (jsonMatch) {
            try {
              const metadata = JSON.parse(jsonMatch[0]);
              isReadyForCreation = metadata.ready_for_creation === true;
              cleanMessage = fullContent.replace(jsonMatch[0], '').trim();
            } catch (e) {
              console.error('Failed to parse readiness metadata:', e);
            }
          }

          console.log('Readiness assessment:', isReadyForCreation);

          // Insert assistant message
          await supabase
            .from('conversation_messages')
            .insert({
              conversation_id: conversationIdToSend,
              role: 'assistant',
              content: cleanMessage,
              metadata: { ready_for_creation: isReadyForCreation }
            });

          // Update conversation readiness
          await supabase
            .from('ai_conversations')
            .update({ 
              is_ready_for_creation: isReadyForCreation,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationIdToSend);

          // Send final done event with metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            done: true, 
            conversationId: conversationIdToSend, 
            isReadyForCreation 
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream processing failed' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Error in chat-with-gio:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
