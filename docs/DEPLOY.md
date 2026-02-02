# GitDiscover Deployment Guide

> Production deployment instructions for GitDiscover platform

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Docker Deployment](#docker-deployment)
- [Database Migration](#database-migration)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Verification Steps](#verification-steps)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Infrastructure Requirements

| Component | Specification |
|-----------|---------------|
| VPS | 2+ vCPU, 4GB+ RAM, 50GB+ SSD |
| OS | Ubuntu 22.04 LTS or Debian 12 |
| Docker | 24.0+ with Docker Compose v2 |
| Domain | gitdiscover.org (A record → VPS IP) |
| Optional | www.gitdiscover.org (CNAME → gitdiscover.org) |

### Required Accounts

- GitHub OAuth App (for authentication)
- GitHub Personal Access Token (for data collection)
- OpenAI API Key (for AI analysis)

### Network Requirements

- Ports 80, 443 open for web traffic
- Port 22 for SSH access
- Outbound HTTPS for API calls

## Environment Setup

### 1. Server Preparation

```bash
# SSH to production server
ssh root@107.174.42.198

# Update system
apt update && apt upgrade -y

# Install Docker (if not present)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Install Node.js 20 (for local builds)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install additional tools
apt install -y git make jq
```

### 2. Repository Clone

```bash
# Create deployment directory
mkdir -p /opt/docker-projects
cd /opt/docker-projects

# Clone repository
git clone https://github.com/your-org/gitdiscover.org.git
cd gitdiscover.org

# Create data directories
mkdir -p data/postgres data/redis
```

### 3. Environment Variables

Create `/opt/docker-projects/gitdiscover.org/.env`:

```bash
# =============================================================================
# GitDiscover Production Environment
# =============================================================================

# -----------------------------------------------------------------------------
# Web (Next.js)
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL="https://gitdiscover.org"
NEXT_PUBLIC_API_BASE_URL="https://api.gitdiscover.org/v1"

# -----------------------------------------------------------------------------
# API Server (Fastify)
# -----------------------------------------------------------------------------
HOST="0.0.0.0"
PORT="3001"
APP_URL="https://gitdiscover.org"
API_BASE_URL="http://api:3001"

# CRITICAL: Generate strong secret (openssl rand -base64 32)
JWT_SECRET="CHANGE_ME_TO_32_CHAR_RANDOM_STRING"

# -----------------------------------------------------------------------------
# Database (PostgreSQL via Docker)
# -----------------------------------------------------------------------------
# Format: postgresql://USER:PASSWORD@postgres:5432/DB_NAME
DATABASE_URL="postgresql://gitdiscover:STRONG_DB_PASSWORD@postgres:5432/gitdiscover"

# Database credentials for docker-compose
POSTGRES_USER="gitdiscover"
POSTGRES_PASSWORD="STRONG_DB_PASSWORD"
POSTGRES_DB="gitdiscover"

# -----------------------------------------------------------------------------
# Cache (Redis via Docker)
# -----------------------------------------------------------------------------
REDIS_URL="redis://redis:6379"

# -----------------------------------------------------------------------------
# GitHub OAuth (Create at https://github.com/settings/developers)
# -----------------------------------------------------------------------------
GITHUB_CLIENT_ID="your-oauth-app-client-id"
GITHUB_CLIENT_SECRET="your-oauth-app-client-secret"

# -----------------------------------------------------------------------------
# GitHub API Token (for collector service)
# Create at https://github.com/settings/tokens
# Required scopes: public_repo, read:user
# -----------------------------------------------------------------------------
GITHUB_TOKEN="ghp_your_personal_access_token"

# -----------------------------------------------------------------------------
# OpenAI API (for AI analysis)
# -----------------------------------------------------------------------------
OPENAI_API_KEY="sk-your-openai-api-key"

# -----------------------------------------------------------------------------
# Monitoring (optional)
# -----------------------------------------------------------------------------
SENTRY_DSN=""
LOG_LEVEL="info"
```

Generate secure secrets:

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 24 | tr -d '=+/' | cut -c1-20
```

### 4. File Permissions

```bash
# Secure environment file
chmod 600 /opt/docker-projects/gitdiscover.org/.env
chown root:root /opt/docker-projects/gitdiscover.org/.env

# Ensure data directories exist with correct permissions
mkdir -p data/postgres data/redis
chmod 755 data
```

## Docker Deployment

### 1. Network Setup

The deployment uses nginx-proxy for SSL termination. Ensure the proxy network exists:

```bash
# Check if nginx-proxy network exists
docker network ls | grep nginx-proxy_default

# If not, create it (or deploy nginx-proxy first)
docker network create nginx-proxy_default
```

### 2. Build Images

```bash
cd /opt/docker-projects/gitdiscover.org

# Build all service images
docker compose -f docker/docker-compose.stack.yml build

# Verify images built
docker images | grep gitdiscover
```

### 3. Start Services

```bash
# Start in background
docker compose -f docker/docker-compose.stack.yml up -d

# Check service status
docker compose -f docker/docker-compose.stack.yml ps

# View logs
docker compose -f docker/docker-compose.stack.yml logs -f
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Stack                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │     Web      │    │     API      │    │  Collector   │  │
│  │   (Next.js)  │◄──►│  (Fastify)   │◄──►│  (Cron Jobs) │  │
│  │    :3002     │    │    :3001     │    │    :3003     │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
│         │            ┌──────┴──────┐                       │
│         │            │             │                       │
│  ┌──────┴──────┐    ┌▼────────────┐▼┐                      │
│  │ nginx-proxy │    │   Redis     │ │                      │
│  │   (SSL)     │    │    :6379    │ │                      │
│  └─────────────┘    └─────────────┘ │                      │
│                                     │                      │
│                          ┌──────────▼┐                     │
│                          │ PostgreSQL│                     │
│                          │  :5432    │                     │
│                          └───────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Database Migration

### Initial Migration

```bash
# Ensure database is running
docker compose -f docker/docker-compose.stack.yml up -d postgres

# Wait for postgres to be ready
docker compose -f docker/docker-compose.stack.yml exec postgres \
  pg_isready -U gitdiscover -d gitdiscover

# Run migrations (using API container)
docker compose -f docker/docker-compose.stack.yml run --rm api \
  npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# Verify migration status
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -d gitdiscover -c "\dt"
```

### Migration Best Practices

1. **Always backup before migration**:
   ```bash
   docker compose -f docker/docker-compose.stack.yml exec postgres \
     pg_dump -U gitdiscover -Fc gitdiscover > backup_$(date +%Y%m%d).dump
   ```

2. **Test migrations in staging first**

3. **Zero-downtime migrations**:
   - Add new columns as nullable first
   - Deploy code changes
   - Backfill data
   - Add constraints in subsequent migration

### Schema Updates

```bash
# Generate new migration (development only)
npm run prisma:migrate:dev -- --name add_new_feature

# Deploy to production
docker compose -f docker/docker-compose.stack.yml run --rm api \
  npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# Regenerate client after schema changes
npm run prisma:generate
```

## SSL/TLS Configuration

### nginx-proxy Setup

The stack uses nginx-proxy with automatic Let's Encrypt certificates:

```bash
# Deploy nginx-proxy (if not already running)
cd /opt/docker-projects/nginx-proxy
docker compose up -d
```

### Domain Configuration

Ensure DNS records point to your VPS:

```
Type  Name              Value                TTL
A     gitdiscover.org   107.174.42.198       300
CNAME www               gitdiscover.org      300
A     api.gitdiscover   107.174.42.198       300
```

### Certificate Verification

```bash
# Check certificate status
docker logs nginx-proxy 2>&1 | grep -i certificate

# Test SSL connection
curl -I https://gitdiscover.org

# Verify certificate details
echo | openssl s_client -servername gitdiscover.org -connect gitdiscover.org:443 2>/dev/null | openssl x509 -noout -dates -subject
```

### Web Service Labels

The `docker-compose.stack.yml` includes Traefik labels for SSL:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.gitdiscover-web.rule=Host(`gitdiscover.org`) || Host(`www.gitdiscover.org`)"
  - "traefik.http.routers.gitdiscover-web.entrypoints=websecure"
  - "traefik.http.routers.gitdiscover-web.tls.certresolver=letsencrypt"
```

## Verification Steps

### 1. Health Checks

```bash
# API health check
curl https://api.gitdiscover.org/health

# Expected response:
# {"status":"healthy","checks":{"database":true,"redis":true}}

# Web health check
curl -I https://gitdiscover.org

# Expected: HTTP/2 200
```

### 2. Database Connectivity

```bash
# Test database connection from API container
docker compose -f docker/docker-compose.stack.yml exec api \
  node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.$connect().then(() => console.log('OK')).catch(console.error)"
```

### 3. End-to-End Tests

```bash
# Test trending repositories endpoint
curl https://api.gitdiscover.org/v1/repositories?limit=5

# Test repository search
curl https://api.gitdiscover.org/v1/repositories/search?q=react

# Test developer listing
curl https://api.gitdiscover.org/v1/developers?limit=5
```

### 4. Log Verification

```bash
# Check for errors
docker compose -f docker/docker-compose.stack.yml logs --tail=100 api | grep -i error
docker compose -f docker/docker-compose.stack.yml logs --tail=100 web | grep -i error

# Monitor real-time logs
docker compose -f docker/docker-compose.stack.yml logs -f
```

## Troubleshooting

### Container Won't Start

```bash
# Check container status
docker compose -f docker/docker-compose.stack.yml ps

# View specific service logs
docker compose -f docker/docker-compose.stack.yml logs api
docker compose -f docker/docker-compose.stack.yml logs postgres

# Check for port conflicts
ss -tlnp | grep -E '3001|3002|5432|6379'
```

### Database Connection Issues

```bash
# Verify postgres is running
docker compose -f docker/docker-compose.stack.yml exec postgres pg_isready

# Check database exists
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -l

# Test connection string
docker compose -f docker/docker-compose.stack.yml exec api \
  echo $DATABASE_URL
```

### Migration Failures

```bash
# Check migration status
docker compose -f docker/docker-compose.stack.yml run --rm api \
  npx prisma migrate status --schema apps/api/prisma/schema.prisma

# Reset migrations (CAUTION: destroys data)
docker compose -f docker/docker-compose.stack.yml run --rm api \
  npx prisma migrate reset --schema apps/api/prisma/schema.prisma

# Mark migration as applied (if already in DB)
docker compose -f docker/docker-compose.stack.yml run --rm api \
  npx prisma migrate resolve --applied MIGRATION_NAME
```

### SSL Certificate Issues

```bash
# Force certificate renewal
docker exec nginx-proxy /app/force_renew

# Check certificate expiration
echo | openssl s_client -connect gitdiscover.org:443 2>/dev/null | openssl x509 -noout -dates

# Verify domain resolution
dig +short gitdiscover.org
```

### Performance Issues

```bash
# Check resource usage
docker stats --no-stream

# Database performance
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Redis memory usage
docker compose -f docker/docker-compose.stack.yml exec redis \
  redis-cli info memory
```

## Rollback Procedure

If deployment fails:

```bash
cd /opt/docker-projects/gitdiscover.org

# Stop current services
docker compose -f docker/docker-compose.stack.yml down

# Restore previous version (if using git tags)
git checkout <previous-tag>

# Rebuild and start
docker compose -f docker/docker-compose.stack.yml up -d --build

# Restore database if needed
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_restore -U gitdiscover -d gitdiscover --clean < backup_YYYYMMDD.dump
```

## Maintenance Windows

### Regular Updates

```bash
# Update base images
docker compose -f docker/docker-compose.stack.yml pull
docker compose -f docker/docker-compose.stack.yml up -d

# Clean up old images
docker image prune -f

# Clean up volumes (CAUTION)
docker volume prune -f
```

### Backup Schedule

```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * cd /opt/docker-projects/gitdiscover.org && ./scripts/backup-db.sh

# Weekly full backup on Sundays
0 3 * * 0 cd /opt/docker-projects/gitdiscover.org && ./scripts/backup-full.sh
```

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-02
**Production Server**: 107.174.42.198
