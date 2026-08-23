package org.modularsoft.zander.velocity.events;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
<<<<<<< HEAD
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.discord.spy.DiscordCommandSpy;
import org.slf4j.Logger;

import java.util.Set;

public class UserCommandSpyEvent {

    private static final Logger logger = ZanderVelocityMain.getLogger();

    // Commands that carry private message content and must not be logged
    private static final Set<String> DM_COMMANDS = Set.of(
            "msg", "tell", "w", "message", "m", "whisper", "t", "r", "reply"
    );

=======
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.discord.spy.DiscordCommandSpy;

public class UserCommandSpyEvent {

>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
    @Subscribe
    public void onPlayerCommand(CommandExecuteEvent event) {
        // Ensure the command source is a player
        if (!(event.getCommandSource() instanceof Player)) {
            return;
        }

        Player player = (Player) event.getCommandSource();
<<<<<<< HEAD
        String command = event.getCommand();

        // Extract the command name (first word) for exact matching
        String commandName = command.split(" ", 2)[0].toLowerCase();

        // Skip DM commands to avoid logging sensitive content
        if (DM_COMMANDS.contains(commandName)) {
            return;
        }

        logger.info("Command spy: {} executed /{}", player.getUsername(), commandName);

        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));
        String server = player.getCurrentServer()
                .map(conn -> conn.getServer().getServerInfo().getName())
                .orElse("unknown");

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            try {
                DiscordCommandSpy commandSpy = DiscordCommandSpy.builder()
                        .username(player.getUsername())
                        .command(command)
                        .server(server)
                        .build();

                Request commandSpyReq = Request.builder()
                        .setURL(BaseAPIURL + "/discord/spy/command")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", String.valueOf(APIKey))
                        .setRequestBody(commandSpy.toString())
                        .build();

                Response commandSpyRes = commandSpyReq.execute();
                logger.info("Response (" + commandSpyRes.getStatusCode() + "): " + commandSpyRes.getBody());
            } catch (Exception e) {
                logger.error("Error sending command spy event for player {}", player.getUsername(), e);
            }
        }).schedule();
    }

}
=======
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));
        String command = event.getCommand(); // Get the full command

        ZanderVelocityMain.getLogger().info("Command: {}", command);

        // Check if the command is one we need to log (ignore direct message commands)
        if (command.startsWith("msg") || command.startsWith("tell") || command.startsWith("w")
                || command.startsWith("message") || command.startsWith("r")) {
            return;
        }

        //
        // Command Spy API POST
        //
        try {
            DiscordCommandSpy commandSpy = DiscordCommandSpy.builder()
                    .username(player.getUsername())
                    .command(command)
                    .server(player.getCurrentServer().get().getServer().getServerInfo().getName())
                    .build();

            Request commandSpyReq = Request.builder()
                    .setURL(BaseAPIURL + "/discord/spy/command")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", String.valueOf(APIKey))
                    .setRequestBody(commandSpy.toString())
                    .build();

            Response commandSpyRes = commandSpyReq.execute();
            ZanderVelocityMain.getLogger().info("Response (" + commandSpyRes.getStatusCode() + "): " + commandSpyRes.getBody());
        } catch (Exception e) {
            Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
            player.disconnect(builder);
            System.out.println(e);
        }
    }
}
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
