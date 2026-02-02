# GitDiscover Documentation

> GitHub Discovery Platform - Product Hunt for GitHub

## Quick Navigation

| Document | Description | Status |
|----------|-------------|--------|
| [BLUEPRINT.md](./BLUEPRINT.md) | Project vision, roadmap, KPIs | Core |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, tech stack, data flow | Core |
| [DATABASE.md](./DATABASE.md) | Prisma schema, indexes, migrations | Core |
| [API.md](./API.md) | RESTful endpoints, OpenAPI spec | Core |
| [COMPONENTS.md](./COMPONENTS.md) | React components, state management | Frontend |
| [ROUTING.md](./ROUTING.md) | Next.js routes, middleware, SEO | Frontend |
| [DATA-PIPELINE.md](./DATA-PIPELINE.md) | Data collection, processing, AI | Backend |
| [SEO-CONTENT.md](./SEO-CONTENT.md) | SEO strategy, content plan | Growth |
| [TESTING.md](./TESTING.md) | Test strategy, coverage goals | Quality |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, Cloudflare, CI/CD | DevOps |
| [ROADMAP.md](./ROADMAP.md) | Weekly tasks, milestones | Planning |
| [SECURITY.md](./SECURITY.md) | Auth, encryption, audit checklist | Security |

## Project Overview

```
GitDiscover
├── Discovery Engine     # Daily Top 50 repos, Top 30 developers
├── Trend Analytics      # Language trends, growth rankings
├── Community Features   # Bookmarks, comments, votes
└── AI Insights          # GPT-4o-mini deep analysis
```

## Tech Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Pages (SSR) │  │  KV Cache   │  │   Edge Functions    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ Cloudflare Tunnel
┌─────────────────────────▼───────────────────────────────────┐
│                    VPS Docker Stack                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  API Server │  │ PostgreSQL  │  │   Data Collector    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

1. **Understand the Vision**: Start with [BLUEPRINT.md](./BLUEPRINT.md)
2. **Review Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Setup Database**: Follow [DATABASE.md](./DATABASE.md)
4. **Implement APIs**: Reference [API.md](./API.md)
5. **Build Frontend**: Use [COMPONENTS.md](./COMPONENTS.md) and [ROUTING.md](./ROUTING.md)
6. **Deploy**: Follow [DEPLOYMENT.md](./DEPLOYMENT.md)

## Development Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Data Pipeline | Collector, DB, basic API |
| 2 | Frontend + CF | Pages, KV sync, UI |
| 3 | Community | Auth, bookmarks, comments |
| 4 | Polish + Launch | SEO, performance, monitoring |

## Key Metrics

- **Storage**: ~15GB (MVP)
- **Daily Processing**: ~1GB
- **Target Pool**: 100-200M active repos
- **Monthly Cost**: ~$15

## Document Conventions

- All code examples are production-ready
- Mermaid diagrams for architecture visualization
- TypeScript for all code samples
- Prisma for database schema

---

Last Updated: 2026-02-01
Version: 1.0.0
