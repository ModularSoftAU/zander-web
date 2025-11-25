import config from "../config.json" assert { type: "json" };
import fetch from "node-fetch";

/**
 * Fetches the current month's revenue from the Tebex API.
 *
 * @returns {Promise<number>} The total revenue for the current month.
 */
export async function getMonthlyRevenue() {
  // --- Mocked Data ---
  // This function currently returns a randomized value for demonstration purposes.
  // To implement live data, replace the mocked section with a real API call to Tebex.
  //
  // Example using the Tebex API:
  //
  // const response = await fetch("https://plugin.tebex.io/analytics/payments", {
  //   headers: {
  //     "X-Tebex-Secret": config.tebex.secretKey,
  //     "Content-Type": "application/json"
  //   }
  // });
  // const data = await response.json();
  //
  // // You would then need to process the data to get the current month's revenue.
  // // This is a simplified example and might need to be adjusted based on the
  // // actual structure of the Tebex API response.
  //
  // return data.totals.current_month;

  // Mocked implementation: returns a random value between 30 and 90.
  const mockedRevenue = Math.floor(Math.random() * (90 - 30 + 1)) + 30;
  return Promise.resolve(mockedRevenue);
}
