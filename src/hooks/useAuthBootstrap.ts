import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface OrgContext {
  organizationId: string | null;
  role: string | null;
  userType: string | null;
}

interface AuthBootstrapState {
  ready: boolean;
  session: Session | null;
  orgContext: OrgContext | null;
}

export function useAuthBootstrap() {
  const [state, setState] = useState<AuthBootstrapState>({
    ready: false,
    session: null,
    orgContext: null,
  });

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;

      if (!session) {
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      // Resolve org context from database
      const { data: orgData } = await supabase.rpc('resolve_org_context');
      
      if (!mounted) return;

      const orgContext: OrgContext = orgData && orgData.length > 0 ? {
        organizationId: orgData[0].organization_id,
        role: orgData[0].role,
        userType: orgData[0].user_type,
      } : null;

      setState({ ready: true, session, orgContext });
    }

    bootstrap();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session) {
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      // Resolve org context from database
      const { data: orgData } = await supabase.rpc('resolve_org_context');
      
      if (!mounted) return;

      const orgContext: OrgContext = orgData && orgData.length > 0 ? {
        organizationId: orgData[0].organization_id,
        role: orgData[0].role,
        userType: orgData[0].user_type,
      } : null;

      setState({ ready: true, session, orgContext });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
