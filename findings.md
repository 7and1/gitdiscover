# Findings & Decisions

## Requirements
- Follow `docs/ARCHITECTURE.md` for stack + directory structure (monorepo: `apps/web`, `apps/api`, `services/collector`, shared packages, `docker/`, `scripts/`).
- Implement REST API per `docs/API.md` (v1, consistent error format/codes, cursor pagination).
- Implement Prisma/PostgreSQL schema per `docs/DATABASE.md` (repositories, developers, users, snapshots, ai_analyses, bookmarks, comments, votes, sync logs).
- Implement caching strategy (Redis sessions/rate-limit + edge/KV hooks) and admin cache purge endpoint referenced in docs.
- Implement core product features from `docs/BLUEPRINT.md` + `docs/MVP-PLAN.md`: discovery (repos/devs), trends, community (bookmarks/comments/votes), AI insights (top repos daily), auth (GitHub OAuth), responsive UI, dark/light mode.
- Implement production-quality testing: unit + integration (+ minimal E2E smoke).

## Research Findings
- `docs/API.md` explicitly lists required routes:
  - `GET /repositories`, `GET /repositories/:fullName`, `GET /repositories/search`
  - `GET /developers`, `GET /developers/:login`
  - `GET /trends/languages`, `GET /trends/topics`, `GET /trends/growth`
  - `GET /bookmarks`, `POST /bookmarks`, `DELETE /bookmarks/:repositoryId`
  - `GET /repositories/:fullName/comments`, `POST /repositories/:fullName/comments`, `PUT /comments/:id`, `DELETE /comments/:id`
  - `POST /repositories/:fullName/vote`
  - `GET /user`
  - `GET /repositories/:fullName/analysis`
- `docs/DATABASE.md` provides a complete Prisma schema (incl. indexes and constraints) and should be treated as the source of truth for DB structure.
- `docs/API.md` defines the error response envelope and required error codes (e.g. `VALIDATION_ERROR`, `INVALID_CURSOR`, `RATE_LIMITED`) and also requires rate limit headers (`X-RateLimit-*`).
- Rate limiting tiers are explicitly documented: anonymous (100/min), authenticated (1000/min), premium (5000/min), implemented with Redis.
- Endpoint response shapes include:
  - Repository detail returns `analysis` (latest daily AI summary), `stats` (bookmarks/comments/voteScore), and `history` (stars/forks time series).
  - Developer detail returns `repositories` and `history` (followers/totalStars time series).
  - Comments list returns nested `replies` and supports `sort`, `limit`, `cursor`.
  - Voting returns `{ repositoryId, userVote, totalScore }` and must be idempotent per user+repo.
- `docs/ARCHITECTURE.md` specifies:
  - Security headers (HSTS, CSP, etc.) via Next.js middleware.
  - API response compression via `@fastify/compress`.
  - Cursor pagination helper pattern (take `limit+1`, return `cursor` + `hasMore`).
  - Observability basics: Pino structured logs, Prometheus metrics (`prom-client`), health check shape with DB/Redis/KV checks.
- `docs/BLUEPRINT.md` defines the core scoring formulas to implement:
  - Repo hotness score using `starsGrowth24h`, `forksGrowth24h`, plus a quality multiplier (README, LICENSE, recent commits, low issue ratio).
  - Developer impact score using followers (log10), active repos, total stars, and contributions.
- `docs/MVP-PLAN.md` data strategy constraints:
  - Daily collection at 02:00 UTC.
  - Top languages list for filtering (JS, Python, TS, Go, Rust, Java, C++, C#, PHP, Ruby).
  - AI analysis limited to top 10 repos/day with “why trending” style prompt.
- `docs/MVP-PLAN.md` deployment/ops expectations:
  - VPS runs collector + analyzer as systemd services; cron schedule: collector 02:00 UTC, analyzer 03:00 UTC, cache warming 04:00 UTC.
  - Health check endpoint is required (`/api/health` in MVP plan; `healthCheck()` shape in architecture doc).
- Success criteria includes performance targets (Lighthouse > 90, P95 page load <2s) and data targets (>=100 repos/day, >=30 devs/day, top-10 AI analyses daily).
- Some high-level conflicts exist:
  - `docs/ARCHITECTURE.md` targets Cloudflare Pages + separate VPS Fastify API, while `docs/MVP-PLAN.md` shows a Next.js-only app with API routes and NextAuth (Vercel). Implementation will follow `ARCHITECTURE.md` boundaries while preserving MVP feature requirements.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use npm workspaces + TypeScript strict mode | Matches docs’ npm examples; keeps monorepo manageable |
| Use Prisma + Postgres (Docker Compose) for dev | Matches `docs/DATABASE.md` and supports integration tests |
| Implement “growth” using stored snapshots | Avoids GHArchive dependency while producing required fields |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `docs/README.md` references docs not present in repo | Ignore missing docs; implement based on available specs and clearly document assumptions |

## Resources
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/BLUEPRINT.md`
- `docs/MVP-PLAN.md`

## Visual/Browser Findings
- (none)

---
*Update this file after every 2 view/browser/search operations*
