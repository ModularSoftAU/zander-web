import mysql from "mysql";
import dotenv from "dotenv";
dotenv.config();

var pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.databaseHost,
  port: process.env.databasePort,
  user: process.env.databaseUser,
  password: process.env.databasePassword,
  database: process.env.databaseName,
  multipleStatements: true,
});

pool.getConnection(function (err) {
  if (err) {
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    pool.connect();
    return;
  }
  console.log(`[CONSOLE] [DB] Database pool connection is successful.`);
});

export default pool;
