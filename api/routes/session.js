import { required } from "../common";

export default function sessionApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/session";

  app.post(baseEndpoint + "/create", async function (req, res) {
  const uuid = required(req.body, "uuid", res);
  const ipAddress = required(req.body, "ipAddress", res);

  const newSessionCreatedLang = lang.session.newSessionCreated;

  try {
    // Fetch userId based on the provided uuid
    const userIdResult = await new Promise((resolve, reject) => {
      db.query(
        `SELECT userId FROM users WHERE uuid = ?`,
        [uuid],
        function (error, results, fields) {
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
        function (error, results, fields) {
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
    return res.send({
      success: false,
      message: `${error}`,
    });
  }
});


  app.post(baseEndpoint + "/destroy", async function (req, res) {
    const uuid = required(req.body, "uuid", res);

    const sessionClosedLang = lang.session.allSessionsClosed;

    try {
      // Update any open sessions for the specified user to close them
      // The 'AND gameSessions.sessionId > 0' line is necessary to bypass mySQL's "safe update" feature.
      // If this is not there and there is somehow more than 1 open session, the query will fail.
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
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: sessionClosedLang.replace("%UUID%", uuid),
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/switch", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    const server = required(req.body, "server", res);

    const sessionSwitchLang = lang.session.sessionSwitch;

    try {
      // Update any open sessions for the specified user to change to the specified server
      // The 'AND gameSessions.sessionId > 0' line is necessary to bypass mySQL's "safe update" feature.
      // If this is not there and there is somehow more than 1 open session, the query will fail.
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
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: sessionSwitchLang
              .replace("%UUID%", uuid)
              .replace("%SERVER%", server),
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
