# Part D — Wire & Smoke Test Setup

## Configuration Complete ✅

### Backend Environment (.env)
- ✅ `ALLOWED_HOSTS` updated to include LAN IP: `localhost,127.0.0.1,192.168.1.83`
- ✅ `REDIS_URL` added: `redis://localhost:6379/0`
- ✅ `ALLOWED_GOOGLE_EMAILS` added (⚠️ **UPDATE WITH YOUR GMAIL**)
- ✅ Google OAuth client IDs configured

### Mobile Environment (mobile/.env)
- ✅ `EXPO_PUBLIC_API_URL` set to: `http://192.168.1.83:8000`
- ✅ Google OAuth client IDs configured

## Next Steps — Manual Actions Required

### 1. Update Your Email in Backend .env
Edit `.env` and replace `your-email@gmail.com` with your actual Google account email:
```bash
ALLOWED_GOOGLE_EMAILS=your-actual-email@gmail.com
```

### 2. Start Docker Desktop
Redis needs to run via Docker Compose:
```bash
# After starting Docker Desktop app:
docker compose up -d
```

### 3. Start Backend Services

**Terminal 1 — Django API:**
```bash
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```
> Note: Using `0.0.0.0:8000` instead of default `127.0.0.1:8000` allows the mobile device/simulator to connect via LAN IP

**Terminal 2 — Celery Worker (optional for auth testing):**
```bash
source .venv/bin/activate
celery -A filaments worker -l info
```
> Note: Celery is only needed for processing filaments, not for the auth smoke test

### 4. Launch Mobile Dev Client

**Terminal 3 — Expo Dev Client:**
```bash
cd mobile
npx expo start --dev-client
```

Then install and launch the development build on your iOS Simulator or device.

## Smoke Test Checklist

### Test 1: Successful Sign-In (Allowlisted Account)
1. Launch the dev client app
2. Tap "Sign in with Google"
3. Select the Google account matching `ALLOWED_GOOGLE_EMAILS`
4. **Expected result:**
   - App receives `{ access, refresh }` tokens
   - Tokens stored in SecureStore
   - App routes to Timeline screen
5. **Verify in Django admin** (`http://127.0.0.1:8000/admin/`):
   - Exactly one `User` object created
   - Username matches the Google email

### Test 2: Rejected Sign-In (Non-Allowlisted Account)
1. Sign out from the app (if signed in)
2. Tap "Sign in with Google"
3. Select a Google account **NOT** in `ALLOWED_GOOGLE_EMAILS`
4. **Expected result:**
   - Backend returns `403 Forbidden`
   - App displays error message: "email not permitted"
   - No user created in database

### Test 3: Token Refresh
1. After successful sign-in, verify the app can refresh tokens
2. Make an authenticated API request (once core endpoints are built)
3. **Expected result:**
   - Access token refreshed automatically when expired
   - API requests succeed with valid JWT

## Troubleshooting

### Mobile can't reach backend
- ✅ Backend running on `0.0.0.0:8000` (not `127.0.0.1`)
- ✅ `EXPO_PUBLIC_API_URL` uses LAN IP (`192.168.1.83`), not `localhost`
- ✅ `ALLOWED_HOSTS` includes the LAN IP
- Check firewall: macOS Firewall might block incoming connections

### Google Sign-In doesn't work
- ✅ Using dev client build (not Expo Go)
- ✅ Client IDs match between backend and mobile `.env`
- ✅ `webClientId` in mobile app matches backend's `GOOGLE_WEB_CLIENT_ID`
- ✅ Bundle ID in `app.json` matches Google Console OAuth iOS client
- Check Google Cloud Console: account is listed under Test Users

### Backend rejects all tokens
- ✅ `GOOGLE_WEB_CLIENT_ID` matches the web client ID (audience verification)
- ✅ `ALLOWED_GOOGLE_EMAILS` contains the test account email
- Check backend logs for specific error messages

### Redis connection errors
- Docker Desktop must be running
- Run `docker compose ps` to verify redis container is up
- Check `REDIS_URL` matches the exposed port (6379)

## Current Network Configuration

**LAN IP:** `192.168.1.83` (determined via `ipconfig getifaddr en0`)

If your LAN IP changes (e.g., reconnect to WiFi):
1. Get new IP: `ipconfig getifaddr en0`
2. Update `mobile/.env`: `EXPO_PUBLIC_API_URL=http://<NEW_IP>:8000`
3. Update backend `.env`: `ALLOWED_HOSTS=localhost,127.0.0.1,<NEW_IP>`
4. Restart Expo dev server

## Next Phase

Once auth round-trips successfully:
- Build the first vertical slice: **Record → Upload → Process → Timeline**
- Follow the frontend planning document for implementation order
- Start with the Record screen (voice capture) and timeline display
