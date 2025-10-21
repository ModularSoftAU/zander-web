import cron from "node-cron";
import { Colors, EmbedBuilder, WebhookClient } from "discord.js";
import { createRequire } from "module";
import db from "../controllers/databaseController.js";

const require = createRequire(import.meta.url);
const config = require("../config.json");

const REPORT_SCHEDULE = "0 12 * * 1"; // Every Monday at 12:00 server time

function formatAuditValue(value) {
  if (!value) {
    return "No record";
  }

  const timestamp = Math.floor(new Date(value).getTime() / 1000);
  if (!Number.isFinite(timestamp)) {
    return "No record";
  }

  return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
}

async function fetchStaffAuditRows() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT
        u.userId,
        u.username,
        u.discordId,
        u.audit_lastDiscordMessage,
        u.audit_lastDiscordVoice,
        u.audit_lastMinecraftLogin,
        u.audit_lastMinecraftMessage,
        u.audit_lastMinecraftPunishment,
        u.audit_lastDiscordPunishment,
        u.audit_lastWebsiteLogin,
        GROUP_CONCAT(DISTINCT r.displayName ORDER BY CAST(r.priority AS UNSIGNED) DESC SEPARATOR ', ') AS staffRanks
      FROM users u
      JOIN userRanks ur ON ur.userId = u.userId
      JOIN ranks r ON r.rankSlug = ur.rankSlug
      WHERE r.isStaff = '1' AND u.account_disabled = 0
      GROUP BY u.userId
      ORDER BY u.username;`,
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(results || []);
      }
    );
  });
}

const staffAuditReportTask = cron.schedule(REPORT_SCHEDULE, async () => {
  try {
    const webhookUrl = config?.discord?.webhooks?.staffAuditLog;
    if (!webhookUrl) {
      console.warn(
        "Staff audit report skipped: config.discord.webhooks.staffAuditLog is not configured."
      );
      return;
    }

    const staffAuditRows = await fetchStaffAuditRows();

    if (!staffAuditRows.length) {
      console.warn("Staff audit report skipped: no staff members found.");
      return;
    }

    const sections = staffAuditRows.map((member) => {
      const headerParts = [`**${member.username}**`];

      if (member.staffRanks) {
        headerParts.push(`_${member.staffRanks}_`);
      }

      if (member.discordId) {
        headerParts.push(`<@${member.discordId}>`);
      }

      const details = [
        `• Discord Message: ${formatAuditValue(member.audit_lastDiscordMessage)}`,
        `• Discord Voice: ${formatAuditValue(member.audit_lastDiscordVoice)}`,
        `• Minecraft Login: ${formatAuditValue(member.audit_lastMinecraftLogin)}`,
        `• Minecraft Message: ${formatAuditValue(member.audit_lastMinecraftMessage)}`,
        `• Minecraft Punishment: ${formatAuditValue(member.audit_lastMinecraftPunishment)}`,
        `• Discord Punishment: ${formatAuditValue(member.audit_lastDiscordPunishment)}`,
        `• Website Login: ${formatAuditValue(member.audit_lastWebsiteLogin)}`,
      ];

      return [headerParts.join(" "), ...details].join("\n");
    });

    const MAX_FIELD_LENGTH = 1024;
    const fieldValues = [];
    let buffer = "";

    sections.forEach((section) => {
      const candidate = buffer ? `${buffer}\n\n${section}` : section;

      if (candidate.length > MAX_FIELD_LENGTH) {
        if (buffer) {
          fieldValues.push(buffer);
        }

        if (section.length > MAX_FIELD_LENGTH) {
          const lines = section.split("\n");
          let chunk = "";

          lines.forEach((line) => {
            const chunkCandidate = chunk ? `${chunk}\n${line}` : line;

            if (chunkCandidate.length > MAX_FIELD_LENGTH) {
              if (chunk) {
                fieldValues.push(chunk);
              }

              if (line.length > MAX_FIELD_LENGTH) {
                const forcedChunks = line.match(/.{1,900}/g) || [line];
                forcedChunks.forEach((forcedChunk) => fieldValues.push(forcedChunk));
                chunk = "";
              } else {
                chunk = line;
              }
            } else {
              chunk = chunkCandidate;
            }
          });

          if (chunk) {
            fieldValues.push(chunk);
          }

          buffer = "";
        } else {
          fieldValues.push(section);
          buffer = "";
        }
      } else {
        buffer = candidate;
      }
    });

    if (buffer) {
      fieldValues.push(buffer);
    }

    if (!fieldValues.length) {
      fieldValues.push("No audit data was available for staff members.");
    }

    const embed = new EmbedBuilder()
      .setTitle("Weekly Staff Activity Audit")
      .setColor(Colors.Blurple)
      .setTimestamp(new Date());

    fieldValues.slice(0, 25).forEach((value, index) => {
      embed.addFields({
        name: `Staff Activity ${index + 1}`,
        value,
        inline: false,
      });
    });

    let footerText = `Total staff members reported: ${staffAuditRows.length}`;
    if (fieldValues.length > 25) {
      footerText = `Showing 25 of ${fieldValues.length} sections (total staff: ${staffAuditRows.length}).`;
    }

    embed.setFooter({ text: footerText });

    const webhookClient = new WebhookClient({ url: webhookUrl });
    await webhookClient.send({ embeds: [embed] });
    webhookClient.destroy?.();
    console.log(
      `Posted weekly staff audit report (${staffAuditRows.length} staff members, ${fieldValues.length} sections).`
    );
  } catch (error) {
    console.error("Failed to generate staff audit report:", error);
  }
});

staffAuditReportTask.start();
