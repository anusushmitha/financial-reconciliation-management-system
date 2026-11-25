-- LENDGUARD AI - Seed Users
-- Admin: admin@example.com / Admin123!
-- Analyst: analyst@example.com / Analyst123!

INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'Administrator',
    'admin@example.com',
    '$2a$11$910xKz2.k4hOq1vK4a2fQe3/LwF1E5CgWfIekG6aR1pQpI.N1Yw4y', -- Admin123!
    'ADMIN',
    TRUE,
    now(),
    now()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
VALUES 
(
    '00000000-0000-0000-0000-000000000002',
    'Analyst User',
    'analyst@example.com',
    '$2a$11$2h2Z7mJ7B9w4yX6dF0tZLeY8H5nK3vM1qO7pS4uW0aC9dE2gI6kLm', -- Analyst123!
    'ANALYST',
    TRUE,
    now(),
    now()
)
ON CONFLICT (email) DO NOTHING;
