import { required, optional, generateVerifyCode } from "../common";

export default function userApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/user";

  app.post(baseEndpoint + "/create", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    const username = required(req.body, "username", res);

    const userCreatedLang = lang.api.userCreated;

    // shadowolf
    // Check if user does not exist, we do this in case of testing we create multiple users on accident
    db.query(
      `SELECT * FROM users WHERE uuid=?`,
      [uuid],
      function (error, results, fields) {
        if (error) {
          console.log(error);
        }

        if (results[0]) {
          // To ensure usernames are always accurate we set the username just in case the username changes.
          db.query(
            `UPDATE users SET username=? WHERE uuid=?;`,
            [username, uuid],
            function (error, results, fields) {
              if (error) {
                return res.send({
                  success: false,
                  message: `${error}`,
                });
              }
            }
          );

          // If the user already exists, we alert the console that the user wasn't created because it doesn't exist.
          return res.send({
            success: null,
            message: `${lang.api.userAlreadyExists}`,
          });
        }

        // If user does not exist, create them
        db.query(
          `INSERT INTO users (uuid, username) VALUES (?, ?)`,
          [uuid, username],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: `${error}`,
              });
            }

            return res.send({
              success: true,
              message: userCreatedLang
                .replace("%USERNAME%", username)
                .replace("%UUID%", uuid),
            });
          }
        );
      }
    );

    return res;
  });

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    const username = optional(req.query, "username");

    try {
      if (username) {
        db.query(
          `SELECT * FROM users WHERE username=?;`,
          [username],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: error,
              });
            }

            if (!results || !results.length) {
              return res.send({
                success: false,
                message: lang.api.userDoesNotExist,
              });
            }

            return res.send({
              success: true,
              data: results,
            });
          }
        );
      } else {
        db.query(`SELECT * FROM users;`, function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: error,
            });
          }

          if (!results || !results.length) {
            return res.send({
              success: false,
              message: `No Users found`,
            });
          }

          return res.send({
            success: true,
            data: results,
          });
        });
      }
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/verify", async function (req, res) {
    const username = required(req.body, "username");
    const uuid = required(req.body, "uuid");

    const linkCode = await generateVerifyCode();
    
    try {
      db.query(
        `INSERT INTO userVerifyLink (uuid, username, linkCode, codeExpiry) VALUES (?, ?, ?, ?)`,
        [uuid, username, linkCode],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            code: linkCode,
          });
        }
      );


    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/link", async function (req, res) {
    const discordId = required(req.body, "discordId");
    const first = required(req.body, "first");
    const second = required(req.body, "second");
    const third = required(req.body, "third");
    const fourth = required(req.body, "fourth");
    const fifth = required(req.body, "fifth");
    const sixth = required(req.body, "sixth");

    const verifyCode = first + second + third + fourth + fifth + sixth;

    try {
      // 
      // Grab link code and find player.
      // 
      db.query(
        `SELECT * FROM userVerifyLink WHERE linkCode=?`,
        [verifyCode],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          const mcUuid = results[0].uuid;

          // 
          // Bind Discord Account to User ID
          // 
          db.query(
            `UPDATE users SET discordId=? account_registered=? WHERE uuid=?`,
            [discordId, new Date(), mcUuid],
            function (error, results, fields) {
              if (error) {
                return res.send({
                  success: false,
                  message: `${error}`,
                });
              }

              return res.send({
                success: true,
                message: `Account creation successful, sign back in to get started.`,
              });
            }
          );
        }
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
