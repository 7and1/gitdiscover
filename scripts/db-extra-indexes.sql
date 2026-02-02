-- Additional indexes for complex queries.
-- Run manually in production (CONCURRENTLY cannot run inside a transaction).

-- Full-text search on repositories (name + description)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_repos_fulltext
ON repositories USING GIN (
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- Composite index for trending page
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_repos_trending_composite
ON repositories (language, score DESC, stars_growth_24h DESC)
WHERE is_archived = false;

