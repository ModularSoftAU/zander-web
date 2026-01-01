ALTER TABLE supportTicketMessages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE supportTicketMessages MODIFY message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
