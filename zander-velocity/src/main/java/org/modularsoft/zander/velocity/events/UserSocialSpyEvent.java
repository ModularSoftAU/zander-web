package org.modularsoft.zander.velocity.events;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ServerConnection;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.discord.spy.DiscordSocialSpy;
import org.slf4j.Logger;

import java.util.Arrays;
import java.util.Optional;

public class UserSocialSpyEvent {

    private static final Logger logger = ZanderVelocityMain.getLogger();

    @Subscribe
    public void onUserChatDMEvent(CommandExecuteEvent event) {
        // Ensure the command source is a player
        if (!(event.getCommandSource() instanceof Player)) {
            return;
        }

        Player player = (Player) event.getCommandSource();
        String command = event.getCommand();

        logger.info("Command: {}", command);

        // Check if the command is a direct message command
        if (command.contains("msg") || command.contains("tell") || command.contains("w")
                || command.contains("message") || command.contains("r")) {

            // Split the command into parts and check for minimum required arguments
            String[] commandParts = command.split(" ");
            if (commandParts.length < 3) {
                logger.warn("Invalid direct message format from player: {}", player.getUsername());
                return; // Invalid command format, return without processing
            }

            String targetPlayer = commandParts[1]; // The player who is being messaged
            String directMessage = String.join(" ", Arrays.copyOfRange(commandParts, 2, commandParts.length)); // The actual message

            try {
                // Ensure the player is connected to a server
                Optional<ServerConnection> currentServerOpt = player.getCurrentServer();
                if (currentServerOpt.isEmpty()) {
                    logger.warn("Player {} is not connected to any server", player.getUsername());
                    return; // Player is not connected to a server, return early
                }

                ServerConnection currentServer = currentServerOpt.get();

                // Construct the social spy object
                DiscordSocialSpy socialSpy = DiscordSocialSpy.builder()
                        .usernameFrom(player.getUsername())
                        .usernameTo(targetPlayer)
                        .directMessage(directMessage)
                        .server(currentServer.getServerInfo().getName())
                        .build();

                // Fetch API URL and key
                String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
                String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

                // Send the social spy request to the API
                Request socialSpyReq = Request.builder()
                        .setURL(BaseAPIURL + "/discord/spy/directMessage")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", APIKey)
                        .setRequestBody(socialSpy.toString()) // Ensure proper serialization to JSON
                        .build();

                Response socialSpyRes = socialSpyReq.execute();
                logger.info("Social Spy Response ({}): {}", socialSpyRes.getStatusCode(), socialSpyRes.getBody());

            } catch (Exception e) {
                logger.error("Error occurred while handling social spy request", e);
                player.sendMessage(Component.text("An error occurred, but you can continue playing.").color(NamedTextColor.RED));
            }
        }
    }
}