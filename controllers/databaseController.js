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
// Parse connection URLs
// ---------------------------------------------------------------------------

const dbUrl = new URL(process.env.DATABASE_URL);
const lpUrl = new URL(process.env.LUCKPERMS_URL);
const qsUrl = new URL(process.env.QUICKSHOP_URL);

// ---------------------------------------------------------------------------
// Prisma client (primary interface for new code)
// ---------------------------------------------------------------------------

const prismaBase = new PrismaClient({
  log: process.env.DEBUG === "true" ? ["query", "info", "warn", "error"] : ["warn", "error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=5&pool_timeout=10&connect_timeout=10",
    },
  },
});

export const prisma = prismaBase;

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
  connectionLimit: 10,
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  charset: "utf8mb4",
  multipleStatements: true,
  connectTimeout: 10000,
  waitForConnections: true,
  timezone: "Z",
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
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
  if (["PROTOCOL_CONNECTION_LOST", "ECONNREFUSED", "EHOSTUNREACH", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"].includes(err.code)) {
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
// LuckPerms pool — separate MySQL instance
// ---------------------------------------------------------------------------

const luckpermsPool = mysql2.createPool({
  connectionLimit: 5,
  host: lpUrl.hostname,
  port: parseInt(lpUrl.port) || 3306,
  user: decodeURIComponent(lpUrl.username),
  password: decodeURIComponent(lpUrl.password),
  database: lpUrl.pathname.slice(1),
  charset: "utf8mb4",
  connectTimeout: 10000,
  waitForConnections: true,
  timezone: "Z",
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

luckpermsPool.on("connection", function (connection) {
  console.info("[DB] LuckPerms pool connection established.");
  connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
});

luckpermsPool.on("error", (err) => {
  console.error(`[ERROR] [DB] LuckPerms Pool Error: ${err.message}`);
});

luckpermsPool.getConnection(function (err, connection) {
  if (err) {
    console.error(`[ERROR] [DB] LuckPerms connection failed:\n ${err.stack}`);
    return;
  }
  console.info("[DB] LuckPerms pool connection is successful.");
  connection.release();
});

export const luckpermsDb = luckpermsPool;

// ---------------------------------------------------------------------------
// QuickShop pool — separate MySQL instance (shop directory database)
// ---------------------------------------------------------------------------

const quickshopPool = mysql2.createPool({
  connectionLimit: 5,
  host: qsUrl.hostname,
  port: parseInt(qsUrl.port) || 3306,
  user: decodeURIComponent(qsUrl.username),
  password: decodeURIComponent(qsUrl.password),
  database: qsUrl.pathname.slice(1),
  charset: "utf8mb4",
  connectTimeout: 10000,
  waitForConnections: true,
  timezone: "Z",
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

quickshopPool.on("connection", function (connection) {
  console.info("[DB] QuickShop pool connection established.");
  connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
});

quickshopPool.on("error", (err) => {
  console.error(`[ERROR] [DB] QuickShop Pool Error: ${err.message}`);
});

quickshopPool.getConnection(function (err, connection) {
  if (err) {
    console.error(`[ERROR] [DB] QuickShop connection failed:\n ${err.stack}`);
    return;
  }
  console.info("[DB] QuickShop pool connection is successful.");
  connection.release();
});

export const quickshopDb = quickshopPool;

// ---------------------------------------------------------------------------
// Default export: mysql2 pool (drop-in replacement for the old `mysql` pool)
// ---------------------------------------------------------------------------

export default pool;
