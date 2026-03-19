import {
  getCategoriesForUser,
  getRecentDiscussions,
} from "../controllers/forumController.js";

function flattenCategories(categories, result = []) {
  for (const cat of categories) {
    result.push(cat);
    if (cat.children?.length) flattenCategories(cat.children, result);
  }
  return result;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function sitemapRoutes(app, config, features) {
  const rawUrl = config?.siteConfiguration?.siteUrl;
  if (!rawUrl) {
    console.warn("[sitemapRoutes] config.siteConfiguration.siteUrl is not set — sitemap and robots.txt routes will be skipped.");
    return;
  }
  const baseUrl = rawUrl.replace(/\/$/, "");

  app.get("/robots.txt", function (req, res) {
    const lines = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /dashboard/",
      "Disallow: /login",
      "Disallow: /logout",
      "Disallow: /register",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ];
    res.type("text/plain").send(lines.join("\n"));
  });

  app.get("/sitemap.xml", async function (req, res) {
    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/play", priority: "0.8", changefreq: "weekly" },
      { url: "/ranks", priority: "0.7", changefreq: "weekly" },
      { url: "/staff", priority: "0.6", changefreq: "weekly" },
      { url: "/apply", priority: "0.7", changefreq: "weekly" },
      { url: "/watch", priority: "0.7", changefreq: "daily" },
      { url: "/appeal", priority: "0.5", changefreq: "monthly" },
      { url: "/report", priority: "0.5", changefreq: "monthly" },
      { url: "/terms", priority: "0.3", changefreq: "monthly" },
      { url: "/rules", priority: "0.6", changefreq: "monthly" },
      { url: "/privacy", priority: "0.3", changefreq: "monthly" },
      { url: "/refund", priority: "0.3", changefreq: "monthly" },
    ];

    let forumUrls = [];
    try {
      // Empty permissions = anonymous user; only publicly accessible content
      const categories = await getCategoriesForUser([]);
      const flat = flattenCategories(categories);
      const categoryIds = flat.map((c) => c.categoryId);

      for (const cat of flat) {
        forumUrls.push({
          url: `/forums/category/${cat.slug}`,
          priority: "0.6",
          changefreq: "daily",
        });
      }

      if (categoryIds.length) {
        const { discussions } = await getRecentDiscussions({
          categoryIds,
          page: 1,
          perPage: 200,
        });
        for (const d of discussions) {
          const path = d.slug
            ? `/forums/discussion/${d.discussionId}/${d.slug}`
            : `/forums/discussion/${d.discussionId}`;
          forumUrls.push({ url: path, priority: "0.5", changefreq: "weekly" });
        }
      }
    } catch (err) {
      console.error("[SITEMAP] Failed to fetch forum data:", err.message);
    }

    const urlEntries = [...staticPages, ...forumUrls]
      .map(
        ({ url, priority, changefreq }) =>
          `  <url>\n    <loc>${escapeXml(baseUrl + url)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;
    res.type("application/xml").send(xml);
  });
}
