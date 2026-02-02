# GitHub Discovery Platform - MVP Plan

## Executive Summary

**Project Name**: GitDiscover (GitHub 发现平台)
**Goal**: 每天更新热门 GitHub 项目，提供多维度发现 + 社区互动 + AI 深度分析
**Timeline**: 4 weeks to MVP launch
**Budget**: $85-155/month (VPS + API costs)

---

## 1. Product Scope Definition

### 1.1 Core Features (MVP MUST HAVE)

**Dimension 1: Repository Discovery**
- Daily trending repositories (top 50)
- Filter by language (top 10 languages)
- Sort by stars gained today/this week
- Basic repository card: name, description, stars, language, topics

**Dimension 2: Developer Discovery**
- Daily trending developers (top 30)
- Based on repository activity + star growth
- Developer card: avatar, name, bio, top repositories

**Dimension 3: Trending Analysis**
- Weekly trending topics (extracted from repository topics)
- Language popularity trends (simple chart)
- Star growth leaderboard

**Community Features**
- User can bookmark repositories
- Simple comment system (per repository)
- Upvote/downvote for repositories

**AI Analysis (Limited)**
- Daily AI summary for top 10 repositories
- Why it's trending (1-2 sentences)
- Key innovation points (bullet points)

### 1.2 NOT in MVP (Phase 2+)

- User profiles and social features
- Advanced search and filters
- Email notifications
- Mobile app
- Multi-language UI
- Advanced AI chat
- Historical trend analysis
- API for third parties

### 1.3 Success Metrics

**Week 1-2 (Soft Launch)**
- 100 daily active users
- 50+ bookmarks created
- 20+ comments posted

**Week 3-4 (Public Launch)**
- 500 daily active users
- 200+ bookmarks created
- 100+ comments posted
- 10+ returning users (3+ visits)

---

## 2. Technical Architecture

### 2.1 Tech Stack

**Frontend**
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **Deployment**: Vercel (free tier)

**Backend**
- **Framework**: Next.js API Routes (serverless)
- **Database**: PostgreSQL (on VPS)
- **ORM**: Prisma
- **Cache**: Redis (on VPS)
- **Job Queue**: BullMQ (on VPS)

**Data Collection (VPS)**
- **Scraper**: Node.js + Octokit (GitHub API)
- **Scheduler**: node-cron
- **AI**: OpenAI API (gpt-4o-mini for cost)

**Infrastructure**
- **VPS**: 192.168.2.8 (database + Redis + cron jobs)
- **Frontend**: Vercel
- **Domain**: Custom domain + SSL

### 2.2 System Architecture

```mermaid
graph TB
    subgraph "User Layer"
        A[Browser]
    end

    subgraph "Vercel - Frontend"
        B[Next.js App]
        C[API Routes]
    end

    subgraph "VPS 192.168.2.8"
        D[PostgreSQL]
        E[Redis Cache]
        F[Data Collector]
        G[AI Analyzer]
        H[BullMQ]
    end

    subgraph "External APIs"
        I[GitHub API]
        J[OpenAI API]
    end

    A -->|HTTPS| B
    B -->|API Call| C
    C -->|Query| D
    C -->|Cache| E
    F -->|Fetch Data| I
    F -->|Store| D
    G -->|Analyze| J
    G -->|Update| D
    H -->|Schedule| F
    H -->|Schedule| G
```

### 2.3 Data Flow

```mermaid
sequenceDiagram
    participant Cron
    participant Collector
    participant GitHub
    participant DB
    participant AI
    participant Cache
    participant User

    Note over Cron,AI: Daily Data Collection (02:00 UTC)
    Cron->>Collector: Trigger daily job
    Collector->>GitHub: Fetch trending repos
    GitHub-->>Collector: Repository data
    Collector->>DB: Store raw data
    Collector->>AI: Send top 10 repos
    AI->>OpenAI: Generate analysis
    AI->>DB: Store AI insights
    Collector->>Cache: Invalidate cache

    Note over User,Cache: User Access (Real-time)
    User->>Next.js: Request trending page
    Next.js->>Cache: Check cache
    alt Cache hit
        Cache-->>Next.js: Return cached data
    else Cache miss
        Next.js->>DB: Query data
        DB-->>Next.js: Return data
        Next.js->>Cache: Update cache
    end
    Next.js-->>User: Render page
```

---

## 3. Data Strategy

### 3.1 Data Sources

**Primary Source: GitHub API**
- Trending repositories: `GET /search/repositories` with date filters
- Developer data: `GET /users/{username}`
- Repository details: `GET /repos/{owner}/{repo}`
- Rate limit: 5,000 requests/hour (authenticated)

**Secondary Source: GitHub Trending Scraper**
- Fallback for trending data
- Parse https://github.com/trending
- Use only if API rate limit exceeded

### 3.2 Data Collection Strategy

**Daily Collection (02:00 UTC)**

1. **Trending Repositories** (30 min)
   - Fetch top 100 repos by stars gained today
   - Languages: JavaScript, Python, TypeScript, Go, Rust, Java, C++, C#, PHP, Ruby
   - Store: repo_id, name, owner, description, stars, forks, language, topics, created_at

2. **Trending Developers** (20 min)
   - Extract owners from trending repos
   - Fetch user details
   - Calculate score: (total_stars * 0.7) + (followers * 0.3)
   - Store top 50 developers

3. **AI Analysis** (40 min)
   - Top 10 repos only (cost control)
   - Prompt: "Why is {repo} trending? Key innovations?"
   - Store: ai_summary, ai_highlights (JSON array)

4. **Trend Aggregation** (10 min)
   - Extract topics from all repos
   - Count language distribution
   - Calculate weekly growth rates

**Total daily runtime**: ~100 minutes
**API calls**: ~500 requests (well under 5,000 limit)
**Cost**: ~$2-3/day for AI (gpt-4o-mini)

### 3.3 Database Schema

```sql
-- Core tables
CREATE TABLE repositories (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner VARCHAR(255) NOT NULL,
  description TEXT,
  stars INT DEFAULT 0,
  forks INT DEFAULT 0,
  language VARCHAR(50),
  topics JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  trending_date DATE,
  stars_gained_today INT,
  ai_summary TEXT,
  ai_highlights JSONB
);

CREATE TABLE developers (
  id BIGINT PRIMARY KEY,
  login VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  followers INT DEFAULT 0,
  public_repos INT DEFAULT 0,
  trending_score FLOAT,
  trending_date DATE,
  updated_at TIMESTAMP
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  repo_id BIGINT REFERENCES repositories(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  repo_id BIGINT REFERENCES repositories(id),
  content TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  repo_id BIGINT REFERENCES repositories(id),
  vote_type VARCHAR(10) CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

-- Indexes
CREATE INDEX idx_repos_trending ON repositories(trending_date DESC, stars_gained_today DESC);
CREATE INDEX idx_repos_language ON repositories(language, trending_date DESC);
CREATE INDEX idx_devs_trending ON developers(trending_date DESC, trending_score DESC);
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_comments_repo ON comments(repo_id, created_at DESC);
```

### 3.4 Caching Strategy

**Redis Cache Layers**

1. **Hot Data (TTL: 1 hour)**
   - `trending:repos:today` - Today's trending repos
   - `trending:devs:today` - Today's trending developers
   - `trending:topics:week` - Weekly trending topics

2. **User Data (TTL: 5 minutes)**
   - `user:{id}:bookmarks` - User's bookmarks
   - `repo:{id}:comments` - Repository comments

3. **Computed Data (TTL: 24 hours)**
   - `stats:languages` - Language distribution
   - `stats:growth` - Weekly growth stats

---

## 4. Development Plan

### Week 1: Foundation + Data Pipeline

**Day 1-2: Project Setup**
- Initialize Next.js project with TypeScript
- Setup Prisma + PostgreSQL connection to VPS
- Configure Tailwind CSS + shadcn/ui
- Setup Git repository

**Day 3-4: Data Collection**
- Build GitHub API client (Octokit)
- Implement trending repository collector
- Implement developer collector
- Test data collection locally (save to JSON first)

**Day 5-7: Database + Deployment**
- Deploy PostgreSQL on VPS
- Run Prisma migrations
- Deploy data collector to VPS
- Setup cron job (node-cron)
- Verify daily collection works

**Deliverables**:
- Working data pipeline
- Database with 7 days of data
- Automated daily collection

---

### Week 2: Core UI + Repository Discovery

**Day 8-9: Layout + Navigation**
- Build main layout (header, sidebar, footer)
- Implement navigation (Home, Repos, Developers, Trends)
- Add authentication UI (NextAuth.js with GitHub OAuth)

**Day 10-11: Repository Discovery**
- Build repository list page
- Implement filters (language, date range)
- Add sorting (stars, forks, trending score)
- Repository detail modal

**Day 12-14: Developer Discovery**
- Build developer list page
- Developer profile modal
- Link developers to their trending repos

**Deliverables**:
- Functional UI for browsing repos and developers
- Basic authentication
- Responsive design

---

### Week 3: Community Features + AI

**Day 15-16: Bookmarks**
- Implement bookmark functionality
- User bookmark page
- Bookmark sync with database

**Day 17-18: Comments**
- Build comment system
- Comment form + validation
- Display comments on repo detail

**Day 19-20: Voting + AI**
- Implement upvote/downvote
- Integrate OpenAI API
- Display AI summaries on top repos
- Setup AI analysis cron job

**Day 21: Polish**
- Loading states
- Error handling
- Empty states

**Deliverables**:
- Full community features
- AI-powered insights
- Production-ready UI

---

### Week 4: Trends + Launch Prep

**Day 22-23: Trending Analysis**
- Build trends dashboard
- Topic cloud visualization
- Language popularity chart
- Weekly growth leaderboard

**Day 24-25: Performance + SEO**
- Implement Redis caching
- Add meta tags for SEO
- Optimize images
- Lighthouse audit (score > 90)

**Day 26-27: Testing + Bug Fixes**
- End-to-end testing
- Fix critical bugs
- Cross-browser testing

**Day 28: Launch**
- Deploy to production
- Setup monitoring (Sentry)
- Soft launch to small community
- Gather initial feedback

**Deliverables**:
- Production-ready MVP
- Monitoring and logging
- Launch announcement

---

## 5. Deployment Architecture

### 5.1 VPS Setup (192.168.2.8)

**Services on VPS**:
```
/opt/gitdiscover/
├── collector/          # Data collection service
│   ├── src/
│   ├── package.json
│   └── .env
├── analyzer/           # AI analysis service
│   ├── src/
│   ├── package.json
│   └── .env
└── scripts/
    └── deploy.sh

/etc/systemd/system/
├── gitdiscover-collector.service
└── gitdiscover-analyzer.service

PostgreSQL: port 5432 (internal only)
Redis: port 6379 (internal only)
```

**Systemd Services**:

```ini
# /etc/systemd/system/gitdiscover-collector.service
[Unit]
Description=GitDiscover Data Collector
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=gitdiscover
WorkingDirectory=/opt/gitdiscover/collector
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Cron Schedule**:
```bash
# Daily collection at 02:00 UTC
0 2 * * * /usr/bin/node /opt/gitdiscover/collector/dist/daily-job.js

# AI analysis at 03:00 UTC (after collection)
0 3 * * * /usr/bin/node /opt/gitdiscover/analyzer/dist/analyze-job.js

# Cache warming at 04:00 UTC
0 4 * * * /usr/bin/node /opt/gitdiscover/collector/dist/warm-cache.js
```

### 5.2 Frontend Deployment (Vercel)

**Environment Variables**:
```env
DATABASE_URL=postgresql://user:pass@192.168.2.8:5432/gitdiscover
REDIS_URL=redis://192.168.2.8:6379
NEXTAUTH_URL=https://gitdiscover.com
NEXTAUTH_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

**Vercel Configuration**:
```json
{
  "buildCommand": "prisma generate && next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["sfo1"]
}
```

### 5.3 Monitoring

**Logs**:
- Application logs: `/var/log/gitdiscover/`
- PostgreSQL logs: `/var/log/postgresql/`
- Nginx logs: `/var/log/nginx/`

**Monitoring Tools**:
- Sentry (error tracking)
- Vercel Analytics (frontend performance)
- Custom health check endpoint: `/api/health`

**Alerts**:
- Data collection failure (email alert)
- Database connection issues
- API rate limit warnings

---

## 6. Risk Management

### 6.1 Technical Risks

**Risk 1: GitHub API Rate Limit**
- **Impact**: High - Cannot collect data
- **Probability**: Medium
- **Mitigation**:
  - Use authenticated requests (5,000/hour)
  - Implement exponential backoff
  - Fallback to scraping GitHub Trending page
  - Monitor rate limit headers

**Risk 2: VPS Downtime**
- **Impact**: High - Data collection stops
- **Probability**: Low
- **Mitigation**:
  - Setup systemd auto-restart
  - Daily health check script
  - Backup data collection to cloud function (fallback)

**Risk 3: Database Growth**
- **Impact**: Medium - Storage costs increase
- **Probability**: High
- **Mitigation**:
  - Archive old data (>90 days) to cold storage
  - Implement data retention policy
  - Monitor disk usage alerts

### 6.2 Data Risks

**Risk 1: AI Analysis Cost Overrun**
- **Impact**: Medium - Budget exceeded
- **Probability**: Medium
- **Mitigation**:
  - Limit to top 10 repos/day
  - Use gpt-4o-mini (cheaper)
  - Set monthly budget cap in OpenAI
  - Cache AI results aggressively

**Risk 2: Data Quality Issues**
- **Impact**: Medium - Poor user experience
- **Probability**: Medium
- **Mitigation**:
  - Validate data before storing
  - Implement data quality checks
  - Manual review of top 10 daily

**Risk 3: Stale Data**
- **Impact**: Low - Users see outdated info
- **Probability**: Low
- **Mitigation**:
  - Show "last updated" timestamp
  - Implement cache invalidation
  - Alert if collection fails

### 6.3 Product Risks

**Risk 1: Low User Engagement**
- **Impact**: High - Product fails
- **Probability**: Medium
- **Mitigation**:
  - Launch with small community first
  - Gather feedback early
  - Iterate quickly on features
  - Add social sharing features

**Risk 2: Competition**
- **Impact**: Medium - Similar products exist
- **Probability**: High
- **Mitigation**:
  - Focus on unique value (AI + community)
  - Build for niche audience first
  - Emphasize developer discovery
  - Fast iteration cycle

**Risk 3: Content Moderation**
- **Impact**: Medium - Spam/abuse in comments
- **Probability**: Medium
- **Mitigation**:
  - Require GitHub auth to comment
  - Implement rate limiting
  - Add report/flag feature
  - Manual moderation initially

---

## 7. Cost Breakdown

### 7.1 Infrastructure

**VPS (192.168.2.8)**
- Assumed existing/shared: $0
- Or dedicated: $40-80/month

**Vercel**
- Free tier (hobby): $0
- Pro (if needed): $20/month

**Domain + SSL**
- Domain: $12/year
- SSL: Free (Let's Encrypt)

### 7.2 APIs

**GitHub API**
- Free (5,000 requests/hour)

**OpenAI API**
- gpt-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
- Daily usage: ~10 repos * 2,000 tokens = 20K tokens
- Monthly cost: ~$5-10

**Total Monthly Cost**: $45-110 (excluding VPS if shared)

---

## 8. Success Criteria

### 8.1 Technical Success

- [ ] Data collection runs daily without failures
- [ ] Page load time < 2 seconds
- [ ] Lighthouse score > 90
- [ ] Zero critical bugs in production
- [ ] 99% uptime

### 8.2 Product Success

**Week 1-2**:
- [ ] 100+ daily active users
- [ ] 50+ bookmarks created
- [ ] 20+ comments posted

**Week 3-4**:
- [ ] 500+ daily active users
- [ ] 200+ bookmarks created
- [ ] 100+ comments posted
- [ ] 10+ returning users (3+ visits)

### 8.3 Data Success

- [ ] 100+ repositories tracked daily
- [ ] 30+ developers tracked daily
- [ ] AI analysis for top 10 repos daily
- [ ] 10+ trending topics identified weekly

---

## 9. Post-MVP Roadmap

### Phase 2 (Month 2-3)

**Features**:
- Email notifications (daily digest)
- Advanced search and filters
- User profiles and following
- Repository collections (curated lists)
- Mobile-responsive improvements

**Data**:
- Historical trend analysis
- Repository comparison tool
- Developer activity timeline

### Phase 3 (Month 4-6)

**Features**:
- Multi-language UI (Chinese, English)
- Mobile app (React Native)
- API for third parties
- Premium features (advanced analytics)

**Data**:
- Expand to 500+ repos/day
- Add more languages
- Sentiment analysis on comments

---

## 10. Quick Start Guide

### For Development (Mac)

```bash
# Clone and setup
git clone <repo>
cd github-trending
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with VPS database URL

# Generate Prisma client
npx prisma generate

# Run development (frontend only)
npm run dev

# Note: Data collection runs on VPS, not locally
```

### For Deployment (VPS)

```bash
# SSH to VPS
ssh user@192.168.2.8

# Deploy collector
cd /opt/gitdiscover/collector
git pull
npm install
npm run build
sudo systemctl restart gitdiscover-collector

# Deploy analyzer
cd /opt/gitdiscover/analyzer
git pull
npm install
npm run build
sudo systemctl restart gitdiscover-analyzer

# Check status
sudo systemctl status gitdiscover-collector
sudo systemctl status gitdiscover-analyzer
```

---

## Appendix A: Key Files Structure

```
github-trending/
├── app/                          # Next.js app directory
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/
│   │   ├── page.tsx             # Home page
│   │   ├── repositories/
│   │   │   ├── page.tsx         # Repository list
│   │   │   └── [id]/page.tsx   # Repository detail
│   │   ├── developers/
│   │   │   ├── page.tsx         # Developer list
│   │   │   └── [login]/page.tsx # Developer profile
│   │   ├── trends/
│   │   │   └── page.tsx         # Trends dashboard
│   │   └── bookmarks/
│   │       └── page.tsx         # User bookmarks
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── repositories/route.ts
│   │   ├── developers/route.ts
│   │   ├── bookmarks/route.ts
│   │   ├── comments/route.ts
│   │   └── votes/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── repository-card.tsx
│   ├── developer-card.tsx
│   ├── comment-list.tsx
│   └── trend-chart.tsx
├── lib/
│   ├── prisma.ts               # Prisma client
│   ├── redis.ts                # Redis client
│   ├── github.ts               # GitHub API client
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── collector/                   # VPS service
│   ├── src/
│   │   ├── index.ts
│   │   ├── daily-job.ts
│   │   ├── collectors/
│   │   │   ├── repositories.ts
│   │   │   └── developers.ts
│   │   └── utils/
│   └── package.json
├── analyzer/                    # VPS service
│   ├── src/
│   │   ├── index.ts
│   │   ├── analyze-job.ts
│   │   └── openai.ts
│   └── package.json
└── package.json
```

---

## Appendix B: Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@192.168.2.8:5432/gitdiscover"

# Redis
REDIS_URL="redis://192.168.2.8:6379"

# NextAuth
NEXTAUTH_URL="https://gitdiscover.com"
NEXTAUTH_SECRET="your-secret-key"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# GitHub API (for data collection)
GITHUB_TOKEN="your-personal-access-token"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
```

---

## Summary

This MVP plan provides a **pragmatic, executable roadmap** to launch GitDiscover in 4 weeks:

1. **Week 1**: Build data pipeline and collect initial data
2. **Week 2**: Build core UI for repository and developer discovery
3. **Week 3**: Add community features and AI analysis
4. **Week 4**: Add trends dashboard and launch

**Key Principles**:
- Start small, iterate fast
- Validate core value first (discovery + AI)
- Leverage existing infrastructure (VPS)
- Keep costs low (<$100/month)
- Focus on data quality over quantity

**Next Steps**:
1. Review and approve this plan
2. Setup project repository
3. Configure VPS database
4. Start Week 1 development

Ready to build?
