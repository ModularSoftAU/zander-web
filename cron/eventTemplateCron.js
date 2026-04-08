/**
 * Event Template Draft Generation Cron
 * Runs every hour. Checks for active templates whose nextGenerateAt has passed
 * and generates draft events for review.
 */

import cron from "node-cron";
import {
  getTemplatesDueForGeneration,
  generateDraftFromTemplate,
  computeNextEventDate,
  markTemplateGenerated,
} from "../services/eventTemplateService.js";

const eventTemplateCronTask = cron.schedule("0 * * * *", async () => {
  try {
    const templates = await getTemplatesDueForGeneration();

    if (templates.length === 0) return;

    console.log(`[EventTemplateCron] Found ${templates.length} templates due for draft generation`);

    for (const template of templates) {
      try {
        const nextEventDate = computeNextEventDate(template);

        if (!nextEventDate) {
          console.warn(`[EventTemplateCron] Could not compute next event date for template #${template.templateId}`);
          continue;
        }

        const event = await generateDraftFromTemplate(template, nextEventDate, null, "System (Template)");

        await markTemplateGenerated(template.templateId);

        console.log(
          `[EventTemplateCron] Generated draft event #${event.eventId} "${event.title}" from template #${template.templateId}`
        );
      } catch (err) {
        console.error(`[EventTemplateCron] Failed to generate draft for template #${template.templateId}:`, err.message);
      }
    }
  } catch (error) {
    console.error("[EventTemplateCron] Error:", error);
  }
});

eventTemplateCronTask.start();
