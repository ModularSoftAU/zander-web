-- Add votes table for top voters feature
-- Migration: v1.16.0 -> v1.17.0
--
-- Creates the votes table to record player votes from external voting services.
-- Used to display top voters on the homepage.

CREATE TABLE IF NOT EXISTS votes (
  voteId      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  uuid        VARCHAR(36)   NOT NULL,
  username    VARCHAR(16)   NOT NULL,
  service     VARCHAR(64)   NOT NULL DEFAULT 'unknown',
  votedAt     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (voteId),
  KEY idx_votes_uuid     (uuid),
  KEY idx_votes_votedAt  (votedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
