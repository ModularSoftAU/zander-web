package dev.anchorlight.zander.addon.api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import dev.anchorlight.zander.addon.ZanderAddonMain;
import dev.dejvokep.boostedyaml.route.Route;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class PolicyApiServer {
    private final ZanderAddonMain plugin;
    private HttpServer server;
    private final Gson gson = new Gson();

    public PolicyApiServer(ZanderAddonMain plugin) {
        this.plugin = plugin;
    }

    public void start() {
        int port = plugin.getYamlConfig().getInt(Route.from("api-server", "port"), 8080);
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/api/config/policy", new PolicyHandler());
            server.createContext("/api/config/social", new SocialHandler());
            server.setExecutor(null); // creates a default executor
            server.start();
            plugin.getLogger().info("API Server started on port " + port);
        } catch (IOException e) {
            plugin.getLogger().severe("Could not start API Server: " + e.getMessage());
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            plugin.getLogger().info("API Server stopped.");
        }
    }

    private class PolicyHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                return;
            }

            JsonObject data = new JsonObject();
            data.addProperty("termsOfService", "https://raw.githubusercontent.com/craftingforchrist/Legal/master/terms.md");
            data.addProperty("rules", "https://raw.githubusercontent.com/craftingforchrist/Legal/master/rules.md");
            data.addProperty("privacy", "https://raw.githubusercontent.com/craftingforchrist/Legal/master/privacy.md");
            data.addProperty("refund", "https://raw.githubusercontent.com/craftingforchrist/Legal/master/refund.md");

            JsonObject response = new JsonObject();
            response.addProperty("success", true);
            response.add("data", data);

            String jsonResponse = gson.toJson(response);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, jsonResponse.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(jsonResponse.getBytes());
            os.close();
        }
    }

    private class SocialHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            JsonObject data = new JsonObject();
            data.addProperty("discord", "https://discord.gg/fGWNchS");
            data.addProperty("facebook", "https://www.facebook.com/craft4christ/");
            data.addProperty("twitter", "https://twitter.com/craft4christmc");
            data.addProperty("instagram", "https://instagram.com/craftingforchrist");
            data.addProperty("twitch", "https://www.twitch.tv/craftingforchrist");
            data.addProperty("youtube", "https://www.youtube.com/channel/UCeijz6MNnya85LprMjPmYag");
            data.addProperty("linkedin", "https://www.linkedin.com/company/68885022/");
            data.addProperty("tiktok", "https://www.tiktok.com/@craftingforchrist");

            JsonObject response = new JsonObject();
            response.addProperty("success", true);
            response.add("data", data);

            String jsonResponse = gson.toJson(response);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, jsonResponse.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(jsonResponse.getBytes());
            os.close();
        }
    }
}
