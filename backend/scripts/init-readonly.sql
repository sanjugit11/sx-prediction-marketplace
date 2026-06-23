-- Create a marker user for grading/auditing with read-only access
CREATE USER marker WITH PASSWORD 'marker_readonly_pass';

-- Grant connection access to the database
GRANT CONNECT ON DATABASE sx_prediction_db TO marker;

-- Connect to the database
\c sx_prediction_db;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO marker;

-- Grant read-only access to all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO marker;

-- Ensure read-only access is automatically applied to future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO marker;
