import { Listener } from "@sapphire/framework";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");
import { checkAndReportNickname } from "../lib/discord/nicknameCheck.mjs";

export class GuildMemberAddListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "guildMemberAdd",
    });
  }

  async run(member) {
    if (!features.discord?.events?.nicknameCheck) return;
    if (member.user.bot) return;

    const reportChannelId = config.discord?.nicknameReportChannelId;
    if (!reportChannelId) return;

    // Only enforce if they already have a linked account (e.g. re-joiners)
    await checkAndReportNickname(member, reportChannelId, "Member Joined");
  }
}
