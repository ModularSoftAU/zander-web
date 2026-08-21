package dev.anchorlight.zander.addon.service;

import com.jayway.jsonpath.JsonPath;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import com.google.gson.reflect.TypeToken;
import dev.anchorlight.zander.addon.ZanderAddonMain;
import dev.anchorlight.zander.addon.model.PolicyConfig;
import dev.anchorlight.zander.addon.model.SocialConfig;
import dev.dejvokep.boostedyaml.route.Route;

import java.lang.reflect.Type;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public class PolicyService {
    private final ZanderAddonMain plugin;

    public PolicyService(ZanderAddonMain plugin) {
        this.plugin = plugin;
    }

    public CompletableFuture<PolicyConfig> fetchPolicyUrls() {
        return CompletableFuture.supplyAsync(() -> {
            String apiUrl = plugin.getYamlConfig().getString(Route.from("api-url"));
            try {
                Request req = Request.builder()
                        .setURL(apiUrl + "/api/config/policy")
                        .setMethod(Request.Method.GET)
                        .build();

                Response res = req.execute();
                if (res.getStatusCode() != 200) {
                    throw new RuntimeException("Failed to fetch policy URLs: " + res.getStatusCode());
                }

                String json = res.getBody();
                PolicyConfig config = new PolicyConfig();
                config.setTermsOfService(JsonPath.read(json, "$.data.termsOfService"));
                config.setRules(JsonPath.read(json, "$.data.rules"));
                config.setPrivacy(JsonPath.read(json, "$.data.privacy"));
                config.setRefund(JsonPath.read(json, "$.data.refund"));
                return config;
            } catch (Exception e) {
                plugin.getLogger().severe("Error fetching policy URLs: " + e.getMessage());
                throw new RuntimeException(e);
            }
        });
    }

    public CompletableFuture<String> fetchPolicyContent(String url) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                Request req = Request.builder()
                        .setURL(url)
                        .setMethod(Request.Method.GET)
                        .build();

                Response res = req.execute();
                if (res.getStatusCode() != 200) {
                    throw new RuntimeException("Failed to fetch policy content: " + res.getStatusCode());
                }

                return res.getBody();
            } catch (Exception e) {
                plugin.getLogger().severe("Error fetching policy content: " + e.getMessage());
                throw new RuntimeException(e);
            }
        });
    }

    public CompletableFuture<SocialConfig> fetchSocialLinks() {
        return CompletableFuture.supplyAsync(() -> {
            String apiUrl = plugin.getYamlConfig().getString(Route.from("api-url"));
            try {
                Request req = Request.builder()
                        .setURL(apiUrl + "/api/config/social")
                        .setMethod(Request.Method.GET)
                        .build();

                Response res = req.execute();
                if (res.getStatusCode() != 200) {
                    throw new RuntimeException("Failed to fetch social links: " + res.getStatusCode());
                }

                String json = res.getBody();
                Map<String, Object> responseMap = JsonPath.read(json, "$.data");

                SocialConfig config = new SocialConfig();
                Map<String, String> platforms = new java.util.HashMap<>();
                for (Map.Entry<String, Object> entry : responseMap.entrySet()) {
                    platforms.put(entry.getKey(), String.valueOf(entry.getValue()));
                }
                config.setPlatforms(platforms);
                return config;
            } catch (Exception e) {
                plugin.getLogger().severe("Error fetching social links: " + e.getMessage());
                throw new RuntimeException(e);
            }
        });
    }
}
