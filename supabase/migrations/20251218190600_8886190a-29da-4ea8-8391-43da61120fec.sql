-- Clean &nbsp; entities from existing email subjects
UPDATE stage_automation_emails 
SET subject = REPLACE(subject, '&nbsp;', ' ')
WHERE subject LIKE '%&nbsp;%';

UPDATE email_templates
SET subject = REPLACE(subject, '&nbsp;', ' ')
WHERE subject LIKE '%&nbsp;%';