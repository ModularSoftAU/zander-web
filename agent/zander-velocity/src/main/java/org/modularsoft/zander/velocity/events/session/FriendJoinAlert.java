package org.modularsoft.zander.velocity.events.session;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.ServerPostConnectEvent;
import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.util.api.FriendService;
import org.modularsoft.zander.velocity.util.messaging.VanishStatusResolver;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Tells a player's friends when they join the network.
 *
 * <p>This deliberately does NOT listen on {@code PostLoginEvent}: that fires
 * before PremiumVanish restores a returning staff member's vanish state (the
 * same hazard HubPlayerJoin warns about). Instead it hooks
 * {@link ServerPostConnectEvent} with {@code previousServer == null} (a fresh
 * proxy join, never a server switch), waits a few seconds, then re-checks vanish
 * immediately before sending.</p>
 *
 * <p>Suppressed for: vanished joiners, any block relationship, and friends whose
 * {@code notifyFriendJoin} is off. The whole thing is gated on
 * {@link VanishStatusResolver#isPresenceSafe()} — if vanish state can't be
 * trusted, nothing is published.</p>
 *
 * <p>By default unvanishing does not retro-fire an alert. {@code VanishReporter}
 * calls {@link #announce(Player)} on an unvanish transition only when
 * {@code FriendsJoinAlertsOnUnvanish} is enabled in config (default false).</p>
 */
public class FriendJoinAlert {

    private static final long DELAY_SECONDS = 3;

    @Subscribe
    public void onServerPostConnect(ServerPostConnectEvent event) {
        // Only a first connection to the proxy — a server switch has a previous server.
        if (event.getPreviousServer() != null) {
            return;
        }
        if (!joinAlertsEnabled()) {
            return;
        }
        // If we can't determine vanish state at all, publish nothing.
        if (!VanishStatusResolver.isPresenceSafe()) {
            return;
        }

        final Player joiner = event.getPlayer();

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            // The player may have left during the delay.
            Optional<Player> stillOn = ZanderVelocityMain.getProxy().getPlayer(joiner.getUniqueId());
            if (stillOn.isEmpty()) {
                return;
            }
            // Re-check vanish right before sending, regardless of the delay.
            announce(stillOn.get());
        }).delay(DELAY_SECONDS, TimeUnit.SECONDS).schedule();
    }

    public static boolean joinAlertsEnabled() {
        return ZanderVelocityMain.getConfig().getBoolean(Route.from("FriendsJoinAlerts"), true);
    }

    /**
     * Broadcast "<joiner> joined the network." to the joiner's online friends,
     * applying every suppression rule. Safe to call from any thread; performs a
     * final vanish re-check itself. Shared by the join listener and the
     * opt-in unvanish path in VanishReporter.
     */
    public static void announce(Player joiner) {
        if (joiner == null || !joinAlertsEnabled()) {
            return;
        }
        if (!VanishStatusResolver.isPresenceSafe() || VanishStatusResolver.isVanished(joiner)) {
            return;
        }

        try {
            FriendService fs = ZanderVelocityMain.getFriendService();
            List<String> friendNames = fs.getFriends(joiner.getUniqueId()); // fail-open
            if (friendNames.isEmpty()) {
                return;
            }
            Set<String> friendSet = friendNames.stream()
                    .map(n -> n.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toSet());

            for (Player recipient : ZanderVelocityMain.getProxy().getAllPlayers()) {
                if (recipient.getUniqueId().equals(joiner.getUniqueId())) {
                    continue;
                }
                if (!friendSet.contains(recipient.getUsername().toLowerCase(Locale.ROOT))) {
                    continue;
                }

                // Their preference. Missing settings -> fail closed, no alert.
                Optional<FriendService.Settings> prefs = fs.getSettings(recipient.getUniqueId());
                if (prefs.isEmpty() || !prefs.get().notifyFriendJoin()) {
                    continue;
                }

                // Block relationship either way -> no alert. isBlocked fails closed.
                if (fs.isBlocked(recipient.getUniqueId(), joiner.getUsername())
                        || fs.isBlocked(joiner.getUniqueId(), recipient.getUsername())) {
                    continue;
                }

                recipient.sendMessage(Component.text(joiner.getUsername() + " joined the network.")
                        .color(NamedTextColor.GREEN));
            }
        } catch (Exception e) {
            ZanderVelocityMain.getLogger().warn("[friends] join alert failed for "
                    + joiner.getUsername(), e);
        }
    }
}
