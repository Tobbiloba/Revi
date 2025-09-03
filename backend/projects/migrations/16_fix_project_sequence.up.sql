-- Fix project ID sequence after demo data insertion
-- This ensures new projects can be created without ID conflicts

SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id) FROM projects), 1));