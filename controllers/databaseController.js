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
  multipleStatements: true,
  connectTimeout: 30000, // 30 seconds
  acquireTimeout: 30000, // Time to wait for acquiring a connection
  timezone: "Z", // Treat all database datetimes as UTC
});

pool.getConnection(function (err, connection) {
  if (err) {
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    return;
  }
  console.info(`[DB] Database pool connection is successful.`);
  connection.release(); // Release the connection back to the pool
});

pool.on("error", (err) => {
  console.error(`[ERROR] [DB] Pool Error: ${err.message}`);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.error("[ERROR] [DB] Database connection was closed.");
  } else if (err.code === "ER_CON_COUNT_ERROR") {
    console.error("[ERROR] [DB] Database has too many connections.");
  } else if (err.code === "ECONNREFUSED") {
    console.error("[ERROR] [DB] Database connection was refused.");
  }
});

export default pool;
