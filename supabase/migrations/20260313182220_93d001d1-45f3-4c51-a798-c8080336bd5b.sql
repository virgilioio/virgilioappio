
CREATE OR REPLACE FUNCTION validate_candidate_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.candidate_name IS NULL OR TRIM(NEW.candidate_name) = '' THEN
    RAISE EXCEPTION 'candidate_name cannot be empty';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_candidate_name
  BEFORE INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION validate_candidate_name();
