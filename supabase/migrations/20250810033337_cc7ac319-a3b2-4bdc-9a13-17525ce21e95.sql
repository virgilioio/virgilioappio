-- Update field_select_options constraint to allow application_field_id as a valid reference
ALTER TABLE public.field_select_options 
DROP CONSTRAINT IF EXISTS field_select_options_reference_check;

ALTER TABLE public.field_select_options 
ADD CONSTRAINT field_select_options_reference_check 
CHECK (
  ((CASE WHEN country_field_id IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN offer_template_field_id IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN application_field_id IS NOT NULL THEN 1 ELSE 0 END)) = 1
);

-- Create Salary Expectation fields in application_fields library (non-default)
DO $$
DECLARE
  currency_field_id uuid;
  amount_field_id uuid;
  period_field_id uuid;
BEGIN
  -- Salary Expectation - Currency (select)
  SELECT id INTO currency_field_id FROM public.application_fields WHERE field_name = 'salary_expectation_currency' LIMIT 1;
  IF currency_field_id IS NULL THEN
    INSERT INTO public.application_fields (
      field_name, field_label, field_type, is_required, is_default, placeholder_text, help_text, display_order
    ) VALUES (
      'salary_expectation_currency',
      'Salary Expectation - Currency',
      'select',
      false,
      false,
      'Select currency',
      'Choose the currency for your expected salary',
      0
    ) RETURNING id INTO currency_field_id;
  END IF;

  -- Salary Expectation - Amount (number)
  SELECT id INTO amount_field_id FROM public.application_fields WHERE field_name = 'salary_expectation_amount' LIMIT 1;
  IF amount_field_id IS NULL THEN
    INSERT INTO public.application_fields (
      field_name, field_label, field_type, is_required, is_default, placeholder_text, help_text, display_order
    ) VALUES (
      'salary_expectation_amount',
      'Salary Expectation - Amount',
      'number',
      false,
      false,
      'Enter amount (numbers only)',
      'Provide the numeric value of your expected salary (no separators)',
      0
    ) RETURNING id INTO amount_field_id;
  END IF;

  -- Salary Expectation - Period (select)
  SELECT id INTO period_field_id FROM public.application_fields WHERE field_name = 'salary_expectation_period' LIMIT 1;
  IF period_field_id IS NULL THEN
    INSERT INTO public.application_fields (
      field_name, field_label, field_type, is_required, is_default, placeholder_text, help_text, display_order
    ) VALUES (
      'salary_expectation_period',
      'Salary Expectation - Period',
      'select',
      false,
      false,
      'Select period',
      'Select the period your expected salary refers to',
      0
    ) RETURNING id INTO period_field_id;
  END IF;

  -- Seed select options for currency (common set)
  IF currency_field_id IS NOT NULL THEN
    -- Replace options to avoid duplicates
    DELETE FROM public.field_select_options WHERE application_field_id = currency_field_id;
    INSERT INTO public.field_select_options (application_field_id, option_value, option_label, display_order) VALUES
      (currency_field_id, 'USD', 'USD - US Dollar', 0),
      (currency_field_id, 'EUR', 'EUR - Euro', 1),
      (currency_field_id, 'GBP', 'GBP - British Pound', 2),
      (currency_field_id, 'CAD', 'CAD - Canadian Dollar', 3),
      (currency_field_id, 'AUD', 'AUD - Australian Dollar', 4),
      (currency_field_id, 'JPY', 'JPY - Japanese Yen', 5),
      (currency_field_id, 'INR', 'INR - Indian Rupee', 6);
  END IF;

  -- Seed select options for period
  IF period_field_id IS NOT NULL THEN
    DELETE FROM public.field_select_options WHERE application_field_id = period_field_id;
    INSERT INTO public.field_select_options (application_field_id, option_value, option_label, display_order) VALUES
      (period_field_id, 'yearly', 'Per Year', 0),
      (period_field_id, 'monthly', 'Per Month', 1),
      (period_field_id, 'weekly', 'Per Week', 2),
      (period_field_id, 'daily', 'Per Day', 3),
      (period_field_id, 'hourly', 'Per Hour', 4);
  END IF;
END $$;