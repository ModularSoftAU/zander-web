/**
 * databaseController.js
 *
 * Provides two database interfaces:
 *
 *   1. `prisma`  – PrismaClient for typed model queries on first-party tables.
 *                  Import as: import { prisma } from "./databaseController.js"
 *
 *   2. `db`      – Backward-compatible pool shim using mysql2 under the hood.
 *                  Keeps existing callback-style controller code working without
 *                  modification.  Import as: import db from "./databaseController.js"
 *
 * Cross-database views (luckPermsPlayers, ranks, userRanks, userPermissions,
 * rankRanks, rankPermissions, punishments, shoppingDirectory) cannot be modelled
 * in Prisma because they span external databases.  Use prisma.$queryRawUnsafe()
 * for those queries.
 */

import { PrismaClient } from "@prisma/client";
import mysql2 from "mysql2";
import dotenv from "dotenv";
dotenv.config();

// ---------------------------------------------------------------------------
// Prisma client (primary interface for new code)
// ---------------------------------------------------------------------------

export const prisma = new PrismaClient({
  log: process.env.DEBUG === "true" ? ["query", "info", "warn", "error"] : ["warn", "error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL ||
        `mysql://${encodeURIComponent(process.env.databaseUser)}:${encodeURIComponent(process.env.databasePassword)}@${process.env.databaseHost}:${process.env.databasePort || 3306}/${process.env.databaseName}`,
    },
  },
});

// ---------------------------------------------------------------------------
// Health tracking
// ---------------------------------------------------------------------------

let dbHealthy = null;

export function isDbHealthy() {
  return dbHealthy;
}

// ---------------------------------------------------------------------------
// mysql2 pool (backward-compatible shim — keeps existing controller code working)
// ---------------------------------------------------------------------------

const pool = mysql2.createPool({
  connectionLimit: 25,
  host: process.env.databaseHost,
  port: parseInt(process.env.databasePort) || 3306,
  user: process.env.databaseUser,
  password: process.env.databasePassword,
  database: process.env.databaseName,
  charset: "utf8mb4",
  multipleStatements: true,
  connectTimeout: 5000,
  waitForConnections: true,
  timezone: "Z",
});

// Ensure utf8mb4 on every connection and update health status.
pool.on("connection", function (connection) {
  if (dbHealthy !== true) {
    dbHealthy = true;
    console.info("[DB] Database is reachable.");
  }
  connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
});

pool.on("error", (err) => {
  console.error(`[ERROR] [DB] Pool Error: ${err.message}`);
  if (["PROTOCOL_CONNECTION_LOST", "ECONNREFUSED", "EHOSTUNREACH", "ETIMEDOUT", "ENOTFOUND"].includes(err.code)) {
    dbHealthy = false;
  }
});

// Initial connection probe
pool.getConnection(function (err, connection) {
  if (err) {
    dbHealthy = false;
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    return;
  }
  dbHealthy = true;
  console.info(`[DB] Database pool connection is successful.`);
  connection.release();
});

// Periodic health check — keeps dbHealthy accurate after mid-session DB drops.
const HEALTH_CHECK_INTERVAL_MS = 10_000;
setInterval(() => {
  pool.getConnection((err, connection) => {
    if (err) {
      if (dbHealthy !== false) {
        dbHealthy = false;
        console.error("[DB] Health check failed — database is unreachable:", err.message);
      }
      return;
    }
    if (dbHealthy !== true) {
      dbHealthy = true;
      console.info("[DB] Health check passed — database is reachable.");
    }
    connection.release();
  });
}, HEALTH_CHECK_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Default export: mysql2 pool (drop-in replacement for the old `mysql` pool)
// ---------------------------------------------------------------------------

export default pool;
