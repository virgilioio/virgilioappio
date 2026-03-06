
-- Add DF to state normalization
CREATE OR REPLACE FUNCTION public.normalize_candidate_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
  lower_state text;
  lower_city text;
BEGIN
  -- Trim whitespace
  NEW.location_country := NULLIF(TRIM(COALESCE(NEW.location_country, '')), '');
  NEW.location_state := NULLIF(TRIM(COALESCE(NEW.location_state, '')), '');
  NEW.location_city := NULLIF(TRIM(COALESCE(NEW.location_city, '')), '');

  -- Clear garbage
  IF LOWER(COALESCE(NEW.location_country, '')) IN ('país', 'null', 'n/a', '-', '--', 'none') THEN NEW.location_country := NULL; END IF;
  IF LOWER(COALESCE(NEW.location_state, '')) IN ('null', 'n/a', '-', '--', 'none') THEN NEW.location_state := NULL; END IF;
  IF LOWER(COALESCE(NEW.location_city, '')) IN ('null', 'n/a', '-', '--', 'none') THEN NEW.location_city := NULL; END IF;

  -- Fix cities in country field
  IF NEW.location_country IN ('Monterrey', 'Guadalajara', 'Puebla', 'Tijuana', 'Cancún', 'Cancun', 'Mérida', 'Merida', 'Querétaro', 'Queretaro', 'León', 'Leon') THEN
    IF NEW.location_city IS NULL THEN NEW.location_city := NEW.location_country; END IF;
    NEW.location_country := 'Mexico';
  END IF;
  IF NEW.location_country ~* '^\s*Jalisco\s*,?\s*M[eé]xi?co\s*$' THEN
    IF NEW.location_state IS NULL THEN NEW.location_state := 'Jalisco'; END IF;
    NEW.location_country := 'Mexico';
  END IF;
  IF NEW.location_country ~* '^\s*Nuevo\s+Le[oó]n\s*,?\s*M[eé]xi?co\s*$' THEN
    IF NEW.location_state IS NULL THEN NEW.location_state := 'Nuevo León'; END IF;
    NEW.location_country := 'Mexico';
  END IF;
  IF NEW.location_country ~* 'Metropolitan' THEN
    NEW.location_country := regexp_replace(NEW.location_country, '\s*Metropolitan\s+Area\s*', '', 'i');
  END IF;

  -- Country normalization
  IF NEW.location_country IS NOT NULL THEN
    NEW.location_country := CASE TRIM(LOWER(NEW.location_country))
      WHEN 'méxico' THEN 'Mexico' WHEN 'mx' THEN 'Mexico' WHEN 'mexico' THEN 'Mexico'
      WHEN 'eeuu' THEN 'United States' WHEN 'estados unidos' THEN 'United States'
      WHEN 'us' THEN 'United States' WHEN 'usa' THEN 'United States'
      WHEN 'united states of america' THEN 'United States' WHEN 'united states' THEN 'United States'
      WHEN 'brasil' THEN 'Brazil' WHEN 'brazil' THEN 'Brazil'
      WHEN 'perú' THEN 'Peru' WHEN 'peru' THEN 'Peru'
      WHEN 'colombia' THEN 'Colombia' WHEN 'argentina' THEN 'Argentina' WHEN 'chile' THEN 'Chile'
      WHEN 'canada' THEN 'Canada'
      WHEN 'uk' THEN 'United Kingdom' WHEN 'united kingdom' THEN 'United Kingdom' WHEN 'gb' THEN 'United Kingdom'
      WHEN 'de' THEN 'Germany' WHEN 'germany' THEN 'Germany'
      WHEN 'fr' THEN 'France' WHEN 'france' THEN 'France'
      WHEN 'es' THEN 'Spain' WHEN 'spain' THEN 'Spain' WHEN 'españa' THEN 'Spain'
      WHEN 'india' THEN 'India' WHEN 'in' THEN 'India'
      WHEN 'australia' THEN 'Australia' WHEN 'au' THEN 'Australia'
      WHEN 'singapore' THEN 'Singapore' WHEN 'sg' THEN 'Singapore'
      WHEN 'japan' THEN 'Japan' WHEN 'jp' THEN 'Japan'
      WHEN 'costa rica' THEN 'Costa Rica' WHEN 'ecuador' THEN 'Ecuador'
      WHEN 'panamá' THEN 'Panama' WHEN 'panama' THEN 'Panama'
      WHEN 'uruguay' THEN 'Uruguay' WHEN 'venezuela' THEN 'Venezuela' WHEN 'guatemala' THEN 'Guatemala'
      WHEN 'república dominicana' THEN 'Dominican Republic' WHEN 'dominican republic' THEN 'Dominican Republic'
      WHEN 'philippines' THEN 'Philippines' WHEN 'netherlands' THEN 'Netherlands'
      ELSE INITCAP(TRIM(NEW.location_country))
    END;
  END IF;

  -- State: split composite values
  IF NEW.location_state IS NOT NULL AND NEW.location_state ~ ',' THEN
    parts := string_to_array(NEW.location_state, ',');
    IF array_length(parts, 1) = 2 THEN
      IF NEW.location_city IS NULL THEN NEW.location_city := TRIM(parts[1]); END IF;
      NEW.location_state := TRIM(parts[2]);
    END IF;
  END IF;

  -- State normalization
  IF NEW.location_state IS NOT NULL THEN
    NEW.location_state := regexp_replace(NEW.location_state, '\s*Metropolitan\s*$', '', 'i');
    NEW.location_state := TRIM(NEW.location_state);
    lower_state := TRIM(LOWER(NEW.location_state));
    
    NEW.location_state := CASE
      WHEN lower_state IN ('jalisco', 'jal.', 'jal', 'guadalajara') THEN 'Jalisco'
      WHEN lower_state IN ('nuevo león', 'nuevo leon', 'nl') THEN 'Nuevo León'
      WHEN lower_state IN ('cdmx', 'ciudad de méxico', 'ciudad de mexico', 'federal district', 'distrito federal', 'mexico city', 'mexico city metropolitan', 'df') THEN 'Mexico City'
      WHEN lower_state IN ('baja california', 'bc') THEN 'Baja California'
      WHEN lower_state IN ('querétaro', 'queretaro', 'qro') THEN 'Querétaro'
      WHEN lower_state IN ('guanajuato', 'gto') THEN 'Guanajuato'
      WHEN lower_state = 'puebla' THEN 'Puebla'
      WHEN lower_state IN ('yucatán', 'yucatan') THEN 'Yucatán'
      WHEN lower_state IN ('quintana roo', 'qroo') THEN 'Quintana Roo'
      WHEN lower_state = 'sonora' THEN 'Sonora'
      WHEN lower_state = 'chihuahua' THEN 'Chihuahua'
      WHEN lower_state = 'sinaloa' THEN 'Sinaloa'
      WHEN lower_state = 'tamaulipas' THEN 'Tamaulipas'
      WHEN lower_state IN ('aguascalientes', 'ags') THEN 'Aguascalientes'
      WHEN lower_state = 'coahuila' THEN 'Coahuila'
      WHEN lower_state IN ('san luis potosí', 'san luis potosi', 'slp') THEN 'San Luis Potosí'
      WHEN lower_state IN ('estado de méxico', 'estado de mexico', 'state of mexico', 'edomex', 'edo mex', 'edo. mex', 'edo. mex.', 'méxico', 'mexico', 'edo méxico', 'edo mexico') THEN 'State of Mexico'
      WHEN lower_state = 'oaxaca' THEN 'Oaxaca'
      WHEN lower_state IN ('california', 'ca') THEN 'California'
      WHEN lower_state IN ('new york', 'ny') THEN 'New York'
      WHEN lower_state IN ('texas', 'tx') THEN 'Texas'
      WHEN lower_state IN ('florida', 'fl') THEN 'Florida'
      WHEN lower_state IN ('illinois', 'il') THEN 'Illinois'
      WHEN lower_state IN ('washington', 'wa') THEN 'Washington'
      WHEN lower_state IN ('colorado', 'co') THEN 'Colorado'
      WHEN lower_state IN ('massachusetts', 'ma') THEN 'Massachusetts'
      WHEN lower_state IN ('georgia', 'ga') THEN 'Georgia'
      ELSE INITCAP(TRIM(NEW.location_state))
    END;
  END IF;

  -- City normalization
  IF NEW.location_city IS NOT NULL THEN
    NEW.location_city := regexp_replace(NEW.location_city, '(?:Área\s+metropolitana\s+de|Metropolitan\s+Area\s+of|Greater)\s+', '', 'i');
    NEW.location_city := regexp_replace(NEW.location_city, '\s+Metropolitan\s+Area$', '', 'i');
    NEW.location_city := TRIM(NEW.location_city);

    lower_city := TRIM(LOWER(NEW.location_city));
    NEW.location_city := CASE
      WHEN lower_city IN ('ciudad de méxico', 'ciudad de mexico', 'cdmx', 'méxico city', 'mexico city', 'df') THEN 'Mexico City'
      WHEN lower_city IN ('santiago de querétaro', 'santiago de queretaro', 'queretaro', 'querétaro') THEN 'Querétaro'
      WHEN lower_city IN ('sao paulo', 'são paulo') THEN 'São Paulo'
      WHEN lower_city IN ('bogota', 'bogotá') THEN 'Bogotá'
      WHEN lower_city IN ('medellin', 'medellín') THEN 'Medellín'
      WHEN lower_city IN ('cancun', 'cancún') THEN 'Cancún'
      WHEN lower_city IN ('merida', 'mérida') THEN 'Mérida'
      WHEN lower_city IN ('leon', 'león') THEN 'León'
      WHEN lower_city = 'monterrey' THEN 'Monterrey'
      WHEN lower_city = 'guadalajara' THEN 'Guadalajara'
      WHEN lower_city = 'puebla' THEN 'Puebla'
      WHEN lower_city = 'tijuana' THEN 'Tijuana'
      ELSE INITCAP(TRIM(NEW.location_city))
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Final cleanup pass
UPDATE public.candidates SET location_state = location_state WHERE deleted_at IS NULL AND location_state IS NOT NULL;
