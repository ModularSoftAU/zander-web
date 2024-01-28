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

    @param password The password to match against confirmPassword
    @param confirmPassword The password to validate against password
*/
export async function doesPasswordMatch(password, confirmPassword) {
  return new Promise((resolve, reject) => {
    if (password === confirmPassword) {
      resolve(true);
    }

    resolve(false);
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
        let emailHash = results[0].emailHash;

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