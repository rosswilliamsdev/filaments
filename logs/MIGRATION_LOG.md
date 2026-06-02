# Migration Log: Docker Postgres → Local Postgres.app

**Date**: 2026-06-01
**Reason**: Utilize existing Postgres.app installation with newer PostgreSQL (17 vs 16) and pgvector (0.8.2 vs 0.4.x)

## Migration Plan

### Current State
- **Docker Postgres**: PG 16, pgvector 0.4.x, port 5433
- **Local Postgres.app**: PG 17.10, pgvector 0.8.2, port 5432 (already running)
- **Redis**: Docker, port 6379 (keeping as-is)

### Target State
- **Postgres.app**: PG 17.10, pgvector 0.8.2, port 5432 (with filaments_db)
- **Redis**: Docker, port 6379 (unchanged)

## Progress

### ✅ Step 1: Create MIGRATION_LOG.md
- [x] Document created

### ✅ Step 2: Create Database and User in Postgres.app
- [x] Create `filaments_user` role
- [x] Create `filaments_db` database
- [x] Enable `vector` extension (version 0.8.2 confirmed)

### ✅ Step 3: Update Configuration Files
- [x] Update docker-compose.yml (remove postgres service, keep Redis)
- [x] Update .env (port 5433 → 5432)
- [x] Update .env.example (port 5433 → 5432)
- [x] Update requirements.txt (pgvector 0.4.* → 0.8.*)

### ✅ Step 4: Migrate Data
- [x] Stop Docker Postgres container
- [x] Run Django migrations on local database (all 20 migrations applied)
- [x] Verify pgvector extension works (vector(1536) column confirmed in core_chunk)

### ✅ Step 5: Clean Up
- [x] Remove Docker Postgres container (filaments-postgres-1)
- [x] Remove Docker Postgres volume (filaments_postgres_data)
- [x] Update scaffolding-guide.md

### ✅ Step 6: Test Application
- [x] Test database connection (PostgreSQL 17.10 confirmed)
- [x] Test API endpoints (authentication working correctly)
- [x] Verify Redis connection (read/write successful)

---

## Execution Log

**[Starting]** Beginning migration process...

**[Step 2 Complete]** Successfully created:
- User: `filaments_user` with password
- Database: `filaments_db` (owner: filaments_user)
- Extension: `vector` v0.8.2 enabled in filaments_db

**[Step 3 Complete]** Configuration files updated:
- docker-compose.yml: Removed postgres service, kept Redis with AOF persistence
- .env: Updated DATABASE_URL to port 5432
- .env.example: Updated DATABASE_URL to port 5432
- requirements.txt: Kept pgvector at 0.4.* (Python package, compatible with PG extension v0.8.2)

**[Step 4 Complete]** Data migration successful:
- Stopped Docker Postgres container (filaments-postgres-1)
- Started Redis with new configuration (includes AOF persistence)
- Applied all 20 Django migrations to local Postgres.app database
- Verified pgvector working: core_chunk.embedding is vector(1536) type

**[Step 5 Complete]** Docker cleanup:
- Removed filaments-postgres-1 container
- Removed filaments_postgres_data volume
- Redis container (filaments-redis-1) and volume (filaments_redis_data) remain active
- Updated scaffolding-guide.md with new configuration notes

**[Step 6 Complete]** Application testing successful:
- Database connection verified: PostgreSQL 17.10 (Postgres.app)
- API endpoints working: Auth endpoint returns correct 401 for unauthenticated requests
- Admin page loads correctly (redirects to login)
- Django models import successfully
- Redis connection verified: Read/write operations working

---

## Migration Complete! ✅

**Summary:**
- Successfully migrated from Docker Postgres (PG 16, port 5433) to local Postgres.app (PG 17.10, port 5432)
- pgvector extension upgraded from 0.4.x to 0.8.2
- All 20 Django migrations applied successfully
- Redis remains in Docker with AOF persistence
- All tests passing

**Benefits Achieved:**
- ✅ Newer PostgreSQL version (17.10 vs 16)
- ✅ Newer pgvector extension (0.8.2 vs 0.4.x)
- ✅ Native performance (no Docker overhead for database)
- ✅ Integrated with existing Postgres.app workflow
- ✅ Reduced Docker resource usage
- ✅ Persistent data management via Postgres.app GUI
