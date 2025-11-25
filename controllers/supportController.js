import fetch from "node-fetch";

const TEBEX_PAYMENTS_URL = "https://plugin.tebex.io/payments";

function getMonthBoundaries(currentDate = new Date()) {
  const startOfMonth = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));
  const startOfNextMonth = new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1)
  );

  return { startOfMonth, startOfNextMonth };
}

function extractPayments(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.payments)) return payload.payments;

  return [];
}

function parsePaymentDate(payment) {
  const possibleDateKeys = ["date", "time", "created_at", "completed_at", "created"];

  for (const key of possibleDateKeys) {
    if (payment[key]) {
      const parsedDate = new Date(payment[key]);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
  }

  return null;
}

function resolveAmount(payment) {
  const possibleAmountKeys = ["amount", "price", "total", "subtotal", "payment_amount"];

  for (const key of possibleAmountKeys) {
    const value = payment[key];

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const numberValue = Number.parseFloat(value);
      if (!Number.isNaN(numberValue)) return numberValue;
    }

    if (value && typeof value === "object") {
      const nestedAmount = value.amount || value.gross || value.net;
      if (typeof nestedAmount === "number") return nestedAmount;
      if (typeof nestedAmount === "string") {
        const parsedNested = Number.parseFloat(nestedAmount);
        if (!Number.isNaN(parsedNested)) return parsedNested;
      }
    }
  }

  return 0;
}

function getNextPage(payload) {
  const nextLink =
    payload?.pagination?.links?.next || payload?.links?.next || payload?.pagination?.next_page;

  if (nextLink && typeof nextLink === "string") {
    return nextLink;
  }

  return null;
}

export async function getMonthlySupportProgress(tebexApiSecret, monthlyOperationsBudget = 0) {
  if (!tebexApiSecret) {
    throw new Error("Tebex API secret is not configured.");
  }

  const { startOfMonth, startOfNextMonth } = getMonthBoundaries();
  const monthStartUnix = Math.floor(startOfMonth.getTime() / 1000);

  let revenue = 0;
  let nextPageUrl = `${TEBEX_PAYMENTS_URL}?begin=${monthStartUnix}`;
  const visitedPages = new Set();

  while (nextPageUrl && !visitedPages.has(nextPageUrl)) {
    visitedPages.add(nextPageUrl);

    const response = await fetch(nextPageUrl, {
      headers: {
        "X-Tebex-Secret": tebexApiSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Tebex API responded with status ${response.status}`);
    }

    const payload = await response.json();
    const payments = extractPayments(payload);

    payments.forEach((payment) => {
      const paymentDate = parsePaymentDate(payment);
      if (!paymentDate) return;

      if (paymentDate >= startOfMonth && paymentDate < startOfNextMonth) {
        revenue += Math.max(0, resolveAmount(payment));
      }
    });

    const nextLink = getNextPage(payload);
    nextPageUrl = nextLink;
  }

  const cleanedRevenue = Number.parseFloat(revenue.toFixed(2));
  const percentageFunded =
    monthlyOperationsBudget > 0
      ? Math.min(100, (cleanedRevenue / monthlyOperationsBudget) * 100)
      : 0;

  return {
    monthlyOperationsBudget,
    currentMonthRevenue: cleanedRevenue,
    percentageFunded: Number.parseFloat(percentageFunded.toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
}
