# GitDiscover

> GitHub discovery platform - Product Hunt for GitHub. Daily trending repositories, developer rankings, community curation, and AI-powered insights.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.6-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/gitdiscover.org.git
cd gitdiscover.org

# Install dependencies
npm install

# Start database services (Postgres + Redis)
docker compose -f docker/docker-compose.yml up -d

# Setup database
npm run prisma:generate
npm run prisma:migrate:dev

# Start development servers
npm run dev
```

Services will be available at:
- Web: http://localhost:3002
- API: http://localhost:3001
- Database: localhost:55433 (Postgres)
- Cache: localhost:6380 (Redis)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitDiscover Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │  Next.js Web │◄────►│  Fastify API │◄────►│  PostgreSQL  │  │
│  │   (App)      │      │   (REST)     │      │   (Primary)  │  │
│  └──────────────┘      └──────┬───────┘      └──────────────┘  │
│                               │                                 │
│                        ┌──────┴──────┐                         │
│                        │             │                         │
│  ┌──────────────┐     ┌▼───────────┐▼┐      ┌──────────────┐   │
│  │   Redis      │◄───►│  Collector │ │      │     AI       │   │
│  │  (Cache)     │     │  (Cron)    │ │◄────►│  (OpenAI)    │   │
│  └──────────────┘     └────────────┘ │      └──────────────┘   │
│                                      │                          │
│                               ┌──────┴──────┐                  │
│                               │  GitHub API │                  │
│                               └─────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 + Tailwind CSS | SSR web application |
| API | Fastify + Prisma | High-performance REST API |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | Sessions, rate limiting |
| AI | OpenAI GPT-4 | Repository analysis |
| Data | GitHub API + GH Archive | Trending repositories |

## Project Structure

```
gitdiscover/
├── apps/
│   ├── web/                    # Next.js 14 frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   └── lib/                # Utilities
│   │
│   └── api/                    # Fastify API server
│       ├── src/
│       │   ├── routes/         # API endpoints
│       │   ├── services/       # Business logic
│       │   └── repositories/   # Data access
│       └── prisma/             # Database schema
│
├── packages/
│   ├── shared/                 # Shared utilities
│   ├── ui/                     # Shared UI components
│   └── config/                 # Shared configurations
│
├── services/
│   └── collector/              # Data collection service
│       ├── src/jobs/           # Daily trending ingest
│       └── src/processors/     # AI analysis
│
├── docker/
│   ├── docker-compose.yml      # Local development
│   ├── docker-compose.stack.yml # Production
│   └── Dockerfile.*            # Service images
│
├── docs/
│   ├── ARCHITECTURE.md         # System design
│   ├── DATABASE.md             # Schema documentation
│   ├── API.md                  # API specification
│   ├── DEPLOY.md               # Deployment guide
│   └── RUNBOOK.md              # Operations guide
│
└── scripts/
    └── deploy.sh               # Production deployment
```

## Development Setup

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required for local development
DATABASE_URL="postgresql://gitdiscover:gitdiscover@localhost:55433/gitdiscover"
REDIS_URL="redis://localhost:6380"
JWT_SECRET="dev-secret-min-32-chars-long"

# Optional (for full features)
GITHUB_CLIENT_ID=""           # GitHub OAuth
GITHUB_CLIENT_SECRET=""       # GitHub OAuth
GITHUB_TOKEN=""               # API access
OPENAI_API_KEY=""             # AI analysis
```

### Available Commands

```bash
# Development
npm run dev              # Start API + Web concurrently
npm run dev:api          # API only
npm run dev:web          # Web only
npm run dev:collector    # Collector service

# Database
npm run prisma:generate       # Generate Prisma client
npm run prisma:migrate:dev    # Create/apply migrations
npm run prisma:migrate:deploy # Apply migrations (production)
npm run prisma:studio         # Open Prisma Studio
npm run db:seed               # Seed sample data

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run format:check     # Check formatting

# Build
npm run build            # Build all packages
```

### Running Tests

```bash
# Unit tests
npm test

# With coverage
npm test -- --coverage

# Specific workspace
npm test -w @gitdiscover/shared
```

## Deployment

### Production Server

- **IP**: 107.174.42.198
- **Path**: `/opt/docker-projects/gitdiscover.org`
- **Domain**: https://gitdiscover.org

### Quick Deploy

```bash
# SSH to production server
ssh root@107.174.42.198
cd /opt/docker-projects/gitdiscover.org

# Deploy with automated script
./scripts/deploy.sh
```

### Manual Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Build images
docker compose -f docker/docker-compose.stack.yml build

# 3. Run migrations
docker compose -f docker/docker-compose.stack.yml run --rm api \
  npx prisma migrate deploy

# 4. Deploy
docker compose -f docker/docker-compose.stack.yml up -d

# 5. Verify
curl https://api.gitdiscover.org/health
```

See [docs/DEPLOY.md](docs/DEPLOY.md) for complete deployment instructions.

## API Documentation

### Base URL

```
Production: https://api.gitdiscover.org/v1
Local:      http://localhost:3001/v1
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/repositories` | GET | List trending repositories |
| `/repositories/:fullName` | GET | Get repository details |
| `/repositories/search` | GET | Search repositories |
| `/developers` | GET | List top developers |
| `/developers/:login` | GET | Get developer profile |
| `/trends/languages` | GET | Language trends |
| `/bookmarks` | GET/POST | User bookmarks |
| `/auth/github` | GET | GitHub OAuth |

### Example Usage

```bash
# Get trending repositories
curl https://api.gitdiscover.org/v1/repositories?language=TypeScript&limit=10

# Search repositories
curl "https://api.gitdiscover.org/v1/repositories/search?q=react+framework"

# Get repository details
curl https://api.gitdiscover.org/v1/repositories/vercel/next.js
```

See [docs/API.md](docs/API.md) for complete API specification.

## Database Schema

### Core Entities

- **Repository** - GitHub repositories with metrics
- **Developer** - GitHub users with impact scores
- **User** - Application users (authenticated)
- **RepositorySnapshot** - Daily metrics history
- **AiAnalysis** - AI-generated repository insights
- **Bookmark/Comment/Vote** - Community features

See [docs/DATABASE.md](docs/DATABASE.md) for complete schema documentation.

## Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit with conventional commits: `feat(api): add amazing feature`
6. Push and create a Pull Request

### Commit Convention

```
feat(api): new feature
feat(web): new feature
fix(api): bug fix
fix(collector): bug fix
docs: documentation changes
chore: maintenance tasks
refactor: code refactoring
test: adding tests
```

### Code Style

- TypeScript with strict mode enabled
- Prettier for formatting
- ESLint for linting
- Conventional commit messages

### Pull Request Guidelines

- Include a clear description of changes
- Link related issues
- Add screenshots for UI changes
- Ensure all tests pass
- Request review from maintainers

## Operations

### Daily Checks

```bash
# Service health
docker compose -f docker/docker-compose.stack.yml ps
curl https://api.gitdiscover.org/health

# Resource usage
df -h && free -h

# Recent errors
docker compose -f docker/docker-compose.stack.yml logs --since=1h | grep -i error
```

### Backup

```bash
# Automated daily backup
0 2 * * * /opt/docker-projects/gitdiscover.org/scripts/backup-db.sh

# Manual backup
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_dump -U gitdiscover -Fc gitdiscover > backup_$(date +%Y%m%d).dump
```

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for complete operations guide.

## Security

### Reporting Vulnerabilities

Please report security vulnerabilities to [security@gitdiscover.org](mailto:security@gitdiscover.org).

### Security Best Practices

- Never commit secrets to repository
- Use strong JWT secrets (32+ characters)
- Keep dependencies updated
- Enable rate limiting in production
- Use HTTPS only in production
- Regular security audits

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-org/gitdiscover.org/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/gitdiscover.org/discussions)

---

**Built with** TypeScript, Next.js, Fastify, PostgreSQL, and OpenAI.
