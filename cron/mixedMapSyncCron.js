import cron from "node-cron";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

if (features.mixed && config.mixed?.mapSync?.enabled) {
  const schedule = config.mixed.mapSync.cronSchedule || "0 * * * *";
  if (cron.validate(schedule)) {
    cron.schedule(schedule, async () => {
      try {
        const { syncAll } = await import("../services/mixed/mixedMapRepoSyncService.js");
        const summary = await syncAll({ triggeredBy: "cron" });
        console.info(`[mixed:mapSyncCron] status=${summary.status} found=${summary.summary.mapsFound} created=${summary.summary.mapsCreated} updated=${summary.summary.mapsUpdated} conflicts=${summary.summary.conflictsFound}`);
      } catch (err) {
        console.error("[mixed:mapSyncCron] sync failed:", err?.message || err);
      }
    });
  } else {
    console.error(`[mixed:mapSyncCron] invalid cronSchedule "${schedule}" — cron not registered.`);
  }
}
