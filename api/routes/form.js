import { isFeatureEnabled, required, optional, generateLog, setBannerCookie } from "../common";

export default function formApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/form";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);
    const formId = optional(req.query, "id");
    const formSlug = optional(req.query, "slug");

    try {
      function getForms(dbQuery) {
        db.query(dbQuery, function (error, results, fields) {
          if (error) {
            res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results) {
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

      // Get Form by Slug
      if (formSlug) {
        let dbQuery = `SELECT * FROM forms WHERE formSlug='${formSlug}';`;
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
    const formSlug = required(req.body, "formSlug", res);
    const displayName = required(req.body, "displayName", res);
    const formSchema = required(req.body, "formSchema", res);
    const formStatus = required(req.body, "formStatus", res);

    try {
      db.query(
        `INSERT INTO forms 
            (formSlug, displayName, formSchema, formStatus) 
        VALUES (?, ?, ?, ?)`,
        [
          formSlug,
          displayName,
          formSchema,
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
            message: `${displayName} form created`,
          });
        }
      );
    } catch (error) {
      console.log(error);

      return res.send({
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
    const formSlug = required(req.body, "formSlug", res);
    const displayName = required(req.body, "displayName", res);
    const formSchema = optional(req.body, "formSchema", res);
    const formStatus = required(req.body, "formStatus", res);

    try {
      db.query(
        `
                UPDATE 
                    forms 
                SET 
                    formSlug=?,
                    displayName=?, 
                    formSchema=?, 
                    formStatus=?
                WHERE formId=?;`,
        [
          formSlug,
          displayName,
          formSchema,
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
      console.log(error);
      
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

  app.post(baseEndpoint + "/:formSlug/submit", async function (req, res) {
    // Check if the feature is enabled
    isFeatureEnabled(features.forms, res, lang);

    const formSlug = optional(req.query, "formSlug");

    //
    // Grab form data
    //
    const fetchURL = `${process.env.siteAddress}/api/form/get?slug=${formSlug}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const formApiData = await response.json();
    let formSchemaData = null;

    if (formApiData.data[0].formSchema) {
      //
      // Grab form schema data
      //
      const schemaFetchURL = `${formApiData.data[0].formSchema}`;
      const schemaResponse = await fetch(schemaFetchURL);
      const formSchemaJSONData = await schemaResponse.json();

      formSchemaData = formSchemaJSONData;
    }

    // Set a success banner cookie
    setBannerCookie("success", `Application Submitted`, res);

    // Log the incoming request body for debugging
    console.log("Request Body:", req.body);

    // Ensure formSchemaData is valid before proceeding
    if (!formSchemaData || !formSchemaData.sections) {
      console.error("Invalid form schema data");
      return res.status(400).json({
        success: false,
        message: "Invalid form schema",
      });
    }

    const formData = req.body; // This contains the submitted answers
    let result = [];

    // Process each section and prompt to map answers to questions
    formSchemaData.sections.forEach((section, sectionIndex) => {
      section.prompts.forEach((prompt, promptIndex) => {
        // Generate the key based on the formSlug, section index, and prompt index
        const elementName = `${formSlug}_${sectionIndex}_${promptIndex}`;
        const promptText = prompt.display;
        const answer = formData[elementName];

        if (answer) {
          // Add the question-answer pair to the result array
          result.push({
            question: promptText,
            answer: answer,
          });
        }
      });
    });

    // Log the results to check the question-answer pairs
    console.log("Processed Form Data:", result);

    // Send the response with the mapped question-answer pairs
    try {
      return res.json({
        success: true,
        message: "Form submitted successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error sending JSON response:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });
}
