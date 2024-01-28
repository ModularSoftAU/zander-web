import { hashEmail } from "../api/common";
import db from "./databaseController";

/*
    Returns a Promise which checks if a user with a given username has joined 
    before by querying a database using the db.query method. 
    If the query is successful and a user with that username is found, 
    it resolves the Promise with a value of true, otherwise it resolves with a value of false. I
    f there is an error, the Promise is rejected with the error message.

    @param username The username of the user
*/
export async function hasJoined(username) {
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
}

/*
    Checks if two given passwords match, and returns a Promise with a boolean value of true if they match and false otherwise.

    @param username The username of the user.
*/
export async function getProfilePicture(username) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM users WHERE username=?;`,
      [username],
      function (error, results, fields) {
        if (error) {
          reject(error);
        }

        let profilePictureType = results[0].profilePictureType;
        let craftUUID = results[0].uuid;
        let email = results[0].email;
        let emailHash = hashEmail(email);

        if (profilePictureType == "CRAFTATAR")
          return resolve(`https://crafatar.com/avatars/${craftUUID}?helm`);
        if (profilePictureType == "GRAVATAR")
          return resolve(`https://www.gravatar.com/avatar/${emailHash}?s=300`);
      }
    );
  });
}

export async function isRegistered(uuid) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT account_registered FROM users WHERE uuid=?;`,
      [uuid],
      function (error, results, fields) {
        if (error) {
          reject(error);
        }

        console.log(results);

        if (!results || !results.length) {
          resolve(false);
        }

        resolve(true);
      }
    );
  });
}

export async function getUserPermissions(userData) {
  return new Promise((resolve) => {
    //Get permissions assigned directly to user
    db.query(
      `SELECT DISTINCT permission FROM userPermissions WHERE userId = ?`,
      [userData.userId],
      async function (err, results) {
        if (err) {
          throw err;
        }

        let userPermissions = results.map((a) => a.permission);
        resolve(userPermissions);
      }
    );
  });
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
          //Using a set of the array removes duplicates and prevents infinite loops
          let removeDuplicates = [...new Set(allRanks)];

          //If after removing duplicates the length of the new list is not longer than the old list we are done simply resolve
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