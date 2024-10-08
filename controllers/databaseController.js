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
  connectTimeout: 30000, // 30 seconds
  acquireTimeout: 30000, // Time to wait for acquiring a connection
});

pool.getConnection(function (err, connection) {
  if (err) {
    console.log(err);    
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    return;
  }
  console.log(`[CONSOLE] [DB] Database pool connection is successful.`);
  connection.release(); // Release the connection back to the pool
});

export default pool;
