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


function buildMemberField(member) {
  const ts = (val) => {
    if (!val) return "_No record_";
    const t = Math.floor(new Date(val).getTime() / 1000);
    return Number.isFinite(t) ? `<t:${t}:R>` : "_No record_";
  };

  const lines = [];

  // Account linkage — uuid is always present (sourced from LP),
  // but audit data only exists if the member is on the website (userId set).
  const websiteLinked = !!member.userId;
  const discordLinked = !!member.discordId;
  const discordStatus = discordLinked ? `✅ <@${member.discordId}>` : "❌ Discord not linked";
  lines.push(`${discordStatus}`);

  // Minecraft — always in LP, but activity only tracked if website-registered
  if (websiteLinked) {
    lines.push(`**Minecraft** — Login: ${ts(member.audit_lastMinecraftLogin)} · Chat: ${ts(member.audit_lastMinecraftMessage)}`);
  } else {
    lines.push("**Minecraft** — _not registered on website_");
  }

  // Discord
  if (discordLinked) {
    lines.push(`**Discord** — Chat: ${ts(member.audit_lastDiscordMessage)} · Voice: ${ts(member.audit_lastDiscordVoice)}`);
  } else {
    lines.push("**Discord** — _not linked_");
  }

  // Website
  lines.push(`**Website** — Login: ${websiteLinked ? ts(member.audit_lastWebsiteLogin) : "_not registered_"}`);

  return lines.join("\n");
}

async function fetchActiveStaff() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT
        ur.uuid,
        COALESCE(u.username, lp.username) AS username,
        u.userId,
        u.discordId,
        u.audit_lastDiscordMessage,
        u.audit_lastDiscordVoice,
        u.audit_lastMinecraftLogin,
        u.audit_lastMinecraftMessage,
        u.audit_lastWebsiteLogin
      FROM userRanks ur
      JOIN ranks r ON r.rankSlug = ur.rankSlug
      LEFT JOIN users u ON u.userId = ur.userId
      LEFT JOIN cfcdev_luckperms.luckperms_players lp ON lp.uuid = ur.uuid
      WHERE r.isStaff = '1'
        AND ur.rankSlug != 'retired'
        AND (u.account_disabled IS NULL OR u.account_disabled = 0)
      GROUP BY ur.uuid
      ORDER BY COALESCE(u.username, lp.username);`,
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
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

  // Each member gets their own named field. Discord allows max 25 fields per
  // embed, so split into multiple embeds if there are more than 25 staff.
  const embeds = [];
  let embedIndex = 1;
  let currentEmbed = new EmbedBuilder()
    .setTitle("Weekly Staff Activity Audit")
    .setColor(Colors.Blurple)
    .setTimestamp(new Date());
  let fieldCount = 0;

  for (const member of staffMembers) {
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
      name: member.username,
      value: buildMemberField(member),
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
