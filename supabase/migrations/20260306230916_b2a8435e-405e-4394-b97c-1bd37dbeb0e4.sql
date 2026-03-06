
-- ============================================================
-- Part 1: Create the normalize_candidate_location trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_candidate_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trim whitespace on all location fields
  NEW.location_country := NULLIF(TRIM(COALESCE(NEW.location_country, '')), '');
  NEW.location_state := NULLIF(TRIM(COALESCE(NEW.location_state, '')), '');
  NEW.location_city := NULLIF(TRIM(COALESCE(NEW.location_city, '')), '');

  -- Clear garbage values in country
  IF NEW.location_country IN ('País', 'null', 'N/A', 'n/a', '-', '--') THEN
    NEW.location_country := NULL;
  END IF;

  -- Fix cities/regions wrongly stored in country field
  IF NEW.location_country IN ('Monterrey', 'Guadalajara', 'Puebla', 'Tijuana', 'Cancún', 'Cancun', 'Mérida', 'Merida', 'Querétaro', 'Queretaro', 'León', 'Leon') THEN
    IF NEW.location_city IS NULL THEN
      NEW.location_city := NEW.location_country;
    END IF;
    NEW.location_country := 'Mexico';
  END IF;

  -- Fix "Jalisco, Mexico" style in country
  IF NEW.location_country ~* '^\s*Jalisco\s*,?\s*M[eé]xi?co\s*$' THEN
    IF NEW.location_state IS NULL THEN NEW.location_state := 'Jalisco'; END IF;
    NEW.location_country := 'Mexico';
  END IF;

  IF NEW.location_country ~* '^\s*Nuevo\s+Le[oó]n\s*,?\s*M[eé]xi?co\s*$' THEN
    IF NEW.location_state IS NULL THEN NEW.location_state := 'Nuevo León'; END IF;
    NEW.location_country := 'Mexico';
  END IF;

  -- Fix "Mexico Metropolitan Area" etc in country
  IF NEW.location_country ~* 'Metropolitan\s+Area' THEN
    NEW.location_country := regexp_replace(NEW.location_country, '\s*Metropolitan\s+Area\s*', '', 'i');
  END IF;

  -- Country normalization
  IF NEW.location_country IS NOT NULL THEN
    NEW.location_country := CASE TRIM(LOWER(NEW.location_country))
      WHEN 'méxico' THEN 'Mexico'
      WHEN 'mx' THEN 'Mexico'
      WHEN 'mexico' THEN 'Mexico'
      WHEN 'eeuu' THEN 'United States'
      WHEN 'estados unidos' THEN 'United States'
      WHEN 'us' THEN 'United States'
      WHEN 'usa' THEN 'United States'
      WHEN 'united states of america' THEN 'United States'
      WHEN 'united states' THEN 'United States'
      WHEN 'brasil' THEN 'Brazil'
      WHEN 'brazil' THEN 'Brazil'
      WHEN 'perú' THEN 'Peru'
      WHEN 'peru' THEN 'Peru'
      WHEN 'colombia' THEN 'Colombia'
      WHEN 'argentina' THEN 'Argentina'
      WHEN 'chile' THEN 'Chile'
      WHEN 'canada' THEN 'Canada'
      WHEN 'uk' THEN 'United Kingdom'
      WHEN 'united kingdom' THEN 'United Kingdom'
      WHEN 'gb' THEN 'United Kingdom'
      WHEN 'de' THEN 'Germany'
      WHEN 'germany' THEN 'Germany'
      WHEN 'fr' THEN 'France'
      WHEN 'france' THEN 'France'
      WHEN 'es' THEN 'Spain'
      WHEN 'spain' THEN 'Spain'
      WHEN 'españa' THEN 'Spain'
      WHEN 'india' THEN 'India'
      WHEN 'in' THEN 'India'
      WHEN 'australia' THEN 'Australia'
      WHEN 'au' THEN 'Australia'
      WHEN 'singapore' THEN 'Singapore'
      WHEN 'sg' THEN 'Singapore'
      WHEN 'japan' THEN 'Japan'
      WHEN 'jp' THEN 'Japan'
      WHEN 'costa rica' THEN 'Costa Rica'
      WHEN 'ecuador' THEN 'Ecuador'
      WHEN 'panamá' THEN 'Panama'
      WHEN 'panama' THEN 'Panama'
      WHEN 'uruguay' THEN 'Uruguay'
      WHEN 'venezuela' THEN 'Venezuela'
      WHEN 'guatemala' THEN 'Guatemala'
      WHEN 'república dominicana' THEN 'Dominican Republic'
      WHEN 'dominican republic' THEN 'Dominican Republic'
      ELSE INITCAP(TRIM(NEW.location_country))
    END;
  END IF;

  -- State normalization
  IF NEW.location_state IS NOT NULL THEN
    -- Strip city from composite "City, State" values
    IF NEW.location_state ~* '^.+,\s*.+$' THEN
      -- Extract the state part (after comma)
      DECLARE
        parts text[];
      BEGIN
        parts := string_to_array(NEW.location_state, ',');
        IF array_length(parts, 1) = 2 THEN
          IF NEW.location_city IS NULL THEN
            NEW.location_city := TRIM(parts[1]);
          END IF;
          NEW.location_state := TRIM(parts[2]);
        END IF;
      END;
    END IF;

    NEW.location_state := CASE TRIM(LOWER(NEW.location_state))
      WHEN 'jalisco' THEN 'Jalisco'
      WHEN 'jal.' THEN 'Jalisco'
      WHEN 'jal' THEN 'Jalisco'
      WHEN 'nuevo león' THEN 'Nuevo León'
      WHEN 'nuevo leon' THEN 'Nuevo León'
      WHEN 'nl' THEN 'Nuevo León'
      WHEN 'cdmx' THEN 'Mexico City'
      WHEN 'ciudad de méxico' THEN 'Mexico City'
      WHEN 'ciudad de mexico' THEN 'Mexico City'
      WHEN 'federal district' THEN 'Mexico City'
      WHEN 'distrito federal' THEN 'Mexico City'
      WHEN 'mexico city' THEN 'Mexico City'
      WHEN 'baja california' THEN 'Baja California'
      WHEN 'bc' THEN 'Baja California'
      WHEN 'querétaro' THEN 'Querétaro'
      WHEN 'queretaro' THEN 'Querétaro'
      WHEN 'qro' THEN 'Querétaro'
      WHEN 'guanajuato' THEN 'Guanajuato'
      WHEN 'gto' THEN 'Guanajuato'
      WHEN 'puebla' THEN 'Puebla'
      WHEN 'yucatán' THEN 'Yucatán'
      WHEN 'yucatan' THEN 'Yucatán'
      WHEN 'quintana roo' THEN 'Quintana Roo'
      WHEN 'qroo' THEN 'Quintana Roo'
      WHEN 'sonora' THEN 'Sonora'
      WHEN 'chihuahua' THEN 'Chihuahua'
      WHEN 'sinaloa' THEN 'Sinaloa'
      WHEN 'tamaulipas' THEN 'Tamaulipas'
      WHEN 'aguascalientes' THEN 'Aguascalientes'
      WHEN 'ags' THEN 'Aguascalientes'
      WHEN 'coahuila' THEN 'Coahuila'
      WHEN 'san luis potosí' THEN 'San Luis Potosí'
      WHEN 'san luis potosi' THEN 'San Luis Potosí'
      WHEN 'slp' THEN 'San Luis Potosí'
      WHEN 'estado de méxico' THEN 'State of Mexico'
      WHEN 'estado de mexico' THEN 'State of Mexico'
      WHEN 'state of mexico' THEN 'State of Mexico'
      WHEN 'edomex' THEN 'State of Mexico'
      -- US states
      WHEN 'california' THEN 'California'
      WHEN 'ca' THEN 'California'
      WHEN 'new york' THEN 'New York'
      WHEN 'ny' THEN 'New York'
      WHEN 'texas' THEN 'Texas'
      WHEN 'tx' THEN 'Texas'
      WHEN 'florida' THEN 'Florida'
      WHEN 'fl' THEN 'Florida'
      WHEN 'illinois' THEN 'Illinois'
      WHEN 'il' THEN 'Illinois'
      WHEN 'washington' THEN 'Washington'
      WHEN 'wa' THEN 'Washington'
      WHEN 'colorado' THEN 'Colorado'
      WHEN 'co' THEN 'Colorado'
      WHEN 'massachusetts' THEN 'Massachusetts'
      WHEN 'ma' THEN 'Massachusetts'
      WHEN 'georgia' THEN 'Georgia'
      WHEN 'ga' THEN 'Georgia'
      ELSE INITCAP(TRIM(NEW.location_state))
    END;
  END IF;

  -- City normalization
  IF NEW.location_city IS NOT NULL THEN
    -- Strip metro area prefixes
    NEW.location_city := regexp_replace(NEW.location_city, '(?:Área\s+metropolitana\s+de|Metropolitan\s+Area\s+of|Greater)\s+', '', 'i');
    NEW.location_city := regexp_replace(NEW.location_city, '\s+Metropolitan\s+Area$', '', 'i');
    NEW.location_city := TRIM(NEW.location_city);

    NEW.location_city := CASE TRIM(LOWER(NEW.location_city))
      WHEN 'ciudad de méxico' THEN 'Mexico City'
      WHEN 'ciudad de mexico' THEN 'Mexico City'
      WHEN 'cdmx' THEN 'Mexico City'
      WHEN 'méxico city' THEN 'Mexico City'
      WHEN 'mexico city' THEN 'Mexico City'
      WHEN 'df' THEN 'Mexico City'
      WHEN 'santiago de querétaro' THEN 'Querétaro'
      WHEN 'santiago de queretaro' THEN 'Querétaro'
      WHEN 'queretaro' THEN 'Querétaro'
      WHEN 'querétaro' THEN 'Querétaro'
      WHEN 'sao paulo' THEN 'São Paulo'
      WHEN 'são paulo' THEN 'São Paulo'
      WHEN 'bogota' THEN 'Bogotá'
      WHEN 'bogotá' THEN 'Bogotá'
      WHEN 'medellin' THEN 'Medellín'
      WHEN 'medellín' THEN 'Medellín'
      WHEN 'cancun' THEN 'Cancún'
      WHEN 'cancún' THEN 'Cancún'
      WHEN 'merida' THEN 'Mérida'
      WHEN 'mérida' THEN 'Mérida'
      WHEN 'leon' THEN 'León'
      WHEN 'león' THEN 'León'
      WHEN 'monterrey' THEN 'Monterrey'
      WHEN 'guadalajara' THEN 'Guadalajara'
      WHEN 'puebla' THEN 'Puebla'
      WHEN 'tijuana' THEN 'Tijuana'
      ELSE INITCAP(TRIM(NEW.location_city))
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_normalize_candidate_location ON public.candidates;
CREATE TRIGGER trg_normalize_candidate_location
  BEFORE INSERT OR UPDATE OF location_country, location_state, location_city
  ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_candidate_location();
