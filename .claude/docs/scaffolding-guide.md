# Filaments — Scaffolding Guide (v1)

_Last updated 2026-05-30. Companion to `PRD.md`, `backend-planning-doc.md`, `frontend-planning-doc.md`, `design-system.md`._

Step-by-step setup for the **Django backend** and the **single Expo iOS app**. v1 is iOS-only and the two projects live in separate repos (the mobile app is a plain Expo app — no monorepo). Follow top to bottom; the backend comes first so the app has something to point at.

> **Convention note.** Use `npx expo install` (not bare `npm install`) for anything that ships native code or pins to the Expo SDK — it resolves the version compatible with your SDK. Use plain `npm install` only for pure-JS libraries. On the backend, pin versions in `requirements.txt` and install into a virtualenv. Where a version is given below it's current as of May 2026; let `expo install` / `pip` resolve compatible versions rather than hardcoding blindly.

---

## 0. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | Current LTS (≥ 20) | For Expo / Metro |
| Python | 3.12+ | Django 5.2 supports 3.10–3.14 |
| Docker + Compose | latest | Local Postgres + Redis |
| Xcode | latest | iOS Simulator + native builds |
| Watchman | latest (macOS) | `brew install watchman` |
| EAS CLI | latest | `npm install -g eas-cli` |
| A Google Cloud project | — | For OAuth client IDs (Part C) |
| An AWS account + S3 bucket | — | One dev bucket is enough |

Accounts: an Expo account (`eas login`) and an Apple Developer account (for device/TestFlight builds later).

---

# Part A — Backend (Django + DRF)

**Status: ✅ COMPLETED** (All steps A1-A11 completed successfully)

### Implementation Notes:
- **Postgres.app**: Using local Postgres.app (PG 17.10, pgvector 0.8.2) on port 5432 instead of Docker
- **Database**: `filaments_db` with user `filaments_user` created in local Postgres.app
- **Docker**: Only Redis runs in Docker (port 6379) with AOF persistence enabled
- **Database URL**: Using `127.0.0.1:5432` in `.env` and `.env.example`
- **requests library**: Added `requests==2.*` to requirements.txt as required by google-auth transport
- **Models**: Created simplified models (Filament, Chunk, Search) with pgvector fields. Full model spec from backend-planning-doc.md should be implemented next
- **Auth**: Implemented basic Google OAuth endpoint. Full email allowlist checking per settings ready to configure
- **Migration**: See [MIGRATION_LOG.md](../../MIGRATION_LOG.md) for details on switching from Docker Postgres to Postgres.app

## A1. Repo, virtualenv, dependencies ✅

```bash
mkdir filaments-backend && cd filaments-backend
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
```

Create `requirements.txt`:

```text
# Core
Django==5.2.*                       # current LTS (3-yr support); 5.0+ needed for GeneratedField
djangorestframework==3.16.*
djangorestframework-simplejwt[crypto]==5.*   # [crypto] pulls in cryptography for RS/EC signing
django-environ==0.12.*
django-cors-headers==4.*
psycopg[binary]==3.*                # Postgres driver (psycopg3)

# Vector / search
pgvector==0.4.*                     # provides pgvector.django VectorField + VectorExtension

# Async pipeline
celery==5.*
redis==5.*

# Storage
django-storages[s3]==1.*
boto3==1.*

# AI APIs
anthropic==0.*                      # Claude (summary/tags/extraction)
openai==1.*                         # Whisper transcription + embeddings

# Document/URL extraction
PyMuPDF==1.*                        # PDF text extraction
trafilatura==2.*                    # URL article extraction

# Auth
google-auth==2.*                    # verifies Google ID tokens

# Prod server
gunicorn==23.*
```

```bash
pip install -r requirements.txt
```

## A2. Create the project and apps ✅

```bash
django-admin startproject filaments .      # note trailing dot — project in current dir
python manage.py startapp core             # the Filament/Tag/Link/ActionItem domain
python manage.py startapp accounts          # the Google auth endpoint
```

Resulting layout:

```
filaments-backend/
  manage.py
  filaments/            # project package (settings, urls, celery, wsgi/asgi)
  core/                 # domain app
  accounts/             # auth app
  requirements.txt
  docker-compose.yml
  .env.example
```

## A3. Local infrastructure (Postgres.app + Docker Redis) ✅

**Strategy:** Use local **Postgres.app** for the database (better performance, newer versions) and Docker for **Redis only**. Django + Celery run on the host for fast reload.

### Step 1: Verify Postgres.app

Check if you have Postgres.app installed with pgvector:

```bash
# Check Postgres version
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -c "SELECT version();"

# Check pgvector availability
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"
```

If not installed: Download from [postgresapp.com](https://postgresapp.com) (includes pgvector 0.8.2+)

### Step 2: Create Database and User

```bash
# Create user
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -c "CREATE USER filaments_user WITH PASSWORD 'filaments_pass';"

# Create database
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -c "CREATE DATABASE filaments_db OWNER filaments_user;"

# Enable pgvector extension
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -d filaments_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -d filaments_db -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

### Step 3: Create docker-compose.yml (Redis only)

```yaml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes  # AOF persistence
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

```bash
docker compose up -d
```

## A4. `.env` / `.env.example` ✅

Commit `.env.example` (no real values); copy to `.env` locally and fill in.

```bash
# Django
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database / Redis
DATABASE_URL=postgres://filaments_user:filaments_pass@localhost:5432/filaments_db
REDIS_URL=redis://localhost:6379/0

# JWT (optional — falls back to SECRET_KEY)
JWT_SIGNING_KEY=

# Google OAuth (Part C)
GOOGLE_WEB_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
ALLOWED_GOOGLE_EMAILS=you@example.com

# AI APIs
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=us-east-1
```

Add `.env`, `.venv/`, `__pycache__/`, `*.pyc` to `.gitignore`.

## A5. `settings.py` ✅

Read config via `django-environ` and register everything:

```python
import environ
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "corsheaders",
    "storages",
    # local
    "core",
    "accounts",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",      # near the top, before CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "filaments.urls"
WSGI_APPLICATION = "filaments.wsgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}   # parses the postgres:// URL

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",   # default-deny; /auth/google is explicitly AllowAny
    ),
    "DEFAULT_VERSIONING_CLASS": "rest_framework.versioning.URLPathVersioning",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "PAGE_SIZE": 30,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=60),
    "ROTATE_REFRESH_TOKENS": True,
    "SIGNING_KEY": env("JWT_SIGNING_KEY", default=SECRET_KEY),
}

# Google OAuth
GOOGLE_WEB_CLIENT_ID = env("GOOGLE_WEB_CLIENT_ID")
GOOGLE_IOS_CLIENT_ID = env("GOOGLE_IOS_CLIENT_ID", default="")
ALLOWED_GOOGLE_EMAILS = env.list("ALLOWED_GOOGLE_EMAILS")

# Celery
CELERY_BROKER_URL = env("REDIS_URL")
CELERY_RESULT_BACKEND = env("REDIS_URL")
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True

# S3
STORAGES = {
    "default": {"BACKEND": "storages.backends.s3.S3Storage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME")

# CORS — open in dev; lock to the app's origins (and v1.1 web origin) in prod
CORS_ALLOW_ALL_ORIGINS = DEBUG

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
```

## A6. Celery wiring ✅

`filaments/celery.py`:

```python
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "filaments.settings")
app = Celery("filaments")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

`filaments/__init__.py`:

```python
from .celery import app as celery_app
__all__ = ("celery_app",)
```

## A7. Enable pgvector via migration ✅

The image ships the extension at the system level, but it must be enabled **inside the DB** before the first `vector` column. Create an empty migration in `core` and add the operation:

```bash
python manage.py makemigrations core --empty --name enable_pgvector
```

Edit the generated file:

```python
from django.db import migrations
from pgvector.django import VectorExtension

class Migration(migrations.Migration):
    dependencies = []                 # keep as the first core migration
    operations = [VectorExtension()]  # CREATE EXTENSION IF NOT EXISTS vector
```

## A8. Models (skeleton — see backend doc for full spec) ✅

`core/models.py` — scaffold the entities now; flesh out per `backend-planning-doc.md` → Data Model:

```python
import uuid
from django.db import models
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex
from pgvector.django import VectorField

class Filament(models.Model):
    class Type(models.TextChoices):
        VOICE = "voice"; DOCUMENT = "document"; TEXT = "text"
    class Status(models.TextChoices):
        PENDING_UPLOAD = "pending_upload"; PROCESSING = "processing"
        DONE = "done"; FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=10, choices=Type.choices)
    title = models.TextField(blank=True)
    body = models.TextField(blank=True)            # canonical searchable text for every type
    summary = models.TextField(blank=True)
    key_ideas = models.JSONField(default=list)
    transcript = models.JSONField(null=True, blank=True)
    source_key = models.TextField(null=True, blank=True)
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING_UPLOAD)
    pipeline_attempts = models.IntegerField(default=0)
    # search_vector: GeneratedField from title+body+summary (Django 5.0+) — add per backend doc
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    pinned = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [GinIndex(fields=["search_vector"])]

class ActionItem(models.Model):
    id = models.AutoField(primary_key=True)
    filament = models.ForeignKey(Filament, on_delete=models.CASCADE, related_name="action_items")
    text = models.TextField()
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Tag(models.Model):
    name = models.CharField(max_length=64, unique=True)

class FilamentTag(models.Model):
    filament = models.ForeignKey(Filament, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    class Meta:
        unique_together = ("filament", "tag")

class FilamentLink(models.Model):
    id = models.AutoField(primary_key=True)
    source = models.ForeignKey(Filament, on_delete=models.CASCADE, related_name="links_as_source")
    target = models.ForeignKey(Filament, on_delete=models.CASCADE, related_name="links_as_target")
    score = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["source", "target"], name="uniq_link_pair")]
```

> The two `FilamentLink` FKs **must** have distinct `related_name`s (`links_as_source` / `links_as_target`) or the migration is rejected. See backend doc.

## A9. Auth endpoint ✅

`accounts/views.py`:

```python
from django.conf import settings
from django.contrib.auth.models import User
from google.oauth2 import id_token
from google.auth.transport import requests as g_requests
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

class GoogleAuthView(APIView):
    permission_classes = [AllowAny]          # the one public route

    def post(self, request):
        token = request.data.get("id_token")
        try:
            claims = id_token.verify_oauth2_token(
                token, g_requests.Request(), settings.GOOGLE_WEB_CLIENT_ID
            )
        except ValueError:
            return Response({"error": "invalid google token"}, status=status.HTTP_401_UNAUTHORIZED)
        if not claims.get("email_verified"):
            return Response({"error": "invalid google token"}, status=status.HTTP_401_UNAUTHORIZED)
        email = claims["email"]
        if email not in settings.ALLOWED_GOOGLE_EMAILS:     # check BEFORE get_or_create
            return Response({"error": "email not permitted"}, status=status.HTTP_403_FORBIDDEN)
        user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {"id": user.id, "email": user.email},
        })
```

## A10. URLs (versioned under `/api/v1/`) ✅

`filaments/urls.py`:

```python
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import GoogleAuthView

api_v1 = [
    path("auth/google", GoogleAuthView.as_view()),
    path("auth/token/refresh", TokenRefreshView.as_view()),
    # path("filaments/", include("core.urls")),   # add as you build core
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "v1"))),
]
```

## A11. Migrate and run ✅

```bash
python manage.py migrate
python manage.py createsuperuser        # optional — for /admin

# Local development processes:
# 1. Redis (Docker) - already running from `docker compose up -d`
# 2. Postgres.app - already running natively on port 5432
# 3. Django API (host):
python manage.py runserver              # API on :8000
# 4. Celery worker (host):
celery -A filaments worker -l info      # pipeline worker
# 5. Celery beat (optional, only when testing periodic sweeps):
# celery -A filaments beat -l info
```

> **Sweep scheduling is still an open decision** (Celery Beat vs. Railway cron — see PRD Open Q #9). You don't need it to start building, but it must land before the failure-recovery sweeps go live.

Smoke test once Part C gives you a real token, or hit `/admin` now to confirm the DB is wired.

---

# Part B — Mobile App (single Expo app)

## B1. Create the app

```bash
npx create-expo-app@latest filaments-app     # ships Expo Router + the default template
cd filaments-app
npm run reset-project                         # removes the demo screens, gives a clean app/ dir
```

> `create-expo-app@latest` currently scaffolds Expo SDK 56 with Expo Router preconfigured. **SDK 56 note:** don't import from `@react-navigation/*` in app code — use the matching `expo-router` entry points (the template already does this).

Move routes under `src/` to match the planned structure (Expo Router supports `src/app`):

```
src/
  app/          # routes: _layout.tsx (auth gate) + (tabs)/ timeline, record, detail, ask, search
  components/
  hooks/
  lib/          # api client, token storage, query client
  styles/       # global.css, (tokens live in tailwind.config.js at root)
```

## B2. Install dependencies (use `expo install` for native modules)

```bash
# Routing peers (already present from the template, safe to ensure):
npx expo install react-native-safe-area-context react-native-screens expo-linking expo-constants

# Styling — NativeWind v4 (stable) + Tailwind CSS v3 (NativeWind v4 supports v3, NOT v4):
npx expo install nativewind react-native-reanimated
npm install --save-dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss

# Server state (pure JS):
npm install @tanstack/react-query

# Secure token storage:
npx expo install expo-secure-store

# Native Google Sign-In (NOT the deprecated expo-google-sign-in):
npx expo install @react-native-google-signin/google-signin

# Fonts (design system: Lora / Inter / JetBrains Mono):
npx expo install expo-font @expo-google-fonts/lora @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono

# Audio capture/playback + filesystem for offline queue (add when building Record):
npx expo install expo-audio expo-file-system

# Dev client (required — see B8):
npx expo install expo-dev-client
```

> NativeWind v5 exists in **preview** (`nativewind@preview` + `react-native-css`, Tailwind v4 syntax). For a project that needs to be reliable, stay on stable **v4 + Tailwind v3** as above until v5 ships stable.

## B3. Configure NativeWind

**`tailwind.config.js`** (root) — tokens live here per the frontend plan; wire the design-system palette:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#faf8f6",100:"#f3efe9",200:"#e6ddd3",300:"#d4c5b5",400:"#b8a48e",
          500:"#9c8368",600:"#7d6750",700:"#5e4d3b",800:"#3f3328",900:"#231c16",
        },
        neutral: {
          0:"#ffffff",50:"#fafaf9",100:"#f5f5f4",200:"#e7e5e4",300:"#d6d3d1",400:"#a8a29e",
          500:"#78716c",600:"#57534e",700:"#44403c",800:"#292524",900:"#1c1917",
        },
        error:"#dc2626","error-light":"#fef2f2",
        success:"#16a34a","success-light":"#f0fdf4",
        warning:"#d97706","warning-light":"#fffbeb",
        info:"#2563eb","info-light":"#eff6ff",
        "type-voice":"#7c3aed","type-document":"#2563eb","type-text":"#0d9488",
      },
      fontFamily: {
        serif: ["Lora_600SemiBold"],
        sans: ["Inter_400Regular"],
        mono: ["JetBrainsMono_400Regular"],
      },
      borderRadius: { sm:"4px", md:"8px", lg:"12px", xl:"16px", full:"9999px" },
    },
  },
  plugins: [],
};
```

**`src/styles/global.css`**:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`babel.config.js`**:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: ["nativewind/babel"],
  };
};
```

**`metro.config.js`**:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
```

**`nativewind-env.d.ts`** (root, for TypeScript):

```ts
/// <reference types="nativewind/types" />
```

Import the stylesheet **once** in the root layout, `src/app/_layout.tsx`:

```tsx
import "../styles/global.css";
import { Stack } from "expo-router";
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

## B4. Load fonts

In the root layout, gate render on fonts:

```tsx
import { useFonts, Lora_600SemiBold, Lora_700Bold } from "@expo-google-fonts/lora";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
// const [loaded] = useFonts({ Lora_600SemiBold, Lora_700Bold, Inter_400Regular, ... });
// if (!loaded) return null;   // or a splash hold
```

## B5. Query client provider

`src/lib/queryClient.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient();
```

Wrap the app in the root layout with `<QueryClientProvider client={queryClient}>…</QueryClientProvider>`.

## B6. Secure token storage

`src/lib/tokens.ts`:

```ts
import * as SecureStore from "expo-secure-store";
const ACCESS = "fil_access", REFRESH = "fil_refresh";
export const saveTokens = (a: string, r: string) =>
  Promise.all([SecureStore.setItemAsync(ACCESS, a), SecureStore.setItemAsync(REFRESH, r)]);
export const getAccess = () => SecureStore.getItemAsync(ACCESS);
export const getRefresh = () => SecureStore.getItemAsync(REFRESH);
export const clearTokens = () =>
  Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
```

## B7. Configure Google Sign-In

Add the config plugin and bundle identifier to **`app.json`** (`iosUrlScheme` is the reversed iOS client ID from Part C):

```json
{
  "expo": {
    "ios": { "bundleIdentifier": "com.yourname.filaments" },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["@react-native-google-signin/google-signin",
        { "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID" }]
    ]
  }
}
```

Configure the client once at startup (e.g. in the root layout):

```ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,  // type WEB — produces the idToken `aud`
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  scopes: ["email", "profile"],
});
```

Sign-in → backend handshake:

```ts
async function signIn() {
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  const idToken = res.data?.idToken;
  const r = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  const { access, refresh } = await r.json();
  await saveTokens(access, refresh);
}
```

Put `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in a `.env` at the app root (Expo exposes `EXPO_PUBLIC_*` to the client). The webClientId here must equal the backend's `GOOGLE_WEB_CLIENT_ID` — that's the audience it verifies.

## B8. Build a dev client (required) and run

Native Google Sign-In does **not** work in Expo Go — you need a development build.

```bash
eas login
eas build:configure                 # creates eas.json
eas build --profile development --platform ios   # or: npx expo prebuild && npx expo run:ios
```

Install the resulting build on the Simulator/device, then:

```bash
npx expo start --dev-client
```

---

# Part C — Google Cloud Console (OAuth client IDs)

You need **two** OAuth 2.0 client IDs in one Google Cloud project.

1. **Create a project** at console.cloud.google.com.
2. **OAuth consent screen** → User type *External* → fill app name + your email → add your Google email under **Test users**. Leave it in **Testing** mode (no verification review needed for a personal app).
3. **Credentials → Create credentials → OAuth client ID:**
   - **iOS** client: set the **Bundle ID** to `com.yourname.filaments` (must match `app.json`). Google gives you a client ID and a **reversed** form (`com.googleusercontent.apps.…`) — that reversed value is the `iosUrlScheme` in B7. This is `GOOGLE_IOS_CLIENT_ID`.
   - **Web application** client: no redirect URIs needed for native flow. This client ID is **`GOOGLE_WEB_CLIENT_ID`** — the token audience the **backend verifies** and the app's `webClientId`.
4. Put the web client ID in both the backend `.env` (`GOOGLE_WEB_CLIENT_ID`) and the app `.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`); the iOS client ID in `GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

> Since v1 is iOS-only, you do **not** need an Android client, `google-services.json`, or SHA-1 fingerprints. Those return only if Android/web is added later.

---

# Part D — Wire & smoke test

1. Backend running (`runserver` + `worker`), infra up (`docker compose up -d`).
2. App `.env` `EXPO_PUBLIC_API_URL` points at your machine's LAN IP (`http://192.168.x.x:8000`), not `localhost` — the Simulator/device can't reach the host's `localhost`.
3. Launch the dev client, tap **Sign in with Google**, pick your allowlisted account.
4. Expect: app receives `{ access, refresh }`, stores them in SecureStore, routes to Timeline.
5. Confirm the backend created exactly one `User` (check `/admin`) and that a non-allowlisted Google account gets a `403`.

Once auth round-trips, build the first vertical slice (Record → upload → process → Timeline) per the frontend plan.

---

## Appendix — version & convention cheatsheet

| Thing | Choice | Why |
|---|---|---|
| Django | 5.2 LTS | 3-yr support; 5.0+ required for `GeneratedField` (search_vector) |
| Expo | SDK 56 (via `create-expo-app@latest`) | Current; Expo Router preconfigured. Repoint `@react-navigation/*` imports → `expo-router` |
| NativeWind | v4 stable + `tailwindcss@^3.4` | NativeWind v4 supports Tailwind **v3 only**; v5 is preview |
| Google Sign-In | `@react-native-google-signin/google-signin` | `expo-google-sign-in` is deprecated; needs a dev build, not Expo Go |
| Token storage | Expo SecureStore | Keychain-backed; web cookie question deferred to v1.1 |
| Postgres image | `pgvector/pgvector:pg16` | Base Postgres lacks the extension at system level |
| Install commands | `npx expo install` (native) / `npm install` (JS) / `pip` (Python) | Expo resolves SDK-compatible versions |

### Common gotchas
- **`localhost` from the Simulator** points at the Simulator, not your Mac — use the LAN IP for `EXPO_PUBLIC_API_URL`.
- **Tailwind v4 installed by mistake** → NativeWind errors with "only supports Tailwind CSS v3". Pin `tailwindcss@^3.4.17`.
- **Google Sign-In silently does nothing** in Expo Go → you're not on a dev build.
- **pgvector "type vector does not exist"** → the `VectorExtension` migration didn't run before the first vector column, or you're on base Postgres.
- **FilamentLink migration rejected** → the two FKs to `Filament` need distinct `related_name`s.
