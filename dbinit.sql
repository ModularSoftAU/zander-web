DROP DATABASE IF EXISTS zanderDev;
CREATE DATABASE IF NOT EXISTS zanderDev;
USE zanderDev;

-- Network Player Data
CREATE TABLE playerData (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  uuid VARCHAR(36),
  username VARCHAR(16),
  joined TIMESTAMP NOT NULL DEFAULT NOW(),
  twitter VARCHAR(15),
  youtube TEXT,
  instagram VARCHAR(30),
  steam VARCHAR(32),
  github VARCHAR(40),
  snapchat VARCHAR(30),
  discord TEXT,
  aboutPage TEXT,
  coverArt VARCHAR(64)
);

-- Sessions for Network
CREATE TABLE gameSessions (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  playerID INT NOT NULL DEFAULT 0,
  sessionStart TIMESTAMP NOT NULL DEFAULT NOW(),
  sessionEnd TIMESTAMP NULL,
  ipAddress VARCHAR(45),
  server VARCHAR(50),
  FOREIGN KEY (playerid) REFERENCES playerdata (id)
);
create index gameSessions on gameSessions (playerID);
create index gameSessions_sessionStart on gameSessions (sessionStart);
create index gameSessions_sessionEnd on gameSessions (sessionEnd);

-- Punishments for Network
CREATE TABLE punishments (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  playerID INT NOT NULL DEFAULT 0,
  staffID INT NOT NULL DEFAULT 0,
  platform VARCHAR(10),
  type VARCHAR(20),
  reason VARCHAR(50),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  expires DATETIME,
  appealed BOOLEAN DEFAULT 0,
  FOREIGN KEY (playerID) REFERENCES playerData (id),
  FOREIGN KEY (staffID) REFERENCES playerData (id)
);

CREATE TABLE ipBans (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  staffID INT NOT NULL DEFAULT 0,
  reason VARCHAR(50),
  ipAddress TEXT,
  enabled BOOLEAN DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  excludedUsers TEXT,
  FOREIGN KEY (staffID) REFERENCES playerData (id)
);


-- Web Accounts
CREATE TABLE webAccounts (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  playerID INT NOT NULL DEFAULT 0,
  email VARCHAR(200),
  password TEXT,
  registrationToken VARCHAR(32),
  registered BOOLEAN DEFAULT 0,
  disabled BOOLEAN DEFAULT 0,
  FOREIGN KEY (playerID) REFERENCES playerData (id)
);

-- Events
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  title TEXT,
  icon TEXT,
  eventDateTime DATETIME,
  information TEXT,
  published BOOLEAN DEFAULT 0
);

-- Servers
CREATE TABLE servers (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  name TEXT,
  address TEXT,
  position VARCHAR(2)
);

-- Votes
CREATE TABLE votes (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  username VARCHAR(16),
  service TEXT,
  time TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Appeals
CREATE TABLE appeals (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  playerID INT NOT NULL DEFAULT 0,
  punishmentID INT NOT NULL DEFAULT 0,
  open BOOLEAN,
  locked BOOLEAN,
  appealed BOOLEAN,
  escalated BOOLEAN,
  createdDate TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedDate DATETIME,
  FOREIGN KEY (playerID) REFERENCES playerData (id)
);

CREATE TABLE appealActions (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  action TEXT,
  text TEXT,
  playerID INT NOT NULL DEFAULT 0,
  punishmentID INT NOT NULL DEFAULT 0,
  createdDate TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedDate DATETIME,
  FOREIGN KEY (playerID) REFERENCES playerData (id)
);

-- User Alerts
CREATE TABLE userAlerts (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  userID INT,
  name TEXT,
  message TEXT,
  url TEXT
);

-- Network Alerts
CREATE TABLE alerts (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  body TEXT,
  motd BOOLEAN,
  tips BOOLEAN,
  web BOOLEAN,
  popUp BOOLEAN,
  createdDate TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedDate DATETIME,
  motdFormat BOOLEAN,
  enabled BOOLEAN
);

-- Friends
CREATE TABLE friends (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  userID INT,
  friendID INT,
  accepted BOOLEAN DEFAULT 0,
  createdDate TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Report
CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  userID INT,
  reporterID INT,
  reason TEXT,
  evidence TEXT,
  server VARCHAR(20),
  createdDate TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User Settings
CREATE TABLE userSettings (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  userID INT,
  userKey TEXT,
  value TEXT
);

-- Knowledgebase
CREATE TABLE knowledgebaseSection (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  name VARCHAR(30),
  description TEXT,
  sectionIcon VARCHAR(20)
);

CREATE TABLE knowledgebaseArticle (
  id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
  name VARCHAR(30),
  markdownLink TEXT,
  position VARCHAR(2),
  sectionID INT,
  FOREIGN KEY (sectionID) REFERENCES knowledgebaseSection (id)
);