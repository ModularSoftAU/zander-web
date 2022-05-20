import mysql from 'mysql';
import dotenv from 'dotenv';
dotenv.config()

var connection = mysql.createConnection({
  host: process.env.databaseHost,
  port: process.env.databasePort,
  user: process.env.databaseUser,
  password: process.env.databasePassword,
  database: process.env.databaseName,
  multipleStatements: true
});

connection.connect(function(err) {
  if (err) {
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
    connection.connect();
    return;
  }
  console.log(`[CONSOLE] [DB] Database connection is successful. Your connection ID is ${connection.threadId}.`);
});

export default connection;
