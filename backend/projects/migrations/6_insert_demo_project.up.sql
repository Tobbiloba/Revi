-- Insert a demo project for testing
INSERT INTO projects (name, api_key, created_at, updated_at)
VALUES (
  'Demo Project',
  'revi_demo_api_key_for_testing_12345678901234567890',
  NOW(),
  NOW()
) ON CONFLICT (api_key) DO NOTHING;

-- Fix sequence after manual insert
SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id) FROM projects), 1));