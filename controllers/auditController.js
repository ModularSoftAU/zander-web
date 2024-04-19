import db from "./databaseController";
import { UserGetter } from "./userController";

export async function updateAudit_lastMinecraftLogin(auditDateTime, username) {
  const userData = new UserGetter();
  const userAudit = await userData.byUsername(username);

  db.query(
    `UPDATE users SET audit_lastMinecraftLogin=? WHERE userId=?;`,
    [auditDateTime, userAudit.userId],
    function (error, results, fields) {
      if (error) {
        reject(error);
      }
    }
  );
}

export async function updateAudit_lastMinecraftMessage(auditDateTime, username) {
  const userData = new UserGetter();
  const userAudit = await userData.byUsername(username);

  db.query(
    `UPDATE users SET audit_lastMinecraftMessage=? WHERE userId=?;`,
    [auditDateTime, userAudit.userId],
    function (error, results, fields) {
      if (error) {
        reject(error);
      }
    }
  );
}

export async function updateAudit_lastWebsiteLogin(auditDateTime, username) {
  const userData = new UserGetter();
  const userAudit = await userData.byUsername(username);

  db.query(
    `UPDATE users SET audit_lastWebsiteLogin=? WHERE userId=?;`,
    [auditDateTime, userAudit.userId],
    function (error, results, fields) {
      if (error) {
        reject(error);
      }
    }
  );
}

export async function updateAudit_lastDiscordMessage(auditDateTime, discordId) {
  const userData = new UserGetter();
  const userAudit = await userData.byDiscordId(discordId);
  
  if (!userAudit) {
    db.query(
      `UPDATE users SET audit_lastDiscordMessage=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error, results, fields) {
        if (error) {
          reject(error);
        }
      }
    );

    console.log(`Discord account for this user is not linked, chat audit ignored.`);
  }
}

export async function updateAudit_lastDiscordVoice(auditDateTime, discordId) {
  const userData = new UserGetter();
  const userAudit = await userData.byDiscordId(discordId);

  if (!userAudit) {
    db.query(
      `UPDATE users SET audit_lastDiscordVoice=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error, results, fields) {
        if (error) {
          reject(error);
        }
      }
    );

    console.log(`Discord account for this user is not linked, chat audit ignored.`);    
  }
}