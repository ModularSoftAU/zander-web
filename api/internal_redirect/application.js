import { hasPermission, postAPIRequest, setBannerCookie } from "../common.js";
import fetch from "node-fetch";

function extractEligibilityRules(body) {
  return {
    minimum_playtime_hours: body.eligibility_minimum_playtime_hours
      ? parseInt(body.eligibility_minimum_playtime_hours, 10)
      : null,
    block_if_currently_banned: body.eligibility_block_if_currently_banned === "1",
    block_if_ever_banned: body.eligibility_block_if_ever_banned === "1",
    punishment_lookback_months: body.eligibility_punishment_lookback_months
      ? parseInt(body.eligibility_punishment_lookback_months, 10)
      : null,
    max_punishments_in_lookback: body.eligibility_max_punishments_in_lookback !== undefined &&
      body.eligibility_max_punishments_in_lookback !== ""
      ? parseInt(body.eligibility_max_punishments_in_lookback, 10)
      : null,
    block_if_banned_on_any_platform: body.eligibility_block_if_banned_on_any_platform === "1",
    require_discord_activity: body.eligibility_require_discord_activity === "1",
    discord_activity_lookback_days: body.eligibility_discord_activity_lookback_days
      ? parseInt(body.eligibility_discord_activity_lookback_days, 10)
      : null,
    minimum_discord_messages: body.eligibility_minimum_discord_messages
      ? parseInt(body.eligibility_minimum_discord_messages, 10)
      : null,
  };
}

async function saveEligibilityRulesViaApi(applicationId, rules, actioningUser) {
  try {
    const response = await fetch(
      `${process.env.siteAddress}/api/application/eligibility/rules`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": process.env.apiKey,
        },
        body: JSON.stringify({
          actioningUser,
          applicationId,
          ...rules,
        }),
      }
    );
    const data = await response.json();
    if (!data.success) {
      console.error("[ApplicationRedirect] Failed to save eligibility rules:", data.message);
    }
  } catch (err) {
    console.error("[ApplicationRedirect] Error saving eligibility rules:", err);
  }
}

export default function applicationRedirectRoute(app, config, lang, features) {
  const baseEndpoint = "/redirect/applications";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!(await hasPermission("zander.web.application", req, res, features))) return;

    req.body.actioningUser = req.session.user.userId;

    // Capture eligibility rules before the API call consumes the body
    const eligibilityRules = extractEligibilityRules(req.body);

    const apiUrl = `${process.env.siteAddress}/api/application/create`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": process.env.apiKey,
      },
      body: JSON.stringify(req.body),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      setBannerCookie("danger", "Unexpected response from the server.", res);
      return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    }

    if (data.alertType) {
      setBannerCookie(data.alertType, data.alertContent, res);
    }

    if (!data.success) {
      return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    }

    // After creating the application, save eligibility rules if any are configured
    // We need the new applicationId — query the most recently inserted application for this user
    try {
      const listResponse = await fetch(
        `${process.env.siteAddress}/api/application/get`,
        { headers: { "x-access-token": process.env.apiKey } }
      );
      const listData = await listResponse.json();
      if (listData.success && Array.isArray(listData.data) && listData.data.length) {
        const sorted = listData.data.slice().sort((a, b) => b.applicationId - a.applicationId);
        const newApplication = sorted[0];
        if (newApplication) {
          await saveEligibilityRulesViaApi(
            newApplication.applicationId,
            eligibilityRules,
            req.session.user.userId
          );
        }
      }
    } catch (err) {
      console.error("[ApplicationRedirect] Could not fetch new applicationId for rules:", err);
    }

    return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!(await hasPermission("zander.web.application", req, res, features))) return;

    req.body.actioningUser = req.session.user.userId;
    const applicationId = req.body.applicationId;
    const eligibilityRules = extractEligibilityRules(req.body);

    await postAPIRequest(
      `${process.env.siteAddress}/api/application/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/applications`,
      res
    );

    // Save eligibility rules regardless of whether the response has been sent
    if (applicationId) {
      await saveEligibilityRulesViaApi(applicationId, eligibilityRules, req.session.user.userId);
    }

    if (!res.sent) {
      return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    }
    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!(await hasPermission("zander.web.application", req, res, features))) return;

    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/application/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/applications`,
      res
    );

    if (!res.sent) {
      return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    }
    return res;
  });
}
