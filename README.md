# Filaments

A personal knowledge graph fed by voice and documents. Speak thoughts or upload files — AI transcribes, summarizes, tags, embeds, and auto-links every input into a searchable, interconnected archive.

## Tech Stack

- **Backend:** Django + Django REST Framework
- **Database:** PostgreSQL 17+ with pgvector 0.8.2+
- **Task Queue:** Celery + Redis
- **Auth:** Google Sign-In → JWT
- **AI:** Claude (Sonnet), OpenAI (Whisper, embeddings)
- **Mobile:** React Native + Expo

## Prerequisites

### Required
- **Python 3.10+** (3.14 recommended)
- **Postgres.app** with pgvector extension ([postgresapp.com](https://postgresapp.com))
- **Docker** (for Redis)

### Optional (for full development)
- **Node.js 18+** (for React Native frontend)
- **Expo CLI** (`npm install -g expo-cli`)

## Quick Start

### 1. Database Setup (One-Time)

```bash
# Create database and user
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -c "CREATE USER filaments_user WITH PASSWORD 'filaments_pass';"
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -c "CREATE DATABASE filaments_db OWNER filaments_user;"

# Enable pgvector extension
/Applications/Postgres.app/Contents/Versions/*/bin/psql -p 5432 -d filaments_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Backend Setup

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (optional for local dev)

# Start Redis
docker compose up -d

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser
```

### 3. Run Development Server

```bash
# Terminal 1: Django API
python manage.py runserver

# Terminal 2: Celery worker
celery -A filaments worker -l info

# Optional Terminal 3: Celery beat (for periodic tasks)
# celery -A filaments beat -l info
```

The API will be available at `http://localhost:8000`

## Project Structure

```
filaments/
├── filaments/          # Django project settings
│   ├── settings.py     # Main configuration
│   ├── urls.py         # URL routing
│   └── celery.py       # Celery configuration
├── core/               # Core domain logic
│   ├── models.py       # Filament, Chunk, Search models
│   └── migrations/     # Database migrations
├── accounts/           # Authentication
│   ├── views.py        # Google OAuth endpoints
│   └── urls.py         # Auth routes
├── requirements.txt    # Python dependencies
├── docker-compose.yml  # Redis configuration
├── .env.example        # Environment template
└── manage.py          # Django CLI
```

## API Endpoints

All routes under `/api/v1/`:

- `POST /auth/google` - Google OAuth login
- `POST /auth/token/refresh` - Refresh JWT
- `GET /me` - Current user info
- `GET /admin` - Django admin panel

## Development Notes

### Infrastructure
- **Postgres.app** runs natively on port 5432 (better performance than Docker)
- **Redis** runs in Docker on port 6379 with AOF persistence
- **Django + Celery** run on host for fast reload

### Database
- Database: `filaments_db`
- User: `filaments_user`
- pgvector extension: v0.8.2+ (for vector embeddings)

### Migration
If you previously had Docker Postgres setup, see [MIGRATION_LOG.md](MIGRATION_LOG.md) for migration details.

## Documentation

- [Backend Planning Doc](.claude/docs/backend-planning-doc.md) - Architecture, data model, API design
- [Frontend Planning Doc](.claude/docs/frontend-planning-doc.md) - Mobile app architecture
- [Scaffolding Guide](.claude/docs/scaffolding-guide.md) - Step-by-step setup instructions
- [PRD](.claude/context/PRD.md) - Product requirements

## Environment Variables

See `.env.example` for full list. Key variables:

```bash
# Required
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=postgres://filaments_user:filaments_pass@localhost:5432/filaments_db
CELERY_BROKER_URL=redis://localhost:6379/0

# Optional for local dev (required for production)
ANTHROPIC_API_KEY=       # Claude API
OPENAI_API_KEY=          # Whisper + embeddings
GOOGLE_CLIENT_ID=        # OAuth
AWS_ACCESS_KEY_ID=       # S3 storage
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
```

## Testing

```bash
# Run Django tests
python manage.py test

# Check for issues
python manage.py check

# Database shell
python manage.py dbshell
```

## Deployment

See [backend-planning-doc.md](.claude/docs/backend-planning-doc.md#prod-railway) for Railway deployment instructions.

## License

Private project - not open source.

## Author

Ross Williams
