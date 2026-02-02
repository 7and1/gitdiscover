# GitDiscover Operations Runbook

> Day-to-day operations, monitoring, and incident response for GitDiscover

## Table of Contents

- [Daily Operations Checklist](#daily-operations-checklist)
- [Monitoring and Alerts](#monitoring-and-alerts)
- [Backup and Restore Procedures](#backup-and-restore-procedures)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Scaling Procedures](#scaling-procedures)
- [Incident Response](#incident-response)

## Daily Operations Checklist

### Morning Checks (09:00 UTC)

```bash
# 1. Check service status
ssh root@107.174.42.198
cd /opt/docker-projects/gitdiscover.org
docker compose -f docker/docker-compose.stack.yml ps

# 2. Verify all services healthy
curl -s https://api.gitdiscover.org/health | jq

# 3. Check disk space
df -h | grep -E 'Filesystem|/dev/'

# 4. Check memory usage
free -h

# 5. Review error logs (last hour)
docker compose -f docker/docker-compose.stack.yml logs --since=1h api | grep -i error
docker compose -f docker/docker-compose.stack.yml logs --since=1h collector | grep -i error

# 6. Check data collector ran
docker compose -f docker/docker-compose.stack.yml logs --since=24h collector | grep -i "daily job completed"

# 7. Verify database connectivity
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "SELECT COUNT(*) FROM repositories;"
```

### Evening Checks (21:00 UTC)

```bash
# 1. Review daily metrics
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT
      (SELECT COUNT(*) FROM repositories) as total_repos,
      (SELECT COUNT(*) FROM developers) as total_devs,
      (SELECT COUNT(*) FROM repository_snapshots WHERE snapshot_date = CURRENT_DATE) as today_snapshots;
  "

# 2. Check SSL certificate expiration (alert if < 7 days)
echo | openssl s_client -connect gitdiscover.org:443 2>/dev/null | \
  openssl x509 -noout -dates | grep notAfter

# 3. Verify backup from previous night
ls -la /backups/postgres/*.dump.gz | tail -5
```

### Weekly Tasks (Monday)

```bash
# 1. Update system packages
apt update && apt upgrade -y

# 2. Update Docker images
docker compose -f docker/docker-compose.stack.yml pull
docker compose -f docker/docker-compose.stack.yml up -d

# 3. Clean up unused Docker resources
docker system prune -f --volumes

# 4. Review and rotate logs
find /var/log -name "*.log" -size +100M -exec gzip {} \;

# 5. Database maintenance
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "VACUUM ANALYZE;"
```

## Monitoring and Alerts

### Key Metrics

| Metric | Warning | Critical | Check Command |
|--------|---------|----------|---------------|
| API Response Time | > 500ms | > 1000ms | `curl -w "%{time_total}" -s -o /dev/null https://api.gitdiscover.org/health` |
| Database Connections | > 80 | > 95 | `docker exec gitdiscover-postgres psql -U gitdiscover -c "SELECT count(*) FROM pg_stat_activity;"` |
| Disk Usage | > 70% | > 85% | `df -h /` |
| Memory Usage | > 70% | > 85% | `free | grep Mem | awk '{print ($3/$2) * 100.0}'` |
| Redis Memory | > 512MB | > 1GB | `docker exec gitdiscover-redis redis-cli info memory | grep used_memory_human` |

### Health Check Endpoints

```bash
# API health
curl https://api.gitdiscover.org/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": true,
    "redis": true
  },
  "latency": {
    "database": 5,
    "redis": 2
  },
  "uptime": 86400,
  "version": "1.0.0"
}

# Collector health
curl http://localhost:3003/health
```

### Log Monitoring

```bash
# Real-time error monitoring
docker compose -f docker/docker-compose.stack.yml logs -f api | grep -i error

# Search for specific patterns
docker compose -f docker/docker-compose.stack.yml logs api | grep -i "rate limit"
docker compose -f docker/docker-compose.stack.yml logs collector | grep -i "github api"

# Export logs for analysis
docker compose -f docker/docker-compose.stack.yml logs --since=24h api > /tmp/api_logs_$(date +%Y%m%d).txt
```

### Alerting Rules (Prometheus/Grafana)

```yaml
# Example alert rules
groups:
  - name: gitdiscover
    rules:
      - alert: APIHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on API"

      - alert: DatabaseHighConnections
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection count high"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space below 15%"

      - alert: CollectorJobFailed
        expr: time() - gitdiscover_last_successful_collection > 90000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Data collector hasn't run in 25 hours"
```

## Backup and Restore Procedures

### Automated Backup Script

Create `/opt/docker-projects/gitdiscover.org/scripts/backup-db.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/gitdiscover_$DATE.dump"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "Starting database backup..."
docker compose -f /opt/docker-projects/gitdiscover.org/docker/docker-compose.stack.yml exec -T postgres \
  pg_dump -U gitdiscover -Fc --no-owner --no-acl gitdiscover > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to remote storage (Backblaze B2)
if command -v rclone &> /dev/null; then
    echo "Uploading to remote storage..."
    rclone copy "$BACKUP_FILE.gz" b2:gitdiscover-backups/postgres/
fi

# Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.dump.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Make executable:
```bash
chmod +x /opt/docker-projects/gitdiscover.org/scripts/backup-db.sh
```

### Manual Backup

```bash
# Full database backup
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_dump -U gitdiscover -Fc gitdiscover > gitdiscover_$(date +%Y%m%d).dump

# Schema-only backup
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_dump -U gitdiscover -s gitdiscover > schema_$(date +%Y%m%d).sql

# Specific table backup
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_dump -U gitdiscover -t repositories gitdiscover > repos_$(date +%Y%m%d).dump
```

### Restore Procedures

#### Full Database Restore

```bash
# 1. Stop API and collector services
docker compose -f docker/docker-compose.stack.yml stop api collector

# 2. Backup current state (just in case)
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_dump -U gitdiscover -Fc gitdiscover > emergency_backup_$(date +%Y%m%d_%H%M%S).dump

# 3. Drop and recreate database
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "DROP DATABASE gitdiscover;"
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "CREATE DATABASE gitdiscover;"

# 4. Restore from backup
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_restore -U gitdiscover -d gitdiscover --clean --if-exists < gitdiscover_YYYYMMDD.dump

# 5. Verify restore
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "SELECT COUNT(*) FROM repositories;"

# 6. Restart services
docker compose -f docker/docker-compose.stack.yml start api collector

# 7. Clear caches
curl -X POST https://api.gitdiscover.org/admin/cache/purge \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Point-in-Time Recovery

```bash
# If WAL archiving is enabled
# Restore base backup first, then apply WAL files

# 1. Stop services
docker compose -f docker/docker-compose.stack.yml stop api collector

# 2. Restore base backup
docker compose -f docker/docker-compose.stack.yml exec -T postgres \
  pg_restore -U gitdiscover -d gitdiscover < base_backup.dump

# 3. Apply WAL files up to specific time
# (Requires PostgreSQL configured with archive_mode = on)
```

### Redis Backup/Restore

```bash
# Backup Redis
docker compose -f docker/docker-compose.stack.yml exec redis \
  redis-cli SAVE
docker cp gitdiscover-redis:/data/dump.rdb /backups/redis/dump_$(date +%Y%m%d).rdb

# Restore Redis
docker compose -f docker/docker-compose.stack.yml stop redis
docker cp /backups/redis/dump_YYYYMMDD.rdb gitdiscover-redis:/data/dump.rdb
docker compose -f docker/docker-compose.stack.yml start redis
```

## Troubleshooting Common Issues

### API Service Issues

#### High Response Times

```bash
# Check database query performance
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT query, mean_exec_time, calls
    FROM pg_stat_statements
    ORDER BY mean_exec_time DESC
    LIMIT 10;
  "

# Check for slow queries in real-time
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT pid, query_start, query
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query_start < NOW() - INTERVAL '5 seconds';
  "

# Restart API service
docker compose -f docker/docker-compose.stack.yml restart api
```

#### Memory Leaks

```bash
# Monitor API memory usage
watch -n 5 'docker stats gitdiscover-api --no-stream'

# If memory keeps growing, restart service
docker compose -f docker/docker-compose.stack.yml restart api

# Check for memory leaks in logs
docker compose -f docker/docker-compose.stack.yml logs api | grep -i "heap"
```

### Database Issues

#### Connection Pool Exhausted

```bash
# Check active connections
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT state, count(*)
    FROM pg_stat_activity
    GROUP BY state;
  "

# Kill idle connections if necessary
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state = 'idle'
    AND state_change < NOW() - INTERVAL '1 hour';
  "

# Restart services to reset pools
docker compose -f docker/docker-compose.stack.yml restart api
```

#### Disk Space Issues

```bash
# Check database size
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT pg_size_pretty(pg_database_size('gitdiscover'));
  "

# Check table sizes
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT schemaname, tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  "

# Clean old snapshots (keep 90 days)
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    DELETE FROM repository_snapshots
    WHERE snapshot_date < NOW() - INTERVAL '90 days';
  "

# Vacuum to reclaim space
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "VACUUM FULL;"
```

### Collector Issues

#### GitHub API Rate Limits

```bash
# Check rate limit status
docker compose -f docker/docker-compose.stack.yml logs collector | grep -i "rate limit"

# Verify GitHub token is valid
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# If rate limited, check token usage and consider:
# 1. Using multiple tokens
# 2. Reducing collection frequency
# 3. Optimizing API calls
```

#### Collector Job Failures

```bash
# Check collector logs
docker compose -f docker/docker-compose.stack.yml logs --tail=200 collector

# Run collector manually for debugging
docker compose -f docker/docker-compose.stack.yml run --rm collector \
  node dist/index.js daily

# Check for data consistency
docker compose -f docker/docker-compose.stack.yml exec postgres \
  psql -U gitdiscover -c "
    SELECT DATE(created_at) as date, COUNT(*) as repos
    FROM repositories
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 7;
  "
```

### SSL/Certificate Issues

```bash
# Check certificate expiration
echo | openssl s_client -connect gitdiscover.org:443 2>/dev/null | \
  openssl x509 -noout -dates

# Force certificate renewal
docker exec nginx-proxy /app/force_renew

# Check nginx-proxy logs
docker logs nginx-proxy 2>&1 | grep -i error
```

## Scaling Procedures

### Vertical Scaling (More Resources)

```bash
# 1. Stop services
docker compose -f docker/docker-compose.stack.yml down

# 2. Resize VPS (via provider dashboard)
# Example: 2 vCPU → 4 vCPU, 4GB → 8GB RAM

# 3. Update PostgreSQL configuration for new resources
# Edit docker/docker-compose.stack.yml:
#   postgres:
#     command: >
#       postgres
#       -c shared_buffers=2GB
#       -c effective_cache_size=6GB
#       -c maintenance_work_mem=512MB

# 4. Restart services
docker compose -f docker/docker-compose.stack.yml up -d
```

### Horizontal Scaling (Multiple Instances)

For high availability, split services across multiple VPS:

```yaml
# docker-compose.api.yml - API tier
services:
  api:
    deploy:
      replicas: 2
    environment:
      DATABASE_URL: postgresql://gitdiscover:pass@db-primary:5432/gitdiscover
      REDIS_URL: redis://redis-shared:6379

# docker-compose.db.yml - Database tier
services:
  postgres-primary:
    image: postgres:16
    # Primary database

  postgres-replica:
    image: postgres:16
    # Read replica for scaling reads
```

### Database Read Replicas

```bash
# 1. Set up streaming replication on secondary VPS
# 2. Update API to use read replica for SELECT queries
# 3. Keep primary for writes

# Connection string examples:
# Primary (writes): postgresql://gitdiscover:pass@db-primary:5432/gitdiscover
# Replica (reads):  postgresql://gitdiscover:pass@db-replica:5432/gitdiscover
```

### CDN Configuration

For static assets, configure Cloudflare:

```bash
# Page Rules for caching
# 1. /static/* → Cache Level: Cache Everything, Edge Cache TTL: 1 month
# 2. /api/* → Cache Level: Bypass
# 3. /* → Cache Level: Standard, Browser Cache TTL: 5 minutes
```

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 | Service down | 15 minutes | API unresponsive, database down |
| P2 | Degraded service | 1 hour | Slow responses, partial outages |
| P3 | Non-critical issues | 4 hours | Collector failures, minor bugs |
| P4 | Feature requests | Next sprint | New features, enhancements |

### Incident Response Playbook

#### P1: Complete Outage

```bash
# 1. Acknowledge and communicate (Slack/Discord)
# 2. Check service status
docker compose -f docker/docker-compose.stack.yml ps

# 3. Check resource exhaustion
free -h && df -h

# 4. Check logs for fatal errors
docker compose -f docker/docker-compose.stack.yml logs --tail=500 api

# 5. Quick recovery attempts:
#    a) Restart services
docker compose -f docker/docker-compose.stack.yml restart

#    b) If database issue, check disk space
df -h /var/lib/docker

#    c) If memory issue, restart with cleanup
docker system prune -f
docker compose -f docker/docker-compose.stack.yml up -d

# 6. If all else fails, restore from backup
# (See Backup and Restore Procedures)

# 7. Post-incident: Document root cause
```

#### P2: Degraded Performance

```bash
# 1. Identify bottleneck
#    - High CPU: Check for expensive queries
#    - High Memory: Check for memory leaks
#    - High Disk I/O: Check database operations

# 2. Mitigation steps:
#    - Restart affected service
#    - Scale up resources temporarily
#    - Enable rate limiting if under attack

# 3. Monitor recovery
curl -s https://api.gitdiscover.org/health | jq
```

#### P3: Data Collector Failure

```bash
# 1. Check collector logs
docker compose -f docker/docker-compose.stack.yml logs collector

# 2. Common fixes:
#    - GitHub API rate limit: Wait 1 hour
#    - Database connection: Restart collector
#    - Memory issue: Restart with more memory

# 3. Manual data collection if needed
docker compose -f docker/docker-compose.stack.yml run --rm collector \
  node dist/index.js daily
```

### Post-Incident Review Template

```markdown
## Incident Report: [YYYY-MM-DD] [Brief Description]

### Timeline
- [Time] Issue detected
- [Time] Response started
- [Time] Service restored
- [Time] Post-mortem completed

### Root Cause
[Description of what caused the incident]

### Impact
- Duration: [X minutes/hours]
- Users affected: [Estimated number]
- Data loss: [Yes/No, details if yes]

### Resolution
[Steps taken to resolve the incident]

### Prevention
[Actions to prevent recurrence]
- [ ] Action item 1
- [ ] Action item 2

### Lessons Learned
[What went well, what could be improved]
```

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-02
**On-Call Contact**: [Your contact info]
**Escalation**: [Escalation contact]
