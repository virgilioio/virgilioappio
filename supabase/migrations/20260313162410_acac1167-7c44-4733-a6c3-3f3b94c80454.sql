
-- Drop WhatsApp tables and related objects (full rollback)
-- Order matters: messages depends on conversations, sessions is independent

-- Drop whatsapp_messages first (depends on whatsapp_conversations)
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;

-- Drop whatsapp_conversations
DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;

-- Drop whatsapp_sessions
DROP TABLE IF EXISTS public.whatsapp_sessions CASCADE;

-- Drop whatsapp_templates
DROP TABLE IF EXISTS public.whatsapp_templates CASCADE;

-- Drop the phone matching function created for WhatsApp
DROP FUNCTION IF EXISTS public.match_candidates_by_phone(uuid, text);
