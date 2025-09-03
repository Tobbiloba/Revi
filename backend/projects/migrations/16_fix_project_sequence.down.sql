-- Rollback: Reset sequence to 1 (this is safe since we only fix the sequence)
SELECT setval('projects_id_seq', 1);