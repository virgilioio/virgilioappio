-- Add salary_expectations to the interview_answer_type enum
ALTER TYPE interview_answer_type ADD VALUE 'salary_expectations';

-- Add new columns to scorecard_interview_questions for notes and salary configuration
ALTER TABLE scorecard_interview_questions
ADD COLUMN notes_for_interviewer TEXT,
ADD COLUMN salary_config JSONB;

-- Add comment for documentation
COMMENT ON COLUMN scorecard_interview_questions.notes_for_interviewer IS 'Optional notes/guidance for interviewers about this question';
COMMENT ON COLUMN scorecard_interview_questions.salary_config IS 'Configuration for salary_expectations type: {"currency": "USD", "period": "monthly"}';