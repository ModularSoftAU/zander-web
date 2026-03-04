import { createRequire } from "module";
const require = createRequire(import.meta.url);
const lang = require("../../lang.json");
import { createRateLimiter } from "../../lib/rateLimiter.js";

// Rate-limit failed token checks to mitigate brute-force attacks on the API key
const failedTokenRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: lang.api.invalidToken,
});

export default async function verifyToken(req, res, done) {
  var token = req.headers["x-access-token"];

  if (!token) {
    // Token not included
    return res.send({
      success: false,
      message: lang.api.noToken,
    });
  }

  if (token === process.env.apiKey) {
    // Passed
    done();
  } else {
    // Token was incorrect — apply rate limiting to prevent brute-force
    await failedTokenRateLimit(req, res);
    if (!res.sent) {
      return res.send({
        success: false,
        message: lang.api.invalidToken,
      });
    }
  }
}
