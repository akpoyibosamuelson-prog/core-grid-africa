INSERT INTO users (id, email, password_hash, name, role)
VALUES (gen_random_uuid(), 'samuelsonstarz980@gmail.com', '$2b$10$/bP3RcutB4Z0XZDnLmal8.nl0X/191CiUwX33uZ6p7SHlVEuWTJHy', 'Samuelson Starz', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash;
--> statement-breakpoint
INSERT INTO platform_admins (id, user_id, phone, title, is_platform_owner, must_change_password)
SELECT gen_random_uuid(), u.id, '08106596042', 'Platform Owner', true, true
FROM users u WHERE u.email = 'samuelsonstarz980@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
