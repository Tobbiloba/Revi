-- Insert a demo project for testing
INSERT INTO projects (id, name, api_key, created_at, updated_at)
VALUES (
  1,
  'Demo Project',
  'revi_demo_api_key_for_testing_12345678901234567890',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;