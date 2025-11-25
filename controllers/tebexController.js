import fetch from "node-fetch";

/**
 * Fetches the current month's revenue from the Tebex API.
 *
 * @returns {Promise<number>} The total revenue for the current month.
 */
export async function getMonthlyRevenue() {
  const response = await fetch("https://plugin.tebex.io/analytics/payments", {
    headers: {
      "X-Tebex-Secret": process.env.TEBEX_SECRET_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Tebex API returned status: ${response.status}`);
  }

  const data = await response.json();

  // Assuming the API returns a structure like { totals: { current_month: 123.45 } }
  // You may need to adjust this based on the actual API response.
  return data.totals.current_month || 0;
}
