const mysql = require('mysql');
const config = require('../config.json');

var connection = mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
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

module.exports = connection;
