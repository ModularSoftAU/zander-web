import cron from "node-cron";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

if (features.mixed) {
  const maxAgeMinutes = config.mixed?.staleMatch?.maxAgeMinutes ?? 180;
  const schedule = config.mixed?.staleMatch?.cronSchedule || "*/15 * * * *";
  if (cron.validate(schedule)) {
    cron.schedule(schedule, async () => {
      try {
        const { closeStaleMatches } = await import("../controllers/mixedController.js");
        const closed = await closeStaleMatches(maxAgeMinutes);
        if (closed > 0) {
          console.info(`[mixed:matchStaleCron] closed ${closed} stale match(es) (maxAgeMinutes=${maxAgeMinutes})`);
        }
      } catch (err) {
        console.error("[mixed:matchStaleCron] failed:", err?.message || err);
      }
    });
  } else {
    console.error(`[mixed:matchStaleCron] invalid cronSchedule "${schedule}" — cron not registered.`);
  }
}
