-- CreateIndex
CREATE INDEX "bookmarks_user_id_created_at_idx" ON "bookmarks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "repositories_full_name_idx" ON "repositories"("full_name");

-- CreateIndex
CREATE INDEX "repositories_pushed_at_idx" ON "repositories"("pushed_at");

-- CreateIndex
CREATE INDEX "repository_snapshots_repository_id_snapshot_date_idx" ON "repository_snapshots"("repository_id", "snapshot_date");
