-- Add title to discussions table for easier and faster lookups
ALTER TABLE forums_discussions
ADD COLUMN title VARCHAR(255) NOT NULL AFTER authorId;
