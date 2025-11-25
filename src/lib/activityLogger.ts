import { supabase } from '@/integrations/supabase/client';

export interface LogActivityParams {
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  entityType?: string;
  entityId?: string;
  organizationId?: string;
  tenantId?: string;
}

export async function logActivity(params: LogActivityParams): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_organization_id: params.organizationId || null,
      p_tenant_id: params.tenantId || null,
      p_activity_type: params.activityType as any,
      p_title: params.title,
      p_description: params.description || null,
      p_metadata: params.metadata || {},
      p_entity_type: params.entityType || null,
      p_entity_id: params.entityId || null,
    });
    
    if (error) {
      console.error('Failed to log activity:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Unexpected error logging activity:', err);
    return null;
  }
}
