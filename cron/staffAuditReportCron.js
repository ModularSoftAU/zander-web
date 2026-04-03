import cron from "node-cron";
import { Colors, EmbedBuilder } from "discord.js";
import { createRequire } from "module";
import db from "../controllers/databaseController.js";
import { client } from "../controllers/discordController.js";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

const DAY_MAP = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function buildCronExpression() {
  const auditConfig = config.staffAuditReport;
  if (!auditConfig) return null;

  const day = DAY_MAP[(auditConfig.dayOfWeek || "monday").toLowerCase()];
  if (day === undefined) {
    console.error(
      `Staff audit report: invalid dayOfWeek "${auditConfig.dayOfWeek}". Use Monday-Sunday.`
    );
    return null;
  }

  const timeParts = (auditConfig.time || "12:00").split(":");
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);

  if (
    isNaN(hour) || isNaN(minute) ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) {
    console.error(
      `Staff audit report: invalid time "${auditConfig.time}". Use HH:MM format.`
    );
    return null;
  }

  return `${minute} ${hour} * * ${day}`;
}

function formatAuditTimestamp(value) {
  if (!value) return "No record";

  const timestamp = Math.floor(new Date(value).getTime() / 1000);
  if (!Number.isFinite(timestamp)) return "No record";

  return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
}

function buildMemberSection(member) {
  const lines = [];

  // Header: username + Discord mention
  const headerParts = [`**${member.username}**`];
  if (member.discordId) {
    headerParts.push(`<@${member.discordId}>`);
  }
  lines.push(headerParts.join(" "));

  // Account linkage status
  const mcLinked = member.uuid ? "✅ Linked" : "❌ Not linked";
  const discordLinked = member.discordId ? "✅ Linked" : "❌ Not linked";
  lines.push(`__Account Linkage:__ Minecraft: ${mcLinked} · Discord: ${discordLinked}`);

  // Minecraft activity
  lines.push("");
  lines.push("**Minecraft**");
  if (member.uuid) {
    lines.push(`• Last Login: ${formatAuditTimestamp(member.audit_lastMinecraftLogin)}`);
    lines.push(`• Last Message: ${formatAuditTimestamp(member.audit_lastMinecraftMessage)}`);
    lines.push(`• Punishments: _Feature coming soon_`);
  } else {
    lines.push(`• _Account not linked — activity cannot be tracked_`);
  }

  // Discord activity
  lines.push("");
  lines.push("**Discord**");
  if (member.discordId) {
    lines.push(`• Last Message: ${formatAuditTimestamp(member.audit_lastDiscordMessage)}`);
    lines.push(`• Last Voice: ${formatAuditTimestamp(member.audit_lastDiscordVoice)}`);
    lines.push(`• Punishments: _Feature coming soon_`);
  } else {
    lines.push(`• _Account not linked — activity cannot be tracked_`);
  }

  // Website activity
  lines.push("");
  lines.push("**Website**");
  lines.push(`• Last Login: ${formatAuditTimestamp(member.audit_lastWebsiteLogin)}`);

  return lines.join("\n");
}

async function fetchActiveStaff() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT
        u.userId,
        u.username,
        u.uuid,
        u.discordId,
        u.audit_lastDiscordMessage,
        u.audit_lastDiscordVoice,
        u.audit_lastMinecraftLogin,
        u.audit_lastMinecraftMessage,
        u.audit_lastMinecraftPunishment,
        u.audit_lastDiscordPunishment,
        u.audit_lastWebsiteLogin
      FROM users u
      JOIN userRanks ur ON ur.userId = u.userId
      JOIN ranks r ON r.rankSlug = ur.rankSlug
      WHERE r.isStaff = '1'
        AND ur.rankSlug != 'retired'
        AND u.account_disabled = 0
      GROUP BY u.userId
      ORDER BY u.username;`,
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
}

function packIntoFields(sections) {
  const MAX_FIELD_LENGTH = 1024;
  const fields = [];
  let buffer = "";

  for (const section of sections) {
    const candidate = buffer ? `${buffer}\n\n${section}` : section;

    if (candidate.length > MAX_FIELD_LENGTH) {
      if (buffer) fields.push(buffer);

      if (section.length > MAX_FIELD_LENGTH) {
        // Split oversized section by lines
        let chunk = "";
        for (const line of section.split("\n")) {
          const lineCandidate = chunk ? `${chunk}\n${line}` : line;
          if (lineCandidate.length > MAX_FIELD_LENGTH) {
            if (chunk) fields.push(chunk);
            chunk = line.length > MAX_FIELD_LENGTH ? line.slice(0, MAX_FIELD_LENGTH) : line;
          } else {
            chunk = lineCandidate;
          }
        }
        if (chunk) fields.push(chunk);
        buffer = "";
      } else {
        buffer = section;
      }
    } else {
      buffer = candidate;
    }
  }

  if (buffer) fields.push(buffer);
  return fields;
}

export async function runStaffAuditReport() {
  // Check feature flag
  if (!features.staffAuditReport) {
    return { sent: false, reason: "Feature is disabled." };
  }

  const auditConfig = config.staffAuditReport;
  if (!auditConfig?.enabled) {
    return { sent: false, reason: "Staff audit report is not enabled in config." };
  }

  // Support both flat channelId and legacy delivery.channelId
  const channelId = auditConfig.channelId || auditConfig.delivery?.channelId;
  if (!channelId) {
    console.warn("Staff audit report skipped: no channelId configured.");
    return { sent: false, reason: "No `channelId` is configured for the staff audit report." };
  }

  // Fetch staff data
  const staffMembers = await fetchActiveStaff();

  if (!staffMembers.length) {
    console.warn("Staff audit report skipped: no active staff members found.");
    return { sent: false, reason: "No active staff members were found." };
  }

  // Build per-member sections
  const sections = staffMembers.map(buildMemberSection);
  const fieldValues = packIntoFields(sections);

  if (!fieldValues.length) {
    fieldValues.push("No audit data was available for staff members.");
  }

  // Discord embeds have a max of 25 fields and 6000 chars total
  // Split into multiple embeds if needed
  const embeds = [];
  let currentEmbed = new EmbedBuilder()
    .setTitle("Weekly Staff Activity Audit")
    .setColor(Colors.Blurple)
    .setTimestamp(new Date());

  let fieldCount = 0;
  let embedIndex = 1;

  for (let i = 0; i < fieldValues.length; i++) {
    if (fieldCount >= 25) {
      embeds.push(currentEmbed);
      embedIndex++;
      currentEmbed = new EmbedBuilder()
        .setTitle(`Weekly Staff Activity Audit (cont. ${embedIndex})`)
        .setColor(Colors.Blurple)
        .setTimestamp(new Date());
      fieldCount = 0;
    }

    currentEmbed.addFields({
      name: fieldCount === 0 && embedIndex === 1 ? "Staff Activity" : "\u200b",
      value: fieldValues[i],
      inline: false,
    });
    fieldCount++;
  }

  const timezone = auditConfig.timezone || "UTC";
  currentEmbed.setFooter({
    text: `Total active staff: ${staffMembers.length} · Schedule: ${auditConfig.dayOfWeek || "Monday"} ${auditConfig.time || "12:00"} ${timezone}`,
  });
  embeds.push(currentEmbed);

  const channel = await client.channels.fetch(channelId);
  for (const embed of embeds) {
    await channel.send({ embeds: [embed] });
  }

  console.log(
    `Posted weekly staff audit report (${staffMembers.length} staff members, ${embeds.length} embed(s)).`
  );

  return { sent: true, staffCount: staffMembers.length, embedCount: embeds.length };
}

// Build schedule from config
const cronExpression = buildCronExpression();

if (cronExpression) {
  let timezone = config.staffAuditReport?.timezone || "UTC";

  // Validate the timezone is a valid IANA identifier
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    console.warn(
      `Invalid timezone "${timezone}" in staffAuditReport config. Falling back to UTC. Use IANA timezone names like "Australia/Sydney" instead of abbreviations like "AEDT".`
    );
    timezone = "UTC";
  }

  const staffAuditReportTask = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runStaffAuditReport();
      } catch (error) {
        console.error("Failed to generate staff audit report:", error);
      }
    },
    { timezone }
  );

  staffAuditReportTask.start();

  console.log(
    `Staff audit report scheduled: "${cronExpression}" (${config.staffAuditReport?.dayOfWeek} ${config.staffAuditReport?.time} ${timezone})`
  );
} else if (config.staffAuditReport?.enabled && features.staffAuditReport) {
  console.warn(
    "Staff audit report is enabled but could not build a valid cron schedule. Check config.staffAuditReport settings."
  );
}
