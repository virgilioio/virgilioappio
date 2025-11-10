-- Migration 2: Add template copying function
CREATE OR REPLACE FUNCTION copy_platform_template_to_tenant(
  p_template_table text,
  p_template_id uuid,
  p_target_tenant_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id uuid;
  v_source_tenant_id uuid;
BEGIN
  -- Verify user is workspace owner of target tenant
  IF NOT user_is_workspace_owner_in_tenant(p_target_tenant_id) THEN
    RAISE EXCEPTION 'Only workspace owners can copy templates';
  END IF;

  -- Verify source template is a platform default (tenant_id IS NULL)
  -- and get source tenant_id for verification
  CASE p_template_table
    WHEN 'job_stages' THEN
      SELECT tenant_id INTO v_source_tenant_id
      FROM job_stages WHERE id = p_template_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
      END IF;
      
      IF v_source_tenant_id IS NOT NULL THEN
        RAISE EXCEPTION 'Can only copy platform default templates (tenant_id must be NULL)';
      END IF;
      
      -- Copy the job stage
      INSERT INTO job_stages (
        tenant_id, stage_name, stage_type, stage_description, 
        is_default, stage_priority, is_active, created_by
      )
      SELECT 
        p_target_tenant_id, stage_name, stage_type, stage_description,
        false, -- Copied templates are not defaults
        stage_priority, is_active, auth.uid()
      FROM job_stages WHERE id = p_template_id
      RETURNING id INTO v_new_id;
      
    WHEN 'offer_templates' THEN
      SELECT tenant_id INTO v_source_tenant_id
      FROM offer_templates WHERE id = p_template_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
      END IF;
      
      IF v_source_tenant_id IS NOT NULL THEN
        RAISE EXCEPTION 'Can only copy platform default templates (tenant_id must be NULL)';
      END IF;
      
      -- Copy the offer template
      INSERT INTO offer_templates (
        tenant_id, name, description, content, created_by
      )
      SELECT 
        p_target_tenant_id, name, description, content, auth.uid()
      FROM offer_templates WHERE id = p_template_id
      RETURNING id INTO v_new_id;
      
    WHEN 'application_fields' THEN
      SELECT tenant_id INTO v_source_tenant_id
      FROM application_fields WHERE id = p_template_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
      END IF;
      
      IF v_source_tenant_id IS NOT NULL THEN
        RAISE EXCEPTION 'Can only copy platform default templates (tenant_id must be NULL)';
      END IF;
      
      -- Copy the application field
      INSERT INTO application_fields (
        tenant_id, field_name, field_label, field_type, is_required,
        is_default, placeholder_text, help_text, display_order,
        accepted_file_types, max_file_size_mb, is_core_field, created_by
      )
      SELECT 
        p_target_tenant_id, field_name, field_label, field_type, is_required,
        false, -- Copied templates are not defaults
        placeholder_text, help_text, display_order,
        accepted_file_types, max_file_size_mb, is_core_field, auth.uid()
      FROM application_fields WHERE id = p_template_id
      RETURNING id INTO v_new_id;
      
    WHEN 'contract_templates' THEN
      SELECT tenant_id INTO v_source_tenant_id
      FROM contract_templates WHERE id = p_template_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
      END IF;
      
      IF v_source_tenant_id IS NOT NULL THEN
        RAISE EXCEPTION 'Can only copy platform default templates (tenant_id must be NULL)';
      END IF;
      
      -- Copy the contract template
      INSERT INTO contract_templates (
        tenant_id, name, description, content, created_by
      )
      SELECT 
        p_target_tenant_id, name, description, content, auth.uid()
      FROM contract_templates WHERE id = p_template_id
      RETURNING id INTO v_new_id;
      
    ELSE
      RAISE EXCEPTION 'Invalid template table: %', p_template_table;
  END CASE;

  RETURN v_new_id;
END;
$$;