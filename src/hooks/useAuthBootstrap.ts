import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface AuthBootstrapState {
  ready: boolean;
  session: Session | null;
}

export function useAuthBootstrap() {
  const [state, setState] = useState<AuthBootstrapState>({
    ready: false,
    session: null,
  });

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setState({ ready: true, session });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setState(prev => ({ ...prev, session }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
