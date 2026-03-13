import mysql from "mysql";
import dotenv from "dotenv";
dotenv.config();

// Tracks whether the DB is reachable. null = not yet known, true = up, false = down.
let dbHealthy = null;

export function isDbHealthy() {
  return dbHealthy;
}

var pool = mysql.createPool({
  connectionLimit: 25,
  host: process.env.databaseHost,
  port: process.env.databasePort,
  user: process.env.databaseUser,
  password: process.env.databasePassword,
  database: process.env.databaseName,
  charset: "utf8mb4",
  multipleStatements: true,
  connectTimeout: 5000,  // 5 seconds — fail fast so the maintenance page shows quickly
  acquireTimeout: 5000,
  timezone: "Z", // Treat all database datetimes as UTC
});

// Ensure every connection in the pool uses utf8mb4 so that 4-byte Unicode
// characters (emoji, etc.) are stored and retrieved correctly.
pool.on("connection", function (connection) {
  if (!dbHealthy) {
    dbHealthy = true;
    console.info("[DB] Database is reachable.");
  }
  connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
});

pool.getConnection(function (err, connection) {
  if (err) {
    dbHealthy = false;
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    return;
  }
  dbHealthy = true;
  console.info(`[DB] Database pool connection is successful.`);
  connection.release(); // Release the connection back to the pool
});

pool.on("error", (err) => {
  console.error(`[ERROR] [DB] Pool Error: ${err.message}`);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    dbHealthy = false;
    console.error("[ERROR] [DB] Database connection was closed.");
  } else if (err.code === "ER_CON_COUNT_ERROR") {
    console.error("[ERROR] [DB] Database has too many connections.");
  } else if (err.code === "ECONNREFUSED") {
    dbHealthy = false;
    console.error("[ERROR] [DB] Database connection was refused.");
  } else if (err.code === "EHOSTUNREACH" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") {
    dbHealthy = false;
    console.error("[ERROR] [DB] Database host is unreachable.");
  }
});

export default pool;
