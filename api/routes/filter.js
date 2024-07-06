import { expandString, isFeatureEnabled, required } from "../common";
import filter from "../../filter.json" assert { type: "json" };
import fetch from "node-fetch";

export default function filterApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/filter";

  app.post(baseEndpoint, async function (req, res) {
    if (!features.filter.phrase && !features.filter.link)
      return isFeatureEnabled(false, res, lang);

    const message = required(req.body, "content", res);

    try {
      const profanityResponse = await fetch(`https://vector.profanity.dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const profanityData = await profanityResponse.json();
      console.log(profanityData);

      const containsProhibitedLink = filter.links.some((link) => message.includes(link));      
      if (profanityData.isProfanity || containsProhibitedLink) {
        return res.send({
          success: false,
          message: lang.filter.phraseCaught,
        });
      } else {
        return res.send({
          success: true
        });
      }     
    } catch (error) {
      console.log(error);

      return res.send({
        success: false,
        message: `There were issues checking this.`,
      });
    }
  });
}
