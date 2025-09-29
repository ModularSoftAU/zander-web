import crypto from "crypto";

function formatDurationNs(durationNs) {
  return Number(durationNs) / 1e6;
}

export function obfuscateValue(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function createAuthFlowLogger(req, action, context = {}) {
  const start = process.hrtime.bigint();
  const baseContext = {
    action,
    requestId: req.id,
    ip: req.ip,
    source: "web-session",
    ...context,
  };
  const log = req.log.child(baseContext);
  log.info({ event: "start" }, `${action} flow started`);
  let finished = false;

  function finish(status, extra = {}) {
    if (finished) return;
    finished = true;
    const durationMs = formatDurationNs(process.hrtime.bigint() - start);
    log.info({ event: "finish", status, durationMs, ...extra }, `${action} flow completed`);
  }

  function step(stepName, extra = {}) {
    log.debug({ event: "step", step: stepName, ...extra }, `${action} step: ${stepName}`);
  }

  return { log, finish, step };
}
