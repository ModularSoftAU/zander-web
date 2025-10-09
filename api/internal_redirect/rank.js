import fetch from "node-fetch";

function ensureRankPermission(req, res) {
  const permissions = req.session?.user?.permissions;

  if (!Array.isArray(permissions)) {
    res.code(401).send({
      success: false,
      message: "You must be signed in to manage ranks.",
    });
    return false;
  }

  if (!permissions.includes("zander.web.rank")) {
    res.code(403).send({
      success: false,
      message: "You do not have permission to manage ranks.",
    });
    return false;
  }

  return true;
}

async function forwardJson(path, options = {}) {
  const { method = "POST", body = {} } = options;

  const response = await fetch(`${process.env.siteAddress}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-access-token": process.env.apiKey,
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

  const data = await response.json();
  return { data, status: response.status };
}

export default function rankRedirectRoute(app) {
  const baseEndpoint = "/redirect/rank";

  app.post(`${baseEndpoint}/config/save`, async function (req, res) {
    if (!ensureRankPermission(req, res)) return;

    const { rankSlug, ...payload } = req.body || {};

    if (!rankSlug) {
      return res.code(400).send({
        success: false,
        message: "Rank slug is required.",
      });
    }

    payload.actor = req.session?.user?.username || null;

    try {
      const { data } = await forwardJson(
        `/api/rank/config/${encodeURIComponent(rankSlug)}`,
        { method: "POST", body: payload }
      );

      res.code(data.success ? 200 : 400).send(data);
    } catch (error) {
      res.code(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/config/reset`, async function (req, res) {
    if (!ensureRankPermission(req, res)) return;

    const { rankSlug } = req.body || {};

    if (!rankSlug) {
      return res.code(400).send({
        success: false,
        message: "Rank slug is required.",
      });
    }

    try {
      const { data } = await forwardJson(
        `/api/rank/config/${encodeURIComponent(rankSlug)}/reset`,
        { method: "POST", body: {} }
      );

      res.code(data.success ? 200 : 400).send(data);
    } catch (error) {
      res.code(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/user/lookup`, async function (req, res) {
    if (!ensureRankPermission(req, res)) return;

    const { username } = req.body || {};

    if (!username) {
      return res.code(400).send({
        success: false,
        message: "Username is required.",
      });
    }

    try {
      const { data } = await forwardJson(
        `/api/rank/user?username=${encodeURIComponent(username)}`,
        { method: "GET" }
      );

      res.code(data.success ? 200 : 400).send(data);
    } catch (error) {
      res.code(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/user/assign`, async function (req, res) {
    if (!ensureRankPermission(req, res)) return;

    const payload = req.body || {};

    if (!payload.username || !payload.rankSlug) {
      return res.code(400).send({
        success: false,
        message: "Username and rankSlug are required.",
      });
    }

    payload.actor = req.session?.user?.username || null;

    try {
      const { data } = await forwardJson(`/api/rank/user/assign`, {
        method: "POST",
        body: payload,
      });

      res.code(data.success ? 200 : 400).send(data);
    } catch (error) {
      res.code(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/user/remove`, async function (req, res) {
    if (!ensureRankPermission(req, res)) return;

    const payload = req.body || {};

    if (!payload.username || !payload.rankSlug) {
      return res.code(400).send({
        success: false,
        message: "Username and rankSlug are required.",
      });
    }

    try {
      const { data } = await forwardJson(`/api/rank/user/remove`, {
        method: "POST",
        body: payload,
      });

      res.code(data.success ? 200 : 400).send(data);
    } catch (error) {
      res.code(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/user/check-permission`, async function (req, res) {
    if (!ensureRankPermission(req, res)) return;

    const payload = req.body || {};

    if (!payload.username || !payload.permission) {
      return res.code(400).send({
        success: false,
        message: "Username and permission are required.",
      });
    }

    try {
      const { data } = await forwardJson(
        `/api/rank/user/permission/check`,
        { method: "POST", body: payload }
      );

      res.code(data.success ? 200 : 400).send(data);
    } catch (error) {
      res.code(500).send({ success: false, message: `${error}` });
    }
  });
}
