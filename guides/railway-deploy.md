# Deploying Filaments on Railway

A step-by-step guide for getting this Django + Celery + Postgres(pgvector) + Redis stack
running on [Railway](https://railway.app). Tailored to *this* repo — it calls out the
specific things that will break if you treat it like a generic Django app.

## What we're deploying

```
┌─────────────┐     ┌──────────────┐
│  web        │     │  worker      │
│  gunicorn   │     │  celery      │
└──────┬──────┘     └──────┬───────┘
       │                   │
   ┌───┴───────────────────┴───┐
   │   Postgres (pgvector)     │
   │   Redis (Celery broker)   │
   └───────────────────────────┘
                 │
          S3 (file storage)
```

Four Railway resources: **two services** (web + worker, same repo) and **two plugins**
(Postgres + Redis). File uploads go to **S3** because Railway containers have an ephemeral
filesystem — anything written to local disk is lost on every deploy/restart.

---

## Part 0 — Code changes required before you deploy

The current `filaments/settings.py` is dev-tuned. Three things must change or production
will be broken in non-obvious ways. Do these first, commit, *then* deploy.

### 0a. Serve static files (Django admin will be broken without this)

There is **no WhiteNoise** in `requirements.txt`, and `STATIC_ROOT` isn't set. With
`DEBUG=False`, Django stops serving static files itself — the admin (and DRF browsable
errors) load with no CSS. Add WhiteNoise:

```bash
# requirements.txt — add under "# Prod server"
whitenoise==6.*
```

```python
# filaments/settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # <- right after SecurityMiddleware
    'corsheaders.middleware.CorsMiddleware',
    # ... rest unchanged
]

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'                       # <- collectstatic target
STORAGES = {
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
```

> Note: your `USE_S3` block sets the deprecated `DEFAULT_FILE_STORAGE`. On Django 5.2 the
> modern form is the `STORAGES` dict with a `"default"` key. If you adopt the `STORAGES`
> dict above for staticfiles, move your S3 default into the same dict rather than mixing
> the two styles — Django ignores `DEFAULT_FILE_STORAGE` once `STORAGES` is defined.

### 0b. Trust the Railway domain (CSRF + HTTPS proxy)

Railway terminates TLS at its edge and forwards plain HTTP to your container. Django needs
to be told it's behind a trusted proxy, and admin/session POSTs need the domain in
`CSRF_TRUSTED_ORIGINS` (Django 4+ requirement) or every form submit 403s.

### 0c. Production security settings

This is a real decision, not boilerplate — see the contribution request at the bottom.
I've left a marked spot in `settings.py` for it.

---

## Part 1 — Create the project and add plugins

1. Install the CLI and log in (optional but handy for migrations/logs):
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. In the Railway dashboard: **New Project → Deploy from GitHub repo** → pick this repo.
   Railway autodetects Python via Nixpacks.
3. Add the data stores: **+ New → Database → Add PostgreSQL**, then again for **Redis**.

### pgvector — the one that bites

Your migrations call `VectorExtension` (`CREATE EXTENSION vector`). Railway's standard
Postgres image **does not ship pgvector**, so that migration fails with
`type "vector" does not exist`.

Two options:
- **Use the pgvector template**: delete the plain Postgres plugin and add
  **+ New → Template → "Postgres + pgvector"** (search the template gallery). It's the
  same Postgres with the extension preinstalled.
- Or keep plain Postgres and install pgvector yourself if your plan allows it (the
  extension binary still has to exist in the image — usually it doesn't, so prefer the
  template).

Verify after provisioning:
```bash
railway connect Postgres        # opens psql
\dx                             # 'vector' should be listed, or:
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Part 2 — Pin the Python version

Local dev is on Python 3.14, but several deps (`psycopg[binary]`, `PyMuPDF`, `pgvector`)
may not have wheels there yet, forcing slow/failing source builds. Pin a well-supported
version:

```bash
# .python-version  (Nixpacks reads this)
3.12
```

---

## Part 3 — Configure the web service

Select the service Railway created from the repo. Under **Settings**:

- **Start command**: `gunicorn filaments.wsgi --log-file -`
  (matches the `web:` line in the Procfile — Railway runs *one* process per service, so
  the `worker:` line is handled by a second service in Part 5, not automatically.)
- **Build**: Nixpacks installs `requirements.txt` automatically. Add a build step to
  collect static (the `STATIC_ROOT` you set in 0a):
  - Settings → **Custom Build Command**:
    `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- **Networking → Generate Domain** to get a public URL.

### Environment variables (web service)

Use Railway's reference syntax (`${{ Plugin.VAR }}`) so the values track the plugins:

| Variable | Value |
|---|---|
| `SECRET_KEY` | a fresh 50-char random string (don't reuse the dev key) |
| `DEBUG` | `False` |
| `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` |
| `CELERY_BROKER_URL` | `${{ Redis.REDIS_URL }}` |
| `ALLOWED_HOSTS` | `${{ RAILWAY_PUBLIC_DOMAIN }}` |
| `CSRF_TRUSTED_ORIGINS` | `https://${{ RAILWAY_PUBLIC_DOMAIN }}` |
| `GOOGLE_WEB_CLIENT_ID` | your OAuth web client id (required — settings has no default) |
| `ALLOWED_GOOGLE_EMAILS` | comma-separated allowlist (required — no default) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | your keys |
| `USE_S3` | `True` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 creds |
| `AWS_STORAGE_BUCKET_NAME` / `AWS_S3_REGION_NAME` | your bucket |

> `CSRF_TRUSTED_ORIGINS` is read by the snippet in 0b — make sure that snippet calls
> `env.list('CSRF_TRUSTED_ORIGINS', default=[])`.

Generate a secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## Part 4 — Run migrations

Migrations should run on every deploy, before the new code serves traffic. Add a
**release command** via the Procfile so Railway runs it automatically:

```procfile
# Procfile
release: python manage.py migrate --noinput
web: gunicorn filaments.wsgi --log-file -
worker: celery -A filaments worker -l info
```

(Railway honours the `release` process type like Heroku.) For the very first deploy you
can also run it manually:
```bash
railway run python manage.py migrate
railway run python manage.py createsuperuser
```

---

## Part 5 — Add the Celery worker service

The `worker:` Procfile line does **not** spin up on its own. Create a second service from
the same repo:

1. **+ New → GitHub Repo →** same repo (or "Empty Service" → connect the repo).
2. **Start command**: `celery -A filaments worker -l info`
3. Give it the **same env vars** as the web service — easiest via Railway's
   **shared variables** (project-level) or by referencing the same plugins. The worker
   needs at minimum `DATABASE_URL`, `CELERY_BROKER_URL`, the AI keys, and the S3 vars,
   since tasks read/write files and the DB.
4. The worker needs **no public domain** — leave networking off.

---

## Part 6 — Schedule the sweep commands

You have three maintenance commands that need to run on a cron:

- `sweep_orphaned_uploads`
- `sweep_soft_deletes`
- `sweep_stuck`

There's no Celery Beat configured, so use **Railway Cron** (one cron service per command,
or a single service running a small script). For each: **+ New → Cron**, set the schedule
(e.g. `0 3 * * *`) and command `python manage.py sweep_stuck`, with the same env vars.

> Alternative: add `django-celery-beat` and define a `CELERY_BEAT_SCHEDULE`, then run a
> `beat` process. More moving parts; Railway Cron is simpler for three jobs.

---

## Part 7 — Verify

```bash
railway logs                          # tail the web service
curl https://<your-domain>/admin/     # should return styled login (static working)
```

Checklist:
- [ ] `/admin/` loads **with CSS** (WhiteNoise + collectstatic worked)
- [ ] Admin login succeeds (CSRF_TRUSTED_ORIGINS correct)
- [ ] Upload a filament → worker logs show the task running (Redis + worker wired up)
- [ ] `\dx` in psql shows `vector` (pgvector migration applied)
- [ ] No `DisallowedHost` errors in logs (ALLOWED_HOSTS correct)

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `type "vector" does not exist` on deploy | plain Postgres image | use the pgvector template (Part 1) |
| Admin loads unstyled | no WhiteNoise / no collectstatic | Part 0a + build command |
| 403 on admin login / form POST | missing CSRF_TRUSTED_ORIGINS | Part 0b + env var |
| `DisallowedHost` | ALLOWED_HOSTS not set to the domain | Part 3 env var |
| Uploaded files vanish after redeploy | wrote to ephemeral disk | `USE_S3=True` (Part 3) |
| Tasks queued but never run | worker service missing/misconfigured | Part 5 |
| `Connection refused` to Redis/PG | used external URL instead of internal | reference `${{ Plugin.VAR }}` |
