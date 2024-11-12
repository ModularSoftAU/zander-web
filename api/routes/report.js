import { MessageBuilder, Webhook } from "discord-webhook-node";
import { isFeatureEnabled, required, optional, setBannerCookie } from "../common";
import { Colors } from "discord.js";

export default function reportApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/report";

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.report, res, lang);
    const reportedId = optional(req.query, "reportedId");

    try {
      function getReports(dbQuery) {
        return new Promise((resolve, reject) => {
          db.query(dbQuery, function (error, results, fields) {
            if (error) {
              console.error(error);
              reject(error);
            } else {
              if (!results.length) {
                res.send({
                  success: false,
                  message: `There are no reports available.`,
                });
              } else {
                res.send({
                  success: true,
                  data: results,
                });
              }
              resolve();
            }
          });
        });
      }
      
      // Get Reports by user
      if (reportedId) {
        let dbQuery = `SELECT * FROM reports WHERE reportedId=${reportedId};`;
        await getReports(dbQuery);
      }

      // Return all reports by default
      let dbQuery = `SELECT * FROM reports;`;
      await getReports(dbQuery);
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.report, res, lang);

    const reporterUser = required(req.body, "reporterUser", res);
    const reportedUser = required(req.body, "reportedUser", res);
    const reportReason = required(req.body, "reportReason", res);
    const reportReasonEvidence = optional(
      req.body,
      "reportReasonEvidence",
      res
    );
    const reportPlatform = required(req.body, "reportPlatform", res);

    try {
      db.query(
        `
        INSERT INTO 
            reports
        (
            reporterId,
            reportedUser,
            reportReason,
            reportReasonEvidence,
            reportPlatform
        ) VALUES ((SELECT userId FROM users WHERE username=?), ?, ?, ?, ?)`,
        [
          reporterUser,
          reportedUser,
          reportReason,
          reportReasonEvidence,
          reportPlatform,
        ],
        function (error, results, fields) {
          console.log(req.body);
          
          if (error) {
            console.log(error);
            console.log(results);
            
            return res.send({
              success: false,
              message: `Report has failed, please try again later.`,
            });
          } else {
            setBannerCookie("success", "Report has been sent.", res);

            try {
              const staffChannelHook = new Webhook(
                config.discord.webhooks.staffChannel
              );

              const embed = new MessageBuilder()
                .setTitle(`New Report: ${reportedUser}`)
                .addField("Report Platform", reportPlatform, true)
                .addField("Report By", reporterUser, true)
                .addField("Report Reason", reportReason)
                .setColor(Colors.Red)
                .setTimestamp();

              if (reportReasonEvidence) {
                embed.addField("Report Evidence", reportReasonEvidence);
              }

              staffChannelHook.send(embed);
            } catch (error) {
              return res.send({
                success: false,
                message: `${error}`,
              });
            }

            return res.send({
              success: true,
              message: `Thanks for your submission: ${reportedUser} for ${reportReason}.`,
            });
          }
        }
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
