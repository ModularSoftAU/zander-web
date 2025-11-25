import { getMonthlySupportProgress } from "../../controllers/supportController.js";

export default function supportApiRoute(app, config) {
  const baseEndpoint = "/api/support";

  app.get(baseEndpoint + "/monthly-progress", async function (req, res) {
    try {
      if (!process.env.tebexApiSecret) {
        return res.send({
          success: false,
          message: "Tebex API secret is not configured.",
        });
      }

      const monthlyOperationsBudget = config?.finance?.monthlyOperationsBudget || 0;
      const monthlyProgress = await getMonthlySupportProgress(
        process.env.tebexApiSecret,
        monthlyOperationsBudget
      );

      return res.send({
        success: true,
        data: monthlyProgress,
      });
    } catch (error) {
      console.error("Error fetching support progress", error);
      return res.send({
        success: false,
        message: "Unable to retrieve support progress at this time.",
      });
    }
  });
}
