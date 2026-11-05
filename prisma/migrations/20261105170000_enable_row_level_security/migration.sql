-- SECURITY: Supabase publishes every table in the `public` schema through its Data API, and
-- tables created by migrations do not get row-level security automatically. Without this, anyone
-- holding the public (anon/publishable) key could read and write every row directly — including
-- publishing a VERIFIED notice — bypassing all role checks in the app.
--
-- The app reaches Postgres through Prisma as the table owner, which RLS does not restrict, so
-- enabling RLS with NO policies leaves the app working and the Data API with no access at all.

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CivicEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlternativeArrangement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Complaint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitEvent" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Prisma's own bookkeeping table does not exist in the shadow database used by `migrate dev`.
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Defence in depth on Supabase: remove the table grants too, now and for future tables.
  -- These roles only exist on Supabase, so plain Postgres (CI, local) skips this.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
  END IF;
END $$;
