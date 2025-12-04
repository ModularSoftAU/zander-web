import { sendCrashReport } from "../../controllers/crashReportController.js";
import { optional } from "../common.js";

export default function crashReportApiRoute(app, config, features, lang) {
  const baseEndpoint = "/api/crash-report";

  app.post(baseEndpoint, async function (req, res) {
    if (features?.crashReports === false) {
      return res.send({
        success: false,
        message: lang.api.featureDisabled,
      });
    }

    const summary = optional(req.body, "summary");
    const errorMessage = optional(req.body, "errorMessage");
    const errorStack = optional(req.body, "errorStack");
    const statusCode = optional(req.body, "statusCode");
    const pageUrl = optional(req.body, "pageUrl");

    try {
      const webhookSent = await sendCrashReport({
        config,
        context: "user-submitted",
        errorMessage,
        errorStack,
        statusCode,
        pageUrl,
        request: req,
        userNote: summary,
      });

      if (!webhookSent) {
        return res.send({
          success: false,
          message:
            "Crash reporting is temporarily unavailable. Please try again later.",
        });
      }

      return res.send({
        success: true,
        message: "Crash report sent. Thank you for the details!",
      });
    } catch (error) {
      req.log?.error(error);
      return res.send({
        success: false,
        message: "We couldn't send the crash report right now.",
      });
    }
  });
}
