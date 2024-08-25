import { isFeatureEnabled, required, optional, generateLog } from "../common";

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

    const reportedUser = required(req.body, "reportedUser", res);
    const reporterUser = required(req.body, "reporterUser", res);
    const reportReason = required(req.body, "reportReason", res);
    const reportReasonEvidence = optional(
      req.body,
      "reportReasonEvidence",
      res
    );

    try {
      db.query(
        `
        INSERT INTO 
            reports
        (
            reporterId,
            reportedId,
            reportReason,
            reportReasonEvidence
        ) VALUES (?, ?, ?, ?)`,
        [reportedUser, reporterUser, reportReason, reportReasonEvidence],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: `Report for ${reportReason} has been submitted.`,
          });
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
