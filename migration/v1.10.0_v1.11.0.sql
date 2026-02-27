-- Convert forum tables to utf8mb4 to support 4-byte Unicode characters (emoji etc.)
-- Migration: v1.10.0 -> v1.11.0
ALTER TABLE forumCategories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE forumDiscussions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE forumPosts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE forumPostRevisions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
