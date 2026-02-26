import { createRequire } from "module";
const require = createRequire(import.meta.url);
const lang = require("../../lang.json");

export default function verifyToken(req, res, done) {
  var token = req.headers["x-access-token"];

  if (!token) {
    // Token not included
    res.send({
      success: false,
      message: lang.api.noToken,
    }); return;
  }

  if (token === process.env.apiKey) {
    // Passed
    done();
  } else {
    // Token was incorrect.
    res.send({
      success: false,
      message: lang.api.invalidToken,
    }); return;
  }
}
