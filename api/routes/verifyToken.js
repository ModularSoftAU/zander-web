import lang from "../../lang.json" assert { type: "json" };

export default function verifyToken(req, res, done) {
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
    // Token was incorrect.
    return res.send({
      success: false,
      message: lang.api.invalidToken,
    });
  }
}
