package dev.anchorlight.zander.auth.config;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;

public record ZanderAuthConfig(String baseApiUrl, String apiKey, String motdTopLine) {
    public static ZanderAuthConfig from(YamlDocument config) {
        return new ZanderAuthConfig(
                config.getString(Route.from("BaseAPIURL")),
                config.getString(Route.from("APIKey")),
                config.getString(Route.from("MOTDTopLine"))
        );
    }
}
