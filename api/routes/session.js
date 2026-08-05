import { required } from "../common.js";

export default function sessionApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/session";

  app.post(baseEndpoint + "/create", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const ipAddress = required(req.body, "ipAddress", res);
    if (res.sent) return;

    const newSessionCreatedLang = lang.session.newSessionCreated;

    try {
      // Fetch userId based on the provided uuid
      const userIdResult = await new Promise((resolve, reject) => {
        db.query(
          `SELECT userId FROM users WHERE uuid = ?`,
          [uuid],
          function (error, results) {
            if (error) {
              reject(error);
            } else {
              resolve(results);
            }
          }
        );
      });

      if (userIdResult.length === 0) {
        return res.send({
          success: false,
          message: "User not found with the provided UUID.",
        });
      }

      const userId = userIdResult[0].userId;

      // Insert newly started session into database
      await new Promise((resolve, reject) => {
        db.query(
          `
            INSERT INTO gameSessions
                (
                    userId,
                    ipAddress
                ) VALUES (
                    ?,
                    ?
                )`,
          [userId, ipAddress],
          function (error) {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });

      return res.send({
        success: true,
        message: newSessionCreatedLang.replace("%UUID%", uuid),
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });


  app.post(baseEndpoint + "/destroy", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;

    const sessionClosedLang = lang.session.allSessionsClosed;

    try {
      // Update any open sessions for the specified user to close them
      await new Promise((resolve, reject) => {
        db.query(
          `
            UPDATE gameSessions, users
            SET gameSessions.sessionEnd = NOW()
          WHERE gameSessions.userId = users.userId
            AND users.uuid = ?
            AND gameSessions.sessionEnd IS NULL
            AND gameSessions.sessionId > 0
          `,
          [uuid],
          function (error) {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });

      return res.send({
        success: true,
        message: sessionClosedLang.replace("%UUID%", uuid),
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/switch", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const server = required(req.body, "server", res);
    if (res.sent) return;

    const sessionSwitchLang = lang.session.sessionSwitch;

    try {
      // Update any open sessions for the specified user to change to the specified server
      await new Promise((resolve, reject) => {
        db.query(
          `
            UPDATE gameSessions
            JOIN users ON gameSessions.userId = users.userId
            SET gameSessions.server = ?
            WHERE users.uuid = ?
                AND gameSessions.sessionEnd IS NULL
                AND gameSessions.sessionId > 0;
          `,
          [server, uuid],
          function (error) {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });

      return res.send({
        success: true,
        message: sessionSwitchLang
          .replace("%UUID%", uuid)
          .replace("%SERVER%", server),
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });
}
