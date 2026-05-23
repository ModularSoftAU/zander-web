/**
 * admin/adminHelpers.js
 *
 * Shared utilities called from dashboard route handlers to populate the
 * common view-data that every admin layout partial expects.
 */

import { getMenuGroups } from "./pageRegistry.js";

/**
 * Build the base data object that every admin view needs alongside its own
 * page-specific data.  Spread this into your view() call:
 *
 *   const base = adminViewData(req, features);
 *   await app.view("dashboard/announcements/announcements-list", {
 *     ...base,
 *     pageTitle: "Announcements",
 *     config,
 *     features,
 *     req,
 *     apiData: rows,
 *   });
 *
 * @param {FastifyRequest} req       – Fastify request (needs req.session.user)
 * @param {object}         features  – parsed features.json object
 * @returns {{ adminMenuGroups: object[], adminCurrentPath: string }}
 */
export function adminViewData(req, features) {
  const userPermissions = req.session?.user?.permissions ?? [];
  const groups = getMenuGroups(userPermissions, features);
  console.log(
    `[adminViewData] url=${req.url} perms=${Array.isArray(userPermissions) ? userPermissions.length : typeof userPermissions} groups=${groups.map(g => g.group + ':' + g.items.length).join(', ')}`
  );
  if (Array.isArray(userPermissions)) {
    const financePerms = userPermissions.filter(p => p && String(p).toLowerCase().includes('finance'));
    const webstorePerms = userPermissions.filter(p => p && String(p).toLowerCase().includes('webstore'));
    console.log(`[adminViewData] finance-related perms: [${financePerms.join(', ')}]`);
    console.log(`[adminViewData] webstore-related perms: [${webstorePerms.join(', ')}]`);
    console.log(`[adminViewData] features.finance=${features.finance} features.webstore=${features.webstore}`);
  }
  return {
    adminMenuGroups: groups,
    adminCurrentPath: req.url.split("?")[0],
  };
}
