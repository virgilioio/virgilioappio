-- Rename candidate status 'available' to 'active'
UPDATE candidates SET status = 'active' WHERE status = 'available';