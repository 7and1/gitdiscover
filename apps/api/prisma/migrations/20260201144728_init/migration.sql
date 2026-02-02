-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateTable
CREATE TABLE "repositories" (
    "id" SERIAL NOT NULL,
    "github_id" BIGINT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "language" VARCHAR(50),
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "open_issues" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stars_growth_24h" INTEGER NOT NULL DEFAULT 0,
    "forks_growth_24h" INTEGER NOT NULL DEFAULT 0,
    "homepage" VARCHAR(500),
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "license" VARCHAR(100),
    "has_readme" BOOLEAN NOT NULL DEFAULT false,
    "has_license" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_fork" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" INTEGER,
    "pushed_at" TIMESTAMP(3),
    "repo_created_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developers" (
    "id" SERIAL NOT NULL,
    "github_id" BIGINT NOT NULL,
    "login" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "bio" TEXT,
    "company" VARCHAR(255),
    "location" VARCHAR(255),
    "blog" VARCHAR(500),
    "email" VARCHAR(255),
    "twitter_username" VARCHAR(100),
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "public_repos" INTEGER NOT NULL DEFAULT 0,
    "public_gists" INTEGER NOT NULL DEFAULT 0,
    "impact_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active_repos" INTEGER NOT NULL DEFAULT 0,
    "total_stars" INTEGER NOT NULL DEFAULT 0,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "dev_created_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "github_id" BIGINT NOT NULL,
    "login" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "name" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "role" "Role" NOT NULL DEFAULT 'USER',
    "access_token" VARCHAR(500),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "stars" INTEGER NOT NULL,
    "forks" INTEGER NOT NULL,
    "watchers" INTEGER NOT NULL,
    "open_issues" INTEGER NOT NULL,
    "stars_growth" INTEGER NOT NULL DEFAULT 0,
    "forks_growth" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "developer_id" INTEGER NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "followers" INTEGER NOT NULL,
    "public_repos" INTEGER NOT NULL,
    "total_stars" INTEGER NOT NULL,
    "impact_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "analysis_date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "use_cases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tech_stack" JSONB,
    "code_quality" JSONB,
    "similar_repos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "target_audience" VARCHAR(500),
    "model_version" VARCHAR(50) NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "sync_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_invalidations" (
    "id" SERIAL NOT NULL,
    "cache_key" VARCHAR(255) NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "invalidated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cache_invalidations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_id_key" ON "repositories"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_full_name_key" ON "repositories"("full_name");

-- CreateIndex
CREATE INDEX "repositories_language_idx" ON "repositories"("language");

-- CreateIndex
CREATE INDEX "repositories_score_idx" ON "repositories"("score" DESC);

-- CreateIndex
CREATE INDEX "repositories_stars_idx" ON "repositories"("stars" DESC);

-- CreateIndex
CREATE INDEX "repositories_stars_growth_24h_idx" ON "repositories"("stars_growth_24h" DESC);

-- CreateIndex
CREATE INDEX "repositories_updated_at_idx" ON "repositories"("updated_at");

-- CreateIndex
CREATE INDEX "repositories_language_score_idx" ON "repositories"("language", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "developers_github_id_key" ON "developers"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "developers_login_key" ON "developers"("login");

-- CreateIndex
CREATE INDEX "developers_impact_score_idx" ON "developers"("impact_score" DESC);

-- CreateIndex
CREATE INDEX "developers_followers_idx" ON "developers"("followers" DESC);

-- CreateIndex
CREATE INDEX "developers_total_stars_idx" ON "developers"("total_stars" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE INDEX "repository_snapshots_snapshot_date_idx" ON "repository_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "repository_snapshots_snapshot_date_score_idx" ON "repository_snapshots"("snapshot_date", "score" DESC);

-- CreateIndex
CREATE INDEX "repository_snapshots_snapshot_date_rank_idx" ON "repository_snapshots"("snapshot_date", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "repository_snapshots_repository_id_snapshot_date_key" ON "repository_snapshots"("repository_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "developer_snapshots_snapshot_date_idx" ON "developer_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "developer_snapshots_snapshot_date_impact_score_idx" ON "developer_snapshots"("snapshot_date", "impact_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "developer_snapshots_developer_id_snapshot_date_key" ON "developer_snapshots"("developer_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "ai_analyses_analysis_date_idx" ON "ai_analyses"("analysis_date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_repository_id_analysis_date_key" ON "ai_analyses"("repository_id", "analysis_date");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "bookmarks_repository_id_idx" ON "bookmarks"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_repository_id_key" ON "bookmarks"("user_id", "repository_id");

-- CreateIndex
CREATE INDEX "comments_repository_id_created_at_idx" ON "comments"("repository_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "votes_repository_id_idx" ON "votes"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_user_id_repository_id_key" ON "votes"("user_id", "repository_id");

-- CreateIndex
CREATE INDEX "sync_logs_sync_type_started_at_idx" ON "sync_logs"("sync_type", "started_at" DESC);

-- CreateIndex
CREATE INDEX "cache_invalidations_invalidated_at_idx" ON "cache_invalidations"("invalidated_at");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_snapshots" ADD CONSTRAINT "repository_snapshots_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_snapshots" ADD CONSTRAINT "developer_snapshots_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
