import { getMonthlyRevenue } from "../../controllers/tebexController.js";
import config from "../../config.json" assert { type: "json" };

export default function giveApiRoute(app) {
  app.get("/api/give/goal", async function (req, res) {
    try {
      const monthlyRevenue = await getMonthlyRevenue();
      const monthlyGoal = config.siteConfiguration.monthlyOperationsGoal;
      const percentage = Math.round((monthlyRevenue / monthlyGoal) * 100);

      res.send({
        success: true,
        current: monthlyRevenue,
        goal: monthlyGoal,
        percentage: percentage,
      });
    } catch (error) {
      console.error("Error fetching monthly revenue:", error);
      res.status(500).send({
        success: false,
        message: "An error occurred while fetching the monthly goal.",
      });
    }
  });
}
