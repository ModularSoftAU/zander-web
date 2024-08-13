import { hashEmail } from "../api/common";
import db from "./databaseController";

export function UserGetter() {
  this.byUsername = function (username) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE username=?;`,
        [username],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.byUUID = function (uuid) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE uuid=?;`,
        [uuid],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }
          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.byDiscordId = function (discordId) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE discordId=?;`,
        [discordId],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.hasJoined = function (username) {
    return new Promise((resolve, reject) => {
      db.query(
        `select * from users where username=?;`,
        [username],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(false);
          }

          resolve(true);
        }
      );
    });
  };

  this.isRegistered = function (discordId) {
    return new Promise((resolve, reject) => {
      // Execute a SQL query to check if the user exists in the database
      db.query(
        `SELECT * FROM users WHERE discordId=?;`,
        [discordId],
        function (error, results, fields) {
          if (error) {
            // If there's an error with the database query, reject the Promise
            reject(error);
          }

          // Check if the query returned any results
          if (!results || !results.length) {
            // If no results were found, resolve with false (user not registered)
            resolve(false);
          } else {
            // If results were found, resolve with true (user is registered)
            resolve(true);
          }
        }
      );
    });
  };
}

export function UserLinkGetter() {
  this.getUserByCode = function (code) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT u.* FROM users u JOIN userVerifyLink uv ON u.uuid = uv.uuid WHERE uv.linkCode = ?;`,
        [code],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.link = function (uuid, discordId) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE users SET discordId=?, account_registered=? WHERE uuid=?`,
        [discordId, new Date(), uuid],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          resolve(true);
        }
      );
    });
  };
}

export async function getProfilePicture(username) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM users WHERE username=?;`,
      [username],
      async function (error, results, fields) {
        if (error) {
          reject(error);
        }

        let profilePictureType = results[0].profilePicture_type;

        if (profilePictureType == "CRAFTATAR") {
          let craftUUID = results[0].uuid;
          return resolve(`https://crafatar.com/avatars/${craftUUID}?helm`);
        }

        if (profilePictureType == "GRAVATAR") {
          let email = results[0].profilePicture_email;
          let emailHash = await hashEmail(email); // Await here
          return resolve(`https://gravatar.com/avatar/${emailHash}?size=300`);
        }
      }
    );
  });
}

export async function setProfileDisplayPreferences(
  userId,
  profilePicture_type,
  profilePicture_email
) {
  db.query(
    `UPDATE users SET profilePicture_type=?, profilePicture_email=? WHERE userId=?;`,
    [profilePicture_type, profilePicture_email, userId],
    function (error, results, fields) {
      if (error) {
        console.log(error);
      }
    }
  );
}

export async function setProfileUserInterests(
  userId,
  social_interests
) {
  db.query(
    `UPDATE users SET social_interests=? WHERE userId=?;`,
    [social_interests, userId],
    function (error, results, fields) {
      if (error) {
        console.log(error);
      }
    }
  );
}

export async function setProfileSocialConnections(
  userId,
  social_discord,
  social_steam,
  social_twitch,
  social_youtube,
  social_twitter_x,
  social_instagram,
  social_reddit,
  social_spotify
) {
  db.query(
    `UPDATE users SET social_discord=?, social_steam=?, social_twitch=?, social_youtube=?, social_twitter_x=?, social_instagram=?, social_reddit=?, social_spotify=? WHERE userId=?;`,
    [
      social_discord,
      social_steam,
      social_twitch,
      social_youtube,
      social_twitter_x,
      social_instagram,
      social_reddit,
      social_spotify,
      userId,
    ],
    function (error, results, fields) {
      if (error) {
        console.log(error);
      }
    }
  );
}

export async function setProfileUserAboutMe(
  userId,
  social_aboutMe
) {
  db.query(
    `UPDATE users SET social_aboutMe=? WHERE userId=?;`,
    [social_aboutMe, userId],
    function (error, results, fields) {
      if (error) {
        console.log(error);
      }
    }
  );
}

export async function getUserPermissions(userData) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT DISTINCT permission FROM userPermissions WHERE userId = ?; SELECT rankSlug FROM userRanks WHERE userId = ?`,
      [userData.userId, userData.userId],
      async function (err, results) {
        if (err) {
          return reject(err);
        }

        // Define this array to specify the permission context for the player
        const userPermissions = [];

        // Map results to get an array of permissions
        let userPermissionResults = results[0].map((a) => a.permission);

        // Push userPermissionResults into userPermissions using the spread operator
        userPermissions.push(...userPermissionResults);

        const userRanks = results[1];

        // Use Promise.all to handle the asynchronous queries inside the forEach loop
        try {
          await Promise.all(
            userRanks.map(async (rank) => {
              console.log(rank.rankSlug);

              return new Promise((resolve, reject) => {
                db.query(
                  `SELECT * FROM zanderdev.rankPermissions WHERE rankSlug=?;`,
                  [rank.rankSlug],
                  function (err, rankPermissionsResults) {
                    if (err) {
                      return reject(err);
                    }

                    rankPermissionsResults.forEach((rankPermission) => {
                      console.log(rankPermission.permission);
                      userPermissions.push(rankPermission.permission);
                    });

                    resolve();
                  }
                );
              });
            })
          );

          console.log(userPermissions);

          resolve(userPermissions);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function getUserStats(userId) {
  return new Promise((resolve) => {
    db.query(
      `SELECT SUM(TIME_TO_SEC(TIMEDIFF(COALESCE(sessionEnd, NOW()), sessionStart))) AS totalSeconds FROM gameSessions WHERE userId=?; SELECT COUNT(*) AS totalLogins FROM gameSessions WHERE userId = ?;`,
      [userId, userId],
      async function (err, results) {
        if (err) {
          throw err;
        }

        const seconds = results[0][0].totalSeconds;
        const logins = results[1][0].totalLogins;

        const userStats = {
          totalPlaytime: convertSecondsToDuration(seconds),
          totalLogins: logins,
        };

        resolve(userStats);
      }
    );
  });
}

export function convertSecondsToDuration(seconds) {
  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;

  if (seconds < MINUTE) {
    return `${seconds} seconds`;
  } else if (seconds < HOUR) {
    return `${Math.floor(seconds / MINUTE)} minutes`;
  } else if (seconds < DAY) {
    return `${Math.floor(seconds / HOUR)} hours`;
  } else if (seconds < MONTH) {
    return `${Math.floor(seconds / DAY)} days`;
  } else {
    return `${Math.floor(seconds / MONTH)} months`;
  }
}

export async function getRankPermissions(allRanks) {
  return new Promise((resolve) => {
    db.query(
      `SELECT DISTINCT permission FROM rankPermissions WHERE FIND_IN_SET(rankSlug, ?)`,
      [allRanks.join()],
      async function (err, results) {
        if (err) {
          throw err;
        }

        let rankPermissions = results.map((a) => a.permission);
        resolve(rankPermissions);
      }
    );
  });
}

export async function getUserRanks(userData, userRanks = null) {
  return new Promise((resolve) => {
    // Call with just userData only get directly assigned Ranks
    if (userRanks === null) {
      db.query(
        `SELECT rankSlug, title FROM userRanks WHERE userId = ?`,
        [userData.userId],
        async function (err, results) {
          if (err) {
            throw err;
          }

          let userRanks = results.map((a) => ({
            ["rankSlug"]: a.rankSlug,
            ["title"]: a.title,
          }));
          resolve(userRanks);
        }
      );
      // Ranks were passed in meaning we are looking for nested ranks
    } else {
      db.query(
        `SELECT rankSlug FROM rankRanks WHERE FIND_IN_SET(parentRankSlug, ?)`,
        [userRanks.join()],
        async function (err, results) {
          if (err) {
            throw err;
          }

          let childRanks = results.map((a) => a.rankSlug);
          let allRanks = userRanks.concat(childRanks);
          // Using a set of the array removes duplicates and prevents infinite loops
          let removeDuplicates = [...new Set(allRanks)];

          // If after removing duplicates the length of the new list is not longer than the old list we are done simply resolve
          if (userRanks.length <= removeDuplicates.length) {
            resolve(removeDuplicates);
          } else {
            resolve(getUserRanks(userData, removeDuplicates));
          }
        }
      );
    }
  });
}

export async function checkPermissions(username, permissionNode) {
  try {
    const userPermissions = await getUserPermissions(username);
    console.log(userPermissions);

    const hasPermission = userPermissions.includes(permissionNode);

    return hasPermission;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

export async function getUserLastSession(userId) {
  return new Promise((resolve) => {
    db.query(
      `SELECT * FROM gameSessions WHERE userId=? ORDER BY sessionStart DESC LIMIT 1;`,
      [userId],
      async function (err, results) {
        if (err) {
          throw err;
        }

        const now = new Date(); // Current time
        const sessionStart = new Date(results[0].sessionEnd);
        const sessionDiff = convertSecondsToDuration(Math.floor((now - sessionStart) / 1000));

        const sessionData = {
          sessionStart: results[0].sessionStart,
          sessionEnd: results[0].sessionEnd,
          server: results[0].server,
          lastOnlineDiff: sessionDiff,
        };

        resolve(sessionData);
      }
    );
  });
}
