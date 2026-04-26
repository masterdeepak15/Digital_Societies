-- ──────────────────────────────────────────────────────────────────────────────
-- Row-Level Security bootstrap
-- Runs once when the Postgres container first initialises.
-- Sets up the session variable that the API writes before each query.
-- ──────────────────────────────────────────────────────────────────────────────

-- Create schemas
CREATE SCHEMA IF NOT EXISTS identity;

-- Create app user with limited privileges (not superuser)
-- The actual GRANT statements are in EF Core migrations.

-- App session variable for RLS (set by TenantResolutionMiddleware)
-- Postgres RLS policies will reference current_setting('app.current_society_id')
ALTER DATABASE digital_societies SET app.current_society_id = '';

-- Example RLS policy (applied via EF Core migration, shown here for reference):
-- ALTER TABLE identity.memberships ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation ON identity.memberships
--   USING (society_id::text = current_setting('app.current_society_id', true));
