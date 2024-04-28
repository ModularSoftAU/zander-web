import { isFeatureEnabled, required, optional, generateLog } from "../common";

export default function formApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/form";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);
    const formId = optional(req.query, "id");

    try {
      function getForms(dbQuery) {
        db.query(dbQuery, function (error, results, fields) {
          if (error) {
            res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results.length) {
            return res.send({
              success: false,
              message: `lang.applications.noFormsFound`,
            });
          }

          return res.send({
            success: true,
            data: results,
          });
        });
      }

      // Get Form by ID
      if (formId) {
        let dbQuery = `SELECT * FROM forms WHERE formId=${formId};`;
        getForms(dbQuery);
      }

      // Return all Forms by default
      let dbQuery = `SELECT * FROM forms;`;
      getForms(dbQuery);
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const displayName = required(req.body, "displayName", res);
    const description = required(req.body, "description", res);
    const formType = required(req.body, "formType", res);
    const formSchema = optional(req.body, "formSchema", res);
    const formRedirectUrl = required(req.body, "formRedirectUrl", res);
    const formStatus = required(req.body, "formStatus", res);

    try {
      db.query(
        `INSERT INTO forms 
            (displayName, description, formType, formSchema, formRedirectUrl, formStatus) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          displayName,
          description,
          formType,
          formSchema,
          formRedirectUrl,
          formStatus,
        ],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "SUCCESS",
            "FORM",
            `Created ${displayName}`,
            res
          );

          return res.send({
            success: true,
            message: `${displayName} form created`
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

  app.post(baseEndpoint + "/edit", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const formId = required(req.body, "formId", res);
    const displayName = required(req.body, "displayName", res);
    const description = required(req.body, "description", res);
    const formType = required(req.body, "formType", res);
    const formSchema = optional(req.body, "formSchema", res);
    const formRedirectUrl = required(req.body, "formRedirectUrl", res);
    const formStatus = required(req.body, "formStatus", res);

    try {
      db.query(
        `
                UPDATE 
                    forms 
                SET 
                    displayName=?, 
                    description=?, 
                    formType=?, 
                    formSchema=?, 
                    formRedirectUrl=?, 
                    formStatus=?
                WHERE formId=?;`,
        [
          displayName,
          description,
          formType,
          formSchema,
          formRedirectUrl,
          formStatus,
          formId,
        ],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "SUCCESS",
            "FORM",
            `Edited ${displayName}`,
            res
          );

          return res.send({
            success: true,
            message: `Form ${displayName} edited`,
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

  app.post(baseEndpoint + "/delete", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const formId = required(req.body, "formId", res);

    try {
      db.query(
        `DELETE FROM forms WHERE formId=?;`,
        [formId],
        function (error, results, fields) {
          if (error) {
            res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "WARNING",
            "FORM",
            `Deleted ${formId}`,
            res
          );

          return res.send({
            success: true,
            message: `Deletion of form with the id ${formId} has been successful`,
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
