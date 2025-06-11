
-- Drop existing policies if they exist to recreate them properly
DROP POLICY IF EXISTS "Platform admins can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Billing members can upload org invoices" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can view all invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Billing members can view org invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Workspace owners can view org invoice files" ON storage.objects;

-- Ensure RLS is enabled on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create invoices table policies only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invoices' 
        AND policyname = 'Platform admins can manage all invoices'
    ) THEN
        CREATE POLICY "Platform admins can manage all invoices" ON public.invoices
        FOR ALL 
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.members 
            WHERE user_id = auth.uid() 
            AND user_type = 'platform_admin'
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invoices' 
        AND policyname = 'Billing members can manage org invoices'
    ) THEN
        CREATE POLICY "Billing members can manage org invoices" ON public.invoices
        FOR ALL 
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.members 
            WHERE user_id = auth.uid() 
            AND member_role = 'billing'
            AND organization_id = invoices.organization_id
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invoices' 
        AND policyname = 'Workspace owners can view org invoices'
    ) THEN
        CREATE POLICY "Workspace owners can view org invoices" ON public.invoices
        FOR SELECT 
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.members 
            WHERE user_id = auth.uid() 
            AND user_type = 'workspace_owner'
            AND organization_id = invoices.organization_id
          )
        );
    END IF;
END $$;

-- Add columns if they don't exist
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS description text;

-- Recreate storage policies
CREATE POLICY "Platform admins can upload invoices" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() 
    AND user_type = 'platform_admin'
  )
);

CREATE POLICY "Billing members can upload org invoices" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() 
    AND member_role = 'billing'
  )
);

CREATE POLICY "Platform admins can view all invoice files" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() 
    AND user_type = 'platform_admin'
  )
);

CREATE POLICY "Billing members can view org invoice files" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() 
    AND member_role = 'billing'
  )
);

CREATE POLICY "Workspace owners can view org invoice files" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() 
    AND user_type = 'workspace_owner'
  )
);
