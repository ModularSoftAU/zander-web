/**
 * cron/financeVendorFaviconCron.js
 *
 * Daily cron job (3 AM) that fetches and caches favicons for finance vendors.
 *
 * Targets:
 *   - Active vendors that have a website but no faviconUrl set yet
 *   - Active vendors where faviconFetchedAt is null or older than 7 days
 *
 * Processes in batches of 20 with a 500 ms delay between batches to avoid
 * hammering Google's favicon service.
 */

import cron from "node-cron";
import { prisma } from "../controllers/databaseController.js";
import { fetchAndCacheVendorFavicon } from "../controllers/financeController.js";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;
const FAVICON_REFRESH_DAYS = 7;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshVendorFavicons() {
  console.info("[finance-favicon-cron] Starting vendor favicon refresh...");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - FAVICON_REFRESH_DAYS);

  let vendors;
  try {
    vendors = await prisma.financeVendors.findMany({
      where: {
        isActive: 1,
        website: { not: null },
        OR: [
          { faviconUrl: null },
          { faviconFetchedAt: null },
          { faviconFetchedAt: { lt: sevenDaysAgo } },
        ],
      },
      select: { vendorId: true, name: true, website: true, faviconFetchedAt: true },
      orderBy: { vendorId: "asc" },
    });
  } catch (error) {
    console.error("[finance-favicon-cron] Failed to query vendors:", error);
    return;
  }

  if (vendors.length === 0) {
    console.info("[finance-favicon-cron] No vendors require favicon refresh.");
    return;
  }

  console.info(`[finance-favicon-cron] Found ${vendors.length} vendor(s) to refresh.`);

  // Split into batches
  const batches = [];
  for (let i = 0; i < vendors.length; i += BATCH_SIZE) {
    batches.push(vendors.slice(i, i + BATCH_SIZE));
  }

  let successCount = 0;
  let failCount = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    console.info(`[finance-favicon-cron] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} vendors)...`);

    // Process all vendors in this batch (per-vendor errors don't stop the batch)
    await Promise.all(
      batch.map(async (vendor) => {
        try {
          const faviconUrl = await fetchAndCacheVendorFavicon(vendor.vendorId);
          if (faviconUrl) {
            console.info(`[finance-favicon-cron] ✓ Vendor #${vendor.vendorId} "${vendor.name}" — ${faviconUrl}`);
            successCount++;
          } else {
            console.warn(`[finance-favicon-cron] ✗ Vendor #${vendor.vendorId} "${vendor.name}" — no favicon returned`);
            failCount++;
            // Still record the attempt so we don't retry too soon
            try {
              await prisma.financeVendors.update({
                where: { vendorId: vendor.vendorId },
                data: { faviconFetchedAt: new Date() },
              });
            } catch {
              // Non-critical — ignore update failure
            }
          }
        } catch (error) {
          console.error(`[finance-favicon-cron] Error for vendor #${vendor.vendorId} "${vendor.name}":`, error.message);
          failCount++;
        }
      })
    );

    // Wait between batches (skip delay after the last batch)
    if (batchIndex < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.info(
    `[finance-favicon-cron] Favicon refresh complete. ` +
    `Success: ${successCount}, Failed/skipped: ${failCount}, Total: ${vendors.length}`
  );
}

// Run at 3:00 AM every day
cron.schedule("0 3 * * *", () => {
  refreshVendorFavicons();
});

console.info("[finance-favicon-cron] Scheduled — runs daily at 03:00.");
