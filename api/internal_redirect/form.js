import { hasPermission, postAPIRequest, setBannerCookie } from "../common.js";
import { hasPermission as hasPermissionNode } from "../../lib/discord/permissions.mjs";
import { getFormById } from "../../controllers/formController.js";

export default function formRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/forms";

  const userHasFormPermission = (slug, permissions = []) => {
    if (!slug) return false;
    const formNode = `zander.web.forms.${slug}`;
    return (
      hasPermissionNode(permissions, formNode) ||
      hasPermissionNode(permissions, "zander.web.forms.*")
    );
  };

  const requireFormPermissionById = async (formId, req, res) => {
    const form = await getFormById(formId);
    if (!form) {
      setBannerCookie("danger", "Form not found.", res);
      res.redirect(`${process.env.siteAddress}/dashboard/forms`);
      return false;
    }
    if (!userHasFormPermission(form.slug, req.session.user?.permissions)) {
      setBannerCookie("danger", "You do not have permission to manage this form.", res);
      res.redirect(`${process.env.siteAddress}/dashboard/forms`);
      return false;
    }
    return true;
  };

  // ─── Create form ───
  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!(await hasPermission("zander.web.forms", req, res))) return;

    req.body.actioningUser = req.session.user.userId;

    // Parse blocks from form data if provided as JSON string
    if (req.body.blocksJson) {
      try {
        req.body.blocks = JSON.parse(req.body.blocksJson);
      } catch (_) {
        req.body.blocks = [];
      }
    }

    // Handle checkbox values (come as "on" or undefined from forms)
    req.body.postToForumEnabled = req.body.postToForumEnabled === "on" || req.body.postToForumEnabled === "1";
    req.body.webhookEnabled = req.body.webhookEnabled === "on" || req.body.webhookEnabled === "1";
    req.body.submitterCanView = req.body.submitterCanView === "on" || req.body.submitterCanView === "1";
    req.body.requireLogin = req.body.requireLogin === "on" || req.body.requireLogin === "1";

    postAPIRequest(
      `${process.env.siteAddress}/api/forms/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);
    return res;
  });

  // ─── Edit form ───
  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!(await hasPermission("zander.web.forms", req, res))) return;
    if (!(await requireFormPermissionById(req.body.formId, req, res))) return;

    req.body.actioningUser = req.session.user.userId;

    if (req.body.blocksJson) {
      try {
        req.body.blocks = JSON.parse(req.body.blocksJson);
      } catch (_) {
        req.body.blocks = [];
      }
    }

    req.body.postToForumEnabled = req.body.postToForumEnabled === "on" || req.body.postToForumEnabled === "1";
    req.body.webhookEnabled = req.body.webhookEnabled === "on" || req.body.webhookEnabled === "1";
    req.body.submitterCanView = req.body.submitterCanView === "on" || req.body.submitterCanView === "1";
    req.body.requireLogin = req.body.requireLogin === "on" || req.body.requireLogin === "1";

    postAPIRequest(
      `${process.env.siteAddress}/api/forms/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);
    return res;
  });

  // ─── Delete form ───
  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!(await hasPermission("zander.web.forms", req, res))) return;
    if (!(await requireFormPermissionById(req.body.formId, req, res))) return;

    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/forms/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);
    return res;
  });

  // ─── Publish / unpublish form ───
  app.post(baseEndpoint + "/publish", async function (req, res) {
    if (!(await hasPermission("zander.web.forms", req, res))) return;
    if (!(await requireFormPermissionById(req.body.formId, req, res))) return;

    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/forms/publish`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);
    return res;
  });

  // ─── Update response status ───
  app.post(baseEndpoint + "/response/status", async function (req, res) {
    if (!(await hasPermission("zander.web.forms", req, res))) return;
    if (!(await requireFormPermissionById(req.body.formId, req, res))) return;

    req.body.actioningUser = req.session.user.userId;
    const formId = req.body.formId;

    postAPIRequest(
      `${process.env.siteAddress}/api/forms/response/status`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms/${formId}/responses`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms/${formId}/responses`);
    return res;
  });
}
