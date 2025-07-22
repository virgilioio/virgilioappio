
-- Update workers table to support payment frequency and scheduling
ALTER TABLE public.workers 
DROP COLUMN IF EXISTS pay_date;

-- Add new payment-related columns
ALTER TABLE public.workers 
ADD COLUMN payment_frequency TEXT CHECK (payment_frequency IN ('bi_monthly', 'monthly', 'custom')) DEFAULT 'monthly',
ADD COLUMN custom_pay_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN next_payment_date DATE;

-- Add comment to document the payment frequency options
COMMENT ON COLUMN public.workers.payment_frequency IS 'Payment frequency: bi_monthly (15th and last of month), monthly (last of month), custom (specific dates)';
COMMENT ON COLUMN public.workers.custom_pay_dates IS 'Array of custom payment dates when payment_frequency is custom. Format: [1, 15, 30] for specific days of month';
COMMENT ON COLUMN public.workers.next_payment_date IS 'Next calculated payment date based on payment frequency';

-- Create function to calculate next payment date
CREATE OR REPLACE FUNCTION calculate_next_payment_date(
  frequency TEXT,
  custom_dates JSONB DEFAULT '[]'::jsonb,
  reference_date DATE DEFAULT CURRENT_DATE
) RETURNS DATE AS $$
DECLARE
  next_date DATE;
  current_day INTEGER;
  days_in_month INTEGER;
  custom_day INTEGER;
BEGIN
  current_day := EXTRACT(DAY FROM reference_date);
  
  CASE frequency
    WHEN 'bi_monthly' THEN
      -- 15th and last of month
      IF current_day < 15 THEN
        next_date := DATE_TRUNC('month', reference_date) + INTERVAL '14 days';
      ELSE
        -- Go to last day of current month or next month
        days_in_month := EXTRACT(DAY FROM DATE_TRUNC('month', reference_date) + INTERVAL '1 month' - INTERVAL '1 day');
        IF current_day < days_in_month THEN
          next_date := DATE_TRUNC('month', reference_date) + INTERVAL '1 month' - INTERVAL '1 day';
        ELSE
          -- Next 15th
          next_date := DATE_TRUNC('month', reference_date) + INTERVAL '1 month' + INTERVAL '14 days';
        END IF;
      END IF;
      
    WHEN 'monthly' THEN
      -- Last day of month
      IF current_day < EXTRACT(DAY FROM DATE_TRUNC('month', reference_date) + INTERVAL '1 month' - INTERVAL '1 day') THEN
        next_date := DATE_TRUNC('month', reference_date) + INTERVAL '1 month' - INTERVAL '1 day';
      ELSE
        next_date := DATE_TRUNC('month', reference_date) + INTERVAL '2 months' - INTERVAL '1 day';
      END IF;
      
    WHEN 'custom' THEN
      -- Find next custom date
      next_date := reference_date + INTERVAL '1 day';
      FOR custom_day IN SELECT jsonb_array_elements_text(custom_dates)::INTEGER
      LOOP
        IF custom_day > current_day THEN
          next_date := DATE_TRUNC('month', reference_date) + INTERVAL (custom_day - 1) || ' days';
          EXIT;
        END IF;
      END LOOP;
      
      -- If no date found this month, go to next month's first custom date
      IF next_date <= reference_date THEN
        SELECT MIN(jsonb_array_elements_text(custom_dates)::INTEGER) INTO custom_day;
        next_date := DATE_TRUNC('month', reference_date) + INTERVAL '1 month' + INTERVAL (custom_day - 1) || ' days';
      END IF;
      
    ELSE
      next_date := reference_date + INTERVAL '1 month';
  END CASE;
  
  RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to automatically calculate next_payment_date
CREATE OR REPLACE FUNCTION update_next_payment_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_payment_date := calculate_next_payment_date(
    NEW.payment_frequency,
    NEW.custom_pay_dates,
    COALESCE(NEW.next_payment_date, CURRENT_DATE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_next_payment_date
  BEFORE INSERT OR UPDATE OF payment_frequency, custom_pay_dates
  ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION update_next_payment_date();
