# Repository Guidelines

## Project Structure & Module Organization

```
gitdiscover/
├── apps/
│   ├── web/                    # Next.js 14 App Router (UI, SEO routes)
│   │   ├── app/                # App Router pages (sitemap.ts, etc.)
│   │   ├── components/         # React components
│   │   ├── lib/                # Utilities
│   │   └── styles/             # Global styles
│   │
│   └── api/                    # Fastify API server
│       ├── src/
│       │   ├── routes/         # API routes (/v1/*)
│       │   ├── services/       # Business logic
│       │   ├── repositories/   # Data access layer
│       │   └── utils/          # Helpers
│       └── prisma/             # Database schema & migrations
│
├── packages/
│   ├── shared/                 # Shared utilities (cursor encoding, scoring)
│   ├── ui/                     # Shared UI components
│   └── config/                 # Shared configurations
│
├── services/
│   └── collector/              # Data collection service (cron jobs)
│       ├── src/
│       │   ├── jobs/           # Daily trending ingest
│       │   ├── sources/        # GitHub API, GH Archive
│       │   └── processors/     # AI analysis, warm-cache
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml      # Local Postgres/Redis
│   ├── docker-compose.stack.yml # Full production stack
│   ├── Dockerfile.api          # API container
│   ├── Dockerfile.web          # Web container
│   └── Dockerfile.collector    # Collector container
│
├── docs/                       # Documentation source-of-truth
│   ├── ARCHITECTURE.md         # System design
│   ├── DATABASE.md             # Schema & query patterns
│   ├── API.md                  # REST API spec
│   ├── DEPLOY.md               # Deployment guide
│   └── RUNBOOK.md              # Operations runbook
│
├── scripts/                    # Utility scripts
│   └── deploy.sh               # Production deployment
│
└── package.json                # Monorepo root
```

## Build, Test, and Development Commands

Prerequisites: Node.js 20+, Docker (for Postgres/Redis)

### Initial Setup

```bash
# Install workspace deps
npm install

# Start local DB services
docker compose -f docker/docker-compose.yml up -d

# Generate Prisma client
npm run prisma:generate

# Run migrations (local development)
npm run prisma:migrate:dev

# Seed sample data
npm run db:seed
```

### Development

```bash
# API + Web concurrently
npm run dev                    # API :3001, Web :3002

# Individual services
npm run dev:api                # API only
npm run dev:web                # Web only
npm run dev:collector          # Collector scheduler

# Collector one-off jobs
npm run dev:collector -- daily
npm run dev:collector -- ai
npm run dev:collector -- warm-cache
```

### Build & Deploy

```bash
# Build all workspaces
npm run build

# Production deployment
./scripts/deploy.sh
```

### Database Operations

```bash
# Generate Prisma client
npm run prisma:generate

# Development migration
npm run prisma:migrate:dev

# Production migration (deploy only, no generation)
npm run prisma:migrate:deploy

# Open Prisma Studio
npm run prisma:studio
```

## Testing Guidelines

- **Test runner**: Vitest. Run with `npm test`.
- **Integration tests** require Postgres + Redis running (`docker compose ... up -d`).
- **Unit tests** should be placed next to the module under test (e.g., `packages/shared/src/scoring.test.ts`).
- **Watch mode**: `npm run test:watch`

## Coding Style & Naming Conventions

- **TypeScript**: `strict` + `exactOptionalPropertyTypes` enabled. Prefer `unknown` over `any`; validate boundaries with Zod.
- **Formatting**: Prettier is the source of truth (`npm run format:check` / `npm run format`).
- **Naming**:
  - `kebab-case` for routes/URLs
  - `camelCase` for variables/functions
  - `PascalCase` for React components
  - `UPPER_SNAKE_CASE` for constants

## Commit & Pull Request Guidelines

- Use **Conventional Commits**:
  - `feat(api): ...`
  - `feat(web): ...`
  - `fix(collector): ...`
  - `chore: ...`
  - `docs: ...`
- PRs: Include a short summary, linked issues, and screenshots for UI changes.

## Security & Configuration Best Practices

### Secrets Management

- **NEVER commit secrets**. Use `.env` (see `.env.example`) and keep tokens out of logs.
- Required environment variables:
  ```bash
  JWT_SECRET              # Min 32 characters
  DATABASE_URL            # PostgreSQL connection
  REDIS_URL               # Redis connection
  GITHUB_CLIENT_ID        # OAuth app
  GITHUB_CLIENT_SECRET    # OAuth app
  GITHUB_TOKEN            # API token for collector
  OPENAI_API_KEY          # AI analysis
  ```

### Security Checklist

- [ ] All secrets in `.env` (not committed)
- [ ] JWT_SECRET is cryptographically strong (≥32 chars)
- [ ] Database credentials use strong passwords in production
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Input validation with Zod on all endpoints

### Local Ports (Configurable)

| Service  | Default |
|----------|---------|
| API      | 3001    |
| Web      | 3002    |
| Postgres | 55433   |
| Redis    | 6380    |

## Production Deployment

See [docs/DEPLOY.md](./docs/DEPLOY.md) for full deployment instructions.

Quick reference:
```bash
# Production server: 107.174.42.198
# Deploy path: /opt/docker-projects/gitdiscover.org

ssh root@107.174.42.198
cd /opt/docker-projects/gitdiscover.org
./scripts/deploy.sh
```

## Operations

See [docs/RUNBOOK.md](./docs/RUNBOOK.md) for:
- Daily operations checklist
- Monitoring and alerts
- Backup and restore procedures
- Troubleshooting common issues
- Scaling procedures
