package org.modularsoft.zander.velocity.util.announcement;

import com.jayway.jsonpath.JsonPath;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

<<<<<<< HEAD
=======
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
import java.util.concurrent.TimeUnit;

public class TipChatter {

    // Initialize the logger
    private static final Logger logger = LoggerFactory.getLogger(TipChatter.class);

    public static void startAnnouncementTipTask() {
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));
        String announcementTipPrefix = ZanderVelocityMain.getConfig().getString(Route.from("announcementTipPrefix"));
<<<<<<< HEAD
        int interval = ZanderVelocityMain.getConfig().getInt(Route.from("announcementTipInterval"));

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
=======

        // Create a ScheduledExecutorService with a single thread
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        // Schedule the task to run every 10 seconds
        scheduler.scheduleAtFixedRate(() -> {
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
            try {
                // GET request to fetch Announcement Tip.
                Request req = Request.builder()
                        .setURL(BaseAPIURL + "/announcement/get?announcementType=tip")
                        .setMethod(Request.Method.GET)
                        .addHeader("x-access-token", APIKey)
                        .build();

                Response res = req.execute();
                String json = res.getBody();

                String colourMessageFormat = JsonPath.read(json, "$.data[0].colourMessageFormat");
                String link = JsonPath.read(json, "$.data[0].link");

                // Log the color message format and link
                logger.info("Announcement Tip: {}", colourMessageFormat);
                logger.info("Link: {}", link);
                logger.info("JSON: {}", json);

                // Broadcast the message to all online players
                ZanderVelocityMain.getProxy().getAllPlayers().forEach(player -> {
                    // Send the message to each player
                    char translate = '&';
                    Component message = LegacyComponentSerializer.legacy(translate).deserialize(announcementTipPrefix + " " + colourMessageFormat);

                    if (link != null && !link.isEmpty()) {
                        // Set the click event and reassign the modified message to the variable
                        message = message.clickEvent(ClickEvent.clickEvent(ClickEvent.Action.OPEN_URL, link));
                    }
                    player.sendMessage(message);
                });
            } catch (Exception e) {
                // Handle exceptions here
                logger.error("Announcement Tip Failed, will try again later.", e);
<<<<<<< HEAD
                System.out.println("Announcement Tip Failed, will try again in " + interval + " minutes.");
            }
        }).repeat(interval, TimeUnit.MINUTES).schedule();
    }
}
=======
                System.out.println("Announcement Tip Failed, will try again in " + ZanderVelocityMain.getConfig().getString(Route.from("announcementTipInterval")) + " minutes.");
            }
        }, 0, ZanderVelocityMain.getConfig().getInt(Route.from("announcementTipInterval")), TimeUnit.MINUTES);
    }
}
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
