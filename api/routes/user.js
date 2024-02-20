import { UserGetter, UserLinkGetter } from "../../controllers/userController";
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

    const userData = new UserGetter();
    const user = await userData.byUUID(uuid);

    if (!user) {
      return res.send({
        success: false,
        message: `User ${username} does not exist in player base, please join the Network and try again.`,
      });
    } else {
      try {
        const linkCode = await generateVerifyCode();
        const now = new Date();
        const codeExpiry = new Date(now.getTime() + 5 * 60000);

        db.query(
          `INSERT INTO userVerifyLink (uuid, username, linkCode, codeExpiry) VALUES (?, ?, ?, ?)`,
          [uuid, username, linkCode, codeExpiry],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: `There was an error in setting your code, try again in 5 minutes.`,
              });
            }

            return res.send({
              success: true,
              message: `Here is your code: ${linkCode}\nGo back to the registration form and put this in.\nThis code will expire in 5 minutes.`,
            });
          }
        );
      } catch (error) {
        return res.send({
          success: false,
          message: `${error}`,
        });
      }
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
      const userLinkData = new UserLinkGetter();
      const linkUser = await userLinkData.getUserByCode(verifyCode);
      let linkUserUUID = linkUser.uuid;

      //
      // Bind Discord Account to User ID
      //
      userLinkData
        .link(linkUserUUID, discordId)
        .then((success) => {
          if (success) {
            console.error("Linking success");
          } else {
            // Handle error or do something else
            console.error("Linking failed");
          }
        })
        .catch((error) => {
          // Handle error
          console.error("Error linking");
        });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
