import db from "./databaseController.js";
import { UserGetter } from "./userController.js";

export async function updateAudit_lastMinecraftLogin(auditDateTime, username) {
  const userData = new UserGetter();
  const userAudit = await userData.byUsername(username);

  // If user has not joined the network before, do not process audit request.
  if (userAudit) {
    db.query(
      `UPDATE users SET audit_lastMinecraftLogin=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error) {
        if (error) {
          console.error("Failed to update Minecraft login audit:", error);
        }
      }
    );
  }
}

export async function updateAudit_lastMinecraftMessage(auditDateTime, username) {
  const userData = new UserGetter();
  const userAudit = await userData.byUsername(username);

  if (userAudit) {
    db.query(
      `UPDATE users SET audit_lastMinecraftMessage=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error) {
        if (error) {
          console.error("Failed to update Minecraft message audit:", error);
        }
      }
    );
  }
}

export async function updateAudit_lastWebsiteLogin(auditDateTime, username) {
  const userData = new UserGetter();
  const userAudit = await userData.byUsername(username);

  if (userAudit) {
    db.query(
      `UPDATE users SET audit_lastWebsiteLogin=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error) {
        if (error) {
          console.error("Failed to update website login audit:", error);
        }
      }
    );
  }
}

export async function updateAudit_lastDiscordMessage(auditDateTime, discordId) {
  const userData = new UserGetter();
  const userAudit = await userData.byDiscordId(discordId);

  if (userAudit) {
    db.query(
      `UPDATE users SET audit_lastDiscordMessage=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error) {
        if (error) {
          console.error("Failed to update Discord message audit:", error);
        }
      }
    );
  } else {
    console.warn(`Discord account for this user is not linked, chat audit ignored.`);
  }
}

export async function updateAudit_lastDiscordVoice(auditDateTime, discordId) {
  const userData = new UserGetter();
  const userAudit = await userData.byDiscordId(discordId);

  if (userAudit) {
    db.query(
      `UPDATE users SET audit_lastDiscordVoice=? WHERE userId=?;`,
      [auditDateTime, userAudit.userId],
      function (error) {
        if (error) {
          console.error("Failed to update Discord voice audit:", error);
        }
      }
    );
  } else {
    console.warn(`Discord account for this user is not linked, chat audit ignored.`);
  }
}