package dev.anchorlight.zander.auth.events;

import dev.dejvokep.boostedyaml.route.Route;
import org.bukkit.ChatColor;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.server.ServerListPingEvent;

import static dev.anchorlight.zander.auth.ZanderAuthMain.plugin;

public class UserOnServerPing implements Listener {
    @EventHandler
    public void onServerPing(ServerListPingEvent event) {
        String motd = plugin.getYamlConfig().getString(Route.from("MOTDTopLine"));
        event.setMotd(ChatColor.translateAlternateColorCodes('&', motd));
    }
}
