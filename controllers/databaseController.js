import mysql from "mysql";
import dotenv from "dotenv";
dotenv.config();

var pool = mysql.createPool({
  connectionLimit: 25,
  host: process.env.databaseHost,
  port: process.env.databasePort,
  user: process.env.databaseUser,
  password: process.env.databasePassword,
  database: process.env.databaseName,
  charset: "utf8mb4",
  multipleStatements: true,
  connectTimeout: 30000, // 30 seconds
  acquireTimeout: 30000, // Time to wait for acquiring a connection
  timezone: "Z", // Treat all database datetimes as UTC
});

// Ensure every connection in the pool uses utf8mb4 so that 4-byte Unicode
// characters (emoji, etc.) are stored and retrieved correctly.
pool.on("connection", function (connection) {
  connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
});

pool.getConnection(function (err, connection) {
  if (err) {
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    return;
  }
  console.info(`[DB] Database pool connection is successful.`);
  connection.release(); // Release the connection back to the pool
});

export default pool;
