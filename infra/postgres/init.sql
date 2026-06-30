-- Ensure the GlitchTip database exists alongside the app database.
SELECT 'CREATE DATABASE glitchtip'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'glitchtip')\gexec
